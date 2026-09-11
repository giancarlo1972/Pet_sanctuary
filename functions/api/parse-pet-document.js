import {
  splitServiceBlocks,
  parseWeightHistory,
  parseReminders,
  parseInventoryVaccines,
  parseLabTables,
  parsePatientHeader,
  parseConditions,
  batchBlocks,
  parseExam,
  parseFlowsheet,
  parseMedsTable,
  harvestKnownFacts,
  reconcileVaxDates,
  inheritVisitDate,
  itemsTrulyUndated,
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

const ALL_CONTENT_KINDS = ['vaccinations', 'labs', 'exam_visit', 'weight', 'medications', 'imaging', 'insurance', 'other'];

function normalizeKinds(raw) {
  const arr = (Array.isArray(raw) ? raw : String(raw || '').split(',')).map((k) => String(k).trim()).filter(Boolean);
  return arr.filter((k) => ALL_CONTENT_KINDS.includes(k));
}

function requestedKinds(raw) {
  const filtered = normalizeKinds(raw);
  if (!filtered.length || filtered.length >= ALL_CONTENT_KINDS.length) return [];
  return filtered;
}

function detectedContentKinds(out) {
  const k = [];
  if (Array.isArray(out.vaccinations) && out.vaccinations.length) k.push('vaccinations');
  if (Array.isArray(out.labs) && out.labs.length) k.push('labs');
  if (
    (Array.isArray(out.visits) && out.visits.length)
    || (Array.isArray(out.exams) && out.exams.length)
    || (Array.isArray(out.conditions) && out.conditions.length)
  ) k.push('exam_visit');
  if ((out.weight && out.weight.value != null) || (Array.isArray(out.weights) && out.weights.length)) k.push('weight');
  if (Array.isArray(out.medications) && out.medications.length) k.push('medications');
  if (Array.isArray(out.diagnostics) && out.diagnostics.length) k.push('imaging');
  if (out.insurance && (out.insurance.provider || out.insurance.policy_number || out.insurance.plan)) k.push('insurance');
  return k;
}

function applyKinds(out, kinds) {
  const requested = requestedKinds(kinds);
  const detected = detectedContentKinds(out);
  const use = requested.length ? requested : (detected.length ? detected : ['other']);
  if (requested.length) {
    const k = new Set(requested);
    if (!k.has('vaccinations')) out.vaccinations = [];
    if (!k.has('labs')) out.labs = [];
    if (!k.has('exam_visit')) {
      out.visits = [];
      out.exams = [];
      out.conditions = [];
      out.owner_notes = [];
    }
    if (!k.has('weight')) {
      out.weight = null;
      out.weights = [];
      out.vitals_series = [];
    }
    if (!k.has('medications')) out.medications = [];
    if (!k.has('imaging')) out.diagnostics = [];
  }
  if (!Array.isArray(out.undated)) out.undated = [];
  if (!Array.isArray(out.mentioned_but_missing)) out.mentioned_but_missing = [];
  out.content_kinds = use;
  return out;
}

const SCHEMA_PARTS = {
  vaccinations: `"vaccinations": [{"name": "", "product": null, "manufacturer": null, "lot": null, "dose": null, "given": "YYYY-MM-DD or null", "next_due": "YYYY-MM-DD or null", "status": "given|current|overdue|null", "notes": null, "vet": null, "clinic": null, "reactions": null}]`,
  labs: `"labs": [{"analyte": "", "value": "", "unit": null, "flag": "normal|high|low|abnormal|unknown", "collected_on": null, "ref_low": null, "ref_high": null, "group": "hematology|chemistry|endocrinology|urinalysis"}]`,
  exam_visit: `"visits": [{"clinic": null, "date": "YYYY-MM-DD or null", "reason": null, "findings": null, "plan": null, "summary": null}],
  "exams": [{"visit_date": "YYYY-MM-DD", "clinic": null, "vitals": {"temp_f": null, "hr": null, "rr": null, "bcs": null, "pain": null, "hydration": null}, "systems": [{"name": "Cardiovascular", "status": "normal|abnormal", "note": null}]}],
  "conditions": [{"name": "", "kind": "condition|allergy", "status": "active|resolved|monitoring", "onset_date": "YYYY-MM-DD or null", "resolved_date": "YYYY-MM-DD or null", "notes": null}],
  "owner_notes": [{"text": "behavioral or lifestyle guidance for the owner", "date": "YYYY-MM-DD or null"}],
  "lifestyle": {"diet": null, "food_brand": null, "food_product": null, "food_type": "dry|wet|canned|null", "parasite_prevention": null},
  "identity": {"date_of_birth": "YYYY-MM-DD or estimated from age", "age_years": null, "microchip": null, "sex": null}`,
  weight: `"weight": {"value": null, "unit": "lb|kg", "measured_on": null},
  "vitals_series": [{"at": "YYYY-MM-DDTHH:MM or YYYY-MM-DD", "temp_f": null, "hr": null, "rr": null, "weight_lb": null, "bcs": null}]`,
  medications: `"medications": [{"name": "", "dose": null, "route": null, "given_on": null, "status": "active|completed"}]`,
  imaging: `"diagnostics": [{"kind": "imaging|pcr|other", "name": "", "result": null, "date": null}]`,
  insurance: `"kind": "insurance"`,
  other: `"kind": "other"`,
};

const RULE_PARTS = {
  vaccinations: '- vaccinations: EVERY vaccine mentioned, including current/overdue with no given-date. A vaccine without a given-date is still a vaccine. "Rabies current through September 2026" → status=current, next_due=2026-09-30, administered_on=null. "second FVRCP booster missed" → status=overdue + note.',
  labs: '- labs: EVERY numeric or qualitative result, including prose ("creatinine 1.5, BUN 19", "T4 1.7 µg/dL", "1+ protein", "FeLV/FIV negative"). collected_on defaults to the visit/document date — never undated because the number and date were in different sentences.',
  exam_visit: '- The document itself is a visit. Always emit visits[] with clinic + date from the header, reason, findings, plan.\n- exams: one per physical exam. systems MUST cover 12: Oral-Nasal-Throat, Ears, Eyes, Cardiovascular, Respiratory, Abdominal, Genitourinary, Musculoskeletal, Integument, Lymphatics, Neurological, Rectal.\n- conditions: one row per distinct issue.\n- owner_notes: behavioral/lifestyle guidance.\n- lifestyle: diet brand/product/type (Purina Pro Plan dry) and parasite prevention — these become the Food card.\n- identity: Age 1.2 y → date_of_birth estimated from the visit date when DOB is not printed.',
  weight: '- weight: return the printed {value, unit} as-is (do not convert).\n- vitals_series: EVERY timestamped vital from flowsheets plus exam vitals.',
  medications: '- medications: every drug administered or prescribed (name, dose, route PO/SC/IV, date, active vs completed).',
  imaging: '- diagnostics: imaging (x-ray, ultrasound) and PCR/Idexx panels with the printed result text.',
  insurance: '- insurance: extract policy/carrier name into title and clinic; date = policy or letter date.',
  other: '- other: capture leftover labeled facts in ai_note only.',
};

function buildPrompt(kinds) {
  const k = normalizeKinds(kinds);
  const fields = [
    `"title": "short document title"`,
    `"clinic": "string or null"`,
    `"date": "YYYY-MM-DD or null"`,
    `"ai_note": "3-5 short lines: key findings, deltas vs prior values, flags. Plain text, no markdown."`,
    ...k.map((key) => SCHEMA_PARTS[key]).filter(Boolean),
  ];
  const rules = [
    `Only extract these sections: ${k.join(', ')}. Omit every other clinical array (return [] / null).`,
    '- ai_note: 3–5 lines covering findings and flags. Do not diagnose.',
    '- Inherit the visit/document date onto every lab, weight, and visit item. undated[] ONLY for facts with truly no inferable date.',
    ...k.map((key) => RULE_PARTS[key]).filter(Boolean),
  ];
  return `Extract structured veterinary data from this document.
Return JSON only, no markdown:
{
  ${fields.join(',\n  ')}
}
Rules:
${rules.join('\n')}`;
}

const MODELS = ['claude-haiku-4-5', 'claude-3-5-haiku-latest', 'claude-3-5-sonnet-20241022'];
const SYSTEM = 'Respond with a single JSON object only, no markdown, no commentary';

const NULLABLE_STR = { type: ['string', 'null'] };
const NULLABLE_NUM = { type: ['number', 'string', 'null'] };

const EXTRACTION_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    title: { type: 'string' },
    clinic: NULLABLE_STR,
    date: NULLABLE_STR,
    ai_note: { type: 'string', description: '3–5 lines. Must state improvement/regression per analyte when a prior value exists.' },
    vaccinations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          product: NULLABLE_STR,
          name: NULLABLE_STR,
          brand: NULLABLE_STR,
          lot: NULLABLE_STR,
          administered_on: NULLABLE_STR,
          next_due: NULLABLE_STR,
          status: NULLABLE_STR,
          notes: NULLABLE_STR,
          site: NULLABLE_STR,
          manufacturer: NULLABLE_STR,
          dose: NULLABLE_STR,
          vet: NULLABLE_STR,
          clinic: NULLABLE_STR,
        },
      },
    },
    labs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          analyte: { type: 'string' },
          value: NULLABLE_NUM,
          unit: NULLABLE_STR,
          ref_low: NULLABLE_NUM,
          ref_high: NULLABLE_NUM,
          flag: NULLABLE_STR,
          collected_on: NULLABLE_STR,
          prior_value: NULLABLE_NUM,
          prior_date: NULLABLE_STR,
          group: NULLABLE_STR,
        },
        required: ['analyte'],
      },
    },
    weights: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          lb: NULLABLE_NUM,
          value: NULLABLE_NUM,
          unit: NULLABLE_STR,
          measured_on: NULLABLE_STR,
          bcs: NULLABLE_NUM,
        },
      },
    },
    visits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          date: NULLABLE_STR,
          clinic: NULLABLE_STR,
          vet: NULLABLE_STR,
          reason: NULLABLE_STR,
          findings: NULLABLE_STR,
          plan: NULLABLE_STR,
          summary: NULLABLE_STR,
        },
      },
    },
    undated: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          kind: { type: 'string' },
          summary: { type: 'string' },
          raw: NULLABLE_STR,
        },
        required: ['kind', 'summary'],
      },
    },
    exams: { type: 'array', items: { type: 'object', additionalProperties: true } },
    conditions: { type: 'array', items: { type: 'object', additionalProperties: true } },
    medications: { type: 'array', items: { type: 'object', additionalProperties: true } },
    diagnostics: { type: 'array', items: { type: 'object', additionalProperties: true } },
    vitals_series: { type: 'array', items: { type: 'object', additionalProperties: true } },
    owner_notes: { type: 'array', items: { type: 'object', additionalProperties: true } },
    identity: { type: 'object', additionalProperties: true },
    lifestyle: { type: 'object', additionalProperties: true },
    kind: NULLABLE_STR,
  },
  required: ['ai_note', 'vaccinations', 'labs', 'weights', 'visits', 'undated'],
};

