declare const __ENCODED_ENV__: string;

let _cache: Record<string, string> | null = null;

function decode(): Record<string, string> {
  if (_cache) return _cache;
  try {
    const json = Buffer.from(__ENCODED_ENV__, "base64").toString();
    _cache = JSON.parse(json);
  } catch {
    _cache = {};
  }
  return _cache!;
}

export function env(key: string): string {
  return decode()[key] ?? "";
}
