import { NextResponse, type NextRequest } from 'next/server';

/**
 * Whitelist of search engines and AI assistants.
 * These are ALWAYS allowed through so indexing and SEO are never impacted.
 */
const ALLOWED_BOTS = [
  // Googlebot family
  'googlebot',
  'google-inspectiontool',
  'mediapartners-google',
  'adsbot-google',
  'storebot-google',
  'googleother',
  'apis-google',
  'feedfetcher-google',

  // Microsoft Bing
  'bingbot',
  'bingpreview',
  'msnbot',
  'adidxbot',

  // OpenAI / ChatGPT
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
];

/**
 * Blocklist of aggressive crawlers, SEO harvesters, and scraping tools.
 */
const BLOCKED_BOTS = [
  // Chinese crawlers & scrapers
  'bytespider',       // ByteDance / TikTok scraper
  'bytedance',
  'baiduspider',      // Baidu spider
  'baidu',
  'sogou',            // Sogou spider
  'yisouspider',      // Shenma / Alibaba spider
  'haosouspider',     // 360 search
  'youdaobot',        // NetEase Youdao

  // Aggressive SEO & Backlink scrapers
  'ahrefsbot',
  'ahrefs',
  'semrushbot',
  'semrush',
  'dotbot',
  'mj12bot',
  'petalbot',         // Huawei Petal Search
  'aspiegelbot',
  'megaindex',
  'zoominfobot',
  'serpstatbot',
  'dataforseobot',
  'screaming frog',
  'seokicks',
  'blexbot',
  'turnitin',
  'cognitiveseo',
  'linkdexbot',
  'mail.ru_bot',
  'seznambot',
  'coccocbot',

  // Russian search & crawlers
  'yandexbot',
  'yandeximages',
  'yandexmetrika',

  // Headless browsers, scripts, vulnerability scanners
  'headlesschrome',
  'phantomjs',
  'selenium',
  'puppeteer',
  'playwright',
  'scrapy',
  'python-requests',
  'python-urllib',
  'aiohttp',
  'httpx',
  'go-http-client',
  'libwww-perl',
  'zgrab',
  'masscan',
  'nikto',
  'sqlmap',
];

export function middleware(request: NextRequest) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const path = request.nextUrl.pathname;

  // 1. Always allow verified search engines & AI crawlers (Google, Bing, ChatGPT)
  const isAllowedBot = ALLOWED_BOTS.some((bot) => ua.includes(bot));
  if (isAllowedBot) {
    return NextResponse.next();
  }

  // 2. Allow payment webhooks and critical third-party callbacks
  if (
    path.startsWith('/api/razorpay') ||
    path.startsWith('/api/stripe')
  ) {
    return NextResponse.next();
  }

  // 3. Block aggressive scrapers and unwanted crawlers
  const isBlockedBot = BLOCKED_BOTS.some((bot) => ua.includes(bot));
  if (isBlockedBot) {
    return new NextResponse('Forbidden: Automated crawler blocked.', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // 4. Block China traffic (CN country code via CDN / Geo headers)
  // FixBro operates exclusively in India; incoming requests from China are scrapers/bots.
  const country = (
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-country-code') ||
    request.headers.get('x-vercel-ip-country') ||
    (request as any).geo?.country ||
    ''
  ).toUpperCase();

  if (country === 'CN') {
    return new NextResponse('Access Denied', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // 5. Block empty or blank User-Agents on page/API routes
  if (!ua || ua.trim() === '' || ua === '-') {
    return new NextResponse('Forbidden', {
      status: 403,
      statusText: 'Forbidden',
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, robots.txt, sitemap.xml, offline page, service worker
     * - static asset extensions (.png, .jpg, .webp, .svg, .woff, etc.)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|robots\\.txt|sitemap\\.xml|offline|sw\\.js|site\\.webmanifest|manifest\\.json|.*\\.(?:jpg|jpeg|gif|png|webp|avif|svg|woff|woff2|ttf|eot|ico|css|js)$).*)',
  ],
};
