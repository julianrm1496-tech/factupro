import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { CheckCircle, AlertTriangle, Info, X, RotateCcw } from 'lucide-react'

const UIContext = createContext({})

let toastId = 0

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [confirmState, setConfirmState] = useState(null)
  const [tema, setTema] = useState('claro')
  const timers = useRef({})

  // ─── Tema (claro / oscuro) ───
  useEffect(() => {
    let guardado = 'claro'
    try { guardado = localStorage.getItem('factupro-tema') || 'claro' } catch (e) { /* modo privado */ }
    setTema(guardado)
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema)
    try { localStorage.setItem('factupro-tema', tema) } catch (e) { /* modo privado */ }
  }, [tema])

  const toggleTema = () => setTema(t => (t === 'claro' ? 'oscuro' : 'claro'))

  // ─── Toasts ───
  const cerrarToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id] }
  }, [])

  const toast = useCallback((mensaje, opciones = {}) => {
    const { tipo = 'exito', duracion = 3500, onUndo = null } = opciones
    const id = ++toastId
    setToasts(prev => [...prev, { id, mensaje, tipo, onUndo }])
    timers.current[id] = setTimeout(() => cerrarToast(id), duracion)
    return id
  }, [cerrarToast])

  // Limpia timers pendientes al desmontar
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  // ─── Confirmación ───
  const confirmar = useCallback((opciones) => new Promise(resolve => {
    setConfirmState({
      titulo: opciones.titulo || '¿Confirmar?',
      mensaje: opciones.mensaje || '',
      textoConfirmar: opciones.textoConfirmar || 'Confirmar',
      peligroso: opciones.peligroso !== false,
      resolve,
    })
  }), [])

  const responderConfirm = (valor) => {
    if (confirmState) confirmState.resolve(valor)
    setConfirmState(null)
  }

  // Cerrar confirmación con Escape
  useEffect(() => {
    if (!confirmState) return
    const onKey = (e) => { if (e.key === 'Escape') responderConfirm(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmState])

  const iconoToast = (tipo) => {
    if (tipo === 'error') return <AlertTriangle size={17} />
    if (tipo === 'info') return <Info size={17} />
    return <CheckCircle size={17} />
  }

  return (
    <UIContext.Provider value={{ toast, confirmar, tema, toggleTema }}>
      {children}

      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.tipo}`}>
            <span className="toast-icon">{iconoToast(t.tipo)}</span>
            <span className="toast-msg">{t.mensaje}</span>
            {t.onUndo && (
              <button
                className="toast-undo"
                onClick={() => { t.onUndo(); cerrarToast(t.id) }}
              >
                <RotateCcw size={13} /> Deshacer
              </button>
            )}
            <button className="toast-close" onClick={() => cerrarToast(t.id)} aria-label="Cerrar">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {confirmState && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && responderConfirm(false)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <span className="modal-title">{confirmState.titulo}</span>
              <button className="btn btn-icon btn-sm" onClick={() => responderConfirm(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div className={`confirm-icon${confirmState.peligroso ? ' confirm-icon-danger' : ''}`}>
                  <AlertTriangle size={20} />
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--gray-700)', lineHeight: 1.5 }}>
                  {confirmState.mensaje}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => responderConfirm(false)}>Cancelar</button>
              <button
                className={`btn ${confirmState.peligroso ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => responderConfirm(true)}
                autoFocus
              >
                {confirmState.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
