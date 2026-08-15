import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fmt } from '../lib/utils'
import { useUI } from '../hooks/useUI'
import { Plus, Pencil, Trash2, Package, ChevronDown, ChevronRight, X } from 'lucide-react'

// Extrae la marca a partir del prefijo de la referencia (CHE-001 -> CHE)
const marcaDe = (referencia) => (referencia?.match(/^([A-Za-z]+)/)?.[1] || 'OTROS').toUpperCase()

const NOMBRES_MARCA = {
  CHE: 'Chevrolet', TOY: 'Toyota', REN: 'Renault', FOR: 'Ford', MAZ: 'Mazda',
  KIA: 'Kia', HIN: 'Hino', NIS: 'Nissan', HYU: 'Hyundai', MIT: 'Mitsubishi',
  INT: 'International', UNI: 'Universales', SUZ: 'Suzuki', DOG: 'Dodge',
  KEN: 'Kenworth', VOL: 'Volkswagen', DAE: 'Daewoo', MER: 'Mercedes-Benz',
  DAI: 'Daihatsu', JEE: 'Jeep',
}
const nombreMarca = (codigo) => NOMBRES_MARCA[codigo] || codigo

const FORM_VACIO = { referencia: '', nombre: '', precio_distribuidor: '', precio_local: '', precio_nacional: '', precio_almacen: '' }

