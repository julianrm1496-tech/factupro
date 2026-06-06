import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, nextFacturaNumber, today } from '../lib/utils'
import { Plus, Trash2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [saving, setSaving] = useState(false)
  const [expandida, setExpandida] = useState(null)
  const [itemsMap, setItemsMap] = useState({})
  const [form, setForm] = useState({})
  const [items, setItems] = useState([])

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: f }, { data: c }, { data: p }] = await Promise.all([
      supabase.from('facturas_resumen').select('*').order('fecha_emision', { ascending: false }),
      supabase.from('clientes').select('id, nombre, email').order('nombre'),
      supabase.from('productos').select('*').eq('activo', true).order('nombre'),
    ])
    setFacturas(f || [])
    setClientes(c || [])
    setProductos(p || [])
    setLoading(false)
  }

  const loadItems = async (facturaId) => {
    if (itemsMap[facturaId]) return
    const { data } = await supabase.from('factura_items').select('*').eq('factura_id', facturaId).order('created_at')
    setItemsMap(prev => ({ ...prev, [facturaId]: data || [] }))
  }

  const toggleExpandir = async (id) => {
    if (expandida === id) { setExpandida(null); return }
    setExpandida(id)
    await loadItems(id)
  }

  const openNueva = () => {
    setForm({
      numero: nextFacturaNumber(facturas),
      cliente_id: clientes[0]?.id || '',
      fecha_emision: today(),
      fecha_vencimiento: '',
      descripcion: '',
    })
    setItems([{ id: Date.now(), producto_id: '', descripcion: '', cantidad: 1, precio_unitario: '' }])
    setModal('nueva')
  }

  const addItem = () => {
    setItems(prev => [...prev, { id: Date.now(), producto_id: '', descripcion: '', cantidad: 1, precio_unitario: '' }])
  }

  const removeItem = (id) => {
    if (items.length === 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id, key, value) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const updated = { ...i, [key]: value }
      if (key === 'producto_id' && value) {
        const p = productos.find(p => p.id === value)
        if (p) {
          updated.descripcion = p.nombre
          updated.precio_unitario = p.precio
        }
      }
      return updated
    }))
  }

  const totalItems = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0), 0)

  const guardar = async () => {
    if (!form.numero || !form.cliente_id || !form.fecha_emision || !form.fecha_vencimiento) {
      alert('Completa todos los campos obligatorios')
      return
    }
    const itemsValidos = items.filter(i => i.descripcion && i.precio_unitario)
    if (itemsValidos.length === 0) {
      alert('Agrega al menos un ítem a la factura')
      return
    }
    setSaving(true)
    const { data: factura, error } = await supabase.from('facturas').insert({
      numero: form.numero,
      cliente_id: form.cliente_id,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento,
      monto: totalItems,
      descripcion: form.descripcion,
    }).select().single()

    if (error) { alert('Error: ' + error.message); setSaving(false); return }

    await supabase.from('factura_items').insert(
      itemsValidos.map(i => ({
        factura_id: factura.id,
        producto_id: i.producto_id || null,
        descripcion: i.descripcion,
        cantidad: parseFloat(i.cantidad) || 1,
        precio_unitario: parseFloat(i.precio_unitario),
      }))
    )
    setSaving(false)
    setModal(null)
    load()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar esta factura y todos sus pagos?')) return
    await supabase.from('facturas').delete().eq('id', id)
    load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filtered = facturas
    .filter(f => {
      const q = filtro.toLowerCase()
      return !q || f.numero?.toLowerCase().includes(q) || f.cliente_nombre?.toLowerCase().includes(q)
    })
    .filter(f => !filtroEstado || f.estado === filtroEstado)

  const total = filtered.reduce((s, f) => s + Number(f.monto), 0)
  const cobrado = filtered.reduce((s, f) => s + Number(f.total_pagado), 0)

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Total</div>
          <div className="metric-value">{fmt(total)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cobrado</div>
          <div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(cobrado)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Por cobrar</div>
          <div className="metric-value" style={{ color: '#854F0B' }}>{fmt(total - cobrado)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencidas</div>
          <div className="metric-value" style={{ color: '#A32D2D' }}>
            {filtered.filter(f => f.estado === 'vencida').length}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Buscar..." value={filtro} onChange={e => setFiltro(e.target.value)} style={{ flex: 1, minWidth: 0, height: 38 }} />
        <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} style={{ width: 'auto', height: 38 }}>
          <option value="">Todos</option>
          <option value="pagada">Pagadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="vencida">Vencidas</option>
        </select>
        <button className="btn btn-primary" onClick={openNueva} style={{ height: 38 }}>
          <Plus size={15} /> Nueva
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div className="empty">No hay facturas que mostrar</div>
        ) : filtered.map(f => {
          const pct = f.monto > 0 ? Math.min(100, Math.round(Number(f.total_pagado) / Number(f.monto) * 100)) : 0
          const isExpanded = expandida === f.id
          const its = itemsMap[f.id] || []
          return (
            <div key={f.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{f.numero}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-700)', marginTop: 2 }}>{f.cliente_nombre}</div>
                  </div>
                  <span className={`badge badge-${f.estado}`}>{f.estado}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Monto</div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(f.monto)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Pagado</div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: '#1D9E75' }}>{fmt(f.total_pagado)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Vence</div>
                    <div style={{ fontSize: 13, color: f.estado === 'vencida' ? '#A32D2D' : 'var(--gray-700)' }}>{fmtDate(f.fecha_vencimiento)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Cobrado</div>
                    <div style={{ fontSize: 13 }}>{pct}%</div>
                  </div>
                </div>
                <div className="progress-bar" style={{ marginBottom: 10 }}>
                  <div className="progress-fill" style={{ width: pct + '%' }} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => toggleExpandir(f.id)}>
                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    {isExpanded ? 'Ocultar ítems' : 'Ver ítems'}
                  </button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => window.location.href = '/pagos?factura=' + f.id}>
                    <CreditCard size={13} /> Pagar
                  </button>
                  <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(f.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Detalle ítems */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', padding: '12px 14px' }}>
                  {its.length === 0 ? (
                    <div style={{ fontSize: 13, color: 'var(--gray-500)', textAlign: 'center', padding: '8px 0' }}>Sin ítems registrados</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {its.map((item, i) => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
                          <div>
                            <div style={{ fontWeight: 500 }}>{item.descripcion}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{item.cantidad} x {fmt(item.precio_unitario)}</div>
                          </div>
                          <div style={{ fontWeight: 600 }}>{fmt(item.subtotal)}</div>
                        </div>
                      ))}
                      <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                        <span>Total</span>
                        <span>{fmt(f.monto)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modal nueva factura */}
      {modal === 'nueva' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Nueva factura</span>
              <button className="btn btn-icon btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cliente *</label>
                <select value={form.cliente_id} onChange={e => set('cliente_id', e.target.value)}>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Número *</label>
                  <input value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="FAC-001" />
                </div>
                <div className="form-group">
                  <label>Fecha emisión *</label>
                  <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Fecha vencimiento *</label>
                <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
              </div>

              {/* Ítems */}
              <div style={{ borderTop: '1px solid var(--gray-200)', paddingTop: 14 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Ítems de la factura</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 10, position: 'relative' }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>ÍTEM {idx + 1}</div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label>Del catálogo (opcional)</label>
                        <select value={item.producto_id} onChange={e => updateItem(item.id, 'producto_id', e.target.value)}>
                          <option value="">— Seleccionar producto —</option>
                          {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precio)}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ marginBottom: 8 }}>
                        <label>Descripción *</label>
                        <input value={item.descripcion} onChange={e => updateItem(item.id, 'descripcion', e.target.value)} placeholder="Descripción del ítem" />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Cantidad</label>
                          <input type="number" value={item.cantidad} onChange={e => updateItem(item.id, 'cantidad', e.target.value)} min="1" />
                        </div>
                        <div className="form-group">
                          <label>Precio unitario</label>
                          <input type="number" value={item.precio_unitario} onChange={e => updateItem(item.id, 'precio_unitario', e.target.value)} placeholder="0" />
                        </div>
                      </div>
                      {(parseFloat(item.cantidad) || 0) > 0 && (parseFloat(item.precio_unitario) || 0) > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--green-dark)', fontWeight: 600, marginTop: 6, textAlign: 'right' }}>
                          Subtotal: {fmt((parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0))}
                        </div>
                      )}
                      {items.length > 1 && (
                        <button className="btn btn-sm btn-danger" style={{ marginTop: 6, width: '100%', justifyContent: 'center' }} onClick={() => removeItem(item.id)}>
                          <Trash2 size={12} /> Quitar ítem
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} onClick={addItem}>
                  <Plus size={13} /> Agregar otro ítem
                </button>

                {totalItems > 0 && (
                  <div style={{ background: 'var(--green-light)', borderRadius: 'var(--radius)', padding: '10px 14px', marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: 'var(--green-dark)' }}>Total factura</span>
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--green-dark)' }}>{fmt(totalItems)}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Notas</label>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Notas opcionales..." rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
