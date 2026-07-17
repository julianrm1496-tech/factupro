import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt, initials } from '../lib/utils'
import { generarEstadoCuentaPDF } from '../lib/pdf'
import { Plus, Pencil, Trash2, Phone, FileDown, Users, AlertTriangle, CheckCircle } from 'lucide-react'

export default function Clientes() {
  const [clientes, setClientes] = useState([])
  const [resumen, setResumen] = useState({})
  const [facturasCliente, setFacturasCliente] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nombre: '', nit: '', email: '', telefono: '', direccion: '', notas: '' })
  const [buscar, setBuscar] = useState('')
  const [orden, setOrden] = useState('deuda')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const [{ data: c }, { data: f }] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('facturas_resumen').select('*'),
    ])
    const res = {}
    ;(f || []).forEach(fac => {
      if (!res[fac.cliente_id]) res[fac.cliente_id] = { total: 0, cobrado: 0, pendiente: 0, abiertas: 0, cerradas: 0 }
      res[fac.cliente_id].total += Number(fac.monto)
      res[fac.cliente_id].cobrado += Number(fac.total_pagado)
      res[fac.cliente_id].pendiente += Number(fac.saldo_pendiente)
      if (fac.estado === 'pagada') res[fac.cliente_id].cerradas++
      else res[fac.cliente_id].abiertas++
    })
    setClientes(c || [])
    setResumen(res)
    setFacturasCliente(f || [])
    setLoading(false)
  }

  const estadoCuenta = (cliente) => {
    const facturas = facturasCliente.filter(f => f.cliente_id === cliente.id)
    generarEstadoCuentaPDF({ cliente, facturas })
  }

  const openNuevo = () => { setEditId(null); setForm({ nombre: '', nit: '', email: '', telefono: '', direccion: '', notas: '' }); setModal('form') }
  const openEditar = (c) => { setEditId(c.id); setForm({ nombre: c.nombre, nit: c.nit || '', email: c.email || '', telefono: c.telefono || '', direccion: c.direccion || '', notas: c.notas || '' }); setModal('form') }

  const guardar = async () => {
    if (!form.nombre.trim()) { alert('El nombre es obligatorio'); return }
    setSaving(true)
    if (editId) await supabase.from('clientes').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editId)
    else await supabase.from('clientes').insert(form)
    setSaving(false); setModal(null); load()
  }

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este cliente? Se eliminarán también todas sus facturas.')) return
    await supabase.from('clientes').delete().eq('id', id)
    load()
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filtered = clientes
    .filter(c => !buscar || c.nombre.toLowerCase().includes(buscar.toLowerCase()) || c.email?.toLowerCase().includes(buscar.toLowerCase()))
    .sort((a, b) => {
      const ra = resumen[a.id] || { pendiente: 0, abiertas: 0, cerradas: 0 }
      const rb = resumen[b.id] || { pendiente: 0, abiertas: 0, cerradas: 0 }
      if (orden === 'deuda') return rb.pendiente - ra.pendiente
      if (orden === 'facturas') return (rb.abiertas + rb.cerradas) - (ra.abiertas + ra.cerradas)
      return a.nombre.localeCompare(b.nombre)
    })

  const totalClientesConDeuda = Object.values(resumen).filter(r => r.pendiente > 0).length

  if (loading) return (
    <div>
      <div className="skel-metrics" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[0,1,2].map(i => (
          <div key={i} className="skel-metric">
            <div className="skeleton skel-line" style={{ width: '55%' }} />
            <div className="skeleton skel-line" style={{ width: '40%', height: 18, marginBottom: 0 }} />
          </div>
        ))}
      </div>
      {[0,1,2,3].map(i => <div key={i} className="skel-row"><div className="skeleton skel-line" style={{ width: '45%', marginBottom: 0 }} /></div>)}
    </div>
  )

  return (
    <div>
      <div className="metrics stagger-in" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="metric metric-brand"><div className="metric-label"><Users size={15} /> Total clientes</div><div className="metric-value">{clientes.length}</div></div>
        <div className="metric metric-warn"><div className="metric-label"><AlertTriangle size={15} /> Con deuda</div><div className="metric-value">{totalClientesConDeuda}</div></div>
        <div className="metric metric-success"><div className="metric-label"><CheckCircle size={15} /> Al día</div><div className="metric-value" style={{ color: 'var(--green-dark)' }}>{clientes.length - totalClientesConDeuda}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <input placeholder="Buscar cliente..." value={buscar} onChange={e => setBuscar(e.target.value)} style={{ flex: 1, minWidth: 140, height: 38 }} />
        <select value={orden} onChange={e => setOrden(e.target.value)} style={{ width: 'auto', height: 38 }}>
          <option value="deuda">Mayor deuda primero</option>
          <option value="nombre">Nombre A-Z</option>
          <option value="facturas">Más facturas primero</option>
        </select>
        <button className="btn btn-primary" onClick={openNuevo} style={{ height: 38 }}><Plus size={15} /> Nuevo</button>
      </div>

      <div className="card hide-mobile-block">
        <div className="table-wrapper">
          <table className="table-compact">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Contacto</th>
                <th style={{ textAlign: 'center' }}>Abiertas</th>
                <th style={{ textAlign: 'center' }}>Cerradas</th>
                <th style={{ textAlign: 'right' }}>Cobrado</th>
                <th style={{ textAlign: 'right' }}>Pendiente</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty">No hay clientes registrados</div></td></tr>
              ) : filtered.map(c => {
                const r = resumen[c.id] || { cobrado: 0, pendiente: 0, abiertas: 0, cerradas: 0 }
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(c.nombre)}</div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{c.nombre}</div>
                          {c.nit && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>NIT: {c.nit}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>
                      {c.email && <div>{c.email}</div>}
                      {c.telefono && <div>{c.telefono}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-pendiente">{r.abiertas}</span></td>
                    <td style={{ textAlign: 'center' }}><span className="badge badge-pagada">{r.cerradas}</span></td>
                    <td style={{ textAlign: 'right', color: '#1D9E75', fontWeight: 600 }}>{fmt(r.cobrado)}</td>
                    <td style={{ textAlign: 'right', color: r.pendiente > 0 ? '#854F0B' : 'var(--gray-500)', fontWeight: 600 }}>{r.pendiente > 0 ? fmt(r.pendiente) : '—'}</td>
                    <td>
                      <div className="actions-row">
                        <button className="btn btn-sm btn-icon" title="Estado de cuenta PDF" onClick={() => estadoCuenta(c)}><FileDown size={13} /></button>
                        <button className="btn btn-sm btn-icon" onClick={() => openEditar(c)}><Pencil size={13} /></button>
                        <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(c.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="show-mobile-block client-grid">
        {filtered.length === 0 && <div className="empty">No hay clientes registrados</div>}
        {filtered.map(c => {
          const r = resumen[c.id] || { cobrado: 0, pendiente: 0, abiertas: 0, cerradas: 0 }
          return (
            <div key={c.id} className="client-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div className="avatar avatar-lg">{initials(c.nombre)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre}</div>
                  {c.telefono && <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={11} />{c.telefono}</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    <span className="badge badge-pendiente">{r.abiertas} abiertas</span>
                    <span className="badge badge-pagada">{r.cerradas} cerradas</span>
                  </div>
                  {r.pendiente > 0 && <div style={{ fontSize: 13, fontWeight: 700, color: '#854F0B', marginTop: 6 }}>{fmt(r.pendiente)} pendiente</div>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button className="btn btn-sm btn-icon" onClick={() => openEditar(c)}><Pencil size={13} /></button>
                  <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(c.id)}><Trash2 size={13} /></button>
                </div>
              </div>
              <button className="btn btn-sm" style={{ marginTop: 10, width: '100%', justifyContent: 'center' }} onClick={() => estadoCuenta(c)}>
                <FileDown size={13} /> Estado de cuenta PDF
              </button>
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
              <div className="form-group"><label>Nombre / Empresa *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Nombre del cliente" autoFocus /></div>
              <div className="form-row">
                <div className="form-group"><label>NIT / CC</label><input value={form.nit} onChange={e => set('nit', e.target.value)} placeholder="900123456-1" /></div>
                <div className="form-group"><label>Teléfono</label><input value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+57 300..." /></div>
              </div>
              <div className="form-group"><label>Correo electrónico</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="cliente@correo.com" /></div>
              <div className="form-group"><label>Dirección</label><input value={form.direccion} onChange={e => set('direccion', e.target.value)} placeholder="Calle 123 #45-67" /></div>
              <div className="form-group"><label>Notas</label><textarea value={form.notas} onChange={e => set('notas', e.target.value)} placeholder="Información adicional..." rows={2} /></div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      <button className="fab" onClick={openNuevo} title="Nuevo cliente" aria-label="Nuevo cliente">
        <Plus size={24} />
      </button>
    </div>
  )
}
