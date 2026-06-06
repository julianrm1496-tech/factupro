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
  const [form, setForm] = useState({ factura_id: '', monto: '', fecha: today(), metodo: 'Transferencia bancaria', referencia: '', notas: '' })

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
    const [{ data: p }, { data: f }] = await Promise.all([
      supabase.from('pagos').select('*, facturas(numero, cliente_id, monto, facturas_resumen(cliente_nombre))').order('fecha', { ascending: false }),
      supabase.from('facturas_resumen').select('id, numero, cliente_nombre, monto, saldo_pendiente, estado').neq('estado', 'pagada').order('numero'),
    ])
    // For pagos, get client name separately
    const { data: pagosData } = await supabase
      .from('pagos')
      .select(`id, monto, fecha, metodo, referencia, notas, created_at,
        facturas!inner(numero, cliente_id, monto,
          clientes!inner(nombre)
        )`)
      .order('fecha', { ascending: false })
    setPagos(pagosData || [])
    setFacturas(f || [])
    setLoading(false)
  }

  const openNuevo = () => {
    setForm({ factura_id: facturas[0]?.id || '', monto: '', fecha: today(), metodo: 'Transferencia bancaria', referencia: '', notas: '' })
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
      factura_id: form.factura_id,
      monto,
      fecha: form.fecha,
      metodo: form.metodo,
      referencia: form.referencia,
      notas: form.notas,
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

  const totalMes = pagos
    .filter(p => p.fecha?.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, p) => s + Number(p.monto), 0)

  const totalGeneral = pagos.reduce((s, p) => s + Number(p.monto), 0)

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="metric">
          <div className="metric-label">Total cobrado</div>
          <div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(totalGeneral)}</div>
          <div className="metric-sub">{pagos.length} registros</div>
        </div>
        <div className="metric">
          <div className="metric-label">Este mes</div>
          <div className="metric-value">{fmt(totalMes)}</div>
        </div>
        <div className="metric">
          <div className="metric-label">Facturas con saldo</div>
          <div className="metric-value" style={{ color: '#854F0B' }}>{facturas.length}</div>
          <div className="metric-sub">pendientes de cobro</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-header-title">Historial de pagos ({pagos.length})</span>
          <button className="btn btn-primary" onClick={openNuevo} disabled={facturas.length === 0}>
            <Plus size={15} /> Registrar pago
          </button>
        </div>
        {facturas.length === 0 && pagos.length === 0 && (
          <div className="empty">No hay facturas pendientes de pago</div>
        )}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Factura</th>
                <th className="hide-mobile">Cliente</th>
                <th>Monto</th>
                <th className="hide-mobile">Método</th>
                <th className="hide-mobile">Referencia</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pagos.length === 0 ? (
                <tr><td colSpan={7}><div className="empty">No hay pagos registrados</div></td></tr>
              ) : pagos.map(p => (
                <tr key={p.id}>
                  <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(p.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{p.facturas?.numero}</td>
                  <td className="hide-mobile">{p.facturas?.clientes?.nombre}</td>
                  <td style={{ fontWeight: 700, color: '#1D9E75' }}>{fmt(p.monto)}</td>
                  <td className="hide-mobile"><span className="badge badge-blue">{p.metodo}</span></td>
                  <td className="hide-mobile" style={{ color: '#6B7280', fontSize: 12 }}>{p.referencia || p.notas || '—'}</td>
                  <td>
                    <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p.id)}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  {facturas.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.numero} — {f.cliente_nombre} (saldo: {fmt(f.saldo_pendiente)})
                    </option>
                  ))}
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
                <div className="form-group">
                  <label>Monto del pago (COP) *</label>
                  <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" autoFocus />
                </div>
                <div className="form-group">
                  <label>Fecha de pago *</label>
                  <input type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Método de pago</label>
                <select value={form.metodo} onChange={e => set('metodo', e.target.value)}>
                  <option>Transferencia bancaria</option>
                  <option>Efectivo</option>
                  <option>Cheque</option>
                  <option>Tarjeta débito</option>
                  <option>Tarjeta crédito</option>
                  <option>Otro</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Referencia / No. operación</label>
                  <input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="TRF-123456" />
                </div>
                <div className="form-group">
                  <label>Notas</label>
                  <input value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Opcional..." />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Registrar pago'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