const GAP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    mentioned_but_missing: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          kind: { type: 'string' },
          mention: { type: 'string' },
        },
        required: ['kind', 'mention'],
      },
    },
  },
  required: ['mentioned_but_missing'],
};

const RECORD_TOOL = {
  name: 'record_extraction',
  description: 'Store every vaccine, lab, weight, visit, and lifestyle fact printed in the document. A vaccine without a given-date is still a vaccine. Labs in prose count. The report itself is a visit. Inherit the visit date onto undated items in that visit. undated[] only when no date can be inferred.',
  input_schema: EXTRACTION_SCHEMA,
};

const GAP_TOOL = {
  name: 'list_gaps',
  description: 'List every number, date, vaccine, lab result, or weight mentioned in the summary that is missing from the extracted JSON arrays.',
  input_schema: GAP_SCHEMA,
};

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
  else if (printed === 'not detected' || printed === 'not-detected' || printed === 'undetected' || printed === 'negative') { flag = flag || 'normal'; }
  else if (printed === 'positive') { flag = flag || 'abnormal'; }
  return {
    analyte: l?.analyte || l?.name || '',
    value,
    unit,
    flag,
    ref_low: l?.ref_low ?? null,
    ref_high: l?.ref_high ?? null,
    collected_on: l?.collected_on || l?.date || l?.taken_on || null,
    prior_value: l?.prior_value ?? null,
    prior_date: l?.prior_date || null,
    group: l?.group || null,
  };
}

