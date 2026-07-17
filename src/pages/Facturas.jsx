import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, nextFacturaNumber, today } from '../lib/utils'
import { generarFacturaPDF } from '../lib/pdf'
import { Plus, Trash2, CreditCard, ChevronDown, ChevronRight, FileDown, Pencil, UserPlus, Receipt, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

const COLS = [
  { key: 'numero', label: 'Factura' },
  { key: 'fecha_emision', label: 'Emisión' },
  { key: 'fecha_vencimiento', label: 'Vence' },
  { key: 'monto', label: 'Monto' },
]

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [saving, setSaving] = useState(false)
  const [itemsMap, setItemsMap] = useState({})
  const [expandidaFactura, setExpandidaFactura] = useState(null)
  const [clientesAbiertos, setClientesAbiertos] = useState({})
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])
  const [montoManual, setMontoManual] = useState(false)
  const [montoValor, setMontoValor] = useState('')
  const [editId, setEditId] = useState(null)
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [nuevoClienteTel, setNuevoClienteTel] = useState('')
  const [creandoCliente, setCreandoCliente] = useState(false)

  // Ordenamiento
  const [ordenClientes, setOrdenClientes] = useState({ key: 'pendiente', dir: 'desc' })
  const [ordenFacturas, setOrdenFacturas] = useState({ key: 'fecha_emision', dir: 'desc' })
  const [vista, setVista] = useState('agrupado') // agrupado | lista

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: f }, { data: c }] = await Promise.all([
      supabase.from('facturas_resumen').select('*'),
      supabase.from('clientes').select('*').order('nombre'),
    ])
    setFacturas(f || [])
    setClientes(c || [])
    setLoading(false)
  }

  const loadItems = async (facturaId) => {
    if (itemsMap[facturaId]) return itemsMap[facturaId]
    const { data } = await supabase.from('factura_items').select('*').eq('factura_id', facturaId).order('created_at')
    setItemsMap(prev => ({ ...prev, [facturaId]: data || [] }))
    return data || []
  }

  const toggleFactura = async (id) => {
    if (expandidaFactura === id) { setExpandidaFactura(null); return }
    setExpandidaFactura(id)
    await loadItems(id)
  }

  const toggleCliente = (id) => setClientesAbiertos(prev => ({ ...prev, [id]: !prev[id] }))
  const toggleTodosClientes = (grupos) => {
    const todosAbiertos = grupos.length > 0 && grupos.every(g => clientesAbiertos[g.cliente_id])
    if (todosAbiertos) { setClientesAbiertos({}); return }
    const next = {}
    grupos.forEach(g => { next[g.cliente_id] = true })
    setClientesAbiertos(next)
  }

  // Trae items, cliente y el historial de pagos de una factura y descarga el PDF completo
  const generarPDFCompleto = async (f) => {
    const [its, { data: pagosData }] = await Promise.all([
      loadItems(f.id),
      supabase.from('pagos').select('monto, fecha, metodo').eq('factura_id', f.id).order('fecha'),
    ])
    const cliente = clientes.find(c => c.id === f.cliente_id)
    generarFacturaPDF({ factura: f, cliente, items: its, totalPagado: f.total_pagado, pagos: pagosData || [] })
  }

  const descargarPDF = (f) => generarPDFCompleto(f)

  const openNueva = () => {
    setEditId(null)
    setForm({
      numero: nextFacturaNumber(facturas),
      cliente_id: clientes[0]?.id || '',
      fecha_emision: today(),
      fecha_vencimiento: '',
      descripcion: '',
    })
    setItems([{ id: Date.now(), descripcion: '', cantidad: 1, precio_unitario: '' }])
    setMontoManual(false)
    setMontoValor('')
    setModal('nueva')
  }

  const openEditar = async (f) => {
    setEditId(f.id)
    setForm({
      numero: f.numero,
      cliente_id: f.cliente_id,
      fecha_emision: f.fecha_emision,
      fecha_vencimiento: f.fecha_vencimiento,
      descripcion: f.descripcion || '',
    })
    const its = await loadItems(f.id)
    setItems(its.length > 0
      ? its.map(i => ({ id: i.id, descripcion: i.descripcion, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      : [{ id: Date.now(), descripcion: '', cantidad: 1, precio_unitario: '' }]
    )
    // Si el monto guardado no coincide con la suma de los items, es porque el usuario lo ajusto manualmente antes
    const sumaItems = its.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0), 0)
    const difiere = Math.abs(Number(f.monto) - sumaItems) > 0.01
    setMontoManual(difiere)
    setMontoValor(difiere ? String(f.monto) : '')
    setModal('nueva')
  }

  const crearClienteRapido = async () => {
    if (!nuevoClienteNombre.trim()) { alert('Escribe el nombre del cliente'); return }
    setCreandoCliente(true)
    const { data, error } = await supabase.from('clientes').insert({ nombre: nuevoClienteNombre.trim(), telefono: nuevoClienteTel.trim() }).select().single()
    setCreandoCliente(false)
    if (error) { alert('Error: ' + error.message); return }
    setClientes(prev => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)))
    set('cliente_id', data.id)
    setNuevoClienteNombre('')
    setNuevoClienteTel('')
    setModal('nueva')
  }

  const addItem = () => setItems(prev => [...prev, { id: Date.now(), descripcion: '', cantidad: 1, precio_unitario: '' }])
  const removeItem = (id) => { if (items.length > 1) setItems(prev => prev.filter(i => i.id !== id)) }
  const updateItem = (id, key, value) => setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: value } : i))
  const totalItems = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0), 0)

  const montoFinal = montoManual ? (parseFloat(montoValor) || 0) : totalItems

  const guardar = async () => {
    if (!form.numero || !form.cliente_id || !form.fecha_emision || !form.fecha_vencimiento) {
      alert('Completa todos los campos obligatorios'); return
    }
    const itemsValidos = items.filter(i => i.descripcion.trim() && i.precio_unitario)
    if (montoFinal <= 0) { alert('Ingresa el total de la factura o agrega productos con precio'); return }
    setSaving(true)
    let facturaId = editId

    if (editId) {
      // Editar factura existente
      const { error } = await supabase.from('facturas').update({
        numero: form.numero, cliente_id: form.cliente_id,
        fecha_emision: form.fecha_emision, fecha_vencimiento: form.fecha_vencimiento,
        monto: montoFinal, descripcion: form.descripcion,
      }).eq('id', editId)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }

      // Reemplazar items: borrar los viejos e insertar los nuevos
      await supabase.from('factura_items').delete().eq('factura_id', editId)
      if (itemsValidos.length > 0) {
        await supabase.from('factura_items').insert(
          itemsValidos.map(i => ({
            factura_id: editId, descripcion: i.descripcion.trim(),
            cantidad: parseFloat(i.cantidad) || 1, precio_unitario: parseFloat(i.precio_unitario),
          }))
        )
      }
      setItemsMap(prev => { const c = { ...prev }; delete c[editId]; return c })
    } else {
      // Crear factura nueva
      const { data: factura, error } = await supabase.from('facturas').insert({
        numero: form.numero, cliente_id: form.cliente_id,
        fecha_emision: form.fecha_emision, fecha_vencimiento: form.fecha_vencimiento,
        monto: montoFinal, descripcion: form.descripcion,
      }).select().single()
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
      if (itemsValidos.length > 0) {
        await supabase.from('factura_items').insert(
          itemsValidos.map(i => ({
            factura_id: factura.id, descripcion: i.descripcion.trim(),
            cantidad: parseFloat(i.cantidad) || 1, precio_unitario: parseFloat(i.precio_unitario),
          }))
        )
      }
      facturaId = factura.id
    }

    // Descarga automatica del PDF con los datos ya actualizados (monto, items, saldo)
    const { data: facturaActualizada } = await supabase.from('facturas_resumen').select('*').eq('id', facturaId).single()
    if (facturaActualizada) await generarPDFCompleto(facturaActualizada)

    setSaving(false); setModal(null); setEditId(null); load()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta factura y todos sus pagos?')) return
    await supabase.from('facturas').delete().eq('id', id)
    load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const diasVencida = (fechaVencimiento) => {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
    const venc = new Date(fechaVencimiento + 'T00:00:00')
    const dias = Math.floor((hoy - venc) / (1000 * 60 * 60 * 24))
    return dias
  }

  // Filtro por estado, incluyendo "con abono" y "por cobrar" como casos especiales
  const matchesEstado = (f) => {
    if (!filtroEstado) return true
    if (filtroEstado === 'abono') return f.estado !== 'pagada' && Number(f.total_pagado) > 0
    if (filtroEstado === 'porCobrar') return f.estado !== 'pagada'
    return f.estado === filtroEstado
  }

  const filtered = useMemo(() => {
    const q = filtro.toLowerCase()
    return facturas
      .filter(f => !q || f.numero?.toLowerCase().includes(q) || f.cliente_nombre?.toLowerCase().includes(q))
      .filter(matchesEstado)
  }, [facturas, filtro, filtroEstado])

  // Agrupar por cliente
  const grupos = useMemo(() => {
    const map = {}
    filtered.forEach(f => {
      if (!map[f.cliente_id]) map[f.cliente_id] = { cliente_id: f.cliente_id, nombre: f.cliente_nombre, facturas: [], pendiente: 0, total: 0, pagado: 0 }
      map[f.cliente_id].facturas.push(f)
      map[f.cliente_id].pendiente += Number(f.saldo_pendiente)
      map[f.cliente_id].total += Number(f.monto)
      map[f.cliente_id].pagado += Number(f.total_pagado)
    })
    let arr = Object.values(map)
    const { key, dir } = ordenClientes
    arr.sort((a, b) => {
      let va, vb
      if (key === 'nombre') { va = a.nombre || ''; vb = b.nombre || ''; return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      va = a[key] ?? 0; vb = b[key] ?? 0
      return dir === 'asc' ? va - vb : vb - va
    })
    // Ordenar facturas dentro de cada grupo
    arr.forEach(g => {
      g.facturas.sort((a, b) => {
        let va = a[ordenFacturas.key], vb = b[ordenFacturas.key]
        if (ordenFacturas.key === 'numero') { va = va || ''; vb = vb || ''; return ordenFacturas.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
        if (ordenFacturas.key.includes('fecha')) { va = new Date(va).getTime(); vb = new Date(vb).getTime() }
        else { va = Number(va) || 0; vb = Number(vb) || 0 }
        return ordenFacturas.dir === 'asc' ? va - vb : vb - va
      })
    })
    return arr
  }, [filtered, ordenClientes, ordenFacturas])

  // Vista de lista plana: todas las facturas ordenadas juntas, sin agrupar por cliente
  const listaPlana = useMemo(() => {
    const arr = [...filtered]
    const { key, dir } = ordenFacturas
    arr.sort((a, b) => {
      let va = a[key], vb = b[key]
      if (key === 'numero') { va = va || ''; vb = vb || ''; return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va) }
      if (key.includes('fecha')) { va = new Date(va).getTime(); vb = new Date(vb).getTime() }
      else { va = Number(va) || 0; vb = Number(vb) || 0 }
      return dir === 'asc' ? va - vb : vb - va
    })
    return arr
  }, [filtered, ordenFacturas])

  const toggleOrdenClientes = (key) => {
    setOrdenClientes(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' })
  }
  const toggleOrdenFacturas = (key) => {
    setOrdenFacturas(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  const total = filtered.reduce((s, f) => s + Number(f.monto), 0)
  const cobrado = filtered.reduce((s, f) => s + Number(f.total_pagado), 0)

  if (loading) return (
    <div>
      <div className="skel-metrics">
        {[0,1,2,3].map(i => (
          <div key={i} className="skel-metric">
            <div className="skeleton skel-line" style={{ width: '50%' }} />
            <div className="skeleton skel-line" style={{ width: '75%', height: 18, marginBottom: 0 }} />
          </div>
        ))}
      </div>
      {[0,1,2,3,4].map(i => <div key={i} className="skel-row"><div className="skeleton skel-line" style={{ width: '40%', marginBottom: 0 }} /></div>)}
    </div>
  )

  const tipoDeCampo = (key) => key.includes('fecha') ? 'fecha' : (key === 'monto' || key === 'pendiente' || key === 'total') ? 'monto' : 'texto'
  const textoOrden = (key, dir) => {
    const tipo = tipoDeCampo(key)
    if (tipo === 'fecha') return dir === 'asc' ? 'antiguas primero' : 'recientes primero'
    if (tipo === 'monto') return dir === 'asc' ? 'menor a mayor' : 'mayor a menor'
    return dir === 'asc' ? 'A-Z' : 'Z-A'
  }
  const OrdenLabel = ({ active, campo, dir }) => !active ? null : (
    <span style={{ fontSize: 10.5, fontWeight: 500, opacity: .85 }}> · {textoOrden(campo, dir)}</span>
  )

  return (
    <div>
      <div className="metrics stagger-in">
        <div className="metric metric-brand"><div className="metric-label"><Receipt size={15} /> Total</div><div className="metric-value">{fmt(total)}</div></div>
        <div className="metric metric-success"><div className="metric-label"><CheckCircle size={15} /> Cobrado</div><div className="metric-value" style={{ color: 'var(--green-dark)' }}>{fmt(cobrado)}</div></div>
        <div
          className={`metric metric-warn${filtroEstado === 'porCobrar' ? ' metric-active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => setFiltroEstado(filtroEstado === 'porCobrar' ? '' : 'porCobrar')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFiltroEstado(filtroEstado === 'porCobrar' ? '' : 'porCobrar')}
          title="Ver solo facturas por cobrar"
        >
          <div className="metric-label"><Clock size={15} /> Por cobrar</div>
          <div className="metric-value">{fmt(total - cobrado)}</div>
        </div>
        <div
          className={`metric metric-danger${filtroEstado === 'vencida' ? ' metric-active' : ''}`}
          role="button" tabIndex={0}
          onClick={() => setFiltroEstado(filtroEstado === 'vencida' ? '' : 'vencida')}
          onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFiltroEstado(filtroEstado === 'vencida' ? '' : 'vencida')}
          title="Ver solo facturas vencidas"
        >
          <div className="metric-label"><AlertTriangle size={15} /> Vencidas</div>
          <div className="metric-value">{filtered.filter(f => f.estado === 'vencida').length}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input placeholder="Buscar cliente o factura..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ flex: 1, minWidth: 0, height: 38 }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 'auto', height: 38 }}>
          <option value="">Todos los estados</option>
          <option value="porCobrar">Por cobrar</option>
          <option value="pagada">Pagadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="vencida">Vencidas</option>
          <option value="abono">Con abono parcial</option>
        </select>
        <button className="btn btn-primary" onClick={openNueva} style={{ height: 38 }}>
          <Plus size={15} /> Nueva
        </button>
      </div>

      {/* Ordenar clientes */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-sm"
            style={{ fontWeight: vista === 'agrupado' ? 700 : 500, background: vista === 'agrupado' ? 'var(--blue-light)' : '#fff', color: vista === 'agrupado' ? 'var(--blue)' : 'var(--gray-700)' }}
            onClick={() => setVista('agrupado')}
          >
            Agrupado por cliente
          </button>
          <button
            className="btn btn-sm"
            style={{ fontWeight: vista === 'lista' ? 700 : 500, background: vista === 'lista' ? 'var(--blue-light)' : '#fff', color: vista === 'lista' ? 'var(--blue)' : 'var(--gray-700)' }}
            onClick={() => setVista('lista')}
          >
            Lista completa (ordenar todo junto)
          </button>
        </div>
        {vista === 'agrupado' && grupos.length > 0 && (
          <button className="btn btn-sm" onClick={() => toggleTodosClientes(grupos)}>
            {grupos.every(g => clientesAbiertos[g.cliente_id]) ? 'Colapsar todos' : 'Expandir todos'}
          </button>
        )}
      </div>

      {vista === 'agrupado' && (
      <>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--gray-500)', marginRight: 2 }}>Ordenar clientes por:</span>
        {[
          { key: 'nombre', label: 'Nombre' },
          { key: 'pendiente', label: 'Saldo pendiente' },
          { key: 'total', label: 'Total facturado' },
        ].map(o => (
          <button
            key={o.key}
            className="btn btn-sm"
            style={{ fontWeight: ordenClientes.key === o.key ? 700 : 500, background: ordenClientes.key === o.key ? 'var(--blue-light)' : '#fff', color: ordenClientes.key === o.key ? 'var(--blue)' : 'var(--gray-700)' }}
            onClick={() => toggleOrdenClientes(o.key)}
          >
            {o.label}<OrdenLabel active={ordenClientes.key === o.key} campo={o.key} dir={ordenClientes.dir} />
          </button>
        ))}
      </div>

      {/* Ordenar facturas dentro de cada cliente */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--gray-500)', marginRight: 2 }}>Ordenar facturas por:</span>
        {COLS.map(c => (
          <button
            key={c.key}
            className="btn btn-sm"
            style={{ fontWeight: ordenFacturas.key === c.key ? 700 : 500, background: ordenFacturas.key === c.key ? 'var(--blue-light)' : '#fff', color: ordenFacturas.key === c.key ? 'var(--blue)' : 'var(--gray-700)' }}
            onClick={() => toggleOrdenFacturas(c.key)}
          >
            {c.label}<OrdenLabel active={ordenFacturas.key === c.key} campo={c.key} dir={ordenFacturas.dir} />
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <div className="empty">No hay facturas que mostrar</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grupos.map(g => {
            const abierto = !!clientesAbiertos[g.cliente_id] // cerrado por defecto
            const pctCumplimiento = g.total > 0 ? Math.min(100, Math.round(g.pagado / g.total * 100)) : 100
            const alDia = g.pendiente <= 0
            return (
              <div key={g.cliente_id} className="card" style={{ marginBottom: 0 }}>
                <div
                  onClick={() => toggleCliente(g.cliente_id)}
                  style={{ padding: '11px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontWeight: 700, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nombre}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>· {g.facturas.length} fact.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {!alDia && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, whiteSpace: 'nowrap' }}>
                        <span style={{ color: 'var(--gray-500)' }}>Fact. <b style={{ color: 'var(--gray-900)', fontVariantNumeric: 'tabular-nums' }}>{fmt(g.total)}</b></span>
                        <span style={{ color: 'var(--gray-300)' }}>|</span>
                        <span style={{ color: 'var(--green-dark)' }}>Pag. <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(g.pagado)}</b></span>
                        <span style={{ color: 'var(--gray-300)' }}>|</span>
                        <span style={{ color: 'var(--warn-ink)' }}>Pend. <b style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(g.pendiente)}</b></span>
                      </div>
                    )}
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap',
                      background: alDia ? 'var(--green-light)' : 'var(--danger-grad-to)',
                      color: alDia ? 'var(--green-dark)' : 'var(--danger-label)',
                    }}>
                      {pctCumplimiento}%
                    </span>
                  </div>
                </div>

                {!alDia && (
                  <div style={{ height: 3, background: 'var(--gray-200)' }}>
                    <div style={{ height: '100%', width: pctCumplimiento + '%', background: 'linear-gradient(90deg, #34D399, var(--green-dark))' }} />
                  </div>
                )}

                {abierto && (
                  <div className="table-wrapper" style={{ borderTop: '1px solid var(--gray-200)' }}>
                    <table className="table-compact">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Factura</th>
                          <th>Emisión</th>
                          <th>Vence</th>
                          <th style={{ textAlign: 'right' }}>Monto</th>
                          <th style={{ textAlign: 'right' }}>Pagado</th>
                          <th>Progreso</th>
                          <th>Estado</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.facturas.map(f => {
                          const pct = f.monto > 0 ? Math.min(100, Math.round(Number(f.total_pagado) / Number(f.monto) * 100)) : 0
                          const isExpanded = expandidaFactura === f.id
                          const its = itemsMap[f.id] || []
                          const conAbono = f.estado !== 'pagada' && Number(f.total_pagado) > 0
                          return (
                            <>
                              <tr key={f.id} className="row-clickable" onClick={() => toggleFactura(f.id)}>
                                <td style={{ width: 24 }}>{isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                                <td style={{ fontWeight: 700 }}>{f.numero}</td>
                                <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{fmtDate(f.fecha_emision)}</td>
                                <td style={{ color: f.estado === 'vencida' ? '#A32D2D' : 'var(--gray-500)', fontSize: 12 }}>{fmtDate(f.fecha_vencimiento)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(f.monto)}</td>
                                <td style={{ textAlign: 'right', color: '#1D9E75', fontWeight: 600 }}>{fmt(f.total_pagado)}</td>
                                <td style={{ minWidth: 90 }}>
                                  <div className="progress-bar" style={{ width: 80 }}><div className="progress-fill" style={{ width: pct + '%' }} /></div>
                                </td>
                                <td>
                                  <span className={`badge badge-${f.estado}`}>
                                    {f.estado === 'vencida' ? `vencida hace ${diasVencida(f.fecha_vencimiento)}d` : f.estado}
                                  </span>
                                  {conAbono && <span className="badge badge-blue" style={{ marginLeft: 4 }}>abono</span>}
                                </td>
                                <td onClick={e => e.stopPropagation()}>
                                  <div className="actions-row">
                                    <button className="btn btn-sm btn-icon" title="Editar factura" onClick={() => openEditar(f)}><Pencil size={13} /></button>
                                    <button className="btn btn-sm btn-icon" title="Descargar PDF" onClick={() => descargarPDF(f)}><FileDown size={13} /></button>
                                    <button className="btn btn-sm btn-icon" title="Registrar pago" onClick={() => window.location.href = '/pagos?factura=' + f.id}><CreditCard size={13} /></button>
                                    <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(f.id)}><Trash2 size={13} /></button>
                                  </div>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={f.id + '-d'}>
                                  <td colSpan={9} style={{ background: 'var(--gray-50)', padding: '10px 16px' }}>
                                    {its.length === 0 ? (
                                      <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Sin detalle de productos</div>
                                    ) : (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                                        {its.map(item => (
                                          <div key={item.id} style={{ fontSize: 12.5 }}>
                                            <span style={{ fontWeight: 500 }}>{item.descripcion}</span>
                                            <span style={{ color: 'var(--gray-500)' }}> · {Number(item.cantidad)} x {fmt(item.precio_unitario)} = </span>
                                            <span style={{ fontWeight: 600 }}>{fmt(Number(item.cantidad) * Number(item.precio_unitario))}</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>
      )}

      {vista === 'lista' && (
      <>
      {/* Ordenar facturas: toda la lista junta */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--gray-500)', marginRight: 2 }}>Ordenar por:</span>
        {[{ key: 'cliente_nombre', label: 'Cliente' }, ...COLS].map(c => (
          <button
            key={c.key}
            className="btn btn-sm"
            style={{ fontWeight: ordenFacturas.key === c.key ? 700 : 500, background: ordenFacturas.key === c.key ? 'var(--blue-light)' : '#fff', color: ordenFacturas.key === c.key ? 'var(--blue)' : 'var(--gray-700)' }}
            onClick={() => toggleOrdenFacturas(c.key)}
          >
            {c.label}<OrdenLabel active={ordenFacturas.key === c.key} campo={c.key} dir={ordenFacturas.dir} />
          </button>
        ))}
      </div>

      <div className="card">
        <div className="table-wrapper">
          <table className="table-compact">
            <thead>
              <tr>
                <th></th>
                <th>Factura</th>
                <th>Cliente</th>
                <th>Emisión</th>
                <th>Vence</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th style={{ textAlign: 'right' }}>Pagado</th>
                <th>Progreso</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listaPlana.length === 0 ? (
                <tr><td colSpan={10}><div className="empty">No hay facturas que mostrar</div></td></tr>
              ) : listaPlana.map(f => {
                const pct = f.monto > 0 ? Math.min(100, Math.round(Number(f.total_pagado) / Number(f.monto) * 100)) : 0
                const isExpanded = expandidaFactura === f.id
                const its = itemsMap[f.id] || []
                const conAbono = f.estado !== 'pagada' && Number(f.total_pagado) > 0
                return (
                  <>
                    <tr key={f.id} className="row-clickable" onClick={() => toggleFactura(f.id)}>
                      <td style={{ width: 24 }}>{isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                      <td style={{ fontWeight: 700 }}>{f.numero}</td>
                      <td>{f.cliente_nombre}</td>
                      <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{fmtDate(f.fecha_emision)}</td>
                      <td style={{ color: f.estado === 'vencida' ? '#A32D2D' : 'var(--gray-500)', fontSize: 12 }}>{fmtDate(f.fecha_vencimiento)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(f.monto)}</td>
                      <td style={{ textAlign: 'right', color: '#1D9E75', fontWeight: 600 }}>{fmt(f.total_pagado)}</td>
                      <td style={{ minWidth: 90 }}>
                        <div className="progress-bar" style={{ width: 80 }}><div className="progress-fill" style={{ width: pct + '%' }} /></div>
                      </td>
                      <td>
                        <span className={`badge badge-${f.estado}`}>
                          {f.estado === 'vencida' ? `vencida hace ${diasVencida(f.fecha_vencimiento)}d` : f.estado}
                        </span>
                        {conAbono && <span className="badge badge-blue" style={{ marginLeft: 4 }}>abono</span>}
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="actions-row">
                          <button className="btn btn-sm btn-icon" title="Editar factura" onClick={() => openEditar(f)}><Pencil size={13} /></button>
                          <button className="btn btn-sm btn-icon" title="Descargar PDF" onClick={() => descargarPDF(f)}><FileDown size={13} /></button>
                          <button className="btn btn-sm btn-icon" title="Registrar pago" onClick={() => window.location.href = '/pagos?factura=' + f.id}><CreditCard size={13} /></button>
                          <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(f.id)}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={f.id + '-d'}>
                        <td colSpan={10} style={{ background: 'var(--gray-50)', padding: '10px 16px' }}>
                          {its.length === 0 ? (
                            <div style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>Sin detalle de productos</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                              {its.map(item => (
                                <div key={item.id} style={{ fontSize: 12.5 }}>
                                  <span style={{ fontWeight: 500 }}>{item.descripcion}</span>
                                  <span style={{ color: 'var(--gray-500)' }}> · {Number(item.cantidad)} x {fmt(item.precio_unitario)} = </span>
                                  <span style={{ fontWeight: 600 }}>{fmt(Number(item.cantidad) * Number(item.precio_unitario))}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {modal === 'nueva' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Editar factura' : 'Nueva factura'}</span>
              <button className="btn btn-icon btn-sm" onClick={() => { setModal(null); setEditId(null) }}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cliente *</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)} style={{ flex: 1 }}>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <button className="btn btn-sm btn-icon" title="Crear cliente nuevo" onClick={() => setModal('nuevoCliente')}><UserPlus size={14} /></button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Número *</label><input value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="FAC-001" /></div>
                <div className="form-group"><label>Fecha emisión *</label><input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} /></div>
              </div>
              <div className="form-group"><label>Fecha vencimiento *</label><input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} /></div>

              <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Productos de la factura</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>PRODUCTO {idx + 1}</div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label>Descripción *</label>
                        <input value={item.descripcion} onChange={e => updateItem(item.id, 'descripcion', e.target.value)} placeholder="Ej: Tapetes de lujo x4" />
                      </div>
                      <div className="form-row">
                        <div className="form-group"><label>Cantidad</label><input type="number" value={item.cantidad} onChange={e => updateItem(item.id, 'cantidad', e.target.value)} min="1" /></div>
                        <div className="form-group"><label>Precio unitario *</label><input type="number" value={item.precio_unitario} onChange={e => updateItem(item.id, 'precio_unitario', e.target.value)} placeholder="0" /></div>
                      </div>
                      {(parseFloat(item.cantidad) || 0) > 0 && (parseFloat(item.precio_unitario) || 0) > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 600, marginTop: 6, textAlign: 'right' }}>
                          Subtotal: {fmt((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0))}
                        </div>
                      )}
                      {items.length > 1 && (
                        <button className="btn btn-sm btn-danger" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }} onClick={() => removeItem(item.id)}>
                          <Trash2 size={12} /> Quitar producto
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={addItem}><Plus size={13} /> Agregar otro producto</button>

                <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius)', padding: '12px 14px', marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: montoManual ? 8 : 0 }}>
                    <span style={{ fontWeight: 600, color: 'var(--green-dark)', fontSize: 13 }}>Total factura</span>
                    {totalItems > 0 && (
                      <span style={{ fontSize: 11.5, color: 'var(--green-dark)' }}>
                        Sugerido por productos: <strong>{fmt(totalItems)}</strong>
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      value={montoManual ? montoValor : totalItems || ''}
                      onChange={e => { setMontoManual(true); setMontoValor(e.target.value) }}
                      placeholder="0"
                      style={{ background: '#fff', fontWeight: 700, fontSize: 16, color: 'var(--green-dark)' }}
                    />
                    {montoManual && (
                      <button type="button" className="btn btn-sm" onClick={() => { setMontoManual(false); setMontoValor('') }} title="Usar el total sugerido por los productos">
                        Usar sugerido
                      </button>
                    )}
                  </div>
                  {montoManual && (
                    <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 6 }}>Total editado manualmente — no coincide con la suma de productos.</div>
                  )}
                </div>
              </div>
              <div className="form-group"><label>Notas</label><textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Notas opcionales..." rows={2} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => { setModal(null); setEditId(null) }}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : editId ? 'Guardar cambios' : 'Guardar factura'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'nuevoCliente' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal('nueva')}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nuevo cliente rápido</span>
              <button className="btn btn-icon btn-sm" onClick={() => setModal('nueva')}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre *</label>
                <input value={nuevoClienteNombre} onChange={e => setNuevoClienteNombre(e.target.value)} placeholder="Nombre del cliente" autoFocus />
              </div>
              <div className="form-group">
                <label>Teléfono (opcional)</label>
                <input value={nuevoClienteTel} onChange={e => setNuevoClienteTel(e.target.value)} placeholder="+57 300..." />
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                Podrás completar NIT, email y dirección más tarde desde la sección Clientes.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal('nueva')}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearClienteRapido} disabled={creandoCliente}>
                {creandoCliente ? 'Creando...' : 'Crear y usar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <button className="fab" onClick={openNueva} title="Nueva factura" aria-label="Nueva factura">
        <Plus size={24} />
      </button>
    </div>
  )
}
