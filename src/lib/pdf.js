import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { fmt, fmtDate } from './utils'

// Datos de la empresa (editar aquí si cambian)
const EMPRESA = {
  nombre: 'Deluxe',
  subtitulo: 'Accesorios para Carros',
  nit: '',        // opcional
  telefono: '',   // opcional
  direccion: '',  // opcional
}

// Colores de marca FactuPro (azul celeste + negro + gris), con semántica de estado igual que en la app
const BRAND = [14, 165, 233]        // #0EA5E9 — acento principal
const BRAND_DARK = [3, 105, 161]    // #0369A1
const BRAND_LIGHT = [224, 242, 254] // #E0F2FE
const INK = [11, 15, 20]            // #0B0F14 — igual que el sidebar
const GRAY = [100, 116, 139]        // #64748B
const DARK = [15, 23, 42]           // #0F172A — texto principal
const GREEN_DARK = [15, 110, 86]    // #0F6E56 — pagado (semántico, igual que la app)
const AMBER = [146, 64, 0]          // #924000 — pendiente (semántico, igual que la app)
const AMBER_LIGHT = [250, 238, 218] // #FAEEDA
const SLATE = [71, 85, 105]         // #475569 — header de tablas secundarias
const SLATE_SOFT = [241, 245, 249]  // #F1F5F9 — filas alternas
const LINE = [226, 232, 240]        // #E2E8F0 — bordes suaves

