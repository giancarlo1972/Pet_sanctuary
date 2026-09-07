import {
  splitServiceBlocks,
  parseWeightHistory,
  parseReminders,
  parseInventoryVaccines,
  parseLabTables,
  parsePatientHeader,
  parseConditions,
  batchBlocks,
} from '../lib/clinic-export.js';

function decodedBytes(b64) {
  const raw = String(b64 || '').replace(/^data:[^;]+;base64,/, '');
  return Math.floor(raw.length * 0.75);
}

function getKey(env) {
  if (!env) return null;
  if (env.ANTHROPIC_API_KEY) return env.ANTHROPIC_API_KEY;
  for (const name of Object.keys(env)) {
    if (/anthropic|claude|rescuearmy/i.test(name)) return env[name];
  }
  return null;
}

function getSupabase(env) {
  const url = env?.SUPABASE_URL || env?.EXPO_PUBLIC_SUPABASE_URL;
  const key = env?.SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_SERVICE_KEY;
  return { url, key };
}

const PROMPT = `Extract structured veterinary data from this document (vaccine card, lab report, invoice, wellness visit, or insurance letter).
Return JSON only, no markdown:
{
  "title": "short document title",
  "kind": "vaccination|lab|visit|invoice|insurance|other",
  "clinic": "string or null",
  "date": "YYYY-MM-DD or null",
  "vaccinations": [{"name": "", "product": null, "manufacturer": null, "lot": null, "dose": null, "given": "YYYY-MM-DD date administered — never the due date", "next_due": "YYYY-MM-DD or null", "vet": null, "clinic": null, "reactions": null}],
  "conditions": [{"name": "", "kind": "condition|allergy", "status": "active|resolved|monitoring", "onset_date": "YYYY-MM-DD or null", "resolved_date": "YYYY-MM-DD or null", "notes": null}],
  "medications": [{"name": "", "dose": null, "given_on": null}],
  "visits": [{"clinic": null, "date": "YYYY-MM-DD or null", "reason": null, "summary": null}],
  "labs": [{"analyte": "", "value": "", "unit": null, "flag": "normal|high|low|abnormal|unknown", "collected_on": null}],
  "weight": {"value": null, "unit": "lb|kg", "measured_on": null},
  "ai_note": "3-5 short lines: key findings, deltas vs prior values for the same analytes, flags. Plain text, no markdown.",
  "owner_notes": [{"text": "behavioral or lifestyle guidance for the owner", "date": "YYYY-MM-DD or null"}]
}
Rules:
- labs[].value MUST be a string or a number. Qualitative PCR (e.g. "Detected", "Not detected") stays as that string; unit null. If value is Detected (case-insensitive) flag=abnormal; if Not detected flag=normal. Numeric labs keep the printed number and unit.
- vaccinations: list EVERY vaccine administered at this visit AND every vaccine listed as current. Field "given" = date administered (e.g. 2026-08-12). Field "next_due" = next due / valid until, only if a SECOND later date is printed. If the card shows only one date, put it in given and leave next_due null. Never put the administered date in next_due. Always include manufacturer (Purevax, Merck, Elanco), lot, and vet when printed.
- weight: return the printed {value, unit} as-is (do not convert). Empty arrays if unreadable. Never invent dates.
- conditions: one row per distinct issue. If a visit notes an existing problem is better or gone, set status=resolved (or monitoring), do not duplicate the name. Use onset_date/resolved_date when printed.
- ai_note: 3–5 lines covering findings, any delta vs prior labs for the same analytes, and flags. Do not diagnose.
- owner_notes: behavioral/lifestyle guidance quoted from the vet notes for the owner (diet, indoor-only, activity, follow-up at home). Not clinical findings, diagnoses, or lab values. Empty array if none.`;

const MODELS = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];
const SYSTEM = 'Respond with a single JSON object only, no markdown, no commentary';

