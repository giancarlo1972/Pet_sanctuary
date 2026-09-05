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
    const key = context.env.OPENAI_API_KEY;
    if (!key || !imageBase64) {
      return Response.json(FALLBACK, { headers });
    }
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Analyze this animal photo.' },
              { type: 'image_url', image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });
    const json = await resp.json();
    const parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}');
    return Response.json({ ...FALLBACK, ...parsed, analyzed: true }, { headers });
  } catch {
    return Response.json(FALLBACK, { headers });
  }
}