// Dibuja un titulo de seccion con barrita de acento (mismo lenguaje visual de la app)
function tituloSeccion(doc, texto, y, color = BRAND) {
  doc.setFillColor(...color)
  doc.roundedRect(14, y - 4, 1.4, 5, .7, .7, 'F')
  doc.setTextColor(...DARK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(texto, 18.5, y)
}

function header(doc, titulo) {
  doc.setFillColor(...INK)
  doc.rect(0, 0, 216, 28, 'F')
  doc.setFillColor(...BRAND)
  doc.rect(0, 27, 216, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(EMPRESA.nombre, 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(200, 210, 220)
  doc.text(EMPRESA.subtitulo, 14, 20)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(titulo, 202, 16, { align: 'right' })
}

function footer(doc) {
  const h = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.5)
  doc.line(14, h - 18, 202, h - 18)
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  const partes = [EMPRESA.nombre]
  if (EMPRESA.nit) partes.push('NIT ' + EMPRESA.nit)
  if (EMPRESA.telefono) partes.push('Tel ' + EMPRESA.telefono)
  if (EMPRESA.direccion) partes.push(EMPRESA.direccion)
  doc.text(partes.join('  |  '), 108, h - 12, { align: 'center' })
}

// ─── PDF 1: Factura individual ───
export function generarFacturaPDF({ factura, cliente, items, totalPagado, pagos }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  header(doc, 'FACTURA')

  // Info factura
  doc.setTextColor(...DARK)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Factura No. ${factura.numero}`, 14, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  doc.text(`Fecha de emision: ${fmtDate(factura.fecha_emision)}`, 14, 46)
  doc.text(`Fecha de vencimiento: ${fmtDate(factura.fecha_vencimiento)}`, 14, 51)

  // Cliente — todas las lineas de info disponibles
  const infoLines = []
  if (cliente?.nit) infoLines.push(`NIT: ${cliente.nit}`)
  if (cliente?.telefono) infoLines.push(`Tel: ${cliente.telefono}`)
  if (cliente?.email) infoLines.push(`Email: ${cliente.email}`)
  if (cliente?.direccion) infoLines.push(`Dir: ${cliente.direccion}`)

  const clienteBoxHeight = Math.max(24, 17 + infoLines.length * 4.4)
  doc.setFillColor(...BRAND_LIGHT)
  doc.roundedRect(120, 34, 82, clienteBoxHeight, 2, 2, 'F')
  doc.setTextColor(...BRAND_DARK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENTE', 124, 40)
  doc.setTextColor(...DARK)
  doc.setFontSize(10)
  doc.text(cliente?.nombre || '—', 124, 46)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  let cy = 51
  infoLines.forEach(line => {
    doc.text(line, 124, cy, { maxWidth: 74 })
    cy += 4.4
  })

  // Tabla de items — el inicio se ajusta si el recuadro de cliente crecio
  const itemsStartY = Math.max(66, 34 + clienteBoxHeight + 10)
  tituloSeccion(doc, 'Detalle de productos', itemsStartY - 2)

  const rows = (items || []).map(i => [
    i.descripcion,
    String(Number(i.cantidad)),
    fmt(i.precio_unitario),
    fmt(Number(i.cantidad) * Number(i.precio_unitario)),
  ])

  autoTable(doc, {
    startY: itemsStartY + 3,
    head: [['Descripcion', 'Cant.', 'Precio unit.', 'Subtotal']],
    body: rows.length ? rows : [['(Sin detalle de items)', '', '', fmt(factura.monto)]],
    theme: 'striped',
    headStyles: {
      fillColor: BRAND, textColor: 255, fontStyle: 'bold', fontSize: 8.5,
      cellPadding: { top: 3.8, bottom: 3.8, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 9, textColor: DARK, lineWidth: 0,
      cellPadding: { top: 3.4, bottom: 3.4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 88 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })

  // Totales — tarjeta con fondo suave
  const y = doc.lastAutoTable.finalY + 10
  const saldo = Number(factura.monto) - Number(totalPagado || 0)

  doc.setFillColor(...SLATE_SOFT)
  doc.roundedRect(118, y - 5, 84, 22, 3, 3, 'F')

  doc.setFontSize(9.5)
  doc.setTextColor(...SLATE)
  doc.setFont('helvetica', 'normal')
  doc.text('Total factura', 124, y + 1)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(fmt(factura.monto), 197, y + 1, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE)
  doc.text('Pagado', 124, y + 8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN_DARK)
  doc.text(fmt(totalPagado || 0), 197, y + 8, { align: 'right' })

  doc.setFillColor(...AMBER_LIGHT)
  doc.roundedRect(118, y + 19, 84, 12, 3, 3, 'F')
  doc.setTextColor(...AMBER)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('Saldo pendiente', 124, y + 26.5)
  doc.setFontSize(11.5)
  doc.text(fmt(saldo > 0 ? saldo : 0), 197, y + 26.5, { align: 'right' })

  // Historial de pagos
  const pagosY = y + 44
  tituloSeccion(doc, 'Historial de pagos', pagosY, GREEN_DARK)

  const pagosRows = (pagos && pagos.length > 0)
    ? pagos.map(p => [fmtDate(p.fecha), p.metodo || '—', fmt(p.monto)])
    : [['Sin pagos registrados', '', '']]

  autoTable(doc, {
    startY: pagosY + 5,
    head: [['Fecha de pago', 'Método de pago', 'Monto']],
    body: pagosRows,
    theme: 'striped',
    headStyles: {
      fillColor: SLATE_SOFT, textColor: SLATE, fontStyle: 'bold', fontSize: 8.5,
      lineWidth: { bottom: 0.3 }, lineColor: LINE, cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 9, textColor: DARK, lineWidth: 0, cellPadding: { top: 3.2, bottom: 3.2, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [252, 253, 254] },
    columnStyles: { 2: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  })

  if (factura.descripcion) {
    const notasY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`Notas: ${factura.descripcion}`, 14, notasY, { maxWidth: 180 })
  }

  footer(doc)
  doc.save(`Factura_${factura.numero}.pdf`)
}

// ─── PDF 2: Estado de cuenta ───
export function generarEstadoCuentaPDF({ cliente, facturas }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  header(doc, 'ESTADO DE CUENTA')

  // Tarjeta de datos del cliente
  const infoLines = []
  if (cliente?.nit) infoLines.push(`NIT: ${cliente.nit}`)
  if (cliente?.telefono) infoLines.push(`Tel: ${cliente.telefono}`)
  if (cliente?.email) infoLines.push(`Email: ${cliente.email}`)
  if (cliente?.direccion) infoLines.push(`Dir: ${cliente.direccion}`)

  const boxH = Math.max(20, 14 + infoLines.length * 4.4)
  doc.setFillColor(...BRAND_LIGHT)
  doc.roundedRect(14, 34, 188, boxH, 3, 3, 'F')

  doc.setTextColor(...BRAND_DARK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('CLIENTE', 19, 40)
  doc.setTextColor(...DARK)
  doc.setFontSize(11.5)
  doc.text(cliente?.nombre || '—', 19, 46.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE)
  let cy = 52
  infoLines.forEach(line => { doc.text(line, 19, cy); cy += 4.4 })

  doc.setFontSize(8.5)
  doc.setTextColor(...SLATE)
  doc.text(`Fecha de corte: ${fmtDate(new Date().toISOString().split('T')[0])}`, 197, 40, { align: 'right' })

  const pendientes = (facturas || []).filter(f => Number(f.saldo_pendiente) > 0)
  const rows = pendientes.map(f => [
    f.numero,
    fmtDate(f.fecha_emision),
    fmtDate(f.fecha_vencimiento),
    fmt(f.monto),
    fmt(f.total_pagado),
    fmt(f.saldo_pendiente),
  ])

  const tablaY = 34 + boxH + 12
  tituloSeccion(doc, 'Facturas pendientes', tablaY - 2)

  autoTable(doc, {
    startY: tablaY + 3,
    head: [['Factura', 'Emision', 'Vence', 'Monto', 'Pagado', 'Saldo']],
    body: rows.length ? rows : [['Sin facturas pendientes', '', '', '', '', '']],
    theme: 'striped',
    headStyles: {
      fillColor: BRAND, textColor: 255, fontStyle: 'bold', fontSize: 8.5,
      cellPadding: { top: 3.8, bottom: 3.8, left: 4, right: 4 },
    },
    bodyStyles: {
      fontSize: 9, textColor: DARK, lineWidth: 0,
      cellPadding: { top: 3.4, bottom: 3.4, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right', textColor: GREEN_DARK },
      5: { halign: 'right', fontStyle: 'bold', textColor: AMBER },
    },
    margin: { left: 14, right: 14 },
  })

  // Resumen final
  const totalFacturado = pendientes.reduce((s, f) => s + Number(f.monto), 0)
  const totalPagadoAcum = pendientes.reduce((s, f) => s + Number(f.total_pagado), 0)
  const totalSaldo = pendientes.reduce((s, f) => s + Number(f.saldo_pendiente), 0)
  const y = doc.lastAutoTable.finalY + 10

  doc.setFillColor(...SLATE_SOFT)
  doc.roundedRect(118, y - 5, 84, 15, 3, 3, 'F')
  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE)
  doc.text('Total facturado', 124, y + 1)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...DARK)
  doc.text(fmt(totalFacturado), 197, y + 1, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SLATE)
  doc.text('Total pagado', 124, y + 7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GREEN_DARK)
  doc.text(fmt(totalPagadoAcum), 197, y + 7, { align: 'right' })

  doc.setFillColor(...AMBER_LIGHT)
  doc.roundedRect(118, y + 12, 84, 13, 3, 3, 'F')
  doc.setTextColor(...AMBER)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.text('SALDO TOTAL', 124, y + 20)
  doc.setFontSize(12)
  doc.text(fmt(totalSaldo), 197, y + 20, { align: 'right' })

  footer(doc)
  doc.save(`EstadoCuenta_${(cliente?.nombre || 'cliente').replace(/\s+/g, '_')}.pdf`)
}