function expandLabPriors(labs) {
  const out = [];
  for (const l of labs) {
    out.push(l);
    if (l.prior_value != null && String(l.prior_value).trim() !== '' && l.prior_date) {
      out.push({
        ...l,
        value: l.prior_value,
        collected_on: l.prior_date,
        prior_value: null,
        prior_date: null,
        is_prior: true,
      });
    }
  }
  return out;
}

function trendLines(labs) {
  const lines = [];
  for (const l of labs) {
    if (l.prior_value == null || l.value == null || l.is_prior) continue;
    const a = parseFloat(l.value);
    const b = parseFloat(l.prior_value);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) {
      if (String(l.value).toLowerCase() !== String(l.prior_value).toLowerCase()) {
        lines.push(`${l.analyte}: ${l.value} vs prior ${l.prior_value} (${l.prior_date || 'earlier'})`);
      }
      continue;
    }
    const dir = a < b ? 'decreased' : 'increased';
    const better = (l.flag === 'high' && a < b) || (l.flag === 'low' && a > b);
    const worse = (l.flag === 'high' && a > b) || (l.flag === 'low' && a < b);
    const word = better ? 'improved' : worse ? 'regressed' : dir;
    lines.push(`${l.analyte}: ${a} vs prior ${b} on ${l.prior_date || 'earlier'} — ${word}`);
  }
  return lines;
}

function normalizeVax(v) {
  const status = String(v?.status || '').toLowerCase() || null;
  const given = v?.administered_on || v?.given || v?.given_on || v?.date_given || null;
  const due = v?.next_due || v?.next_due_on || v?.valid_until || v?.expires_on || null;
  let date = given || null;
  let next_due = due || null;
  if (date && next_due && String(date) > String(next_due) && status !== 'current' && status !== 'overdue') {
    const t = date; date = next_due; next_due = t;
  }
  if (!date && !next_due && v?.date && status !== 'current' && status !== 'overdue') date = v.date;
  const product = v?.product || v?.name || v?.vaccine || '';
  return {
    brand: v?.brand || v?.product || null,
    name: v?.name || v?.vaccine || v?.product || '',
    product: product || null,
    manufacturer: v?.manufacturer || v?.maker || v?.company || v?.mfr || v?.brand || null,
    lot: v?.lot || v?.lot_number || v?.lotNumber || v?.lot_no || v?.serial || null,
    dose: v?.dose || null,
    given: date,
    administered_on: date,
    date,
    next_due,
    valid_until: next_due,
    site: v?.site || v?.injection_site || v?.route_site || null,
    reactions: v?.reactions || null,
    clinic: v?.clinic || v?.clinic_name || null,
    vet: v?.vet || v?.vet_name || v?.veterinarian || v?.doctor || v?.provider || null,
    status: status || (date ? 'given' : (next_due ? 'current' : null)),
    notes: v?.notes || v?.note || null,
  };
}

