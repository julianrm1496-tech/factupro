import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today } from '../lib/utils'
import { Plus, Trash2, Mail } from 'lucide-react'

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
    const [{ data: pagosData }, { data: f }] = await Promise.all([
      supabase.from('pagos').select(`
        id, monto, fecha, metodo, referencia, notas, created_at,
        facturas!inner(
          id, numero, monto,
          clientes!inner(nombre, email)
        )
      `).order('fecha', { ascending: false }),
      supabase.from('facturas_resumen').select('id, numero, cliente_nombre, cliente_email, monto, saldo_pendiente, estado').neq('estado', 'pagada').order('numero'),
    ])
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
    const { data: pago, error } = await supabase.from('pagos').insert({
      factura_id: form.factura_id, monto, fecha: form.fecha,
      metodo: form.metodo, referencia: form.referencia, notas: form.notas,
    }).select().single()
    setSaving(false)
    if (error) { alert('Error: ' + error.message); return }
    setModal(null)
    await load()

    // Ofrecer enviar recibo por email
    const saldoNuevo = Number(factura?.saldo_pendiente) - monto
    enviarRecibo({
      clienteEmail: factura?.cliente_email,
      clienteNombre: factura?.cliente_nombre,
      numeroFactura: factura?.numero,
      montoPago: monto,
      saldoPendiente: saldoNuevo < 0 ? 0 : saldoNuevo,
      fecha: form.fecha,
      metodo: form.metodo,
      referencia: form.referencia,
    })
  }

  const enviarRecibo = ({ clienteEmail, clienteNombre, numeroFactura, montoPago, saldoPendiente, fecha, metodo, referencia }) => {
    if (!clienteEmail) {
      alert('Este cliente no tiene email registrado. Agrega su correo en el módulo de Clientes.')
      return
    }

    const asunto = `Recibo de pago - ${numeroFactura}`
    const cuerpo = `Estimado/a ${clienteNombre},

Le confirmamos el registro del siguiente pago:

📄 Factura: ${numeroFactura}
💰 Monto pagado: ${fmt(montoPago)}
📅 Fecha: ${fmtDate(fecha)}
💳 Método: ${metodo}
${referencia ? `🔖 Referencia: ${referencia}` : ''}
${saldoPendiente > 0
  ? `\n⚠️ Saldo pendiente: ${fmt(saldoPendiente)}`
  : '\n✅ Factura pagada en su totalidad.'
}

Gracias por su pago.`

    const mailtoUrl = `mailto:${clienteEmail}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
    window.open(mailtoUrl, '_blank')
  }

  const enviarReciboPago = (p) => {
    const factura = p.facturas
    const cliente = factura?.clientes
    if (!cliente?.email) {
      alert('Este cliente no tiene email registrado.')
      return
    }
    const asunto = `Recibo de pago - ${factura?.numero}`
    const cuerpo = `Estimado/a ${cliente?.nombre},

Le confirmamos el registro del siguiente pago:

📄 Factura: ${factura?.numero}
💰 Monto pagado: ${fmt(p.monto)}
📅 Fecha: ${fmtDate(p.fecha)}
💳 Método: ${p.metodo}
${p.referencia ? `🔖 Referencia: ${p.referencia}` : ''}

Gracias por su pago.`

    const mailtoUrl = `mailto:${cliente?.email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
    window.open(mailtoUrl, '_blank')
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
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Total cobrado</div>
          <div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(totalGeneral)}</div>
          <div className="metric-sub">{pagos.length} registros</div>
        </div>
        <div className="metric">
          <div className="metric-label">Este mes</div>
          <div className="metric-value">{fmt(totalMes)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Historial de pagos ({pagos.length})</div>
        <button className="btn btn-primary btn-sm" onClick={openNuevo} disabled={facturas.length === 0}>
          <Plus size={14} /> Registrar pago
        </button>
      </div>

      {facturas.length === 0 && pagos.length === 0 && (
        <div className="empty">No hay facturas pendientes de pago</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pagos.map(p => (
          <div key={p.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#1D9E75' }}>{fmt(p.monto)}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{p.facturas?.numero}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.facturas?.clientes?.nombre}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDate(p.fecha)}</div>
                <span className="badge badge-blue" style={{ marginTop: 4 }}>{p.metodo}</span>
              </div>
            </div>
            {(p.referencia || p.notas) && (
              <div style={{ fontSize: 12, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)', paddingTop: 6, marginTop: 6 }}>
                {p.referencia || p.notas}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button
                className="btn btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => enviarReciboPago(p)}
              >
                <Mail size={13} /> Enviar recibo
              </button>
              <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p.id)}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
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
                    {f.cliente_email && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>📧 Recibo se enviará a: {f.cliente_email}</div>}
                  </div>
                ) : null
              })()}
              <div className="form-row">
                <div className="form-group">
                  <label>Monto (COP) *</label>
                  <input type="number" value={form.monto} onChange={e => set('monto', e.target.value)} placeholder="0" />
                </div>
                <div className="form-group">
                  <label>Fecha *</label>
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
              <div className="form-group">
                <label>Referencia / No. operación</label>
                <input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="TRF-123456" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : '💾 Guardar y enviar recibo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
