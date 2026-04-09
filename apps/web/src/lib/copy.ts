export function compactText(text: string | null | undefined, max = 110) {
  if (!text) return text ?? '';

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) {
    return normalized;
  }

  const sentenceMatch = normalized.match(/^.*?[.!?](?=\s|$)/);
  const candidate = sentenceMatch?.[0] ?? normalized;
  if (candidate.length <= max) {
    return candidate;
  }

  const hardCut = candidate.slice(0, max).trimEnd();
  const softCutIndex = hardCut.lastIndexOf(' ');
  const safeCut = softCutIndex > Math.floor(max * 0.6) ? hardCut.slice(0, softCutIndex) : hardCut;
  return `${safeCut.trimEnd()}…`;
}