export default function Productos() {
  const { toast, confirmar } = useUI()
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null)
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(FORM_VACIO)
  const [buscar, setBuscar] = useState('')
  const [marcasAbiertas, setMarcasAbiertas] = useState({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('productos').select('*').eq('activo', true).order('referencia')
    setProductos(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const openNuevo = () => { setEditId(null); setForm(FORM_VACIO); setModal('form') }
  const openEditar = (p) => {
    setEditId(p.id)
    setForm({
      referencia: p.referencia, nombre: p.nombre,
      precio_distribuidor: p.precio_distribuidor, precio_local: p.precio_local,
      precio_nacional: p.precio_nacional, precio_almacen: p.precio_almacen,
    })
    setModal('form')
  }

  const guardar = async () => {
    if (!form.referencia.trim() || !form.nombre.trim()) { toast('Referencia y nombre son obligatorios', { tipo: 'error' }); return }
    setSaving(true)
    const payload = {
      referencia: form.referencia.trim(), nombre: form.nombre.trim(),
      precio_distribuidor: parseFloat(form.precio_distribuidor) || 0,
      precio_local: parseFloat(form.precio_local) || 0,
      precio_nacional: parseFloat(form.precio_nacional) || 0,
      precio_almacen: parseFloat(form.precio_almacen) || 0,
    }
    const { error } = editId
      ? await supabase.from('productos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
      : await supabase.from('productos').insert(payload)
    setSaving(false)
    if (error) { toast('Error: ' + error.message, { tipo: 'error', duracion: 5000 }); return }
    toast(editId ? `Producto "${form.nombre}" actualizado` : `Producto "${form.nombre}" creado`)
    setModal(null); load()
  }

  const eliminar = async (producto) => {
    const ok = await confirmar({
      titulo: 'Eliminar producto',
      mensaje: `Se quitará "${producto.nombre}" del catálogo. Las facturas ya creadas con este producto no se ven afectadas.`,
      textoConfirmar: 'Eliminar',
    })
    if (!ok) return
    const { error } = await supabase.from('productos').update({ activo: false }).eq('id', producto.id)
    if (error) { toast('Error: ' + error.message, { tipo: 'error', duracion: 5000 }); return }
    toast(`Producto "${producto.nombre}" eliminado`, { tipo: 'info' })
    load()
  }

  const filtrados = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    if (!q) return productos
    return productos.filter(p => p.nombre.toLowerCase().includes(q) || p.referencia.toLowerCase().includes(q))
  }, [productos, buscar])

  const grupos = useMemo(() => {
    const map = {}
    filtrados.forEach(p => {
      const marca = marcaDe(p.referencia)
      if (!map[marca]) map[marca] = []
      map[marca].push(p)
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [filtrados])

  const toggleMarca = (m) => setMarcasAbiertas(prev => ({ ...prev, [m]: !prev[m] }))
  const buscando = buscar.trim().length > 0

  if (loading) return (
    <div>
      {[0, 1, 2].map(i => <div key={i} className="skel-row"><div className="skeleton skel-line" style={{ width: '45%', marginBottom: 0 }} /></div>)}
    </div>
  )

  return (
    <div>
      <div className="metrics stagger-in metrics-2">
        <div className="metric metric-brand">
          <div className="metric-label"><Package size={15} /> Total productos</div>
          <div className="metric-value">{productos.length}</div>
        </div>
        <div className="metric metric-success">
          <div className="metric-label"><Package size={15} /> Marcas</div>
          <div className="metric-value" style={{ color: 'var(--green-dark)' }}>{Object.keys(grupos).length || new Set(productos.map(p => marcaDe(p.referencia))).size}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <input placeholder="Buscar producto o referencia..." value={buscar} onChange={e => setBuscar(e.target.value)} style={{ flex: 1, minWidth: 140, height: 40 }} />
        <button className="btn btn-primary" onClick={openNuevo} style={{ height: 40 }}><Plus size={15} /> Nuevo</button>
      </div>

      {grupos.length === 0 ? (
        <div className="empty-rich">
          <div className="empty-rich-icon"><Package size={26} /></div>
          <div className="empty-rich-title">{buscar ? 'Sin resultados' : 'Aún no tienes productos'}</div>
          <div className="empty-rich-text">
            {buscar ? `No encontramos productos que coincidan con "${buscar}".` : 'Agrega productos para usarlos rápido al crear facturas.'}
          </div>
          {!buscar && <button className="btn btn-primary" onClick={openNuevo}><Plus size={15} /> Crear producto</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {grupos.map(([marca, items]) => {
            const abierta = buscando || marcasAbiertas[marca]
            return (
              <div key={marca} className="card" style={{ marginBottom: 0 }}>
                <div
                  onClick={() => !buscando && toggleMarca(marca)}
                  style={{ padding: '11px 16px', cursor: buscando ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                >
                  {!buscando && (abierta ? <ChevronDown size={16} /> : <ChevronRight size={16} />)}
                  <span style={{ fontWeight: 700, fontSize: 14.5 }}>{nombreMarca(marca)}</span>
                  <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>· {items.length} producto{items.length !== 1 ? 's' : ''}</span>
                </div>

                {abierta && (
                  <>
                    {/* Tabla desktop */}
                    <div className="table-wrapper hide-mobile-block" style={{ borderTop: '1px solid var(--gray-200)' }}>
                      <table className="table-compact">
                        <thead>
                          <tr>
                            <th>Ref.</th>
                            <th>Producto</th>
                            <th style={{ textAlign: 'right' }}>Distribuidor</th>
                            <th style={{ textAlign: 'right' }}>Local</th>
                            <th style={{ textAlign: 'right' }}>Nacional</th>
                            <th style={{ textAlign: 'right' }}>Almacén</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map(p => (
                            <tr key={p.id}>
                              <td style={{ color: 'var(--gray-500)', fontSize: 12 }}>{p.referencia}</td>
                              <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.precio_distribuidor)}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.precio_local)}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(p.precio_nacional)}</td>
                              <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(p.precio_almacen)}</td>
                              <td>
                                <div className="actions-row">
                                  <button className="btn btn-sm btn-icon" title="Editar" onClick={() => openEditar(p)}><Pencil size={13} /></button>
                                  <button className="btn btn-sm btn-icon btn-danger" title="Eliminar" onClick={() => eliminar(p)}><Trash2 size={13} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Tarjetas móvil */}
                    <div className="show-mobile-block lista-tarjetas" style={{ padding: '10px 12px', borderTop: '1px solid var(--border-soft)' }}>
                      {items.map(p => (
                        <div key={p.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{p.nombre}</div>
                              <div style={{ fontSize: 11.5, color: 'var(--gray-500)' }}>{p.referencia}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                              <button className="btn btn-sm btn-icon" onClick={() => openEditar(p)} aria-label="Editar"><Pencil size={13} /></button>
                              <button className="btn btn-sm btn-icon btn-danger" onClick={() => eliminar(p)} aria-label="Eliminar"><Trash2 size={13} /></button>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 8, fontSize: 12 }}>
                            <div>Distri: <b>{fmt(p.precio_distribuidor)}</b></div>
                            <div>Local: <b>{fmt(p.precio_local)}</b></div>
                            <div>Nacional: <b>{fmt(p.precio_nacional)}</b></div>
                            <div>Almacén: <b>{fmt(p.precio_almacen)}</b></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {modal === 'form' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal modal-fullscreen">
            <div className="modal-header">
              <span className="modal-title">{editId ? 'Editar producto' : 'Nuevo producto'}</span>
              <button className="btn btn-icon btn-sm" onClick={() => setModal(null)} aria-label="Cerrar"><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label>Referencia *</label><input value={form.referencia} onChange={e => set('referencia', e.target.value)} placeholder="CHE-001" autoFocus /></div>
                <div className="form-group"><label>Nombre del producto *</label><input value={form.nombre} onChange={e => set('nombre', e.target.value)} placeholder="Emblema..." /></div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)', marginTop: 4 }}>Precios por tipo de cliente</div>
              <div className="form-row">
                <div className="form-group"><label>Distribuidor</label><input type="number" value={form.precio_distribuidor} onChange={e => set('precio_distribuidor', e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Local</label><input type="number" value={form.precio_local} onChange={e => set('precio_local', e.target.value)} placeholder="0" /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label>Nacional</label><input type="number" value={form.precio_nacional} onChange={e => set('precio_nacional', e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label>Almacén</label><input type="number" value={form.precio_almacen} onChange={e => set('precio_almacen', e.target.value)} placeholder="0" /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setModal(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