function normalizeWeight(w) {
  if (!w || typeof w !== 'object') return null;
  const unitRaw = String(w.unit || 'lb').toLowerCase();
  let lb = w.lb != null ? Number(w.lb) : Number(w.weight_lb ?? w.value);
  if (!Number.isFinite(lb) && w.value != null) lb = Number(w.value);
  if (Number.isFinite(lb) && unitRaw.startsWith('kg')) lb = Math.round(lb * 2.20462 * 100) / 100;
  if (!Number.isFinite(lb)) return null;
  return {
    value: lb,
    lb,
    unit: 'lb',
    measured_on: w.measured_on || w.date || null,
    bcs: w.bcs ?? null,
  };
}

function normalizeVisit(v) {
  if (!v || typeof v !== 'object') return null;
  return {
    date: v.date || v.visit_date || v.occurred_on || null,
    clinic: v.clinic || v.clinic_name || null,
    vet: v.vet || v.vet_name || v.veterinarian || null,
    reason: v.reason || v.title || null,
    findings: v.findings || null,
    plan: v.plan || null,
    summary: v.summary || v.findings || v.plan || null,
  };
}

function collectUndated(parsed) {
  return itemsTrulyUndated(parsed);
}

function mergeParsedArrays(base, extra) {
  const out = { ...base };
  const keys = ['vaccinations', 'labs', 'weights', 'visits', 'undated', 'exams', 'conditions', 'medications', 'diagnostics', 'vitals_series', 'owner_notes'];
  for (const k of keys) {
    const a = Array.isArray(out[k]) ? out[k] : [];
    const b = Array.isArray(extra?.[k]) ? extra[k] : [];
    out[k] = [...a, ...b];
  }
  if (!out.ai_note && extra?.ai_note) out.ai_note = extra.ai_note;
  else if (extra?.ai_note && out.ai_note && !String(out.ai_note).includes(String(extra.ai_note).slice(0, 40))) {
    out.ai_note = `${out.ai_note}\n${extra.ai_note}`;
  }
  if (!out.lifestyle && extra?.lifestyle) out.lifestyle = extra.lifestyle;
  if (!out.identity && extra?.identity) out.identity = extra.identity;
  if (!out.date && extra?.date) out.date = extra.date;
  if (!out.clinic && extra?.clinic) out.clinic = extra.clinic;
  return out;
}

function logExtraction(meta) {
  const line = {
    pages: meta.pages || 0,
    chars: meta.chars || 0,
    mode: meta.mode || 'text',
    extracted: {
      vax: (meta.vaccinations || []).length,
      labs: (meta.labs || []).length,
      weights: (meta.weights || []).length,
      visits: (meta.visits || []).length,
    },
    mentioned_but_missing: meta.mentioned_but_missing || [],
  };
  console.log('[parse-pet-document]', line);
  return line;
}

async function callClaude(key, model, userContent, extraText, opts = {}) {
  const content = extraText
    ? [...userContent, { type: 'text', text: extraText }]
    : userContent;
  const body = {
    model,
    max_tokens: opts.max_tokens || 8000,
    messages: [{ role: 'user', content }],
  };
  if (opts.tools) {
    body.tools = opts.tools;
    body.tool_choice = opts.tool_choice || { type: 'tool', name: opts.tools[0].name };
  } else {
    body.system = SYSTEM;
  }
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await resp.json();
  const blocks = json.content || [];
  const toolBlock = blocks.find((b) => b.type === 'tool_use');
  const text = blocks.find((b) => b.type === 'text')?.text || '';
  return { resp, json, text, toolInput: toolBlock?.input || null };
}

function parseModelResult(text, toolInput) {
  if (toolInput && typeof toolInput === 'object') return toolInput;
  return parseClaudeJson(text);
}

async function extractStructured(key, model, userContent, extraText) {
  const { resp, json, text, toolInput } = await callClaude(key, model, userContent, extraText, {
    tools: [RECORD_TOOL],
    tool_choice: { type: 'tool', name: 'record_extraction' },
    max_tokens: 8000,
  });
  if (!resp.ok) return { ok: false, error: json?.error?.message || 'model error', parsed: null };
  try {
    return { ok: true, parsed: parseModelResult(text, toolInput), error: null };
  } catch (e) {
    return { ok: false, error: e.message || 'JSON parse failed', parsed: null, raw: String(text).slice(0, 1500) };
  }
}

