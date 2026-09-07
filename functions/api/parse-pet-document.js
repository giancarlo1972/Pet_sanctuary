
function decodedBytes(b64) {
  const raw = String(b64 || '').replace(/^data:[^;]+;base64,/, '');
  return Math.floor(raw.length * 0.75);
}
function tooLarge(b64, max) {
  return decodedBytes(b64) > max;
}

function getKey(env) {
  if (!env) return null;
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  for (const name of Object.keys(env)) {
    if (/anthropic|claude|rescuearmy/i.test(name)) return env[name];
  }
  return null;
}

const PROMPT = `Extract structured veterinary data from this document (vaccine record, lab, invoice, or insurance letter).
Return JSON only:
{
  "kind": "vaccination|lab|invoice|insurance|other",
  "clinic": "string or null",
  "date": "YYYY-MM-DD or null",
  "vaccinations": [{"brand": "", "name": "", "dose": "", "given_on": "", "expires_on": ""}],
  "labs": [{"name": "", "value": "", "unit": "", "flag": "normal|high|low|unknown"}],
  "invoices": [{"description": "", "amount": null, "currency": "USD"}],
  "notes": "short"
}
If unreadable, empty arrays. Flag every extracted row as AI until a human confirms.`;

const MODELS = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function onRequestOptions() {
  return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const key = getKey(context.env);
    if (!key) return Response.json({ parsed: false, error: 'AI key missing' }, { headers });
    const content = [];
    const imgs = Array.isArray(body.images) ? body.images : (body.imageBase64 ? [body.imageBase64] : []);
    for (const s0 of imgs) {
      const s = String(s0);
      if (tooLarge(s, 9_500_000)) {
        return Response.json({ parsed: false, error: 'too_large', labeled: 'Image too large — please re-upload (max 10 MB)' }, { headers, status: 413 });
      }
      const raw = s.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      let mediaType = 'image/jpeg';
      if (s.includes('image/png') || raw.startsWith('iVBORw0')) mediaType = 'image/png';
      content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: raw } });
    }
    content.push({ type: 'text', text: (body.text ? `Document text:\n${String(body.text).slice(0, 12000)}\n\n` : '') + PROMPT });
    let lastErr = 'Claude did not respond.';
    for (const model of MODELS) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: 'user', content }] }),
      });
      const json = await resp.json();
      if (!resp.ok) { lastErr = json?.error?.message || 'model error'; continue; }
      const text = json.content?.find((b) => b.type === 'text')?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      return Response.json({ parsed: true, source: 'ai_extracted', labeled: 'AI extracted — confirm before treating as medical fact', ...parsed }, { headers });
    }
    return Response.json({ parsed: false, error: lastErr }, { headers });
  } catch (err) {
    return Response.json({ parsed: false, error: String(err) }, { headers });
  }
}
