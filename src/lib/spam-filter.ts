const SPAM_PATTERNS: RegExp[] = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bxanax\b/i,
  /\btramadol\b/i,
  /\bcasino\b/i,
  /\bgambling\b/i,
  /\bbet365\b/i,
  /\bpoker(?:stars)?\b/i,
  /\bbinary\s+option/i,
  /\bcrypto.{0,20}giveaway/i,
  /\bonline\s+pharmacy\b/i,
  /\bpharmac(?:y|ies)\s+online\b/i,
  /\bcheap\s+(?:meds|pills|drugs)\b/i,
  /\bbuy\s+(?:cheap|now)\b.*\b(?:online|here)\b/i,
  /\bsex\s+(?:cam|chat|dating)\b/i,
  /\bescort(?:s|\s+service)\b/i,
  /\bSEO\s+services?\b/i,
  /\bback\s*links?\s+(?:cheap|seo|service)/i,
];

const SUSPICIOUS_TLD = /\bhttps?:\/\/[^\s/]+\.(ru|tk|ml|ga|cf|gq|xyz|top|click|loan|work|country|stream|download)(?:[/:?#]|\b)/i;

const MAX_URLS = 2;

function countUrls(text: string): number {
  const matches = text.match(/https?:\/\/\S+/gi);
  return matches?.length ?? 0;
}

export function isSpam(text: string, name: string): boolean {
  const haystack = `${name}\n${text}`;
  for (const re of SPAM_PATTERNS) {
    if (re.test(haystack)) return true;
  }
  if (SUSPICIOUS_TLD.test(text)) return true;
  if (countUrls(text) > MAX_URLS) return true;
  return false;
}
