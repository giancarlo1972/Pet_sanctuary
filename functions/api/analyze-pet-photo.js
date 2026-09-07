
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

const PROMPT = `You analyze a pet photo for Rescue Army. Return JSON only:
{
  "species": "Dog|Cat|Rabbit|Bird|Other",
  "breed_guess": "string",
  "confidence": 0.0,
  "life_stage": "baby|young|adult|senior|unknown",
  "colors": ["..."],
  "coat": "short|medium|long|wire|hairless|unknown"
}
Visual guess only, not DNA. If not an animal, species Other, confidence 0.`;

const MODELS = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

export async function onRequestOptions() {
  return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const imageBase64 = body.imageBase64;
    const key = getKey(context.env);
    if (!imageBase64) return Response.json({ analyzed: false, error: 'No photo' }, { headers });
    if (!key) return Response.json({ analyzed: false, error: 'AI key missing on Cloudflare' }, { headers });
    if (tooLarge(imageBase64, 9_500_000)) return Response.json({ analyzed: false, error: 'too_large', labeled: 'Image too large — please re-upload (max 10 MB)' }, { headers, status: 413 });
    const s = String(imageBase64);
    const prefix = s.slice(0, 40).toLowerCase();
    const raw = s.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    let mediaType = 'image/jpeg';
    if (prefix.includes('image/png') || raw.startsWith('iVBORw0')) mediaType = 'image/png';
    else if (prefix.includes('image/webp') || raw.startsWith('UklGR')) mediaType = 'image/webp';
    else if (raw.startsWith('/9j/')) mediaType = 'image/jpeg';
    let lastErr = 'Claude did not respond.';
    for (const model of MODELS) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 400,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: raw } },
            { type: 'text', text: PROMPT },
          ]}],
        }),
      });
      const json = await resp.json();
      if (!resp.ok) { lastErr = json?.error?.message || 'model error'; continue; }
      const text = json.content?.find((b) => b.type === 'text')?.text || '{}';
      const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
      return Response.json({ analyzed: true, labeled: 'AI visual guess, not DNA', ...parsed }, { headers });
    }
    return Response.json({ analyzed: false, error: lastErr }, { headers });
  } catch (err) {
    return Response.json({ analyzed: false, error: String(err) }, { headers });
  }
}
