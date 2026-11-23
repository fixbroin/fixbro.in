import { type NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, addDoc, Timestamp } from '@/lib/mysqlDb';
import type { FirestoreVisitorInfoLog } from '@/types/firestore';
import { headers } from 'next/headers';

/**
 * Filter all automated bots, crawlers, and search engines from polluting customer visitor logs.
 */
const isBotOrScraper = (ua: string): boolean => {
  if (!ua || ua.trim() === '' || ua === '-') return true;
  const lower = ua.toLowerCase();
  const botKeywords = [
    'bot', 'crawler', 'spider', 'crawling', 'crawl', 'slurp',
    'googlebot', 'bingbot', 'yandex', 'duckduckbot', 'baiduspider', 'baidu',
    'bytespider', 'bytedance', 'petalbot', 'aspiegelbot',
    'ahrefs', 'semrush', 'dotbot', 'mj12bot', 'megaindex', 'zoominfobot',
    'serpstat', 'dataforseo', 'screaming frog', 'seokicks', 'blexbot',
    'gptbot', 'chatgpt', 'oai-searchbot', 'claudebot', 'anthropic',
    'adsbot', 'mediapartners-google', 'lighthouse', 'gtmetrix', 'pingdom',
    'facebookexternalhit', 'whatsapp', 'linkedinbot', 'twitterbot', 'telegrambot',
    'headlesschrome', 'phantomjs', 'selenium', 'puppeteer', 'playwright',
    'python', 'curl', 'wget', 'aiohttp', 'httpx', 'go-http-client', 'libwww'
  ];
  return botKeywords.some(keyword => lower.includes(keyword));
};

export async function POST(req: NextRequest) {
  try {
    // 1. Check if visitor logging is disabled in settings
    try {
      const { executeDbGetDoc } = require('@/app/actions/dbActions');
      const configDoc = await executeDbGetDoc('webSettings', 'applicationConfig');
      if (configDoc && configDoc.exists && configDoc.data) {
        if (configDoc.data.enableVisitorLogging === false) {
          return NextResponse.json({ success: true, bypassed: true });
        }
      }
    } catch (dbErr) {
      console.warn("Could not check enableVisitorLogging in API:", dbErr);
    }

    const body = await req.json();
    const { pathname, userAgent } = body;

    if (!pathname || !userAgent) {
      return NextResponse.json({ success: false, error: 'Missing required fields.' }, { status: 400 });
    }

    // 2. Reject bots & scrapers from being logged
    if (isBotOrScraper(userAgent)) {
      return NextResponse.json({ success: true, bypassed: true, reason: 'Bot filtered' });
    }

    // 3. Check Real IP & CDN country headers
    const headersList = await headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const realIp = headersList.get('x-real-ip');
    const userIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || 'unknown');

    const cdnCountry = (
      headersList.get('cf-ipcountry') ||
      headersList.get('x-country-code') ||
      headersList.get('x-vercel-ip-country') ||
      ''
    ).toUpperCase();

    // Block China traffic from visitor logs immediately
    if (cdnCountry === 'CN') {
      return NextResponse.json({ success: true, bypassed: true, reason: 'China country filtered' });
    }

    // 4. Fetch Geo-data from Server side (More reliable)
    let geoData = {
        city: 'Unknown City',
        region: 'Unknown Region',
        country: 'Unknown Country',
        countryCode: '',
        zip: 'Unknown Postal',
        isp: 'Unknown ISP'
    };

    if (userIp !== 'unknown' && userIp !== '127.0.0.1' && userIp !== '::1') {
        try {
            const geoRes = await fetch(`http://ip-api.com/json/${userIp}?fields=status,country,countryCode,regionName,city,zip,isp,org`);
            if (geoRes.ok) {
                const data = await geoRes.json();
                if (data.status === 'success') {
                    // Double check if resolved IP is from China
                    if (data.countryCode === 'CN' || (data.country && data.country.toLowerCase().includes('china'))) {
                      return NextResponse.json({ success: true, bypassed: true, reason: 'China IP filtered' });
                    }

                    geoData = {
                        city: data.city || 'Unknown City',
                        region: data.regionName || 'Unknown Region',
                        country: data.country || 'Unknown Country',
                        countryCode: data.countryCode || '',
                        zip: data.zip || 'Unknown Postal',
                        isp: data.isp || data.org || 'Unknown ISP'
                    };
                }
            }
        } catch (geoErr) {
            console.error("Geo lookup error on server:", geoErr);
        }
    }
    
    // Final check on resolved country
    if (geoData.countryCode === 'CN' || geoData.country.toLowerCase().includes('china')) {
      return NextResponse.json({ success: true, bypassed: true, reason: 'China filtered' });
    }

    const visitorLog: any = {
      ipAddress: userIp,
      city: geoData.city,
      region: geoData.region,
      countryName: geoData.country,
      postalCode: geoData.zip,
      ispOrganization: geoData.isp,
      pathname: pathname,
      userAgent: userAgent,
      source: body.source || (userAgent.toLowerCase().includes('fixbroapp') ? 'app' : 'web'),
      platform: body.platform || (userAgent.toLowerCase().includes('fixbroapp') ? 'App (Android)' : 'Web'),
    };

    await addDoc(collection(db, 'visitorInfoLogs'), {
      ...visitorLog,
      timestamp: Timestamp.now(),
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Error in /api/log-visitor-info:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
