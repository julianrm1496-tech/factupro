import { useState, useEffect, useMemo, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useUI } from '../hooks/useUI'
import { supabase } from '../lib/supabase'
import { initials, fmt } from '../lib/utils'
import {
  LayoutDashboard, FileText, Users, CreditCard, LogOut, Menu, X,
  Moon, Sun, Search
} from 'lucide-react'

const nav = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/facturas', label: 'Facturas', Icon: FileText },
  { to: '/clientes', label: 'Clientes', Icon: Users },
  { to: '/pagos', label: 'Pagos', Icon: CreditCard },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const { tema, toggleTema } = useUI()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [vencidasCount, setVencidasCount] = useState(0)

  // Busqueda global
  const [buscarAbierto, setBuscarAbierto] = useState(false)
  const [q, setQ] = useState('')
  const [datos, setDatos] = useState({ facturas: [], clientes: [] })
  const [indiceActivo, setIndiceActivo] = useState(0)
  const inputRef = useRef(null)

  const seccionActiva = nav.find(n => location.pathname.startsWith(n.to)) || nav[0]
  const ActivoIcon = seccionActiva.Icon

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const closeSidebar = () => setMenuOpen(false)

  // Contador de vencidas para el badge del sidebar
  useEffect(() => {
    let vigente = true
    const cargar = async () => {
      const { count } = await supabase
        .from('facturas_resumen')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'vencida')
      if (vigente) setVencidasCount(count || 0)
    }
    cargar()
    return () => { vigente = false }
  }, [location.pathname])

  // Atajo Ctrl+K / Cmd+K
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscarAbierto(v => !v)
      }
      if (e.key === 'Escape') setBuscarAbierto(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Carga los datos para buscar (solo al abrir)
  useEffect(() => {
    if (!buscarAbierto) { setQ(''); setIndiceActivo(0); return }
    setTimeout(() => inputRef.current?.focus(), 60)
    const cargar = async () => {
      const [{ data: f }, { data: c }] = await Promise.all([
        supabase.from('facturas_resumen').select('id, numero, cliente_nombre, monto, estado, cliente_id'),
        supabase.from('clientes').select('id, nombre, nit, telefono'),
      ])
      setDatos({ facturas: f || [], clientes: c || [] })
    }
    cargar()
  }, [buscarAbierto])

  const resultados = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return []
    const out = []
    datos.clientes
      .filter(c => c.nombre?.toLowerCase().includes(query) || c.nit?.toLowerCase().includes(query))
      .slice(0, 4)
      .forEach(c => out.push({
        tipo: 'Clientes', id: 'c-' + c.id, titulo: c.nombre,
        sub: c.nit ? 'NIT: ' + c.nit : (c.telefono || ''),
        ir: () => navigate('/facturas?cliente=' + c.id),
      }))
    datos.facturas
      .filter(f => f.numero?.toLowerCase().includes(query) || f.cliente_nombre?.toLowerCase().includes(query))
      .slice(0, 6)
      .forEach(f => out.push({
        tipo: 'Facturas', id: 'f-' + f.id, titulo: f.numero,
        sub: `${f.cliente_nombre} - ${fmt(f.monto)}`,
        ir: () => navigate('/facturas?factura=' + f.id),
      }))
    return out
  }, [q, datos, navigate])

  const agrupados = useMemo(() => {
    const g = {}
    resultados.forEach(r => { (g[r.tipo] = g[r.tipo] || []).push(r) })
    return g
  }, [resultados])

  const abrirResultado = (r) => { r.ir(); setBuscarAbierto(false) }

  const onKeyBuscar = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIndiceActivo(i => Math.min(i + 1, resultados.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setIndiceActivo(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && resultados[indiceActivo]) { e.preventDefault(); abrirResultado(resultados[indiceActivo]) }
  }

  return (
    <div className="app">
      {menuOpen && <div className="sidebar-overlay open" onClick={closeSidebar} />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-logo">Factu<span>Pro</span></div>
        <nav className="sidebar-nav">
          {nav.map(({ to, label, Icon }) => (
            <NavLink
              key={to} to={to}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={closeSidebar}
            >
              <Icon size={17} />
              {label}
              {to === '/facturas' && vencidasCount > 0 && (
                <span className="nav-badge" title={`${vencidasCount} factura(s) vencida(s)`}>{vencidasCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <button className="tema-toggle" onClick={toggleTema}>
          {tema === 'oscuro' ? <Sun size={14} /> : <Moon size={14} />}
          {tema === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
        </button>

        <div className="sidebar-user">
          <div className="avatar">{initials(user?.email || 'U')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <button className="btn btn-icon" onClick={handleSignOut} title="Cerrar sesion">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-icon mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <div className="topbar-seccion">
            <div className="topbar-icon"><ActivoIcon size={17} /></div>
            <div className="topbar-title">{seccionActiva.label}</div>
          </div>

          {/* Barra de busqueda: campo completo en desktop, solo lupa en movil */}
          <button className="topbar-search" onClick={() => setBuscarAbierto(true)}>
            <Search size={16} style={{ flexShrink: 0 }} />
            <span className="topbar-search-text">Buscar cliente o factura...</span>
          </button>
          <button className="btn btn-icon topbar-search-mobile" onClick={() => setBuscarAbierto(true)} aria-label="Buscar">
            <Search size={18} />
          </button>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>

      {buscarAbierto && (
        <div className="gsearch-overlay" onClick={e => e.target === e.currentTarget && setBuscarAbierto(false)}>
          <div className="gsearch-box">
            <div className="gsearch-input-row">
              <Search size={17} style={{ color: 'var(--gray-500)', flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={q}
                onChange={e => { setQ(e.target.value); setIndiceActivo(0) }}
                onKeyDown={onKeyBuscar}
                placeholder="Buscar cliente o factura..."
              />
              <button className="btn btn-icon btn-sm" onClick={() => setBuscarAbierto(false)}><X size={15} /></button>
            </div>

            <div className="gsearch-results">
              {!q.trim() ? (
                <div style={{ padding: '18px 12px', fontSize: 13, color: 'var(--gray-500)', textAlign: 'center' }}>
                  Escribe para buscar entre tus clientes y facturas
                </div>
              ) : resultados.length === 0 ? (
                <div style={{ padding: '18px 12px', fontSize: 13, color: 'var(--gray-500)', textAlign: 'center' }}>
                  Sin resultados para "{q}"
                </div>
              ) : Object.entries(agrupados).map(([grupo, items]) => (
                <div key={grupo}>
                  <div className="gsearch-group-label">{grupo}</div>
                  {items.map(r => {
                    const idxGlobal = resultados.findIndex(x => x.id === r.id)
                    return (
                      <div
                        key={r.id}
                        className={`gsearch-item${idxGlobal === indiceActivo ? ' active' : ''}`}
                        onClick={() => abrirResultado(r)}
                        onMouseEnter={() => setIndiceActivo(idxGlobal)}
                      >
                        <span className="gsearch-item-icon">
                          {grupo === 'Clientes' ? <Users size={15} /> : <FileText size={15} />}
                        </span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{r.titulo}</div>
                          {r.sub && <div className="gsearch-item-sub">{r.sub}</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="gsearch-hint">
              Toca un resultado para abrirlo
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
