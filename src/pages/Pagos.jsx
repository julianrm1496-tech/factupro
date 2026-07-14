import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today } from '../lib/utils'
import { Plus, Trash2 } from 'lucide-react'

export default function Pagos() {
  const location = useLocation()
  const [pagos, setPagos] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ factura_id: '', monto: '', fecha: today(), metodo: 'Transferencia bancaria', referencia: '' })

  useEffect(() => { load() }, [])

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const facId = params.get('factura')
    if (facId && facturas.length > 0) {
      setForm(f => ({ ...f, factura_id: facId }))
      setModal('nuevo')
    }
  }, [location.search, facturas])

  const load = async () => {
    setLoading(true)
    const [{ data: pagosData }, { data: f }] = await Promise.all([
      supabase.from('pagos').select(`
        id, monto, fecha, metodo, referencia, created_at,
        facturas!inner(numero, clientes!inner(nombre))
      `).order('fecha', { ascending: false }),
      supabase.from('facturas_resumen').select('id, numero, cliente_nombre, monto, saldo_pendiente, estado').neq('estado', 'pagada').order('numero'),
    ])
    setPagos(pagosData || [])
    setFacturas(f || [])
    setLoading(false)
  }

  const openNuevo = () => {
    setForm({ factura_id: facturas[0]?.id || '', monto: '', fecha: today(), metodo: 'Transferencia bancaria', referencia: '' })
    setModal('nuevo')
  }

  const guardar = async () => {
    if (!form.factura_id || !form.monto || !form.fecha) { alert('Completa los campos obligatorios'); return }
    const factura = facturas.find(f => f.id === form.factura_id)
    const monto = parseFloat(form.monto)
    if (factura && monto > Number(factura.saldo_pendiente)) {
      alert(`El monto supera el saldo pendiente de ${fmt(factura.saldo_pendiente)}`)
      return
    }
    setSaving(true)
    const { error } = await supabase.from('pagos').insert({
      factura_id: form.factura_id, monto, fecha: form.fecha,
      metodo: form.metodo, referencia: form.referencia,
    })
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setModal(null)
    load()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este registro de pago?')) return
    await supabase.from('pagos').delete().eq('id', id)
    load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const totalMes = pagos.filter(p => p.fecha?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + Number(p.monto), 0)
  const totalGeneral = pagos.reduce((s, p) => s + Number(p.monto), 0)

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="metric"><div className="metric-label">Total cobrado</div><div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(totalGeneral)}</div></div>
        <div className="metric"><div className="metric-label">Este mes</div><div className="metric-value">{fmt(totalMes)}</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Historial de pagos ({pagos.length})</div>
        <button className="btn btn-primary btn-sm" onClick={openNuevo} disabled={facturas.length === 0}>
          <Plus size={14} /> Registrar pago
        </button>
      </div>

      {facturas.length === 0 && pagos.length === 0 && <div className="empty">No hay facturas pendientes de pago</div>}

      <div className="card hide-mobile-block">
        <div className="table-wrapper">
          <table className="table-compact">
            <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Monto</th><th>Método</th><th></th></tr></thead>
            <tbody>
              {pagos.length === 0 ? <tr><td colSpan={6}><div className="empty">No hay pagos registrados</div></td></tr> : pagos.map(p => (
                <tr key={p.id}>
                  <td style={{ color: 'var(--gray-500)' }}>{fmtDate(p.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{p.facturas?.numero}</td>
                  <td>{p.facturas?.clientes?.nombre}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#1D9E75' }}>{fmt(p.monto)}</td>
                  <td><span className="badge badge-blue">{p.metodo}</span></td>
                  <td><button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p.id)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="show-mobile-block">
       <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pagos.map(p => (
          <div key={p.id} className="factura-card-mobile">
            <div className="fcm-top">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1D9E75' }}>{fmt(p.monto)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.facturas?.numero}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.facturas?.clientes?.nombre}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{fmtDate(p.fecha)}</div>
                <span className="badge badge-blue" style={{ marginTop: 4 }}>{p.metodo}</span>
              </div>
            </div>
            <div className="fcm-actions">
              <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
       </div>
      </div>

      {modal === 'nuevo' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">Registrar pago / abono</span>
              <button className="btn btn-icon btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Factura *</label>
                <select value={form.factura_id} onChange={e => set('factura_id', e.target.value)}>
                  {facturas.map(f => <option key={f.id} value={f.id}>{f.numero} — {f.cliente_nombre} (saldo: {fmt(f.saldo_pendiente)})</option>)}
                </select>
              </div>
              {form.factura_id && (() => {
                const f = facturas.find(x => x.id === form.factura_id)
                return f ? (
                  <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    Saldo pendiente: <strong style={{ color: '#15803D' }}>{fmt(f.saldo_pendiente)}</strong>
                  </div>
                ) : null
              })()}
              <div className="form-row">
                <div className="form-group"><label>Monto (COP) *</label><input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Fecha *</label><input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} /></div>
              </div>
              <div className="form-group">
                <label>Método de pago</label>
                <select value={form.metodo} onChange={e => set('metodo', e.target.value)}>
                  <option>Transferencia bancaria</option><option>Efectivo</option><option>Cheque</option>
                  <option>Tarjeta débito</option><option>Tarjeta crédito</option><option>Otro</option>
                </select>
              </div>
              <div className="form-group"><label>Referencia (opcional)</label><input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="TRF-123456" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Registrar pago'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
