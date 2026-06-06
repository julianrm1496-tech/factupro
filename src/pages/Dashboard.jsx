import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

const COLORS = ['#1D9E75', '#FBBF24', '#EF4444']

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: facturas }, { data: pagos }] = await Promise.all([
      supabase.from('facturas_resumen').select('*'),
      supabase.from('pagos').select('*').order('fecha', { ascending: false }).limit(100),
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
    { name: 'Pagadas', value: facturas.filter(f => f.estado === 'pagada').length },
    { name: 'Pendientes', value: facturas.filter(f => f.estado === 'pendiente').length },
    { name: 'Vencidas', value: facturas.filter(f => f.estado === 'vencida').length },
  ].filter(d => d.value > 0)

  const mesMap = {}
  pagos.forEach(p => {
    const m = p.fecha?.slice(0, 7)
    if (m) mesMap[m] = (mesMap[m] || 0) + Number(p.monto)
  })
  const meses = Object.entries(mesMap).sort().slice(-6).map(([k, v]) => ({
    mes: new Date(k + '-01').toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
    cobrado: v,
  }))

  const porCliente = {}
  facturas.forEach(f => {
    if (!porCliente[f.cliente_id]) porCliente[f.cliente_id] = { nombre: f.cliente_nombre, pendiente: 0 }
    porCliente[f.cliente_id].pendiente += Number(f.saldo_pendiente)
  })
  const topClientes = Object.values(porCliente).sort((a, b) => b.pendiente - a.pendiente).slice(0, 5)
  const recentesVencidas = vencidas.slice(0, 5)

  return (
    <div>
      <div className="metrics" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        <div className="metric">
          <div className="metric-label">Total facturado</div>
          <div className="metric-value" style={{ fontSize: 16 }}>{fmt(totalFacturado)}</div>
          <div className="metric-sub">{facturas.length} facturas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Cobrado</div>
          <div className="metric-value" style={{ color: '#1D9E75', fontSize: 16 }}>{fmt(totalCobrado)}</div>
          <div className="metric-sub">{totalFacturado > 0 ? Math.round(totalCobrado / totalFacturado * 100) : 0}% del total</div>
        </div>
        <div className="metric">
          <div className="metric-label">Por cobrar</div>
          <div className="metric-value" style={{ color: '#854F0B', fontSize: 16 }}>{fmt(totalPendiente)}</div>
          <div className="metric-sub">{facturas.filter(f => f.estado !== 'pagada').length} activas</div>
        </div>
        <div className="metric">
          <div className="metric-label">Vencido</div>
          <div className="metric-value" style={{ color: '#A32D2D', fontSize: 16 }}>{fmt(totalVencido)}</div>
          <div className="metric-sub">{vencidas.length} vencidas</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-header-title">Cobros por mes</span></div>
        <div className="card-body">
          {meses.length === 0 ? <div className="empty">Sin datos aún</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={meses} barSize={24}>
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => '$' + (v/1000).toFixed(0) + 'k'} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip formatter={(v) => [fmt(v), 'Cobrado']} />
                <Bar dataKey="cobrado" fill="#1D9E75" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-header-title">Estado de facturas</span></div>
        <div className="card-body">
          {porEstado.length === 0 ? <div className="empty">Sin facturas aún</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={porEstado} dataKey="value" cx="50%" cy="45%" outerRadius={70} label={({ value }) => `${value}`}>
                  {porEstado.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-header-title">Clientes con saldo pendiente</span></div>
        {topClientes.length === 0 ? <div className="empty">Sin pendientes</div> : (
          <table>
            <thead><tr><th>Cliente</th><th>Pendiente</th></tr></thead>
            <tbody>
              {topClientes.map((c, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{c.nombre}</td>
                  <td style={{ color: c.pendiente > 0 ? '#854F0B' : '#1D9E75', fontWeight: 600 }}>{fmt(c.pendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><span className="card-header-title">Facturas vencidas</span></div>
        {recentesVencidas.length === 0 ? (
          <div className="empty" style={{ color: '#1D9E75' }}>¡Sin facturas vencidas! 🎉</div>
        ) : (
          <table>
            <thead><tr><th>Factura</th><th>Cliente</th><th>Saldo</th></tr></thead>
            <tbody>
              {recentesVencidas.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 500 }}>{f.numero}</td>
                  <td style={{ color: '#6B7280', fontSize: 12 }}>{f.cliente_nombre}</td>
                  <td style={{ color: '#A32D2D', fontWeight: 600 }}>{fmt(f.saldo_pendiente)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
