export type ParsedUa = {
  deviceType: "desktop" | "mobile" | "tablet" | "unknown";
  browser: string;
  os: string;
};

export function parseUserAgent(ua: string): ParsedUa {
  const s = ua.toLowerCase();
  let deviceType: ParsedUa["deviceType"] = "desktop";
  if (/ipad|tablet|playbook|silk/.test(s)) deviceType = "tablet";
  else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry/.test(s)) deviceType = "mobile";

  let browser = "Other";
  if (/edg\//.test(s)) browser = "Edge";
  else if (/chrome\//.test(s) && !/chromium/.test(s)) browser = "Chrome";
  else if (/firefox\//.test(s)) browser = "Firefox";
  else if (/safari\//.test(s) && !/chrome/.test(s)) browser = "Safari";
  else if (/opr\//.test(s) || /opera/.test(s)) browser = "Opera";

  let os = "Other";
  if (/windows nt/.test(s)) os = "Windows";
  else if (/mac os x|macintosh/.test(s) && !/iphone|ipad/.test(s)) os = "macOS";
  else if (/android/.test(s)) os = "Android";
  else if (/iphone|ipad|ipod/.test(s)) os = "iOS";
  else if (/linux/.test(s)) os = "Linux";

  return { deviceType, browser, os };
}

/** Vercel / Cloudflare country header when available. */
export function resolveCountry(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const cf = req.headers["x-vercel-ip-country"] ?? req.headers["cf-ipcountry"];
  if (typeof cf === "string" && cf.length === 2) return cf;
  return null;
}
