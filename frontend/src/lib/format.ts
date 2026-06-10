/** Helpers de formato compartidos (port de las funciones de administrador.js). */

export function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  )
}

export function formatDate(value?: string | null): string {
  if (!value) return '-'
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short' }).format(new Date(value))
}

export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value) || 0
  return `$${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(n)}`
}

export function normalizeNumberInput(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

/** Lee un File como data URL (para subir imágenes de producto en base64). */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => resolve('')
    reader.readAsDataURL(file)
  })
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  cajero: 'Cajero',
}

export const TIPO_PAGO_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  mixto: 'Mixto',
}
