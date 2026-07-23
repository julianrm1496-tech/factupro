import { useState, useEffect } from 'react'

/**
 * Igual que useState, pero recuerda el valor entre sesiones.
 * Si localStorage no esta disponible (modo privado), funciona como useState normal.
 */
export function usePersistedState(clave, valorInicial) {
  const [valor, setValor] = useState(() => {
    try {
      const guardado = localStorage.getItem('factupro-' + clave)
      return guardado !== null ? JSON.parse(guardado) : valorInicial
    } catch (e) {
      return valorInicial
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem('factupro-' + clave, JSON.stringify(valor))
    } catch (e) { /* modo privado o storage lleno */ }
  }, [clave, valor])

  return [valor, setValor]
}
