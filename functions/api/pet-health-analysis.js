function getKey(env) {
  if (!env) return null;
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  for (const name of Object.keys(env)) {
    if (/anthropic|claude|rescuearmy/i.test(name)) return env[name];
  }
  return null;
}

function stripFences(text) {
  return String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
}
function extractJsonBlock(text) {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return cleaned.slice(start, i + 1); }
  }
  return null;
}

const MODELS = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
const SYSTEM = `You are Rescue Army AI Health. You are NOT a veterinarian. You do not diagnose or prescribe.
Review the complete pet record (weights in lb only). Return a single JSON object, no markdown:
{
  "verdict": "STABLE" | "MONITOR",
  "findings": [{"severity": "info|watch|urgent", "title": "", "body": ""}],
  "summary": "2 sentences",
  "disclaimer": "AI support only. A licensed veterinarian must confirm any diagnosis or treatment."
}
Use MONITOR if any finding is watch or urgent, otherwise STABLE. Cite specific values (lb, dates, lab flags). Flag data-quality issues (unit errors, implausible jumps).`;

export async function onRequestOptions() {
  return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const key = getKey(context.env);
    if (!key) return Response.json({ ok: false, error: 'AI key missing' }, { headers });
    const record = body.record || body;
    console.log('[pet-health-analysis] record keys', Object.keys(record || {}), {
      weight_lb: record?.weight_lb,
      weights: record?.weight_entries?.length,
      conditions: record?.conditions?.length,
      vax: record?.vaccinations?.length,
      labs: record?.lab_results?.length,
      visits: record?.visits?.length,
    });
    const userContent = `Complete pet record (all weights are pounds):\n${JSON.stringify(record).slice(0, 24000)}`;
    let lastErr = 'Claude did not respond.';
    for (const model of MODELS) {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model, max_tokens: 1800, system: SYSTEM,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
      const json = await resp.json();
      if (!resp.ok) { lastErr = json?.error?.message || 'model error'; continue; }
      const text = json.content?.find((b) => b.type === 'text')?.text || '{}';
      let parsed;
      try {
        parsed = JSON.parse(extractJsonBlock(text) || '{}');
      } catch (e) {
        console.log('[pet-health-analysis] JSON fail', String(e), String(text).slice(0, 800));
        lastErr = e.message;
        continue;
      }
      const findings = Array.isArray(parsed.findings) ? parsed.findings.map((f) => ({
        severity: f.severity || 'info',
        title: f.title || '',
        body: f.body || f.detail || '',
      })) : [];
      const urgent = findings.some((f) => f.severity === 'urgent' || f.severity === 'watch');
      const verdict = (parsed.verdict === 'MONITOR' || parsed.verdict === 'WATCH' || urgent) ? 'MONITOR' : 'STABLE';
      return Response.json({
        ok: true,
        labeled: 'AI — vet-first',
        verdict,
        findings,
        summary: parsed.summary || '',
        disclaimer: parsed.disclaimer || 'AI support only. A licensed veterinarian must confirm any diagnosis or treatment.',
        ran_at: new Date().toISOString(),
      }, { headers });
    }
    return Response.json({ ok: false, error: lastErr }, { headers });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { headers });
  }
}
