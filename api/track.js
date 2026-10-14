/**
 * Vercel Serverless Function: /api/track
 * Recebe eventos do funil e persiste no Vercel KV / Upstash Redis
 */

// Fallback em memória para quando KV ainda não estiver configurado
const fallbackStore = {
  counts: {},
  leads: new Set(),
  recentEvents: []
};

export default async function handler(req, res) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e){}
    }

    const { sessionId, event, timestamp, referrer, screen, metadata } = body || {};

    if (!event) {
      return res.status(400).json({ error: 'Event name is required' });
    }

    const eventRecord = {
      sessionId: sessionId || 'anon',
      event: event,
      time: timestamp || Date.now(),
      ref: referrer || 'direto',
      screen: screen || '',
      meta: metadata || {}
    };

    // Identificar chaves do Vercel KV / Upstash Redis
    const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

    if (kvUrl && kvToken) {
      // Pipeline Upstash / Vercel KV REST API
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

      return res.status(200).json({ ok: true, stored: 'kv' });
    } else {
      // Armazenamento de contingência em memória
      fallbackStore.counts[event] = (fallbackStore.counts[event] || 0) + 1;
      fallbackStore.counts['total_events'] = (fallbackStore.counts['total_events'] || 0) + 1;
      if (sessionId) fallbackStore.leads.add(sessionId);
      fallbackStore.recentEvents.unshift(eventRecord);
      if (fallbackStore.recentEvents.length > 50) fallbackStore.recentEvents.pop();

      return res.status(200).json({ ok: true, stored: 'fallback' });
    }
  } catch (error) {
    console.error('Track error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
