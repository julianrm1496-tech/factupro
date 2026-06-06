import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Facturas from './pages/Facturas'
import Clientes from './pages/Clientes'
import Pagos from './pages/Pagos'
import Productos from './pages/Productos'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /><span>Cargando...</span></div>
  return user ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="facturas" element={<Facturas />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="pagos" element={<Pagos />} />
            <Route path="productos" element={<Productos />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