async function listGaps(key, model, summary, extracted) {
  const prompt = `Here is the summary / document excerpt:\n${String(summary || '').slice(0, 8000)}\n\nHere is the extracted JSON:\n${JSON.stringify(extracted).slice(0, 12000)}\n\nList every number, date, vaccine, lab result, or weight mentioned in the summary that is missing from the JSON arrays.`;
  const { resp, json, text, toolInput } = await callClaude(
    key,
    model,
    [{ type: 'text', text: prompt }],
    null,
    { tools: [GAP_TOOL], tool_choice: { type: 'tool', name: 'list_gaps' }, max_tokens: 2000 },
  );
  if (!resp.ok) {
    console.log('[parse-pet-document] gap check skip', json?.error?.message);
    return [];
  }
  try {
    const parsed = parseModelResult(text, toolInput);
    return Array.isArray(parsed.mentioned_but_missing) ? parsed.mentioned_but_missing : [];
  } catch {
    return [];
  }
}

function shapeParsed(parsed) {
  const vaccinations = (Array.isArray(parsed.vaccinations) ? parsed.vaccinations : []).map(normalizeVax).filter((v) => v.name || v.product);
  const labs = expandLabPriors((Array.isArray(parsed.labs) ? parsed.labs : []).map(normalizeLab).filter((l) => l.analyte));
  const weights = (Array.isArray(parsed.weights) ? parsed.weights : [])
    .concat(parsed.weight ? [parsed.weight] : [])
    .map(normalizeWeight)
    .filter(Boolean);
  const visits = (Array.isArray(parsed.visits) ? parsed.visits : []).map(normalizeVisit).filter(Boolean);
  const shaped = {
    ...parsed,
    date: parsed.date || visits.find((v) => v.date)?.date || null,
    clinic: parsed.clinic || visits.find((v) => v.clinic)?.clinic || null,
    vaccinations,
    labs,
    weights,
    visits,
    exams: Array.isArray(parsed.exams) ? parsed.exams : [],
    conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    diagnostics: Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [],
    vitals_series: Array.isArray(parsed.vitals_series) ? parsed.vitals_series : [],
    owner_notes: Array.isArray(parsed.owner_notes) ? parsed.owner_notes.filter((n) => n && n.text) : [],
    lifestyle: parsed.lifestyle || null,
    identity: parsed.identity || null,
  };
  inheritVisitDate(shaped, shaped.date);
  shaped.undated = collectUndated(shaped);
  const trends = trendLines(labs);
  if (trends.length) {
    const note = String(shaped.ai_note || '');
    const missing = trends.filter((t) => !note.toLowerCase().includes(t.split(':')[0].toLowerCase()));
    if (missing.length) shaped.ai_note = [note, ...missing].filter(Boolean).join('\n');
  }
  return shaped;
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

async function parseClinicExport(env, key, documentId, text, pageCount, kinds) {
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
  const exams = [];
  const harvested = harvestKnownFacts(text);
  harvested.vaccinations.forEach((v) => vax.push(normalizeVax(v)));
  harvested.labs.forEach((l) => labs.push(normalizeLab(l)));
  harvested.weights.forEach((w) => {
    const nw = normalizeWeight(w);
    if (nw && !weights.some((x) => x.measured_on === nw.measured_on && x.value === nw.value)) weights.push(nw);
  });
  harvested.visits.forEach((v) => {
    const nv = normalizeVisit(v);
    if (nv) visits.push(nv);
  });
  blocks.forEach((b, i) => {
    visits.push({ clinic: null, date: b.date, reason: 'Visit', summary: b.text.slice(0, 1200) });
    parseInventoryVaccines(b.text, b.date).forEach((v) => vax.push(normalizeVax(v)));
    parseLabTables(b.text).forEach((l) => labs.push(normalizeLab({ ...l, collected_on: l.collected_on || b.date })));
    const ex = parseExam(b.text, b.date, null);
    if (ex) exams.push(ex);
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
      const extracted = await extractStructured(key, MODELS[0], [{ type: 'text', text: `${VISIT_PROMPT}\n\n${chunk}` }]);
      if (!extracted.ok) continue;
      const parsed = shapeParsed(extracted.parsed);
      (parsed.visits || []).forEach((v) => {
        const existing = visits.find((x) => x.date === v.date);
        if (existing && v.summary) existing.summary = v.summary;
        else if (v.date || v.reason) visits.push(v);
      });
      (parsed.vaccinations || []).forEach((v) => vax.push(v));
      (parsed.labs || []).forEach((l) => labs.push(l));
      (parsed.conditions || []).forEach((c) => conditions.push(c));
      (parsed.exams || []).forEach((e) => exams.push(e));
      (parsed.weights || []).forEach((w) => {
        if (w && !weights.some((x) => x.measured_on === w.measured_on && x.value === w.value)) weights.push(w);
      });
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
    const k = `${(v.name || '').toLowerCase()}|${v.given || ''}|${v.next_due || ''}|${v.status || ''}`;
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
  const rec = reconcileVaxDates(text, dedupeVax);
  const reconciledVax = rec.vaccinations.map(normalizeVax);
  const latestW = weights.slice().sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on)))[0] || null;
  let shaped = shapeParsed({
    vaccinations: reconciledVax,
    labs: dedupeLabs,
    weights,
    visits,
    exams,
    conditions,
    medications: parseMedsTable(text),
    vitals_series: parseFlowsheet(text),
    lifestyle: harvested.lifestyle || null,
    identity: harvested.identity || header,
    date: harvested.date || visits[0]?.date || null,
    clinic: harvested.clinic || visits[0]?.clinic || null,
    ai_note: `${blocks.length} visits · ${weights.length} weights · ${dedupeVax.length} vaccines · ${dedupeLabs.length} labs`,
    undated: [],
  });
  const excerpt = text.slice(0, 8000);
  let mentioned_but_missing = await listGaps(key, MODELS[0], `${shaped.ai_note}\n${excerpt}`, {
    vaccinations: shaped.vaccinations,
    labs: shaped.labs,
    weights: shaped.weights,
    visits: shaped.visits,
  });
  if (mentioned_but_missing.length) {
    const retry = await extractStructured(
      key,
      MODELS[0],
      [{ type: 'text', text: excerpt }],
      `The first pass missed these facts. Extract them into record_extraction (typed arrays + undated). Missing:\n${JSON.stringify(mentioned_but_missing)}`,
    );
    if (retry.ok) shaped = shapeParsed(mergeParsedArrays(shaped, shapeParsed(retry.parsed)));
    mentioned_but_missing = await listGaps(key, MODELS[0], `${shaped.ai_note}\n${excerpt}`, {
      vaccinations: shaped.vaccinations,
      labs: shaped.labs,
      weights: shaped.weights,
      visits: shaped.visits,
    });
  }
  const aiStatus = mentioned_but_missing.length ? 'partial' : 'ready';
  const logLine = logExtraction({
    pages: pageCount,
    chars: charCount,
    mode: 'text',
    vaccinations: shaped.vaccinations,
    labs: shaped.labs,
    weights: shaped.weights,
    visits: shaped.visits,
    mentioned_but_missing,
  });
  const out = {
    parsed: true,
    source: 'ai_extracted',
    schemaVersion: 2,
    kind: 'clinic_export',
    title: 'Clinic export',
    clinic: shaped.visits[0]?.clinic || null,
    date: shaped.visits[0]?.date || visits[0]?.date || null,
    vaccinations: shaped.vaccinations,
    conditions: shaped.conditions,
    medications: shaped.medications,
    visits: shaped.visits,
    labs: shaped.labs,
    weights: shaped.weights,
    exams: shaped.exams,
    vitals_series: shaped.vitals_series,
    diagnostics: shaped.diagnostics,
    weight: latestW,
    identity: shaped.identity || harvested.identity || header,
    lifestyle: shaped.lifestyle || harvested.lifestyle || null,
    page_count: pageCount,
    char_count: charCount,
    progress: { page_count: pageCount, char_count: charCount, visits_total: blocks.length, visits_parsed: blocks.length, stage: 'done' },
    ai_note: shaped.ai_note,
    owner_notes: shaped.owner_notes,
    undated: shaped.undated,
    mentioned_but_missing,
    parse_log: logLine,
  };
  console.log('[parse-pet-document] clinic done', out.ai_note, 'vaccinations[0]', shaped.vaccinations[0]);
  applyKinds(out, kinds);
  if (documentId) {
    await updateDoc(env, documentId, {
      ai_status: aiStatus,
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
  const body = { ...patch };
  if (body.ai_summary && Array.isArray(body.ai_summary.content_kinds) && body.content_kinds == null) {
    body.content_kinds = body.ai_summary.content_kinds;
  }
  const resp = await fetch(`${url}/rest/v1/pet_documents?id=eq.${documentId}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  });
  console.log('[parse-pet-document] patch', documentId, resp.status, Object.keys(body).join(','));
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
    const forceScan = Boolean(body.forceScan);
    const incomingImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];
    let kinds = requestedKinds(body.kinds || body.content_kinds);
    if (documentId && sb.url && sb.key && !kinds.length) {
      try {
        const row = await fetch(`${sb.url}/rest/v1/pet_documents?id=eq.${documentId}&select=content_kinds`, {
          headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
        }).then((r) => r.json());
        if (row?.[0]?.content_kinds) kinds = requestedKinds(row[0].content_kinds);
      } catch (e) {
        console.log('[parse-pet-document] kinds row skip', String(e));
      }
    }
    const pagesGuess = pageCountIn || incomingImages.length || 0;
    const charsPer = extractedText.length / Math.max(pagesGuess || 1, 1);
    const sparseText = pagesGuess > 0 && charsPer < 200;
    let mode = body.mode === 'images' || forceScan || incomingImages.length || (sparseText && !/Service on\s+\d/i.test(extractedText))
      ? 'images'
      : 'text';
    if (incomingImages.length) mode = 'images';
    if (forceScan) mode = 'images';
    console.log('[parse-pet-document]', { pages: pagesGuess, chars: extractedText.length, mode });
    console.log('[parse-pet-document] start', {
      documentId,
      kinds,
      hasAnthropic: Boolean(key),
      hasSupabase: Boolean(sb.url && sb.key),
      hasImage: Boolean(body.imageBase64),
      hasImages: incomingImages.length,
      textChars: extractedText.length,
      pageCount: pageCountIn,
      mime: body.mimeType || null,
      mode,
    });
    if (!key) {
      console.log('[parse-pet-document] FAIL missing ANTHROPIC_API_KEY');
      if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'model_error', error: 'AI key missing' } });
      return fail('model_error', { error: 'AI key missing' });
    }

    if (mode === 'text' && extractedText && (extractedText.length > 2500 || /Service on\s+\d/i.test(extractedText))) {
      return parseClinicExport(env, key, documentId, extractedText, pageCountIn || splitServiceBlocks(extractedText).length, kinds);
    }

    let imgs = incomingImages.length ? incomingImages : (body.imageBase64 ? [body.imageBase64] : []);
    let isPdf = String(body.mimeType || '').includes('pdf') || String(body.path || '').toLowerCase().endsWith('.pdf');
    if (imgs.length === 0 && documentId && body.path) {
      const fetched = await fetchDocBytes(env, body.path);
      if (fetched) {
        isPdf = fetched.isPdf;
        console.log('[parse-pet-document] fetched storage', fetched.byteLength, 'pdf=', isPdf);
        if (fetched.isPdf && fetched.bytes && mode === 'text') {
          const naive = extractPdfTextNaive(fetched.bytes);
          console.log('[parse-pet-document] naive pdf text', naive.charCount, 'pages', naive.pageCount);
          const naivePer = naive.charCount / Math.max(naive.pageCount || pageCountIn || 1, 1);
          console.log('[parse-pet-document]', { pages: naive.pageCount || pageCountIn, chars: naive.charCount, mode: naivePer < 200 ? 'images' : 'text' });
          if (naive.charCount > 2500 || /Service on\s+\d/i.test(naive.text)) {
            return parseClinicExport(env, key, documentId, naive.text, naive.pageCount || pageCountIn, kinds);
          }
          if (naivePer >= 200) {
            imgs = [fetched.b64];
          } else {
            mode = 'images';
            imgs = [fetched.b64];
          }
        } else {
          imgs = [fetched.b64];
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
      if (decodedBytes(s) > (looksPdf && mode !== 'images' ? 32_000_000 : 9_500_000)) {
        if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'too_large' } });
        return fail('too_large', { status: 413 });
      }
      const raw = s.replace(/^data:[^;]+;base64,/, '');
      const isJpeg = s.includes('image/jpeg') || raw.startsWith('/9j/');
      const isPng = s.includes('image/png') || raw.startsWith('iVBORw0');
      if (isJpeg || isPng) {
        content.push({ type: 'image', source: { type: 'base64', media_type: isPng ? 'image/png' : 'image/jpeg', data: raw } });
      } else if (isPdf || s.includes('application/pdf') || looksPdf) {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: raw } });
      } else {
        content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: raw } });
      }
    }
    console.log('[parse-pet-document]', { pages: content.filter((c) => c.type === 'image' || c.type === 'document').length || pagesGuess, chars: extractedText.length, mode });
    let prompt = buildPrompt(kinds);
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
    content.push({ type: 'text', text: `${prompt}\nCall record_extraction. Labs in prose count. A vaccine without a given-date is still a vaccine. The report itself is a visit. Inherit the visit date. Lifestyle (diet, parasite prevention) and age→DOB go in lifestyle/identity.` });

    let lastErr = 'Claude did not respond.';
    for (const model of MODELS) {
      console.log('[parse-pet-document] trying', model);
      const extracted = await extractStructured(key, model, content);
      if (!extracted.ok) {
        lastErr = extracted.error || 'model error';
        console.log('[parse-pet-document] model fail', model, lastErr, extracted.raw || '');
        continue;
      }
      let shaped = shapeParsed(extracted.parsed);
      if (extractedText) {
        const harvested = harvestKnownFacts(extractedText);
        shaped = shapeParsed(mergeParsedArrays(shaped, {
          vaccinations: harvested.vaccinations.map(normalizeVax),
          labs: harvested.labs.map(normalizeLab),
          weights: harvested.weights.map(normalizeWeight).filter(Boolean),
          visits: harvested.visits.map(normalizeVisit).filter(Boolean),
          lifestyle: harvested.lifestyle,
          identity: harvested.identity,
          date: harvested.date,
          clinic: harvested.clinic,
          undated: [],
        }));
      }
      const summaryForGaps = `${shaped.ai_note || ''}\n${extractedText ? extractedText.slice(0, 6000) : ''}`;
      let mentioned_but_missing = await listGaps(key, model, summaryForGaps, {
        vaccinations: shaped.vaccinations,
        labs: shaped.labs,
        weights: shaped.weights,
        visits: shaped.visits,
      });
      if (mentioned_but_missing.length) {
        const retry = await extractStructured(
          key,
          model,
          content,
          `The first pass missed these facts. Extract them now into record_extraction. Missing:\n${JSON.stringify(mentioned_but_missing)}`,
        );
        if (retry.ok) shaped = shapeParsed(mergeParsedArrays(shaped, shapeParsed(retry.parsed)));
        mentioned_but_missing = await listGaps(key, model, summaryForGaps, {
          vaccinations: shaped.vaccinations,
          labs: shaped.labs,
          weights: shaped.weights,
          visits: shaped.visits,
        });
      }
      const latestW = shaped.weights.slice().sort((a, b) => String(b.measured_on || '').localeCompare(String(a.measured_on || '')))[0] || (shaped.weight || null);
      const logLine = logExtraction({
        pages: pageCountIn || incomingImages.length || content.filter((c) => c.type === 'image' || c.type === 'document').length,
        chars: extractedText.length,
        mode,
        vaccinations: shaped.vaccinations,
        labs: shaped.labs,
        weights: shaped.weights,
        visits: shaped.visits,
        mentioned_but_missing,
      });
      const aiStatus = mentioned_but_missing.length ? 'partial' : 'ready';
      const out = applyKinds({
        parsed: true,
        source: 'ai_extracted',
        schemaVersion: 2,
        title: shaped.title || extracted.parsed.title || null,
        kind: shaped.kind || extracted.parsed.kind || null,
        clinic: shaped.clinic || extracted.parsed.clinic || null,
        date: shaped.date || extracted.parsed.date || null,
        vaccinations: shaped.vaccinations,
        conditions: shaped.conditions,
        medications: shaped.medications,
        visits: shaped.visits,
        labs: shaped.labs,
        weights: shaped.weights,
        weight: latestW,
        exams: shaped.exams,
        diagnostics: shaped.diagnostics,
        vitals_series: shaped.vitals_series,
        ai_note: shaped.ai_note || null,
        owner_notes: shaped.owner_notes,
        identity: shaped.identity || extracted.parsed.identity || null,
        lifestyle: shaped.lifestyle || extracted.parsed.lifestyle || null,
        undated: shaped.undated,
        mentioned_but_missing,
        parse_log: logLine,
        page_count: pageCountIn || incomingImages.length || null,
        char_count: extractedText.length,
        parse_mode: mode,
      }, kinds);
      if (documentId) {
        await updateDoc(env, documentId, {
          ai_status: aiStatus,
          ai_summary: out,
          title: out.title || undefined,
          clinic: out.clinic || undefined,
          taken_on: out.date || undefined,
        });
      }
      return Response.json(out, { headers });
    }
    console.log('[parse-pet-document] FAIL model_error', lastErr);
    if (extractedText && extractedText.length > 80) {
      const harvested = harvestKnownFacts(extractedText);
      const shaped = shapeParsed({
        ai_note: `Structured model failed (${lastErr}). Harvested printed facts.`,
        vaccinations: harvested.vaccinations,
        labs: harvested.labs.concat(parseLabTables(extractedText)),
        weights: harvested.weights.concat(parseWeightHistory(extractedText)),
        visits: harvested.visits,
        lifestyle: harvested.lifestyle,
        identity: harvested.identity,
        date: harvested.date,
        clinic: harvested.clinic,
        undated: [],
      });
      const logLine = logExtraction({
        pages: pageCountIn,
        chars: extractedText.length,
        mode,
        vaccinations: shaped.vaccinations,
        labs: shaped.labs,
        weights: shaped.weights,
        visits: shaped.visits,
        mentioned_but_missing: [{ kind: 'model', mention: lastErr }],
      });
      const out = applyKinds({
        parsed: true,
        source: 'ai_extracted',
        schemaVersion: 2,
        title: 'Harvested from text',
        vaccinations: shaped.vaccinations,
        labs: shaped.labs,
        weights: shaped.weights,
        visits: shaped.visits,
        identity: shaped.identity,
        lifestyle: shaped.lifestyle,
        date: shaped.date,
        clinic: shaped.clinic,
        undated: shaped.undated,
        mentioned_but_missing: [{ kind: 'model', mention: lastErr }],
        parse_log: logLine,
        ai_note: shaped.ai_note,
        page_count: pageCountIn,
        char_count: extractedText.length,
        parse_mode: mode,
      }, kinds);
      if (documentId) await updateDoc(env, documentId, { ai_status: 'partial', ai_summary: out });
      return Response.json(out, { headers });
    }
    if (documentId) await updateDoc(env, documentId, { ai_status: 'failed', ai_summary: { reason: 'model_error', error: lastErr } });
    return fail('model_error', { error: lastErr });
  } catch (err) {
    console.log('[parse-pet-document] exception', String(err));
    return fail('model_error', { error: String(err) });
  }
}