function stripFences(text) {
  return String(text || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
}

function extractJsonBlock(text) {
  const cleaned = stripFences(text);
  const start = cleaned.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
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
    else if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

function parseClaudeJson(text) {
  const block = extractJsonBlock(text);
  if (!block) throw new SyntaxError('no JSON object in model text');
  return JSON.parse(block);
}

function normalizeLab(l) {
  const value = l?.value == null ? null : (typeof l.value === 'number' ? l.value : String(l.value));
  const printed = String(value ?? '').trim().toLowerCase();
  let flag = l?.flag || null;
  let unit = l?.unit ?? null;
  if (printed === 'detected') { flag = 'abnormal'; unit = unit || null; }
  else if (printed === 'not detected' || printed === 'not-detected' || printed === 'undetected') { flag = 'normal'; unit = unit || null; }
  return {
    analyte: l?.analyte || l?.name || '',
    value,
    unit,
    flag,
    ref_low: l?.ref_low ?? null,
    ref_high: l?.ref_high ?? null,
    collected_on: l?.collected_on || null,
  };
}

function normalizeVax(v) {
  const given = v?.given || v?.administered_on || v?.given_on || v?.date_given || null;
  const due = v?.next_due || v?.next_due_on || v?.valid_until || v?.expires_on || null;
  let date = given || null;
  let next_due = due || null;
  if (date && next_due && String(date) > String(next_due)) {
    const t = date; date = next_due; next_due = t;
  }
  if (!date && !next_due && v?.date) date = v.date;
  return {
    brand: v?.brand || v?.product || null,
    name: v?.name || v?.vaccine || v?.product || '',
    product: v?.product || v?.name || null,
    manufacturer: v?.manufacturer || v?.maker || v?.company || v?.mfr || v?.brand || null,
    lot: v?.lot || v?.lot_number || v?.lotNumber || v?.lot_no || v?.serial || null,
    dose: v?.dose || null,
    given: date,
    date,
    next_due,
    valid_until: next_due,
    reactions: v?.reactions || null,
    clinic: v?.clinic || v?.clinic_name || null,
    vet: v?.vet || v?.vet_name || v?.veterinarian || v?.doctor || v?.provider || null,
  };
}

async function callClaude(key, model, userContent, extraText) {
  const content = extraText
    ? [...userContent, { type: 'text', text: extraText }]
    : userContent;
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    }),
  });
  const json = await resp.json();
  return { resp, json, text: json.content?.find((b) => b.type === 'text')?.text || '' };
}
const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

function fail(reason, extra = {}) {
  const labels = {
    no_file: 'File missing — re-upload',
    too_large: 'File too large — re-upload',
    unsupported_type: 'Unsupported file type',
    model_error: "AI couldn't read this — retry or add manually",
  };
  console.log('[parse-pet-document] FAIL', reason, extra.error || extra);
  return Response.json({
    parsed: false,
    reason,
    error: extra.error || reason,
    labeled: labels[reason] || labels.model_error,
  }, { headers, status: extra.status || 200 });
}

export async function onRequestOptions() {
  return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
}

async function fetchDocBytes(env, path) {
  const { url, key } = getSupabase(env);
  if (!url || !key || !path) return null;
  const sign = await fetch(`${url}/storage/v1/object/sign/pet-documents/${encodeURI(path)}`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 120 }),
  });
  const signed = await sign.json();
  const signedUrl = signed?.signedURL || signed?.signedUrl;
  if (!signedUrl) {
    console.log('[parse-pet-document] sign failed', path, JSON.stringify(signed).slice(0, 200));
    return null;
  }
  const abs = signedUrl.startsWith('http') ? signedUrl : `${url}${signedUrl}`;
  const file = await fetch(abs);
  if (!file.ok) {
    console.log('[parse-pet-document] download failed', file.status);
    return null;
  }
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { b64: btoa(binary), isPdf: /\.pdf$/i.test(path), byteLength: bytes.length, bytes };
}

function extractPdfTextNaive(bytes) {
  let latin1 = '';
  const chunk = 0x4000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(i + chunk, bytes.length));
    latin1 += String.fromCharCode.apply(null, slice);
  }
  const pageCount = (latin1.match(/\/Type\s*\/Page(?!s)/g) || []).length;
  const parts = [];
  const tj = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let m;
  while ((m = tj.exec(latin1))) {
    parts.push(m[1].replace(/\\n/g, '\n').replace(/\\([()\\])/g, '$1'));
  }
  const text = parts.join(' ').replace(/[ \t]{2,}/g, ' ');
  return { text, pageCount, charCount: text.length };
}

const VISIT_PROMPT = `This is one or more veterinary visit blocks from a clinic export. Return JSON only:
{"visits":[{"clinic":null,"date":"YYYY-MM-DD","reason":null,"summary":null}],"vaccinations":[{"name":"","product":null,"manufacturer":null,"lot":null,"given":"YYYY-MM-DD","next_due":null,"vet":null,"clinic":null}],"labs":[{"analyte":"","value":"","unit":null,"flag":"normal|high|low|abnormal","ref_low":null,"ref_high":null,"collected_on":null}],"conditions":[{"name":"","kind":"condition|allergy|medication","status":"active|resolved|monitoring","notes":null}],"owner_notes":[{"text":"","date":null}],"ai_note":""}
Use given for administered date. Inventory Item PUREVAX lines are vaccines given that service date. Lab tables: keep H/L flags and reference ranges.`;

