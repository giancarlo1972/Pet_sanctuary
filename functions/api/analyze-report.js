const PROMPT = `You are helping Rescue Army, a lost/stray/emergency animal app.
Look at this photo. Return JSON only, no extra words:
{
  "species": "Dog | Cat | Rabbit | Bird | Wildlife | Livestock | Other",
  "breed_guess": "best guess or Unknown",
  "colors": ["main colors"],
  "age_guess": "baby | young | adult | senior | unknown",
  "condition": "appears healthy | injured | skinny | unknown",
  "suggested_report_type": "lost | stray | injured | emergency",
  "confidence": 0.0,
  "short_description": "two sentences a volunteer can use, no personal names"
}
If it is not an animal, set species to Other and say so in short_description.`;

function fallback(reason) {
  return {
    species: 'Other',
    breed_guess: 'Unknown',
    colors: [],
    age_guess: 'unknown',
    condition: 'unknown',
    suggested_report_type: 'stray',
    confidence: 0,
    short_description: reason,
    analyzed: false,
  };
}

function getKey(env) {
  if (!env) return null;
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  for (const name of Object.keys(env)) {
    if (/anthropic|claude|rescuearmy/i.test(name)) return env[name];
  }
  return null;
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function onRequestPost(context) {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  try {
    const body = await context.request.json();
    const imageBase64 = body.imageBase64;
    const envNames = Object.keys(context.env || {}).join(', ') || '(none)';
    const key = getKey(context.env);

    if (!imageBase64) {
      return Response.json(fallback('No photo was sent to the AI.'), { headers });
    }
    if (!key) {
      return Response.json(
        fallback('AI key not found. Add ANTHROPIC_API_KEY on the Pages project, then Retry deployment. Env names: ' + envNames),
        { headers }
      );
    }

    const s = String(imageBase64);
    const prefix = s.slice(0, 40).toLowerCase();
    const raw = s.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
    let mediaType = 'image/jpeg';
    if (prefix.includes('image/png') || raw.startsWith('iVBORw0')) mediaType = 'image/png';
    else if (prefix.includes('image/webp') || raw.startsWith('UklGR')) mediaType = 'image/webp';
    else if (prefix.includes('image/gif') || raw.startsWith('R0lGOD')) mediaType = 'image/gif';
    else if (raw.startsWith('/9j/')) mediaType = 'image/jpeg';
    
    if (prefix.includes('image/png') || raw.startsWith('iVBORw0')) mediaType = 'image/png';
    else if (prefix.includes('image/webp') || raw.startsWith('UklGR')) mediaType = 'image/webp';
    else if (prefix.includes('image/gif') || raw.startsWith('R0lGOD')) mediaType = 'image/gif';
    else if (raw.startsWith('/9j/')) mediaType = 'image/jpeg';
    const models = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];

    let lastErr = 'Claude did not respond.';
    for (const model of models) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: 400,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: mediaType, data: raw } },
                { type: 'text', text: PROMPT },
              ],
            },
          ],
        }),
      });
      const json = await resp.json();
      if (!resp.ok) {
        lastErr = json?.error?.message || JSON.stringify(json).slice(0, 180);
        continue;
      }
      const text = json.content?.find((b) => b.type === 'text')?.text || '{}';
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      return Response.json({ ...fallback(''), ...parsed, analyzed: true }, { headers });
    }

    return Response.json(fallback('Claude error: ' + lastErr), { headers });
  } catch (err) {
    return Response.json(fallback('Analyze failed: ' + String(err)), { headers });
  }
}
