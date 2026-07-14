import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate } from '../lib/utils'
import { CreditCard } from 'lucide-react'

export default function Cartera() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [orden, setOrden] = useState('fecha') // fecha | cliente | monto

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data: f } = await supabase.from('facturas_resumen').select('*').neq('estado', 'pagada')
    setFacturas(f || [])
    setLoading(false)
  }

  const sorted = [...facturas].sort((a, b) => {
    if (orden === 'cliente') return (a.cliente_nombre || '').localeCompare(b.cliente_nombre || '')
    if (orden === 'monto') return Number(b.saldo_pendiente) - Number(a.saldo_pendiente)
    return new Date(a.fecha_emision) - new Date(b.fecha_emision)
  })

  const totalCartera = facturas.reduce((s, f) => s + Number(f.saldo_pendiente), 0)
  const totalVencido = facturas.filter(f => f.estado === 'vencida').reduce((s, f) => s + Number(f.saldo_pendiente), 0)

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="metric">
          <div className="metric-label">Total cartera</div>
          <div className="metric-value" style={{ color: '#854F0B' }}>{fmt(totalCartera)}</div>
          <div className="metric-sub">{facturas.length} facturas pendientes</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencido</div>
          <div className="metric-value" style={{ color: '#A32D2D' }}>{fmt(totalVencido)}</div>
          <div className="metric-sub">{facturas.filter(f => f.estado === 'vencida').length} facturas vencidas</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 14 }}>Facturas por cobrar ({sorted.length})</div>
        <select value={orden} onChange={e => setOrden(e.target.value)} style={{ width: 'auto', height: 36 }}>
          <option value="fecha">Más antiguas primero</option>
          <option value="cliente">Por cliente</option>
          <option value="monto">Mayor saldo primero</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        <div className="empty" style={{ color: '#1D9E75' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🎉</div>
          ¡Cartera al día! No hay facturas pendientes de cobro.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {sorted.map(f => (
            <div
              key={f.id}
              style={{
                background: f.estado === 'vencida' ? '#FFF5F5' : '#FFFDE7',
                border: `1px solid ${f.estado === 'vencida' ? '#FECACA' : '#FDE68A'}`,
                borderLeft: `4px solid ${f.estado === 'vencida' ? '#A32D2D' : '#F59E0B'}`,
                borderRadius: 'var(--radius-lg)',
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{f.numero}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{fmtDate(f.fecha_emision)}</span>
                  {f.estado === 'vencida' && <span className="badge badge-vencida">vencida</span>}
                </div>
                <div style={{ fontSize: 13, marginTop: 2, fontWeight: 500 }}>{f.cliente_nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                  Total: {fmt(f.monto)} · Pagado: {fmt(f.total_pagado)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Debe</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: f.estado === 'vencida' ? '#A32D2D' : '#854F0B' }}>
                  {fmt(f.saldo_pendiente)}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => window.location.href = '/pagos?factura=' + f.id}
              >
                <CreditCard size={13} /> Abonar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