async function parseClinicExport(env, key, documentId, text, pageCount) {
  const charCount = text.length;
  const blocks = splitServiceBlocks(text);
  console.log('[parse-pet-document] clinic export', { pageCount, charCount, visits: blocks.length });
  if (documentId) {
    await updateDoc(env, documentId, {
      ai_status: 'processing',
      ai_summary: {
        schemaVersion: 2,
        progress: { page_count: pageCount, char_count: charCount, visits_total: blocks.length, visits_parsed: 0, stage: 'header' },
      },
    });
  }
  const header = parsePatientHeader(text);
  const weights = parseWeightHistory(text);
  const reminderVax = parseReminders(text).map(normalizeVax);
  const conditions = parseConditions(text);
  let labs = parseLabTables(text).map(normalizeLab);
  const visits = [];
  const vax = [...reminderVax];
  blocks.forEach((b, i) => {
    visits.push({ clinic: null, date: b.date, reason: 'Visit', summary: b.text.slice(0, 1200) });
    parseInventoryVaccines(b.text, b.date).forEach((v) => vax.push(normalizeVax(v)));
    parseLabTables(b.text).forEach((l) => labs.push(normalizeLab({ ...l, collected_on: l.collected_on || b.date })));
    if (documentId && i % 8 === 0) {
      updateDoc(env, documentId, {
        ai_status: 'processing',
        ai_summary: {
          schemaVersion: 2,
          progress: { page_count: pageCount, char_count: charCount, visits_total: blocks.length, visits_parsed: i + 1, stage: 'visits' },
        },
      }).catch(() => {});
    }
  });
  for (const r of reminderVax) {
    const hit = vax.find((v) => v.name && r.name && v.name.toLowerCase().includes(r.name.split(' ')[0].toLowerCase()) && v.given && !v.next_due);
    if (hit) hit.next_due = r.next_due;
  }
  const batches = batchBlocks(blocks, 16000).slice(0, 3);
  for (let bi = 0; bi < batches.length; bi++) {
    const chunk = batches[bi].map((b) => `--- Service on ${b.date} ---\n${b.text.slice(0, 6000)}`).join('\n\n');
    try {
      const { resp, text: raw } = await callClaude(key, MODELS[0], [{ type: 'text', text: `${VISIT_PROMPT}\n\n${chunk}` }]);
      if (!resp.ok) continue;
      const parsed = parseClaudeJson(raw);
      (parsed.visits || []).forEach((v) => {
        const existing = visits.find((x) => x.date === v.date);
        if (existing && v.summary) existing.summary = v.summary;
        else if (v.date) visits.push(v);
      });
      (parsed.vaccinations || []).forEach((v) => vax.push(normalizeVax(v)));
      (parsed.labs || []).forEach((l) => labs.push(normalizeLab(l)));
      (parsed.conditions || []).forEach((c) => conditions.push(c));
    } catch (e) {
      console.log('[parse-pet-document] visit batch skip', bi, String(e));
    }
    if (documentId) {
      await updateDoc(env, documentId, {
        ai_status: 'processing',
        ai_summary: {
          schemaVersion: 2,
          progress: {
            page_count: pageCount, char_count: charCount,
            visits_total: blocks.length,
            visits_parsed: Math.min(blocks.length, (bi + 1) * Math.ceil(blocks.length / Math.max(batches.length, 1))),
            stage: 'visits',
          },
        },
      });
    }
  }
  const dedupeVax = [];
  const seenV = new Set();
  for (const v of vax) {
    const k = `${(v.name || '').toLowerCase()}|${v.given || v.next_due || ''}`;
    if (!v.name || seenV.has(k)) continue;
    seenV.add(k);
    dedupeVax.push(v);
  }
  const dedupeLabs = [];
  const seenL = new Set();
  for (const l of labs) {
    const k = `${(l.analyte || '').toLowerCase()}|${l.value}|${l.collected_on || ''}`;
    if (!l.analyte || seenL.has(k)) continue;
    seenL.add(k);
    dedupeLabs.push(l);
  }
  const latestW = weights.slice().sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on)))[0] || null;
  const out = {
    parsed: true,
    source: 'ai_extracted',
    schemaVersion: 2,
    kind: 'clinic_export',
    title: 'Clinic export',
    clinic: null,
    date: visits[0]?.date || null,
    vaccinations: dedupeVax,
    conditions,
    medications: [],
    visits,
    labs: dedupeLabs,
    weights,
    weight: latestW,
    identity: header,
    page_count: pageCount,
    char_count: charCount,
    progress: { page_count: pageCount, char_count: charCount, visits_total: blocks.length, visits_parsed: blocks.length, stage: 'done' },
    ai_note: `${blocks.length} visits · ${weights.length} weights · ${dedupeVax.length} vaccines · ${dedupeLabs.length} labs`,
    owner_notes: [],
  };
  console.log('[parse-pet-document] clinic done', out.ai_note, 'vaccinations[0]', dedupeVax[0]);
  if (documentId) {
    await updateDoc(env, documentId, {
      ai_status: 'ready',
      ai_summary: out,
      title: out.title,
      taken_on: out.date || undefined,
    });
  }
  return Response.json(out, { headers });
}

