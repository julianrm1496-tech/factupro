import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList,
  PieChart, Pie, Cell
} from 'recharts'

const COLORS = { pagada: '#1D9E75', pendiente: '#F59E0B', vencida: '#EF4444' }

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: facturas }, { data: pagos }] = await Promise.all([
      supabase.from('facturas_resumen').select('*'),
      supabase.from('pagos').select('*').order('fecha', { ascending: false }).limit(200),
    ])
    setData({ facturas: facturas || [], pagos: pagos || [] })
    setLoading(false)
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  const { facturas, pagos } = data

  const totalFacturado = facturas.reduce((s, f) => s + Number(f.monto), 0)
  const totalCobrado = facturas.reduce((s, f) => s + Number(f.total_pagado), 0)
  const totalPendiente = totalFacturado - totalCobrado
  const vencidas = facturas.filter(f => f.estado === 'vencida')
  const totalVencido = vencidas.reduce((s, f) => s + Number(f.saldo_pendiente), 0)

  const porEstado = [
    { name: 'Pagadas', value: facturas.filter(f => f.estado === 'pagada').length, color: COLORS.pagada },
    { name: 'Pendientes', value: facturas.filter(f => f.estado === 'pendiente').length, color: COLORS.pendiente },
    { name: 'Vencidas', value: facturas.filter(f => f.estado === 'vencida').length, color: COLORS.vencida },
  ].filter(d => d.value > 0)
  const totalFacturas = facturas.length

  const mesMap = {}
  pagos.forEach(p => {
    const m = p.fecha?.slice(0, 7)
    if (m) mesMap[m] = (mesMap[m] || 0) + Number(p.monto)
  })
  const meses = Object.entries(mesMap).sort().slice(-6).map(([k, v]) => ({
    mes: new Date(k + '-01').toLocaleDateString('es-CO', { month: 'short' }),
    cobrado: v,
  }))

  const porCliente = {}
  facturas.forEach(f => {
    if (!porCliente[f.cliente_id]) porCliente[f.cliente_id] = { nombre: f.cliente_nombre, pendiente: 0 }
    porCliente[f.cliente_id].pendiente += Number(f.saldo_pendiente)
  })
  const topClientes = Object.values(porCliente).filter(c => c.pendiente > 0).sort((a, b) => b.pendiente - a.pendiente).slice(0, 5)
  const maxPendiente = Math.max(...topClientes.map(c => c.pendiente), 1)

  const recentesVencidas = vencidas.slice(0, 5)

  return (
    <div>
      <div className="metrics">
        <div className="metric metric-gradient" style={{ '--grad-from': '#1D9E75', '--grad-to': '#0F6E56' }}>
          <div className="metric-label" style={{ color: 'rgba(255,255,255,.85)' }}>Total facturado</div>
          <div className="metric-value" style={{ color: '#fff' }}>{fmt(totalFacturado)}</div>
          <div className="metric-sub" style={{ color: 'rgba(255,255,255,.7)' }}>{facturas.length} facturas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cobrado</div>
          <div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(totalCobrado)}</div>
          <div className="metric-sub">{totalFacturado > 0 ? Math.round(totalCobrado / totalFacturado * 100) : 0}% del total</div>
        </div>
        <div className="metric">
          <div className="metric-label">Por cobrar</div>
          <div className="metric-value" style={{ color: '#854F0B' }}>{fmt(totalPendiente)}</div>
          <div className="metric-sub">{facturas.filter(f => f.estado !== 'pagada').length} activas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencido</div>
          <div className="metric-value" style={{ color: '#A32D2D' }}>{fmt(totalVencido)}</div>
          <div className="metric-sub">{vencidas.length} vencidas</div>
        </div>
      </div>

      <div className="dash-row">
        <div className="card">
          <div className="card-header"><span className="card-header-title">Cobros por mes</span></div>
          <div className="card-body">
            {meses.length === 0 ? <div className="empty">Sin datos aun</div> : (
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={meses} barSize={36} margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" />
                      <stop offset="100%" stopColor="#0F6E56" />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="mes" tick={{ fontSize: 12, fill: 'var(--gray-500)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => [fmt(v), 'Cobrado']} cursor={{ fill: 'rgba(29,158,117,.06)' }} />
                  <Bar dataKey="cobrado" fill="url(#barGrad)" radius={[8, 8, 0, 0]}>
                    <LabelList
                      dataKey="cobrado"
                      position="top"
                      formatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : `${Math.round(v/1000)}k`}
                      style={{ fontSize: 11, fontWeight: 700, fill: 'var(--gray-700)' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-header-title">Estado de facturas</span></div>
          <div className="card-body" style={{ position: 'relative' }}>
            {porEstado.length === 0 ? <div className="empty">Sin facturas aun</div> : (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <defs>
                      {porEstado.map((d, i) => (
                        <radialGradient id={`pieGrad${i}`} key={i} cx="35%" cy="35%" r="70%">
                          <stop offset="0%" stopColor={d.color} stopOpacity={1} />
                          <stop offset="100%" stopColor={d.color} stopOpacity={0.75} />
                        </radialGradient>
                      ))}
                    </defs>
                    <Pie
                      data={porEstado}
                      dataKey="value"
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={90}
                      paddingAngle={3}
                      cornerRadius={6}
                      stroke="none"
                    >
                      {porEstado.map((d, i) => <Cell key={i} fill={`url(#pieGrad${i})`} />)}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -46%)',
                  textAlign: 'center', pointerEvents: 'none'
                }}>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--gray-900)' }}>{totalFacturas}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>facturas</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 4, flexWrap: 'wrap' }}>
                  {porEstado.map((d, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color, display: 'inline-block' }} />
                      <span style={{ color: 'var(--gray-700)', fontWeight: 500 }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="dash-row">
        <div className="card">
          <div className="card-header"><span className="card-header-title">Clientes con mayor saldo pendiente</span></div>
          <div className="card-body">
            {topClientes.length === 0 ? <div className="empty">Sin pendientes</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {topClientes.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{c.nombre}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#854F0B' }}>{fmt(c.pendiente)}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(c.pendiente / maxPendiente) * 100}%`,
                        background: 'linear-gradient(90deg, #FBBF24, #F59E0B)',
                        borderRadius: 4,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-header-title">Facturas vencidas</span></div>
          <div className="card-body">
            {recentesVencidas.length === 0 ? (
              <div className="empty" style={{ color: '#1D9E75' }}>Sin facturas vencidas</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recentesVencidas.map(f => (
                  <div key={f.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#FEF2F2', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{f.numero}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{f.cliente_nombre}</div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#A32D2D', fontSize: 13 }}>{fmt(f.saldo_pendiente)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
