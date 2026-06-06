import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'

export default function Productos() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [buscar, setBuscar] = useState('')
  const [form, setForm] = useState({ nombre: '', descripcion: '', precio: '' })

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('nombre')
    setProductos(data || [])
    setLoading(false)
  }

  const openNuevo = () => {
    setEditId(null)
    setForm({ nombre: '', descripcion: '', precio: '' })
    setModal('form')
  }

  const openEditar = (p) => {
    setEditId(p.id)
    setForm({ nombre: p.nombre, descripcion: p.descripcion || '', precio: p.precio })
    setModal('form')
  }

  const guardar = async () => {
    if (!form.nombre.trim() || !form.precio) { alert('Nombre y precio son obligatorios'); return }
    setSaving(true)
    if (editId) {
      await supabase.from('productos').update({ ...form, precio: parseFloat(form.precio), updated_at: new Date().toISOString() }).eq('id', editId)
    } else {
      await supabase.from('productos').insert({ ...form, precio: parseFloat(form.precio) })
    }
    setSaving(false)
    setModal(null)
    load()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este producto del catálogo?')) return
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filtered = productos.filter(p =>
    !buscar || p.nombre.toLowerCase().includes(buscar.toLowerCase())
  )

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          placeholder="Buscar producto..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          style={{ flex: 1, height: 38 }}
        />
        <button className="btn btn-primary" onClick={openNuevo} style={{ height: 38 }}>
          <Plus size={15} /> Nuevo
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <Package size={32} style={{ opacity: .3, marginBottom: 8 }} />
          <div>No hay productos en el catálogo</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Agrega productos o servicios para usarlos en tus facturas</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(p => (
            <div key={p.id} style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--green-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Package size={18} color="var(--green-dark)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</div>
                {p.descripcion && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{p.descripcion}</div>}
                <div style={{ fontWeight: 700, color: 'var(--green-dark)', fontSize: 14, marginTop: 4 }}>{fmt(p.precio)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn btn-sm btn-icon" onClick={() => openEditar(p)}><Pencil size={13} /></button>
                <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p.id)}><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal === 'form' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Editar producto' : 'Nuevo producto'}</span>
              <button className="btn btn-icon btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nombre del producto / servicio *</label>
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Ej: Consultoría por hora" autoFocus />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} placeholder="Descripción opcional..." rows={2} />
              </div>
              <div className="form-group">
                <label>Precio base (COP) *</label>
                <input type="number" value={form.precio} onChange={e => set('precio', e.target.value)} placeholder="0" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
