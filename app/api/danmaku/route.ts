import { NextRequest, NextResponse } from 'next/server';
import { isBlockedTargetUrl } from '@/lib/server/network-guard';
import { clientIp, isRateLimited } from '@/lib/server/rate-limit';
import { getRuntimeEnvValue } from '@/lib/server/runtime-env';

export const runtime = 'edge';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action');
  const apiUrl = searchParams.get('apiUrl');

  if (!action || !apiUrl) {
    return NextResponse.json(
      { error: 'Missing action or apiUrl parameter' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  // Normalize base URL (remove trailing slash)
  const baseUrl = apiUrl.replace(/\/+$/, '');

  // Only the operator-configured danmaku API is allowed when one is set;
  // otherwise fall back to public-host-only so self-hosted custom APIs still work.
  const configuredApiUrl = (
    getRuntimeEnvValue('DANMAKU_API_URL') ||
    getRuntimeEnvValue('NEXT_PUBLIC_DANMAKU_API_URL')
  ).replace(/\/+$/, '');
  if (configuredApiUrl) {
    if (baseUrl !== configuredApiUrl) {
      return NextResponse.json(
        { error: 'Unsupported API host' },
        { status: 400, headers: CORS_HEADERS }
      );
    }
  } else if (isBlockedTargetUrl(baseUrl)) {
    return NextResponse.json(
      { error: 'Unsupported API host' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (isRateLimited(clientIp(request), RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: CORS_HEADERS }
    );
  }

  try {
    let targetUrl: string;

    if (action === 'search') {
      const keyword = searchParams.get('keyword');
      if (!keyword) {
        return NextResponse.json(
          { error: 'Missing keyword parameter' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      targetUrl = `${baseUrl}/api/v2/search/episodes?anime=${encodeURIComponent(keyword)}`;
    } else if (action === 'comments') {
      const episodeId = searchParams.get('episodeId');
      if (!episodeId) {
        return NextResponse.json(
          { error: 'Missing episodeId parameter' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      targetUrl = `${baseUrl}/api/v2/comment/${encodeURIComponent(episodeId)}?withRelated=true`;
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "search" or "comments".' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'KVideo/1.0',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream API returned ${response.status}` },
        { status: response.status, headers: CORS_HEADERS }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, {
      headers: {
        ...CORS_HEADERS,
        'Cache-Control': 'public, max-age=3600', // Cache danmaku for 1 hour
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch from danmaku API' },
      { status: 502, headers: CORS_HEADERS }
    );
  }
}
