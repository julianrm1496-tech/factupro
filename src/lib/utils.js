export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(n ?? 0)

export const fmtDate = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

export const initials = (name = '') =>
  name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()

export const estadoColor = {
  pagada: { bg: '#E1F5EE', color: '#0F6E56' },
  pendiente: { bg: '#FAEEDA', color: '#854F0B' },
  vencida: { bg: '#FCEBEB', color: '#A32D2D' },
}

export const today = () => new Date().toISOString().split('T')[0]

export const nextFacturaNumber = (facturas = []) => {
  const nums = facturas
    .map((f) => parseInt(f.numero?.replace(/\D/g, '') || '0'))
    .filter(Boolean)
  const next = nums.length ? Math.max(...nums) + 1 : 1
  return `FAC-${String(next).padStart(3, '0')}`
}
