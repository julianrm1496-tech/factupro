import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, today } from '../lib/utils'
import { generarFacturaPDF } from '../lib/pdf'
import { useUI } from '../hooks/useUI'
import { usePersistedState } from '../hooks/usePersistedState'
import { Plus, Trash2, CheckCircle, Calendar, CreditCard } from 'lucide-react'

const METODOS_PAGO = [
  'Transferencia bancaria',
  'Nequi',
  'Daviplata',
  'Llave',
  'Efectivo',
  'Cheque',
  'Tarjeta débito',
  'Tarjeta crédito',
  'Otro',
]

export default function Pagos() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast, confirmar } = useUI()
  const [pagos, setPagos] = useState([])
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ factura_id: '', monto: '', fecha: today(), metodo: 'Transferencia bancaria', referencia: '' })
  const [ordenPagos, setOrdenPagos] = usePersistedState('pagos-orden', { key: 'fecha', dir: 'desc' })

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
        id, factura_id, monto, fecha, metodo, referencia, created_at,
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
    if (!form.factura_id || !form.monto || !form.fecha) { toast('Completa los campos obligatorios', { tipo: 'error' }); return }
    const factura = facturas.find(f => f.id === form.factura_id)
    const monto = parseFloat(form.monto)
    if (factura && monto > Number(factura.saldo_pendiente)) {
      toast(`El monto supera el saldo pendiente de ${fmt(factura.saldo_pendiente)}`, { tipo: 'error', duracion: 5000 })
      return
    }
    setSaving(true)
    const { error } = await supabase.from('pagos').insert({
      factura_id: form.factura_id, monto, fecha: form.fecha,
      metodo: form.metodo, referencia: form.referencia,
    })
    if (error) { setSaving(false); toast('Error: ' + error.message, { tipo: 'error', duracion: 5000 }); return }

    // Descarga automatica del PDF de la factura con el pago ya reflejado
    const [{ data: facturaActualizada }, { data: pagosFactura }] = await Promise.all([
      supabase.from('facturas_resumen').select('*').eq('id', form.factura_id).single(),
      supabase.from('pagos').select('monto, fecha, metodo').eq('factura_id', form.factura_id).order('fecha'),
    ])
    if (facturaActualizada) {
      const [{ data: cliente }, { data: items }] = await Promise.all([
        supabase.from('clientes').select('*').eq('id', facturaActualizada.cliente_id).single(),
        supabase.from('factura_items').select('*').eq('factura_id', form.factura_id).order('created_at'),
      ])
      generarFacturaPDF({
        factura: facturaActualizada, cliente, items: items || [],
        totalPagado: facturaActualizada.total_pagado, pagos: pagosFactura || [],
      })
    }

    setSaving(false)
    setModal(null)
    toast(`Pago de ${fmt(monto)} registrado · PDF descargado`)
    load()
  }

  const eliminar = async (pago) => {
    const ok = await confirmar({
      titulo: 'Eliminar pago',
      mensaje: `Se eliminará el pago de ${fmt(pago.monto)} de la factura ${pago.facturas?.numero}. El saldo pendiente se recalculará.`,
      textoConfirmar: 'Eliminar',
    })
    if (!ok) return

    // Guardamos los datos para poder deshacer
    const respaldo = {
      factura_id: pago.factura_id, monto: pago.monto, fecha: pago.fecha,
      metodo: pago.metodo, referencia: pago.referencia,
    }
    const { error } = await supabase.from('pagos').delete().eq('id', pago.id)
    if (error) { toast('Error: ' + error.message, { tipo: 'error', duracion: 5000 }); return }
    load()
    toast(`Pago de ${fmt(pago.monto)} eliminado`, {
      tipo: 'info',
      duracion: 7000,
      onUndo: async () => {
        const { error: err2 } = await supabase.from('pagos').insert(respaldo)
        if (err2) { toast('No se pudo deshacer: ' + err2.message, { tipo: 'error' }); return }
        toast('Pago restaurado')
        load()
      },
    })
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleOrdenPagos = (key) => {
    setOrdenPagos(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'factura' ? 'asc' : 'desc' })
  }
  const textoOrdenPagos = (key, dir) => {
    if (key === 'fecha') return dir === 'asc' ? 'antiguas primero' : 'recientes primero'
    if (key === 'factura') return dir === 'asc' ? 'A-Z' : 'Z-A'
    return dir === 'asc' ? 'menor a mayor' : 'mayor a menor'
  }

  const pagosOrdenados = useMemo(() => {
    const arr = [...pagos]
    const { key, dir } = ordenPagos
    arr.sort((a, b) => {
      if (key === 'factura') {
        const va = a.facturas?.numero || ''
        const vb = b.facturas?.numero || ''
        return dir === 'asc' ? va.localeCompare(vb, 'es', { numeric: true }) : vb.localeCompare(va, 'es', { numeric: true })
      }
      let va = a[key], vb = b[key]
      if (key === 'fecha') { va = new Date(va).getTime(); vb = new Date(vb).getTime() }
      else { va = Number(va) || 0; vb = Number(vb) || 0 }
      return dir === 'asc' ? va - vb : vb - va
    })
    return arr
  }, [pagos, ordenPagos])

  const totalMes = pagos.filter(p => p.fecha?.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, p) => s + Number(p.monto), 0)
  const totalGeneral = pagos.reduce((s, p) => s + Number(p.monto), 0)

  if (loading) return (
    <div>
      <div className="skel-metrics" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {[0,1].map(i => (
          <div key={i} className="skel-metric">
            <div className="skeleton skel-line" style={{ width: '55%' }} />
            <div className="skeleton skel-line" style={{ width: '70%', height: 18, marginBottom: 0 }} />
          </div>
        ))}
      </div>
      {[0,1,2,3].map(i => <div key={i} className="skel-row"><div className="skeleton skel-line" style={{ width: '50%', marginBottom: 0 }} /></div>)}
    </div>
  )

  return (
    <div>
      <div className="metrics stagger-in carrusel metrics-2">
        <div className="metric metric-success"><div className="metric-label"><CheckCircle size={15} /> Total cobrado</div><div className="metric-value" style={{ color: 'var(--green-dark)' }}>{fmt(totalGeneral)}</div></div>
        <div className="metric metric-brand"><div className="metric-label"><Calendar size={15} /> Este mes</div><div className="metric-value">{fmt(totalMes)}</div></div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Historial de pagos ({pagos.length})</div>
        <button className="btn btn-primary btn-sm" onClick={openNuevo} disabled={facturas.length === 0}>
          <Plus size={14} /> Registrar pago
        </button>
      </div>

      {pagos.length > 1 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--gray-500)', marginRight: 2 }}>Ordenar por:</span>
          {[{ key: 'fecha', label: 'Fecha' }, { key: 'factura', label: 'Factura' }, { key: 'monto', label: 'Monto' }].map(o => (
            <button
              key={o.key}
              className="btn btn-sm"
              style={{ fontWeight: ordenPagos.key === o.key ? 700 : 500, background: ordenPagos.key === o.key ? 'var(--blue-light)' : 'var(--surface)', color: ordenPagos.key === o.key ? 'var(--blue)' : 'var(--gray-700)' }}
              onClick={() => toggleOrdenPagos(o.key)}
            >
              {o.label}{ordenPagos.key === o.key && (
                <span style={{ fontSize: 10.5, fontWeight: 500, opacity: .85 }}> · {textoOrdenPagos(o.key, ordenPagos.dir)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {facturas.length === 0 && pagos.length === 0 && <div className="empty">No hay facturas pendientes de pago</div>}

      <div className="card hide-mobile-block">
        <div className="table-wrapper">
          <table className="table-compact">
            <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th style={{ textAlign: 'right' }}>Monto</th><th>Método</th><th></th></tr></thead>
            <tbody>
              {pagos.length === 0 ? <tr><td colSpan={6}>
                <div className="empty-rich">
                  <div className="empty-rich-icon"><CreditCard size={26} /></div>
                  <div className="empty-rich-title">Aún no hay pagos registrados</div>
                  <div className="empty-rich-text">
                    {facturas.length === 0
                      ? 'Cuando tengas facturas pendientes, podrás registrar sus pagos aquí.'
                      : 'Registra el primer abono o pago completo de una factura.'}
                  </div>
                  {facturas.length > 0 && <button className="btn btn-primary" onClick={openNuevo}><Plus size={15} /> Registrar pago</button>}
                </div>
              </td></tr> : pagosOrdenados.map(p => (
                <tr key={p.id} className="row-clickable" onClick={() => navigate('/facturas?factura=' + p.factura_id)}>
                  <td style={{ color: 'var(--gray-500)' }}>{fmtDate(p.fecha)}</td>
                  <td style={{ fontWeight: 600 }}>{p.facturas?.numero}</td>
                  <td>{p.facturas?.clientes?.nombre}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmt(p.monto)}</td>
                  <td><span className="badge badge-blue">{p.metodo}</span></td>
                  <td onClick={e => e.stopPropagation()}><button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p)}><Trash2 size={13} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="show-mobile-block">
       <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {pagosOrdenados.map(p => (
          <div key={p.id} className="factura-card-mobile" onClick={() => navigate('/facturas?factura=' + p.factura_id)} style={{ cursor: 'pointer' }}>
            <div className="fcm-top">
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--green)' }}>{fmt(p.monto)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600 }}>{p.facturas?.numero}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p.facturas?.clientes?.nombre}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{fmtDate(p.fecha)}</div>
                <span className="badge badge-blue" style={{ marginTop: 4 }}>{p.metodo}</span>
              </div>
            </div>
            <div className="fcm-actions" onClick={e => e.stopPropagation()}>
              <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p)}><Trash2 size={13} /></button>
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
                  <div style={{ background: 'var(--surface-success)', border: '1px solid var(--surface-success-border)', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    Saldo pendiente: <strong style={{ color: 'var(--green-dark)' }}>{fmt(f.saldo_pendiente)}</strong>
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
                  {METODOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
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
