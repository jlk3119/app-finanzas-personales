// Lógica de fecha local usada en toda la app
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateLabel(dateStr: string): 'Hoy' | 'Ayer' | null {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (dateStr === toLocalDateStr(today)) return 'Hoy'
  if (dateStr === toLocalDateStr(yesterday)) return 'Ayer'
  return null
}

describe('toLocalDateStr', () => {
  it('devuelve YYYY-MM-DD en hora local', () => {
    const d = new Date(2026, 4, 16) // 16 mayo 2026, hora local
    expect(toLocalDateStr(d)).toBe('2026-05-16')
  })

  it('rellena mes y día con ceros', () => {
    expect(toLocalDateStr(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(toLocalDateStr(new Date(2026, 11, 3))).toBe('2026-12-03')
  })

  it('usa hora local, no UTC', () => {
    // A las 23:00 local la fecha local sigue siendo la misma
    const d = new Date(2026, 4, 16, 23, 0, 0)
    expect(toLocalDateStr(d)).toBe('2026-05-16')
  })

  it('no usa toISOString internamente', () => {
    const d = new Date(2026, 4, 16, 23, 30, 0)
    const local = toLocalDateStr(d)
    // La fecha local es 16; ISO (UTC) podría ser 17 en UTC-5 a las 23:30
    expect(local.endsWith('-16')).toBe(true)
  })
})

describe('formatDateLabel', () => {
  it('devuelve "Hoy" para la fecha de hoy', () => {
    const todayStr = toLocalDateStr(new Date())
    expect(formatDateLabel(todayStr)).toBe('Hoy')
  })

  it('devuelve "Ayer" para la fecha de ayer', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    expect(formatDateLabel(toLocalDateStr(yesterday))).toBe('Ayer')
  })

  it('devuelve null para fechas anteriores', () => {
    expect(formatDateLabel('2020-01-01')).toBeNull()
  })

  it('devuelve null para fechas futuras', () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    expect(formatDateLabel(toLocalDateStr(future))).toBeNull()
  })
})
