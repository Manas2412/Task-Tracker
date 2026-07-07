import { NextResponse } from 'next/server';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { logError } from '@/lib/utils/log';

import { auth } from '@/lib/auth';

const propertyId = process.env.GA4_PROPERTY_ID;
const clientEmail = process.env.GA4_CLIENT_EMAIL;
const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n');

function getClient() {
  if (!propertyId || !clientEmail || !privateKey) return null;
  return new BetaAnalyticsDataClient({
    credentials: { client_email: clientEmail, private_key: privateKey },
  });
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { activeUsers: 0, totalUsers: 0, configured: false },
      { status: 200 },
    );
  }

  try {
    const [realtimeRes, totalRes] = await Promise.all([
      client.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [{ name: 'activeUsers' }],
      }),
      client.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
        metrics: [{ name: 'totalUsers' }],
      }),
    ]);

    const activeUsers = Number(realtimeRes[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0);
    const totalUsers = Number(totalRes[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0);

    return NextResponse.json({ activeUsers, totalUsers, configured: true });
  } catch (err) {
    logError('GA4 API error', err);
    return NextResponse.json(
      { activeUsers: 0, totalUsers: 0, configured: false, error: 'API call failed' },
      { status: 500 },
    );
  }
}
