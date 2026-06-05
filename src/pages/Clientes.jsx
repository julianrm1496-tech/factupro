import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, initials } from '../lib/utils'
import { Plus, Pencil, Trash2 } from 'lucide-react'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [resumen, setResumen] = useState({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: '', nit: '', email: '', telefono: '', direccion: '', notas: '' })
  const [buscar, setBuscar] = useState('')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('facturas_resumen').select('cliente_id, monto, total_pagado, saldo_pendiente'),
    ])
    const res = {}
    ;(f || []).forEach(fac => {
      if (!res[fac.cliente_id]) res[fac.cliente_id] = { total: 0, cobrado: 0, pendiente: 0, count: 0 }
      res[fac.cliente_id].total += Number(fac.monto)
      res[fac.cliente_id].cobrado += Number(fac.total_pagado)
      res[fac.cliente_id].pendiente += Number(fac.saldo_pendiente)
      res[fac.cliente_id].count++
    })
    setClientes(c || [])
    setResumen(res)
    setLoading(false)
  }

  const openNuevo = () => {
    setEditId(null)
    setForm({ nombre: '', nit: '', email: '', telefono: '', direccion: '', notas: '' })
    setModal('form')
  }

  const openEditar = (c) => {
    setEditId(c.id)
    setForm({ nombre: c.nombre, nit: c.nit || '', email: c.email || '', telefono: c.telefono || '', direccion: c.direccion || '', notas: c.notas || '' })
    setModal('form')
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    if (editId) {
      await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId)
    } else {
      await supabase.from('clientes').insert(form)
    }
    setSaving(false)
    setModal(null)
    load()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este cliente? Se eliminarán también todas sus facturas.')) return
    await supabase.from('clientes').delete().eq('id', id)
    load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filtered = clientes.filter(c =>
    !buscar || c.nombre.toLowerCase().includes(buscar.toLowerCase()) || c.email?.toLowerCase().includes(buscar.toLowerCase())
  )

  if (loading) return <div className="loading-page"><div className="spinner" /></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <input
          style={{ maxWidth: 280 }}
          placeholder="Buscar cliente..."
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
        />
        <button className="btn btn-primary" onClick={openNuevo}>
          <Plus size={15} /> Nuevo cliente
        </button>
      </div>

      <div className="client-grid">
        {filtered.length === 0 && <div className="empty" style={{ gridColumn: '1/-1' }}>No hay clientes registrados</div>}
        {filtered.map(c => {
          const r = resumen[c.id] || { total: 0, cobrado: 0, pendiente: 0, count: 0 }
          return (
            <div key={c.id} className="client-card">
              <div className="avatar avatar-lg">{initials(c.nombre)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{c.nombre}</div>
                {c.nit && <div style={{ fontSize: 12, color: '#6B7280' }}>NIT: {c.nit}</div>}
                {c.email && <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.email}</div>}
                {c.telefono && <div style={{ fontSize: 12, color: '#6B7280' }}>{c.telefono}</div>}
                <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: '#0F6E56', background: '#E1F5EE', padding: '2px 8px', borderRadius: 20 }}>
                    {fmt(r.cobrado)} cobrado
                  </span>
                  {r.pendiente > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#854F0B', background: '#FAEEDA', padding: '2px 8px', borderRadius: 20 }}>
                      {fmt(r.pendiente)} pendiente
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{r.count} factura{r.count !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <button className="btn btn-sm btn-icon" onClick={() => openEditar(c)} title="Editar"><Pencil size={13} /></button>
                <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(c.id)} title="Eliminar"><Trash2 size={13} /></button>
              </div>
            </div>
          )
        })}
      </div>

      {modal === 'form' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Editar cliente' : 'Nuevo cliente'}</span>
              <button className="btn btn-icon btn-sm" onClick={() => setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Nombre / Empresa *</label>
                  <input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Empresa S.A.S" autoFocus />
                </div>
                <div className="form-group">
                  <label>NIT / Identificación</label>
                  <input value={form.nit} onChange={e => set('nit', e.target.value)} placeholder="900123456-1" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Correo electrónico</label>
                  <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="pagos@empresa.com" />
                </div>
                <div className="form-group">
                  <label>Teléfono</label>
                  <input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+57 300 000 0000" />
                </div>
              </div>
              <div className="form-group">
                <label>Dirección</label>
                <input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle 123 #45-67, Bogotá" />
              </div>
              <div className="form-group">
                <label>Notas</label>
                <textarea value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Información adicional..." rows={2} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cliente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
