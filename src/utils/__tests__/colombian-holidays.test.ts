import {
  dateKey,
  getColombianHolidays,
  lastBusinessDay,
  getCurrentPayPeriod,
  getNextPayDate,
} from '../colombian-holidays'

describe('dateKey', () => {
  it('formatea fecha como YYYY-MM-DD', () => {
    expect(dateKey(new Date(2026, 4, 16))).toBe('2026-05-16')
  })

  it('rellena mes y día con ceros', () => {
    expect(dateKey(new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(dateKey(new Date(2026, 11, 9))).toBe('2026-12-09')
  })
})

describe('getColombianHolidays', () => {
  const holidays2026 = getColombianHolidays(2026)

  it('devuelve un Set de strings YYYY-MM-DD', () => {
    expect(holidays2026).toBeInstanceOf(Set)
    for (const h of holidays2026) {
      expect(h).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('incluye Año Nuevo (1 de enero)', () => {
    expect(holidays2026.has('2026-01-01')).toBe(true)
  })

  it('incluye Día del Trabajo (1 de mayo)', () => {
    expect(holidays2026.has('2026-05-01')).toBe(true)
  })

  it('incluye Independencia (20 de julio)', () => {
    expect(holidays2026.has('2026-07-20')).toBe(true)
  })

  it('incluye Batalla de Boyacá (7 de agosto)', () => {
    expect(holidays2026.has('2026-08-07')).toBe(true)
  })

  it('incluye Navidad (25 de diciembre)', () => {
    expect(holidays2026.has('2026-12-25')).toBe(true)
  })

  it('incluye al menos 17 festivos por año', () => {
    expect(holidays2026.size).toBeGreaterThanOrEqual(17)
  })

  it('es consistente entre años', () => {
    const h2025 = getColombianHolidays(2025)
    expect(h2025.has('2025-01-01')).toBe(true)
    expect(h2025.has('2025-05-01')).toBe(true)
    expect(h2025.has('2025-12-25')).toBe(true)
  })
})

describe('lastBusinessDay', () => {
  const noHolidays = new Set<string>()

  it('devuelve el mismo día si es hábil y no es festivo', () => {
    const miercoles = new Date(2026, 4, 13) // miércoles 13 mayo 2026
    expect(lastBusinessDay(miercoles, noHolidays)).toEqual(miercoles)
  })

  it('retrocede al viernes si el día es sábado', () => {
    const sabado = new Date(2026, 4, 16) // sábado 16 mayo 2026
    const result = lastBusinessDay(sabado, noHolidays)
    expect(result.getDay()).toBe(5) // viernes
  })

  it('retrocede al viernes si el día es domingo', () => {
    const domingo = new Date(2026, 4, 17) // domingo 17 mayo 2026
    const result = lastBusinessDay(domingo, noHolidays)
    expect(result.getDay()).toBe(5) // viernes
  })

  it('retrocede sobre festivos', () => {
    // Día del Trabajo 1 mayo cae viernes en 2026
    const holidays = new Set(['2026-05-01'])
    const mayo1 = new Date(2026, 4, 1)
    const result = lastBusinessDay(mayo1, holidays)
    // Debe retroceder al jueves 30 abril
    expect(dateKey(result)).toBe('2026-04-30')
  })
})

describe('getCurrentPayPeriod', () => {
  it('retorna período del mes siguiente cuando ya pasó la fecha de pago mensual', () => {
    // Salario pagado a fin de mayo → period_key apunta a junio (mes en que se usa)
    const hoy = new Date(2026, 4, 31) // 31 mayo
    const result = getCurrentPayPeriod('monthly', hoy)
    expect(result).not.toBeNull()
    expect(result?.periodKey).toBe('2026-06')
  })

  it('retorna period_key de diciembre hacia enero del año siguiente', () => {
    const hoy = new Date(2026, 11, 31) // 31 dic
    const result = getCurrentPayPeriod('monthly', hoy)
    expect(result).not.toBeNull()
    expect(result?.periodKey).toBe('2027-01')
  })

  it('retorna null si aún no llegó la fecha de pago mensual', () => {
    const temprano = new Date(2026, 4, 1) // 1 mayo
    // El pago mensual es al final del mes, así que null en el día 1
    const result = getCurrentPayPeriod('monthly', temprano)
    expect(result).toBeNull()
  })
})

describe('getNextPayDate', () => {
  it('devuelve una fecha en formato YYYY-MM-DD', () => {
    const hoy = new Date(2026, 4, 16)
    const result = getNextPayDate('monthly', hoy)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('la próxima fecha de pago mensual es posterior a hoy', () => {
    const hoy = new Date(2026, 0, 15) // 15 enero
    const result = getNextPayDate('monthly', hoy)
    expect(result >= dateKey(hoy)).toBe(true)
  })
})
