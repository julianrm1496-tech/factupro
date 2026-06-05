import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, nextFacturaNumber, today } from '../lib/utils'
import { Plus, Trash2, CreditCard, Search } from 'lucide-react'

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // 'nueva' | null
  const [filtro, setFiltro] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: f }, { data: c }] = await Promise.all([
      supabase.from('facturas_resumen').select('*').order('fecha_emision', { ascending: false }),
      supabase.from('clientes').select('id, nombre').order('nombre'),
    ])
    setFacturas(f || [])
    setClientes(c || [])
    setLoading(false)
  }

  const openNueva = () => {
    setForm({
      numero: nextFacturaNumber(facturas),
      cliente_id: clientes[0]?.id || '',
      fecha_emision: today(),
      fecha_vencimiento: '',
      monto: '',
      descripcion: '',
      notas: '',
    })
    setModal('nueva')
  }

  const guardar = async () => {
    if (!form.numero || !form.cliente_id || !form.fecha_emision || !form.fecha_vencimiento || !form.monto) {
      alert('Completa todos los campos obligatorios')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('facturas').insert({
      numero: form.numero,
      cliente_id: form.cliente_id,
      fecha_emision: form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento,
      monto: parseFloat(form.monto),
      descripcion: form.descripcion,
      notas: form.notas,
    })
    setSaving(false)
    if (error) { alert('Error al guardar: ' + error.message); return }
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
  const pendiente = total - cobrado

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
          <div className="metric-value" style={{ color: '#854F0B' }}>{fmt(pendiente)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencidas</div>
          <div className="metric-value" style={{ color: '#A32D2D' }}>
            {filtered.filter(f => f.estado === 'vencida').length}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Facturas ({filtered.length})</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="filters">
              <input
                placeholder="Buscar factura o cliente..."
                value={filtro}
                onChange={e => setFiltro(e.target.value)}
              />
              <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                <option value="pagada">Pagadas</option>
                <option value="pendiente">Pendientes</option>
                <option value="vencida">Vencidas</option>
              </select>
            </div>
            <button className="btn btn-primary" onClick={openNueva}>
              <Plus size={15} /> Nueva factura
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Factura</th>
                <th>Cliente</th>
                <th className="hide-mobile">Emisión</th>
                <th>Vencimiento</th>
                <th>Monto</th>
                <th>Pagado</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty">No hay facturas que mostrar</div></td></tr>
              ) : filtered.map(f => {
                const pct = f.monto > 0 ? Math.min(100, Math.round(Number(f.total_pagado) / Number(f.monto) * 100)) : 0
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600 }}>{f.numero}</td>
                    <td>{f.cliente_nombre}</td>
                    <td className="hide-mobile" style={{ color: '#6B7280' }}>{fmtDate(f.fecha_emision)}</td>
                    <td style={{ color: f.estado === 'vencida' ? '#A32D2D' : '#6B7280' }}>{fmtDate(f.fecha_vencimiento)}</td>
                    <td>{fmt(f.monto)}</td>
                    <td>
                      <div>{fmt(f.total_pagado)}</div>
                      <div className="progress-bar" style={{ width: 80 }}>
                        <div className="progress-fill" style={{ width: pct + '%' }} />
                      </div>
                    </td>
                    <td><span className={`badge badge-${f.estado}`}>{f.estado}</span></td>
                    <td>
                      <div className="actions-row">
                        <button
                          className="btn btn-sm btn-icon"
                          title="Registrar pago"
                          onClick={() => window.location.href = '/pagos?factura=' + f.id}
                        ><CreditCard size={13} /></button>
                        <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(f.id)} title="Eliminar">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
                  <label>Número de factura *</label>
                  <input value={form.numero} onChange={e => set('numero', e.target.value)} placeholder="FAC-001" />
                </div>
                <div className="form-group">
                  <label>Monto total (COP) *</label>
                  <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha de emisión *</label>
                  <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Fecha de vencimiento *</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Servicios de..." rows={2} />
              </div>
              <div className="form-group">
                <label>Notas internas</label>
                <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Notas opcionales..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? <><div className="spinner" style={{ borderTopColor: '#fff', width: 14, height: 14 }} /> Guardando...</> : 'Guardar factura'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