async function updateDoc(env, documentId, patch) {
  const { url, key } = getSupabase(env);
  if (!url || !key || !documentId) return;
  const resp = await fetch(`${url}/rest/v1/pet_documents?id=eq.${documentId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(patch),
  });
  console.log('[parse-pet-document] patch', documentId, resp.status, Object.keys(patch).join(','));
}

export async function onRequestPost(context) {
  const env = context.env || {};
  try {
    const body = await context.request.json();
    const documentId = body.document_id || body.documentId || null;
    const key = getKey(env);
    const sb = getSupabase(env);
    const extractedText = body.extractedText || body.text || '';
    const pageCountIn = Number(body.pageCount) || 0;
    console.log('[parse-pet-document] start', {
      documentId,
      hasAnthropic: Boolean(key),
      hasSupabase: Boolean(sb.url && sb.key),
      hasImage: Boolean(body.imageBase64),
      hasImages: Array.isArray(body.images) && body.images.length,
      textChars: extractedText.length,
      pageCount: pageCountIn,
      mime: body.mimeType || null,
    });
    if (!key) {
      console.log('[parse-pet-document] FAIL missing ANTHROPIC_API_KEY');
      if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'model_error', error: 'AI key missing' } });
      return fail('model_error', { error: 'AI key missing' });
    }

    if (extractedText && (extractedText.length > 2500 || /Service on\s+\d/i.test(extractedText))) {
      return parseClinicExport(env, key, documentId, extractedText, pageCountIn || splitServiceBlocks(extractedText).length);
    }

    let imgs = Array.isArray(body.images) ? body.images : (body.imageBase64 ? [body.imageBase64] : []);
    let isPdf = String(body.mimeType || '').includes('pdf') || String(body.path || '').toLowerCase().endsWith('.pdf');
    if (imgs.length === 0 && documentId && body.path) {
      const fetched = await fetchDocBytes(env, body.path);
      if (fetched) {
        imgs = [fetched.b64];
        isPdf = fetched.isPdf;
        console.log('[parse-pet-document] fetched storage', fetched.byteLength, 'pdf=', isPdf);
        if (fetched.isPdf && fetched.bytes) {
          const naive = extractPdfTextNaive(fetched.bytes);
          console.log('[parse-pet-document] naive pdf text', naive.charCount, 'pages', naive.pageCount);
          if (naive.charCount > 2500 || /Service on\s+\d/i.test(naive.text)) {
            return parseClinicExport(env, key, documentId, naive.text, naive.pageCount || pageCountIn);
          }
        }
      }
    }
    if (imgs.length === 0 && documentId) {
      // try storage_path / file_path from row
      const { url, key: sk } = sb;
      if (url && sk) {
        const row = await fetch(`${url}/rest/v1/pet_documents?id=eq.${documentId}&select=file_path,storage_path`, {
          headers: { apikey: sk, Authorization: `Bearer ${sk}` },
        });
        const rows = await row.json();
        const path = rows?.[0]?.file_path || rows?.[0]?.storage_path;
        console.log('[parse-pet-document] row path', path);
        const fetched = await fetchDocBytes(env, path);
        if (fetched) {
          imgs = [fetched.b64];
          isPdf = fetched.isPdf;
        }
      }
    }
    if (imgs.length === 0) {
      console.log('[parse-pet-document] FAIL no_file', { documentId, path: body.path || null });
      if (documentId) await updateDoc(env, documentId, { ai_status: 'missing_file', ai_summary: { reason: 'no_file' } });
      return fail('no_file');
    }

    const mime = String(body.mimeType || '');
    const looksPdf = isPdf || mime.includes('pdf');
    const looksImg = mime.startsWith('image/') || !mime;
    if (mime && !looksPdf && !looksImg) {
      if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'unsupported_type' } });
      return fail('unsupported_type', { error: mime });
    }

    const content = [];
    for (const s0 of imgs) {
      const s = String(s0);
      if (decodedBytes(s) > (looksPdf ? 32_000_000 : 9_500_000)) {
        if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'too_large' } });
        return fail('too_large', { status: 413 });
      }
      const raw = s.replace(/^data:[^;]+;base64,/, '');
      if (isPdf || s.includes('application/pdf')) {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: raw } });
      } else {
        let mediaType = 'image/jpeg';
        if (s.includes('image/png') || raw.startsWith('iVBORw0')) mediaType = 'image/png';
        content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: raw } });
      }
    }
    let prompt = PROMPT;
    if (documentId && sb.url && sb.key) {
      try {
        const docRow = await fetch(`${sb.url}/rest/v1/pet_documents?id=eq.${documentId}&select=pet_id`, {
          headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
        }).then((r) => r.json());
        const petId = docRow?.[0]?.pet_id;
        if (petId) {
          const labs = await fetch(`${sb.url}/rest/v1/lab_results?pet_id=eq.${petId}&select=name,analyte,value,unit,flag,collected_on,created_at&order=created_at.desc&limit=40`, {
            headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
          }).then((r) => r.json());
          if (Array.isArray(labs) && labs.length) {
            prompt += `\nPrior lab values for this pet (use for deltas in ai_note):\n${JSON.stringify(labs).slice(0, 6000)}`;
          }
        }
      } catch (e) {
        console.log('[parse-pet-document] prior labs skip', String(e));
      }
    }
    content.push({ type: 'text', text: prompt });

    let lastErr = 'Claude did not respond.';
    for (const model of MODELS) {
      console.log('[parse-pet-document] trying', model);
      let { resp, json, text } = await callClaude(key, model, content);
      if (!resp.ok) {
        lastErr = json?.error?.message || 'model error';
        console.log('[parse-pet-document] model fail', model, resp.status, lastErr);
        continue;
      }
      let parsed;
      try {
        parsed = parseClaudeJson(text);
      } catch (e) {
        console.log('[parse-pet-document] JSON fail', model, String(e), 'raw=', String(text).slice(0, 1500));
        const retry = await callClaude(
          key,
          model,
          content,
          `Your previous reply was not valid JSON (${e.message}). Return a single JSON object only, no markdown.`,
        );
        if (!retry.resp.ok) {
          lastErr = retry.json?.error?.message || 'model error';
          continue;
        }
        text = retry.text;
        try {
          parsed = parseClaudeJson(text);
        } catch (e2) {
          lastErr = e2.message || 'JSON parse failed';
          console.log('[parse-pet-document] JSON fail retry', model, String(e2), 'raw=', String(text).slice(0, 1500));
          continue;
        }
      }
      const vaccinations = (Array.isArray(parsed.vaccinations) ? parsed.vaccinations : []).map(normalizeVax);
      const conditions = Array.isArray(parsed.conditions) ? parsed.conditions : [];
      const medications = Array.isArray(parsed.medications) ? parsed.medications : [];
      const visits = Array.isArray(parsed.visits) ? parsed.visits : [];
      const labs = (Array.isArray(parsed.labs) ? parsed.labs : []).map(normalizeLab);
      const weight = parsed.weight && typeof parsed.weight === 'object' ? parsed.weight : null;
      const out = {
        parsed: true,
        source: 'ai_extracted',
        schemaVersion: 2,
        title: parsed.title || null,
        kind: parsed.kind || null,
        clinic: parsed.clinic || null,
        date: parsed.date || null,
        vaccinations,
        conditions,
        medications,
        visits,
        labs,
        weight,
        ai_note: parsed.ai_note || null,
        owner_notes: Array.isArray(parsed.owner_notes) ? parsed.owner_notes.filter((n) => n && n.text) : [],
      };
      console.log('[parse-pet-document] vaccinations[0]', vaccinations[0]);
      if (documentId) {
        await updateDoc(env, documentId, {
          ai_status: 'ready',
          ai_summary: out,
          title: parsed.title || undefined,
          clinic: parsed.clinic || undefined,
          taken_on: parsed.date || undefined,
        });
      }
      return Response.json(out, { headers });
    }
    console.log('[parse-pet-document] FAIL model_error', lastErr);
    if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'model_error', error: lastErr } });
    return fail('model_error', { error: lastErr });
  } catch (err) {
    console.log('[parse-pet-document] exception', String(err));
    return fail('model_error', { error: String(err) });
  }
}
