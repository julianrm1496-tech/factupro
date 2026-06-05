import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, fmtDate, estadoColor } from '../lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#1D9E75', '#FBBF24', '#EF4444', '#3B82F6']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: facturas }, { data: pagos }, { data: clientes }] = await Promise.all([
      supabase.from('facturas_resumen').select('*'),
      supabase.from('pagos').select('*').order('fecha', { ascending: false }).limit(100),
      supabase.from('clientes').select('id, nombre'),
    ])
    setData({ facturas: facturas || [], pagos: pagos || [], clientes: clientes || [] })
    setLoading(false)
  }

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  const { facturas, pagos, clientes } = data

  const totalFacturado = facturas.reduce((s, f) => s + Number(f.monto), 0)
  const totalCobrado = facturas.reduce((s, f) => s + Number(f.total_pagado), 0)
  const totalPendiente = totalFacturado - totalCobrado
  const vencidas = facturas.filter(f => f.estado === 'vencida')
  const totalVencido = vencidas.reduce((s, f) => s + Number(f.saldo_pendiente), 0)

  // Pie chart estados
  const porEstado = [
    { name: 'Pagadas', value: facturas.filter(f => f.estado === 'pagada').length },
    { name: 'Pendientes', value: facturas.filter(f => f.estado === 'pendiente').length },
    { name: 'Vencidas', value: facturas.filter(f => f.estado === 'vencida').length },
  ].filter(d => d.value > 0)

  // Bar chart: pagos por mes (últimos 6 meses)
  const mesMap = {}
  pagos.forEach(p => {
    const m = p.fecha?.slice(0, 7)
    if (m) mesMap[m] = (mesMap[m] || 0) + Number(p.monto)
  })
  const meses = Object.entries(mesMap).sort().slice(-6).map(([k, v]) => ({
    mes: new Date(k + '-01').toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
    cobrado: v,
  }))

  // Top 5 clientes por saldo pendiente
  const porCliente = {}
  facturas.forEach(f => {
    if (!porCliente[f.cliente_id]) porCliente[f.cliente_id] = { nombre: f.cliente_nombre, pendiente: 0, total: 0 }
    porCliente[f.cliente_id].pendiente += Number(f.saldo_pendiente)
    porCliente[f.cliente_id].total += Number(f.monto)
  })
  const topClientes = Object.values(porCliente).sort((a, b) => b.pendiente - a.pendiente).slice(0, 5)

  const recentesVencidas = vencidas.slice(0, 5)

  return (
    <div>
      {/* Métricas */}
      <div className="metrics">
        <div className="metric">
          <div className="metric-label">Total facturado</div>
          <div className="metric-value">{fmt(totalFacturado)}</div>
          <div className="metric-sub">{facturas.length} facturas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cobrado</div>
          <div className="metric-value" style={{ color: '#1D9E75' }}>{fmt(totalCobrado)}</div>
          <div className="metric-sub">{totalFacturado > 0 ? Math.round(totalCobrado / totalFacturado * 100) : 0}% del total</div>
        </div>
        <div className="metric">
          <div className="metric-label">Por cobrar</div>
          <div className="metric-value" style={{ color: '#854F0B' }}>{fmt(totalPendiente)}</div>
          <div className="metric-sub">{facturas.filter(f => f.estado !== 'pagada').length} facturas activas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencido</div>
          <div className="metric-value" style={{ color: '#A32D2D' }}>{fmt(totalVencido)}</div>
          <div className="metric-sub">{vencidas.length} facturas vencidas</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16, marginBottom: 16 }}>
        {/* Bar chart */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Cobros por mes</span></div>
          <div className="card-body">
            {meses.length === 0 ? (
              <div className="empty">Sin datos de pagos aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={meses} barSize={28}>
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => fmt(v).replace('$', '').replace(/\s/g, '')} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip formatter={(v) => [fmt(v), 'Cobrado']} />
                  <Bar dataKey="cobrado" fill="#1D9E75" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Pie chart */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Estado facturas</span></div>
          <div className="card-body">
            {porEstado.length === 0 ? (
              <div className="empty">Sin facturas aún</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porEstado} dataKey="value" cx="50%" cy="45%" outerRadius={70} label={({ name, value }) => `${value}`}>
                    {porEstado.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Top clientes */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Clientes con mayor saldo pendiente</span></div>
          <div>
            {topClientes.length === 0 ? (
              <div className="empty">Sin pendientes</div>
            ) : (
              <table>
                <thead><tr><th>Cliente</th><th>Pendiente</th></tr></thead>
                <tbody>
                  {topClientes.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                      <td style={{ color: c.pendiente > 0 ? '#854F0B' : '#1D9E75', fontWeight: 600 }}>
                        {fmt(c.pendiente)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Facturas vencidas */}
        <div className="card">
          <div className="card-header"><span className="card-header-title">Facturas vencidas</span></div>
          <div>
            {recentesVencidas.length === 0 ? (
              <div className="empty" style={{ color: '#1D9E75' }}>¡Sin facturas vencidas! 🎉</div>
            ) : (
              <table>
                <thead><tr><th>Factura</th><th>Cliente</th><th>Saldo</th></tr></thead>
                <tbody>
                  {recentesVencidas.map(f => (
                    <tr key={f.id}>
                      <td style={{ fontWeight: 500 }}>{f.numero}</td>
                      <td style={{ color: '#6B7280' }}>{f.cliente_nombre}</td>
                      <td style={{ color: '#A32D2D', fontWeight: 600 }}>{fmt(f.saldo_pendiente)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
