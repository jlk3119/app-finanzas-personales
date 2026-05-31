import { friendlyAIError } from '../ai-error'

describe('friendlyAIError', () => {
  it('mapea el rate limit de Groq a un mensaje amable y 429', () => {
    const raw = 'Rate limit reached for model `llama-3.3-70b-versatile` ... Limit 100000, Used 99341'
    const { message, status } = friendlyAIError(raw)
    expect(status).toBe(429)
    expect(message).toMatch(/límite/i)
    expect(message).not.toMatch(/llama|groq|token/i)
  })

  it('detecta variantes de rate limit (429, quota, too many requests)', () => {
    expect(friendlyAIError('HTTP 429').status).toBe(429)
    expect(friendlyAIError('quota exceeded').status).toBe(429)
    expect(friendlyAIError('Too Many Requests').status).toBe(429)
  })

  it('usa mensaje genérico y 500 para otros errores', () => {
    const { message, status } = friendlyAIError('The model did not return JSON')
    expect(status).toBe(500)
    expect(message).toMatch(/no pudimos generar el análisis/i)
    expect(message).not.toMatch(/JSON|model/i)
  })

  it('no falla con cadena vacía', () => {
    const { status } = friendlyAIError('')
    expect(status).toBe(500)
  })
})
