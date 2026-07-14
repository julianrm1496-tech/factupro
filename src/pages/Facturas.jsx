import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, nextFacturaNumber, today } from '../lib/utils'
import { generarFacturaPDF } from '../lib/pdf'
import { Plus, Trash2, CreditCard, ChevronDown, ChevronRight, FileDown, ArrowUp, ArrowDown, Pencil, UserPlus } from 'lucide-react'

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

  const descargarPDF = async (f) => {
    const its = await loadItems(f.id)
    const cliente = clientes.find(c => c.id === f.cliente_id)
    generarFacturaPDF({ factura: f, cliente, items: its, totalPagado: f.total_pagado })
  }

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

  const guardar = async () => {
    if (!form.numero || !form.cliente_id || !form.fecha_emision || !form.fecha_vencimiento) {
      alert('Completa todos los campos obligatorios'); return
    }
    const itemsValidos = items.filter(i => i.descripcion.trim() && i.precio_unitario)
    if (itemsValidos.length === 0) { alert('Agrega al menos un producto a la factura'); return }
    setSaving(true)

    if (editId) {
      // Editar factura existente
      const { error } = await supabase.from('facturas').update({
        numero: form.numero, cliente_id: form.cliente_id,
        fecha_emision: form.fecha_emision, fecha_vencimiento: form.fecha_vencimiento,
        monto: totalItems, descripcion: form.descripcion,
      }).eq('id', editId)
      if (error) { alert('Error: ' + error.message); setSaving(false); return }

      // Reemplazar items: borrar los viejos e insertar los nuevos
      await supabase.from('factura_items').delete().eq('factura_id', editId)
      await supabase.from('factura_items').insert(
        itemsValidos.map(i => ({
          factura_id: editId, descripcion: i.descripcion.trim(),
          cantidad: parseFloat(i.cantidad) || 1, precio_unitario: parseFloat(i.precio_unitario),
        }))
      )
      setItemsMap(prev => { const c = { ...prev }; delete c[editId]; return c })
    } else {
      // Crear factura nueva
      const { data: factura, error } = await supabase.from('facturas').insert({
        numero: form.numero, cliente_id: form.cliente_id,
        fecha_emision: form.fecha_emision, fecha_vencimiento: form.fecha_vencimiento,
        monto: totalItems, descripcion: form.descripcion,
      }).select().single()
      if (error) { alert('Error: ' + error.message); setSaving(false); return }
      await supabase.from('factura_items').insert(
        itemsValidos.map(i => ({
          factura_id: factura.id, descripcion: i.descripcion.trim(),
          cantidad: parseFloat(i.cantidad) || 1, precio_unitario: parseFloat(i.precio_unitario),
        }))
      )
    }
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

  // Filtro por estado, incluyendo "con abono" como caso especial
  const matchesEstado = (f) => {
    if (!filtroEstado) return true
    if (filtroEstado === 'abono') return f.estado !== 'pagada' && Number(f.total_pagado) > 0
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
      if (!map[f.cliente_id]) map[f.cliente_id] = { cliente_id: f.cliente_id, nombre: f.cliente_nombre, facturas: [], pendiente: 0, total: 0 }
      map[f.cliente_id].facturas.push(f)
      map[f.cliente_id].pendiente += Number(f.saldo_pendiente)
      map[f.cliente_id].total += Number(f.monto)
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

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  const SortIcon = ({ active, dir }) => !active ? null : (dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />)

  return (
    <div>
      <div className="metrics">
        <div className="metric"><div className="metric-label">Total</div><div className="metric-value">{fmt(total)}</div></div>
        <div className="metric"><div className="metric-label">Cobrado</div><div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(cobrado)}</div></div>
        <div className="metric"><div className="metric-label">Por cobrar</div><div className="metric-value" style={{ color: '#854F0B' }}>{fmt(total - cobrado)}</div></div>
        <div className="metric"><div className="metric-label">Vencidas</div><div className="metric-value" style={{ color: '#A32D2D' }}>{filtered.filter(f => f.estado === 'vencida').length}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <input placeholder="Buscar cliente o factura..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ flex: 1, minWidth: 0, height: 38 }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 'auto', height: 38 }}>
          <option value="">Todos los estados</option>
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
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-sm"
          style={{ fontWeight: vista === 'agrupado' ? 700 : 500, background: vista === 'agrupado' ? 'var(--green-light)' : '#fff', color: vista === 'agrupado' ? 'var(--green-dark)' : 'var(--gray-700)' }}
          onClick={() => setVista('agrupado')}
        >
          Agrupado por cliente
        </button>
        <button
          className="btn btn-sm"
          style={{ fontWeight: vista === 'lista' ? 700 : 500, background: vista === 'lista' ? 'var(--green-light)' : '#fff', color: vista === 'lista' ? 'var(--green-dark)' : 'var(--gray-700)' }}
          onClick={() => setVista('lista')}
        >
          Lista completa (ordenar todo junto)
        </button>
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
            style={{ fontWeight: ordenClientes.key === o.key ? 700 : 500, background: ordenClientes.key === o.key ? 'var(--green-light)' : '#fff', color: ordenClientes.key === o.key ? 'var(--green-dark)' : 'var(--gray-700)' }}
            onClick={() => toggleOrdenClientes(o.key)}
          >
            {o.label} <SortIcon active={ordenClientes.key === o.key} dir={ordenClientes.dir} />
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
            {c.label} <SortIcon active={ordenFacturas.key === c.key} dir={ordenFacturas.dir} />
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <div className="empty">No hay facturas que mostrar</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {grupos.map(g => {
            const abierto = clientesAbiertos[g.cliente_id] !== false // abierto por defecto
            return (
              <div key={g.cliente_id} className="card" style={{ marginBottom: 0 }}>
                <div
                  onClick={() => toggleCliente(g.cliente_id)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {abierto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.nombre}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>· {g.facturas.length} factura{g.facturas.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {g.pendiente > 0 ? (
                      <span style={{ fontWeight: 700, color: '#854F0B', fontSize: 14 }}>{fmt(g.pendiente)} pendiente</span>
                    ) : (
                      <span style={{ fontWeight: 700, color: '#1D9E75', fontSize: 14 }}>Al día</span>
                    )}
                  </div>
                </div>

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
            {c.label} <SortIcon active={ordenFacturas.key === c.key} dir={ordenFacturas.dir} />
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
                {totalItems > 0 && (
                  <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--green-dark)' }}>Total factura</span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--green-dark)' }}>{fmt(totalItems)}</span>
                  </div>
                )}
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
    </div>
  )
}
