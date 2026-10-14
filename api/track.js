/**
 * Vercel Serverless Function: /api/track
 * Recebe eventos do funil e persiste na nuvem
 */

const KVDB_URL = 'https://kvdb.io/NnRdYG4NXhJ48JLS527zSC/funnel_data';

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  if (req.body) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body); } catch(e) { return {}; }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch(e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function getStoredData() {
  try {
    const res = await fetch(KVDB_URL, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim().startsWith('{')) {
        return JSON.parse(text);
      }
    }
  } catch(e) {}
  return { counts: {}, leads: [], recentEvents: [] };
}

async function saveStoredData(data) {
  try {
    await fetch(KVDB_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(e) {}
}

module.exports = async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = await parseBody(req);
    const { sessionId, event, timestamp, referrer, screen, metadata } = body || {};

    if (!event) {
      return sendJson(res, 400, { error: 'Event name is required' });
    }

    const eventRecord = {
      sessionId: sessionId || 'anon',
      event: event,
      time: timestamp || Date.now(),
      ref: referrer || 'direto',
      screen: screen || '',
      meta: metadata || {}
    };

    // 1. Armazenamento na nuvem persistente
    const data = await getStoredData();
    data.counts = data.counts || {};
    data.leads = Array.isArray(data.leads) ? data.leads : [];
    data.recentEvents = Array.isArray(data.recentEvents) ? data.recentEvents : [];

    data.counts[event] = (data.counts[event] || 0) + 1;
    data.counts['total_events'] = (data.counts['total_events'] || 0) + 1;

    if (sessionId && !data.leads.includes(sessionId)) {
      data.leads.push(sessionId);
      if (data.leads.length > 500) data.leads.shift();
    }

    data.recentEvents.unshift(eventRecord);
    if (data.recentEvents.length > 50) {
      data.recentEvents.pop();
    }

    await saveStoredData(data);

    // 2. Se Vercel KV / Upstash Redis estiver conectado, sincroniza também nele
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (kvUrl && kvToken) {
      try {
        const pipeline = [
          ["HINCRBY", "aci:funnel:counts", event, "1"],
          ["HINCRBY", "aci:funnel:counts", "total_events", "1"],
          ["SADD", "aci:funnel:leads", sessionId || 'anon'],
          ["SADD", `aci:funnel:step:${event}`, sessionId || 'anon'],
          ["LPUSH", "aci:funnel:recent", JSON.stringify(eventRecord)],
          ["LTRIM", "aci:funnel:recent", "0", "99"]
        ];

        await fetch(`${kvUrl}/pipeline`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${kvToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(pipeline)
        });
      } catch(e) {}
    }

    return sendJson(res, 200, { ok: true, stored: 'cloud' });
  } catch (error) {
    console.error('Track error:', error);
    return sendJson(res, 200, { ok: false, error: error.message });
  }
};
