import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, nextFacturaNumber, today } from '../lib/utils'
import { Plus, Trash2, CreditCard } from 'lucide-react'

export default function Facturas() {
  const [facturas, setFacturas] = useState([])
  const [clientes, setClientes] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
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

      {/* Filtros y botón */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="Buscar factura o cliente..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
          style={{ flex: 1, minWidth: 0, height: 38 }}
        />
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          style={{ width: 'auto', height: 38, flex: '0 0 auto' }}
        >
          <option value="">Todos</option>
          <option value="pagada">Pagadas</option>
          <option value="pendiente">Pendientes</option>
          <option value="vencida">Vencidas</option>
        </select>
        <button className="btn btn-primary" onClick={openNueva} style={{ height: 38 }}>
          <Plus size={15} /> Nueva
        </button>
      </div>

      {/* Lista de facturas — tarjetas en móvil */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 ? (
          <div className="empty">No hay facturas que mostrar</div>
        ) : filtered.map(f => {
          const pct = f.monto > 0 ? Math.min(100, Math.round(Number(f.total_pagado) / Number(f.monto) * 100)) : 0
          return (
            <div key={f.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{f.numero}</div>
                  <div style={{ fontSize: 13, color: 'var(--gray-700)', marginTop: 2 }}>{f.cliente_nombre}</div>
                </div>
                <span className={`badge badge-${f.estado}`}>{f.estado}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Monto</div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{fmt(f.monto)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Pagado</div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1D9E75' }}>{fmt(f.total_pagado)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Vence</div>
                  <div style={{ fontSize: 13, color: f.estado === 'vencida' ? '#A32D2D' : 'var(--gray-700)' }}>{fmtDate(f.fecha_vencimiento)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: '.3px' }}>Cobrado</div>
                  <div style={{ fontSize: 13 }}>{pct}%</div>
                </div>
              </div>
              <div className="progress-bar" style={{ marginBottom: 10 }}>
                <div className="progress-fill" style={{ width: pct + '%' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => window.location.href = '/pagos?factura=' + f.id}
                >
                  <CreditCard size={13} /> Registrar pago
                </button>
                <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(f.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

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
                  <label>Monto (COP) *</label>
                  <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Fecha emisión *</label>
                  <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Fecha vencimiento *</label>
                  <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Servicios de..." rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
