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

const FALLBACK = {
  species: 'Other',
  breed_guess: 'Unknown',
  colors: [],
  age_guess: 'unknown',
  condition: 'unknown',
  suggested_report_type: 'stray',
  confidence: 0,
  short_description: 'Could not analyze this photo. Please choose type and species yourself.',
  analyzed: false,
};

function getKey(env) {
  return (
    env.ANTHROPIC_API_KEY ||
    env['CloudFlare-RescueArmyReports'] ||
    env.CloudFlareRescueArmyReports ||
    null
  );
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
    const { imageBase64 } = await context.request.json();
    const key = getKey(context.env);
    if (!key || !imageBase64) {
      return Response.json(FALLBACK, { headers });
    }

    const raw = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    const mediaType = String(imageBase64).includes('png') ? 'image/png' : 'image/jpeg';

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
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
      console.log('claude error', json);
      return Response.json(FALLBACK, { headers });
    }
    const text = json.content?.find((b) => b.type === 'text')?.text || '{}';
    const cleaned = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Response.json({ ...FALLBACK, ...parsed, analyzed: true }, { headers });
  } catch (err) {
    console.log('analyze-report failed', err);
    return Response.json(FALLBACK, { headers });
  }
}
