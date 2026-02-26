// Hermes supports Unicode property escapes (/u flag) since RN 0.70+.
const SINGLE_EMOJI_RE =
  /^(?:\p{Extended_Pictographic})(?:[\uFE0F\u20E3]|\u200D(?:\p{Extended_Pictographic})[\uFE0F]?|[\u{1F3FB}-\u{1F3FF}])*$/u;

export function isSingleEmoji(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 20) return false; // fast-path: plain text never >20 chars
  return SINGLE_EMOJI_RE.test(t);
}
