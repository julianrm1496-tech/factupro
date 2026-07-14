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

const GREEN = [29, 158, 117]
const GREEN_DARK = [15, 110, 86]
const GRAY = [107, 114, 128]
const DARK = [17, 24, 41]

function header(doc, titulo) {
  doc.setFillColor(...GREEN)
  doc.rect(0, 0, 216, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(EMPRESA.nombre, 14, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(EMPRESA.subtitulo, 14, 20)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(titulo, 202, 16, { align: 'right' })
}

function footer(doc) {
  const h = doc.internal.pageSize.getHeight()
  doc.setDrawColor(...GREEN)
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
export function generarFacturaPDF({ factura, cliente, items, totalPagado }) {
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

  // Cliente
  doc.setFillColor(232, 248, 242)
  doc.roundedRect(120, 34, 82, 24, 2, 2, 'F')
  doc.setTextColor(...GREEN_DARK)
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
  if (cliente?.nit) { doc.text(`NIT: ${cliente.nit}`, 124, cy); cy += 4 }
  if (cliente?.telefono) { doc.text(`Tel: ${cliente.telefono}`, 124, cy) }

  // Tabla de items
  const rows = (items || []).map(i => [
    i.descripcion,
    String(Number(i.cantidad)),
    fmt(i.precio_unitario),
    fmt(Number(i.cantidad) * Number(i.precio_unitario)),
  ])

  autoTable(doc, {
    startY: 66,
    head: [['Descripcion', 'Cant.', 'Precio unit.', 'Subtotal']],
    body: rows.length ? rows : [['(Sin detalle de items)', '', '', fmt(factura.monto)]],
    theme: 'grid',
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 38, halign: 'right' },
      3: { cellWidth: 40, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  })

  // Totales
  const y = doc.lastAutoTable.finalY + 8
  const saldo = Number(factura.monto) - Number(totalPagado || 0)
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'normal')
  doc.text('Total factura:', 150, y, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text(fmt(factura.monto), 202, y, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GREEN_DARK)
  doc.text('Pagado:', 150, y + 6, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.text(fmt(totalPagado || 0), 202, y + 6, { align: 'right' })

  doc.setFillColor(232, 248, 242)
  doc.roundedRect(120, y + 10, 82, 10, 2, 2, 'F')
  doc.setTextColor(...GREEN_DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Saldo pendiente:', 150, y + 17, { align: 'right' })
  doc.text(fmt(saldo > 0 ? saldo : 0), 200, y + 17, { align: 'right' })

  if (factura.descripcion) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`Notas: ${factura.descripcion}`, 14, y + 30, { maxWidth: 180 })
  }

  footer(doc)
  doc.save(`Factura_${factura.numero}.pdf`)
}

// ─── PDF 2: Estado de cuenta ───
export function generarEstadoCuentaPDF({ cliente, facturas }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  header(doc, 'ESTADO DE CUENTA')

  doc.setTextColor(...DARK)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text(cliente?.nombre || '—', 14, 40)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRAY)
  let cy = 46
  if (cliente?.nit) { doc.text(`NIT: ${cliente.nit}`, 14, cy); cy += 5 }
  if (cliente?.telefono) { doc.text(`Tel: ${cliente.telefono}`, 14, cy); cy += 5 }
  doc.text(`Fecha de corte: ${fmtDate(new Date().toISOString().split('T')[0])}`, 14, cy)

  const pendientes = (facturas || []).filter(f => Number(f.saldo_pendiente) > 0)
  const rows = pendientes.map(f => [
    f.numero,
    fmtDate(f.fecha_emision),
    fmtDate(f.fecha_vencimiento),
    fmt(f.monto),
    fmt(f.total_pagado),
    fmt(f.saldo_pendiente),
  ])

  autoTable(doc, {
    startY: cy + 10,
    head: [['Factura', 'Emision', 'Vence', 'Monto', 'Pagado', 'Saldo']],
    body: rows.length ? rows : [['Sin facturas pendientes', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: 14, right: 14 },
  })

  const totalSaldo = pendientes.reduce((s, f) => s + Number(f.saldo_pendiente), 0)
  const y = doc.lastAutoTable.finalY + 10
  doc.setFillColor(232, 248, 242)
  doc.roundedRect(110, y, 92, 12, 2, 2, 'F')
  doc.setTextColor(...GREEN_DARK)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('SALDO TOTAL:', 148, y + 8, { align: 'right' })
  doc.text(fmt(totalSaldo), 200, y + 8, { align: 'right' })

  footer(doc)
  doc.save(`EstadoCuenta_${(cliente?.nombre || 'cliente').replace(/\s+/g, '_')}.pdf`)
}
