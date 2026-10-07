/**
 * Converte strings numéricas em formato BRL/Pt-BR ou decimal padrão para número float.
 * 
 * Regras:
 * - Se a string tiver vírgula: os pontos são separadores de milhar (remova) e a vírgula é o decimal.
 * - Se não tiver vírgula e tiver exatamente um ponto com 1 ou 2 dígitos depois: trate o ponto como decimal.
 * - Senão (ex: múltiplos pontos ou ponto com 3 dígitos): os pontos são separadores de milhar (remova).
 * - Mantém o sinal negativo.
 * 
 * Exemplos:
 *   "1234.56"   → 1234.56
 *   "1.234,56"  → 1234.56
 *   "-50,5"     → -50.5
 *   "1.234"     → 1234
 */
export function parseBRLInput(str: string | number | null | undefined): number {
  if (str === null || str === undefined) return 0;
  if (typeof str === 'number') {
    return isNaN(str) ? 0 : str;
  }

  const raw = String(str).trim();
  if (!raw) return 0;

  // Detecta sinal negativo
  const isNegative = raw.startsWith('-') || /^\s*-\s*/.test(raw);

  // Remove caracteres que não sejam dígitos, pontos ou vírgulas
  const clean = raw.replace(/[^\d.,]/g, '');
  if (!clean) return 0;

  let parsed: number;

  if (clean.includes(',')) {
    // Se a string tiver vírgula, os pontos são separadores de milhar (remova) e a vírgula é o decimal
    const withoutDots = clean.replace(/\./g, '').replace(',', '.');
    parsed = parseFloat(withoutDots);
  } else {
    // Se não tiver vírgula e tiver exatamente um ponto com 1 ou 2 dígitos depois, trate o ponto como decimal
    const dotMatches = clean.match(/\./g);
    const dotCount = dotMatches ? dotMatches.length : 0;

    if (dotCount === 1 && /\.\d{1,2}$/.test(clean)) {
      parsed = parseFloat(clean);
    } else {
      // Caso contrário, pontos são separadores de milhar (remova)
      parsed = parseFloat(clean.replace(/\./g, ''));
    }
  }

  if (isNaN(parsed)) return 0;
  return isNegative ? -Math.abs(parsed) : parsed;
}
