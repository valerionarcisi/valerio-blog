const TIMEZONE_COUNTRY: Record<string, string> = {
  "Europe/Rome": "IT", "Europe/London": "GB", "Europe/Paris": "FR",
  "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE", "Europe/Zurich": "CH", "Europe/Vienna": "AT",
  "Europe/Lisbon": "PT", "Europe/Warsaw": "PL", "Europe/Prague": "CZ",
  "Europe/Budapest": "HU", "Europe/Bucharest": "RO", "Europe/Sofia": "BG",
  "Europe/Athens": "GR", "Europe/Helsinki": "FI", "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Dublin": "IE",
  "Europe/Kiev": "UA", "Europe/Moscow": "RU", "Europe/Istanbul": "TR",
  "Europe/Belgrade": "RS", "Europe/Zagreb": "HR", "Europe/Ljubljana": "SI",
  "Europe/Bratislava": "SK", "Europe/Tallinn": "EE", "Europe/Riga": "LV",
  "Europe/Vilnius": "LT", "Europe/Luxembourg": "LU", "Europe/Malta": "MT",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Los_Angeles": "US", "America/Phoenix": "US", "America/Anchorage": "US",
  "Pacific/Honolulu": "US", "America/Toronto": "CA", "America/Vancouver": "CA",
  "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
  "America/Mexico_City": "MX", "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO", "America/Lima": "PE", "America/Santiago": "CL",
  "America/Caracas": "VE", "Asia/Tokyo": "JP", "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN", "Asia/Hong_Kong": "HK", "Asia/Taipei": "TW",
  "Asia/Singapore": "SG", "Asia/Bangkok": "TH", "Asia/Jakarta": "ID",
  "Asia/Manila": "PH", "Asia/Ho_Chi_Minh": "VN", "Asia/Kolkata": "IN",
  "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA", "Asia/Tehran": "IR", "Asia/Jerusalem": "IL",
  "Africa/Cairo": "EG", "Africa/Lagos": "NG", "Africa/Johannesburg": "ZA",
  "Africa/Nairobi": "KE", "Africa/Casablanca": "MA",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Perth": "AU",
  "Australia/Brisbane": "AU", "Pacific/Auckland": "NZ",
};

export function countryFromTimezone(tz: string | undefined): string | null {
  if (!tz) return null;
  return TIMEZONE_COUNTRY[tz] ?? null;
}

interface ParsedUA {
  browser: string | null;
  os: string | null;
}

export function parseUserAgent(ua: string | undefined): ParsedUA {
  if (!ua) return { browser: null, os: null };

  let browser: string | null = null;
  if (ua.includes("Firefox/")) browser = "Firefox";
  else if (ua.includes("Edg/")) browser = "Edge";
  else if (ua.includes("OPR/") || ua.includes("Opera")) browser = "Opera";
  else if (ua.includes("Chrome/") && ua.includes("Safari/")) browser = "Chrome";
  else if (ua.includes("Safari/") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("MSIE") || ua.includes("Trident/")) browser = "IE";

  let os: string | null = null;
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macOS";
  else if (ua.includes("Linux") && ua.includes("Android")) os = "Android";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("CrOS")) os = "ChromeOS";

  return { browser, os };
}

export function deviceTypeFromViewport(width: number | undefined): string {
  if (!width) return "desktop";
  if (width < 768) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}

const BOT_PATTERNS = /bot|crawler|spider|crawling|headless|phantomjs|lighthouse|pingdom|uptimerobot|slurp|yahoo|bingpreview|facebookexternalhit|twitterbot|linkedinbot|embedly|quora|outbrain|pinterest|semrush|ahref|mj12bot|dotbot|petalbot|bytespider/i;

export function isBot(ua: string | undefined): boolean {
  if (!ua) return true;
  return BOT_PATTERNS.test(ua);
}

export function sanitizePathname(pathname: string): string {
  let clean = pathname.split("?")[0].split("#")[0];
  if (clean.length > 1 && clean.endsWith("/")) {
    clean = clean.slice(0, -1);
  }
  return clean.slice(0, 500);
}

export function extractHostname(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname;
  } catch {
    return null;
  }
}
