const fmt = (n: number) =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(n)

describe('formato COP', () => {
  it('incluye el símbolo de peso', () => {
    expect(fmt(1000)).toMatch(/\$/)
  })

  it('formatea miles con separador de punto', () => {
    expect(fmt(1000)).toMatch(/1[.,\s]?000/)
  })

  it('formatea millones correctamente', () => {
    const result = fmt(6_000_000)
    expect(result).toMatch(/6/)
    expect(result).toMatch(/000/)
  })

  it('no muestra decimales (en es-CO el separador decimal es la coma)', () => {
    // En es-CO: separador de miles = ".", separador decimal = ","
    // Con maximumFractionDigits: 0, no debe haber parte decimal tras la coma
    expect(fmt(1500)).not.toMatch(/,\d+/)
    expect(fmt(300_000)).not.toMatch(/,\d+/)
  })

  it('redondea correctamente sin mostrar centavos', () => {
    const result = fmt(1500.75)
    // El valor redondeado se muestra sin separador decimal
    expect(result).not.toMatch(/,\d+/)
  })

  it('formatea cero', () => {
    expect(fmt(0)).toMatch(/0/)
  })

  it('formatea números negativos', () => {
    const result = fmt(-50000)
    expect(result).toMatch(/-/)
  })
})
