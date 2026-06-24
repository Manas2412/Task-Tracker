# Google Analytics 4 — Integration guide for static sites

A complete, copy-paste guide to add GA4 page tracking **and** a live "X online | Y total users" badge to any static site (plain HTML, Astro, Hugo, Vite, etc.). No framework required — just HTML, CSS, and vanilla JS.

---

## Part 1 — Page tracking (the gtag.js snippet)

This is the script that sends pageview data to Google Analytics. Everything else (realtime badge, reports) depends on this being present on every page.

### Step 1: Create a GA4 property

1. Go to [analytics.google.com](https://analytics.google.com)
2. Click the gear icon (Admin) at bottom-left
3. Click **Create** → **Property**
4. Name it (e.g. `My Site`), set timezone and currency
5. Click through the business details / objectives screens
6. Choose **Web** as the platform
7. Enter your site URL, name the stream `Production`
8. Click **Create stream**
9. Copy the **Measurement ID** — it looks like `G-XXXXXXXXXX`

### Step 2: Add the tracking script

Paste this inside `<head>` on every page (or in your shared layout/template). Replace `G-XXXXXXXXXX` with your actual Measurement ID.

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

### Step 3: Verify

1. Deploy the change
2. Open your site in a browser
3. In GA4, go to **Reports** → **Realtime** — you should see yourself within 30 seconds

That is it for basic tracking. If you only need the GA4 dashboard (no on-site badge), you are done.

---

## Part 2 — Live user count badge on your site

To show "X online | Y total" on the page itself, you need the **GA4 Data API**. This requires a Google Cloud service account.

### Step 4: Enable the GA4 Data API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services** → **Library**
4. Search for **Google Analytics Data API** → click it → **Enable**

### Step 5: Create a service account

1. In the same project, go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Name: `analytics-reader` (or anything)
4. Click **Create and continue** → skip optional permissions → **Done**
5. Click the service account you just created
6. Go to the **Keys** tab → **Add Key** → **Create new key** → **JSON** → **Create**
7. A `.json` file downloads. Open it and note these two fields:

```
client_email  →  "analytics-reader@your-project.iam.gserviceaccount.com"
private_key   →  "-----BEGIN PRIVATE KEY-----\nMIIEv..."
```

### Step 6: Grant access in GA4

1. Go to [analytics.google.com](https://analytics.google.com) → **Admin** (gear icon)
2. Click **Property Access Management**
3. Click **+** → **Add users**
4. Paste the `client_email` from the JSON file
5. Role: **Viewer** → **Add**
6. While in Admin, go to **Property Settings** and copy the **Property ID** (a numeric string like `123456789`)

You now have 3 values:

| Value | Example |
|---|---|
| `PROPERTY_ID` | `123456789` |
| `CLIENT_EMAIL` | `analytics-reader@proj.iam.gserviceaccount.com` |
| `PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\nMIIEv...` |

### Step 7: Create the serverless API endpoint

Since private keys cannot be exposed to the browser, you need a small backend function. Below are two options — pick whichever fits your hosting.

#### Option A: Cloudflare Worker (free tier — recommended for static sites)

Create a file `worker.js`:

```js
// Cloudflare Worker — GA4 realtime + total user counts
// Set these as Worker secrets (wrangler secret put ...):
//   GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, GA4_PRIVATE_KEY

const GA4_API = 'https://analyticsdata.googleapis.com';

export default {
  async fetch(request, env) {
    // CORS — restrict to your domain in production
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=30',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      const token = await getAccessToken(env.GA4_CLIENT_EMAIL, env.GA4_PRIVATE_KEY);
      const prop = `properties/${env.GA4_PROPERTY_ID}`;

      const [realtime, total] = await Promise.all([
        ga4Fetch(token, `${prop}:runRealtimeReport`, {
          metrics: [{ name: 'activeUsers' }],
        }),
        ga4Fetch(token, `${prop}:runReport`, {
          dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
          metrics: [{ name: 'totalUsers' }],
        }),
      ]);

      const activeUsers = Number(realtime?.rows?.[0]?.metricValues?.[0]?.value ?? 0);
      const totalUsers = Number(total?.rows?.[0]?.metricValues?.[0]?.value ?? 0);

      return new Response(JSON.stringify({ activeUsers, totalUsers }), { headers });
    } catch (err) {
      return new Response(
        JSON.stringify({ activeUsers: 0, totalUsers: 0, error: err.message }),
        { status: 500, headers },
      );
    }
  },
};

async function ga4Fetch(token, path, body) {
  const res = await fetch(`${GA4_API}/v1beta/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// --- JWT / OAuth2 for service account ---

async function getAccessToken(email, privateKeyPem) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const key = await importPrivateKey(privateKeyPem);
  const jwt = await signJwt(header, payload, key);

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const data = await res.json();
  return data.access_token;
}

async function importPrivateKey(pem) {
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\n/g, '')
    .trim();

  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function signJwt(header, payload, key) {
  const enc = new TextEncoder();
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const input = enc.encode(`${h}.${p}`);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, input);
  return `${h}.${p}.${base64urlBuffer(sig)}`;
}

