function getKey(env) {
  if (!env) return null;
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  for (const name of Object.keys(env)) {
    if (/anthropic|claude|rescuearmy/i.test(name)) return env[name];
  }
  return null;
}

const MODELS = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function onRequestOptions() {
  return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const key = getKey(context.env);
    if (!key) return Response.json({ ok: false, error: 'AI key missing' }, { headers });
    const prompt = `You are Rescue Army AI Health. Review this pet record. You are NOT a veterinarian.
Return JSON only:
{
  "findings": [{"title": "", "detail": "", "severity": "info|watch|urgent"}],
  "summary": "2 sentences",
  "disclaimer": "AI support only. A licensed veterinarian must confirm any diagnosis or treatment."
}
Record:
${JSON.stringify(body.record || body).slice(0, 14000)}`;
    let lastErr = 'Claude did not respond.';
    for (const model of MODELS) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'user', content: prompt }] }),
      });
      const json = await resp.json();
      if (!resp.ok) { lastErr = json?.error?.message || 'model error'; continue; }
      const text = json.content?.find((b) => b.type === 'text')?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      return Response.json({ ok: true, labeled: 'AI — vet-first', ...parsed }, { headers });
    }
    return Response.json({ ok: false, error: lastErr }, { headers });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { headers });
  }
}
