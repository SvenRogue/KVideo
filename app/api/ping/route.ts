/**
 * Ping API Route - Measures latency to video sources
 * Returns response time for real-time latency display
 */

import { NextRequest, NextResponse } from 'next/server';
import { probeSourceLatency } from '@/lib/api/source-latency';
import { isBlockedTargetUrl } from '@/lib/server/network-guard';
import { getRuntimeFeatures } from '@/lib/server/runtime-features';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
    try {
        const runtimeFeatures = getRuntimeFeatures();
        if (runtimeFeatures.restrictedManagedDeployment) {
            return NextResponse.json(
                {
                    error: 'Latency probing is disabled on this deployment',
                    message: runtimeFeatures.restrictionSummary,
                },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { url } = body;

        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
        }

        if (isBlockedTargetUrl(url)) {
            return NextResponse.json({ error: 'Unsupported URL' }, { status: 400 });
        }

        const result = await probeSourceLatency(url);
        return NextResponse.json(result);
    } catch (error) {
        console.error('Ping error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