function base64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlBuffer(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
```

Deploy with Wrangler:

```bash
npm install -g wrangler
wrangler init ga4-api
# copy worker.js into the project
wrangler secret put GA4_PROPERTY_ID
wrangler secret put GA4_CLIENT_EMAIL
wrangler secret put GA4_PRIVATE_KEY
wrangler deploy
```

Your endpoint will be something like `https://ga4-api.<you>.workers.dev`.

#### Option B: Vercel serverless function (if already on Vercel)

Create `api/analytics.js` at the project root:

```js
import { BetaAnalyticsDataClient } from '@google-analytics/data';

const propertyId = process.env.GA4_PROPERTY_ID;
const clientEmail = process.env.GA4_CLIENT_EMAIL;
const privateKey = process.env.GA4_PRIVATE_KEY?.replace(/\\n/g, '\n');

let client = null;
function getClient() {
  if (!client && propertyId && clientEmail && privateKey) {
    client = new BetaAnalyticsDataClient({
      credentials: { client_email: clientEmail, private_key: privateKey },
    });
  }
  return client;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  const c = getClient();
  if (!c) {
    return res.json({ activeUsers: 0, totalUsers: 0, configured: false });
  }

  try {
    const [realtimeRes, totalRes] = await Promise.all([
      c.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [{ name: 'activeUsers' }],
      }),
      c.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: '2020-01-01', endDate: 'today' }],
        metrics: [{ name: 'totalUsers' }],
      }),
    ]);

    const activeUsers = Number(realtimeRes[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0);
    const totalUsers = Number(totalRes[0]?.rows?.[0]?.metricValues?.[0]?.value ?? 0);

    return res.json({ activeUsers, totalUsers, configured: true });
  } catch (err) {
    console.error('GA4 error:', err);
    return res.status(500).json({ activeUsers: 0, totalUsers: 0, error: 'API call failed' });
  }
}
```

Install the dependency:

```bash
npm install @google-analytics/data
```

Set environment variables in Vercel dashboard → Settings → Environment Variables:

| Key | Value |
|---|---|
| `GA4_PROPERTY_ID` | `123456789` |
| `GA4_CLIENT_EMAIL` | `analytics-reader@proj.iam.gserviceaccount.com` |
| `GA4_PRIVATE_KEY` | (paste the full private key including `-----BEGIN...`) |

### Step 8: Add the badge to your HTML

Paste this wherever you want the badge to appear. Update `API_URL` to point to your Worker or Vercel function.

```html
<!-- Analytics badge -->
<div id="analytics-badge" style="display:none; align-items:center; gap:10px; font-size:13px; font-family:system-ui,sans-serif; color:#555;">
  <span style="display:flex; align-items:center; gap:6px;">
    <span style="position:relative; display:inline-flex; width:8px; height:8px;">
      <span style="position:absolute; width:100%; height:100%; border-radius:50%; background:#34d399; opacity:0.75; animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></span>
      <span style="position:relative; width:8px; height:8px; border-radius:50%; background:#10b981;"></span>
    </span>
    <span id="active-count">0</span> online
  </span>
  <span style="color:#ccc;">|</span>
  <span><span id="total-count">0</span> total visitors</span>
</div>

<style>
  @keyframes ping {
    75%, 100% { transform: scale(2); opacity: 0; }
  }
</style>

<script>
(function() {
  // CHANGE THIS to your Worker or Vercel function URL
  var API_URL = 'https://ga4-api.yourname.workers.dev';

  function load() {
    fetch(API_URL)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.activeUsers !== undefined) {
          document.getElementById('active-count').textContent = data.activeUsers;
          document.getElementById('total-count').textContent = data.totalUsers;
          document.getElementById('analytics-badge').style.display = 'flex';
        }
      })
      .catch(function() {});
  }

  load();
  setInterval(load, 60000);
})();
</script>
```

### Step 9: API reference

**Request:**

```
GET https://your-endpoint.workers.dev/
```

No parameters needed.

**Response:**

```json
{
  "activeUsers": 3,
  "totalUsers": 847
}
```

| Field | Type | Description |
|---|---|---|
| `activeUsers` | number | Users on the site right now (last 30 min) |
| `totalUsers` | number | All-time unique visitors since tracking began |

---

## Summary checklist

1. Create GA4 property → get Measurement ID (`G-XXXXXXXXXX`)
2. Add gtag.js snippet to `<head>` on every page
3. Enable **Google Analytics Data API** in Google Cloud Console
4. Create a **service account** → download JSON key
5. Add service account email as **Viewer** in GA4 property access
6. Note your GA4 **Property ID** (numeric)
7. Deploy the serverless function (Cloudflare Worker or Vercel) with 3 env vars
8. Add the badge HTML/JS to your site, pointing at the function URL
9. Deploy and verify in browser

---

## Environment variables reference

| Variable | Where to find it | Example |
|---|---|---|
| `GA4_PROPERTY_ID` | GA4 Admin → Property Settings | `123456789` |
| `GA4_CLIENT_EMAIL` | Service account JSON → `client_email` | `reader@proj.iam.gserviceaccount.com` |
| `GA4_PRIVATE_KEY` | Service account JSON → `private_key` | `-----BEGIN PRIVATE KEY-----\nMIIEv...` |
