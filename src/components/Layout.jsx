import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { initials } from '../lib/utils'
import {
  LayoutDashboard, FileText, Users, CreditCard, LogOut, Menu, X
} from 'lucide-react'

const nav = [
  { to: '/dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { to: '/facturas', label: 'Facturas', Icon: FileText },
  { to: '/clientes', label: 'Clientes', Icon: Users },
  { to: '/pagos', label: 'Pagos', Icon: CreditCard },
]

export default function Layout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const activo = nav.find(n => location.pathname.startsWith(n.to)) || nav[0]
  const ActivoIcon = activo.Icon

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const closeSidebar = () => setMenuOpen(false)

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
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="avatar">{initials(user?.email || 'U')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
          <button className="btn btn-icon" onClick={handleSignOut} title="Cerrar sesión">
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-icon mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="topbar-icon"><ActivoIcon size={17} /></div>
            <div className="topbar-title">{activo.label}</div>
          </div>
          <div />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
