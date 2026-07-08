const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /slurp/i, /headless/i,
  /googlebot/i, /bingbot/i, /yandex/i, /baidu/i, /duckduck/i,
  /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
  /semrush/i, /ahrefs/i, /petalbot/i, /gptbot/i, /claudebot/i,
  /curl/i, /wget/i, /python-requests/i, /scrapy/i,
];

export function isBotUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent || userAgent.trim().length < 4) return true;
  return BOT_PATTERNS.some((re) => re.test(userAgent));
}
