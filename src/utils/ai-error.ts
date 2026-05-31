export type FriendlyAIError = { message: string; status: number };

/**
 * Convierte el error técnico del proveedor de IA en un mensaje amable en español
 * y un código HTTP apropiado. Nunca expone el mensaje crudo del modelo.
 */
export function friendlyAIError(raw: string): FriendlyAIError {
  const lower = (raw ?? "").toLowerCase();
  const isRateLimit =
    lower.includes("rate limit") ||
    lower.includes("rate_limit") ||
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("too many requests");
  if (isRateLimit) {
    return {
      message: "El análisis con IA alcanzó su límite por ahora. Vuelve a intentarlo en unos minutos.",
      status: 429,
    };
  }
  return {
    message: "No pudimos generar el análisis en este momento. Inténtalo de nuevo más tarde.",
    status: 500,
  };
}
