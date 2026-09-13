export function toIso(s) {
  if (!s) return null;
  const raw = String(s).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const named = raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (named) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const mo = months[named[1].slice(0, 3).toLowerCase()];
    if (mo) return `${named[3]}-${mo}-${String(named[2]).padStart(2, '0')}`;
  }
  const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  const y = m[3].length === 2 ? 2000 + parseInt(m[3], 10) : parseInt(m[3], 10);
  // US clinic records are M/D/YYYY. Only treat as D/M when the first part is > 12.
  let month = a;
  let day = b;
  if (a > 12 && b <= 12) { day = a; month = b; }
  if (month < 1 || month > 12 || day < 1 || day > 31 || !y) return null;
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function splitServiceBlocks(text) {
  const re = /Service on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
  const hits = [];
  let m;
  while ((m = re.exec(text))) hits.push({ date: toIso(m[1]), index: m.index, raw: m[1] });
  if (!hits.length) return [];
  return hits.map((h, i) => ({
    date: h.date,
    text: text.slice(h.index, i + 1 < hits.length ? hits[i + 1].index : text.length),
  }));
}

export function parseWeightHistory(text) {
  const idx = text.search(/weight\s+history/i);
  const slice = idx >= 0 ? text.slice(idx, idx + 4000) : text.slice(0, 8000);
  const out = [];
  const re = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d+(?:\.\d+)?)\s*(lb|kg|lbs)?/gi;
  let m;
  while ((m = re.exec(slice))) {
    const iso = toIso(m[1]);
    const n = parseFloat(m[2]);
    if (!iso || Number.isNaN(n) || n < 0.5 || n > 300) continue;
    const unit = (m[3] || 'lb').toLowerCase().startsWith('kg') ? 'kg' : 'lb';
    out.push({ value: n, unit, measured_on: iso });
  }
  const seen = new Set();
  return out.filter((w) => {
    const k = `${w.measured_on}:${w.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export const STATUS_CURRENT_UNKNOWN = 'current (given date unknown)';
const CLINIC_NAME_WORDS = /^(veterinary|vet|clinic|hospital|animal|care|center|er|emergency)$/i;
const VET_NAME_RE = /^(Dr\.?\s)?[A-Z][a-z]+(\s[A-Z][a-z'\-]+)+,?\s*(D\.?V\.?M\.?|VMD)?$/;

export function isValidVetName(s) {
  const name = String(s || '').replace(/\s+/g, ' ').trim();
  if (!name) return false;
  if (!VET_NAME_RE.test(name)) return false;
  const stripped = name.replace(/^Dr\.?\s/i, '').replace(/,?\s*(D\.?V\.?M\.?|VMD)$/i, '').trim();
  if (stripped.split(/\s+/).some((t) => CLINIC_NAME_WORDS.test(t))) return false;
  return true;
}

export function normalizeVetName(s) {
  if (s == null || s === '') return null;
  const name = String(s).replace(/\s+/g, ' ').trim();
  return isValidVetName(name) ? name : null;
}

export function parseReminders(text) {
  const idx = text.search(/\breminders?\b/i);
  const slice = idx >= 0 ? text.slice(idx, idx + 5000) : text;
  const vax = [];
  const re = /(FVRCP(?:\s*3[-\s]*Year)?|FeLV|Purevax\s+Rabies(?:\s+Feline(?:\s+3\s*year)?)?|Rabies|FVRCP)\b[^.\n]{0,80}?(\d{1,2}\/\d{1,2}\/\d{2,4})/gi;
  let m;
  while ((m = re.exec(slice))) {
    vax.push({
      name: m[1].replace(/\s+/g, ' ').trim(),
      product: m[1].replace(/\s+/g, ' ').trim(),
      given: null,
      administered_on: null,
      next_due: toIso(m[2]),
      status: STATUS_CURRENT_UNKNOWN,
      manufacturer: /purevax/i.test(m[1]) ? 'Boehringer Ingelheim (Purevax)' : null,
    });
  }
  return vax;
}

export function parseInventoryVaccines(blockText, serviceDate) {
  const vax = [];
  if (!/inventory item/i.test(blockText) || !/service on/i.test(blockText)) return vax;
  const re = /Inventory Item\s*[—\-:]?\s*(PUREVAX[^,\n]+|FVRCP[^,\n]+|FeLV[^,\n]+|Rabies[^,\n]+)/gi;
  let m;
  while ((m = re.exec(blockText))) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    const site = (blockText.match(/\bSC over [^.\n]+/i) || blockText.match(/\b(SQ|SC|IM|IN)\b[^.\n]{0,40}/i) || [])[0] || null;
    vax.push({
      name,
      product: name,
      manufacturer: /purevax/i.test(name) ? 'Boehringer Ingelheim (Purevax)' : null,
      given: serviceDate || null,
      administered_on: serviceDate || null,
      next_due: null,
      status: serviceDate ? 'given' : STATUS_CURRENT_UNKNOWN,
      site,
      clinic: null,
    });
  }
  return vax;
}

export function parseLabTables(text) {
  const labs = [];
  const labish = /IDEXX|TEST RESULT|REFERENCE VALUE|Reference Range/i.test(text);
  const re = /^[\t ]*([A-Za-z][A-Za-z0-9()/%+.\- ]{1,40}?)\s+(-?[\d.]+|Detected|Not detected|Negative|Positive)\s*(H|L|HIGH|LOW)?\s+([\d.]+)\s*[-–to]+\s*([\d.]+)/gim;
  let m;
  while ((m = re.exec(text))) {
    const analyte = m[1].trim();
    if (/page|service on|inventory|patient|weight/i.test(analyte)) continue;
    const raw = m[2];
    const flagRaw = (m[3] || '').toUpperCase();
    let flag = null;
    if (flagRaw.startsWith('H')) flag = 'high';
    else if (flagRaw.startsWith('L')) flag = 'low';
    labs.push({
      analyte,
      value: raw,
      unit: null,
      flag,
      ref_low: parseFloat(m[4]),
      ref_high: parseFloat(m[5]),
      collected_on: null,
    });
  }
  if (!labs.length && labish) {
    const loose = /^[\t ]*([A-Za-z][A-Za-z0-9()/%+.\- ]{1,32})\s+(-?[\d.]+|Detected|Not detected)\s+(H|L)\b/gim;
    while ((m = loose.exec(text))) {
      labs.push({
        analyte: m[1].trim(),
        value: m[2],
        unit: null,
        flag: m[3].toUpperCase() === 'H' ? 'high' : 'low',
        ref_low: null,
        ref_high: null,
        collected_on: null,
      });
    }
  }
  const harvested = harvestKnownFacts(text);
  for (const l of harvested.labs) {
    const existing = labs.find((x) => String(x.analyte).toLowerCase() === String(l.analyte).toLowerCase() && String(x.value) === String(l.value));
    if (existing) {
      if (!existing.collected_on && l.collected_on) existing.collected_on = l.collected_on;
      if (!existing.clinic && l.clinic) existing.clinic = l.clinic;
      continue;
    }
    labs.push(l);
  }
  return labs;
}

export function parsePatientHeader(text) {
  const head = String(text || '').slice(0, 8000);

  const labeled = (keys) => {
    const re = new RegExp(`(?:^|\\n)\\s*(?:${keys})\\s*[:.#]\\s*([^\\n]{1,100})`, 'i');
    const m = head.match(re);
    return m ? m[1].replace(/\s+/g, ' ').trim() : null;
  };
  const blank = (s) => {
    if (s == null || s === '') return null;
    const t = String(s).replace(/\s+/g, ' ').trim();
    if (!t || /^(none(?:\s+listed)?|n\/?a|unknown|not\s+listed|—|-|nil)$/i.test(t)) return null;
    return t;
  };

  const owner = blank(labeled('owner|client|guardian'));
  let patient = blank(labeled('patient|pet\\s*name'));
  const speciesRaw = blank(labeled('species'));
  const breed = blank(labeled('breed'));
  const weightRaw = labeled('weight') || '';
  const sexRaw = labeled('sex|gender') || '';
  const microRaw = labeled('microchip(?:\\s*(?:number|#|no\\.)?)?')
    || (head.match(/microchip\s*[:.#]?\s*([0-9]{9,15}|none listed)/i) || [])[1]
    || '';
  const allergies = blank(labeled('allerg(?:y|ies)'));
  const patientId = blank(labeled('patient\\s*id|chart\\s*id|medical\\s*record\\s*(?:#|no\\.?|number)'));
  let dobSrc = labeled('date\\s*of\\s*birth|\\bdob\\b');
  if (!dobSrc) {
    const dobLine = head.split(/\r?\n/).find((l) => /date of birth|\bDOB\b/i.test(l)) || '';
    dobSrc = (dobLine.match(/(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/) || [])[1] || null;
  }
  const date_of_birth = toIso(dobSrc) || monthEndIso(dobSrc);

  // Unlabeled Patient Information line: "Gina  Female  Spayed  Date of Birth 6/15/2020"
  const infoLine = head.split(/\r?\n/).find((l) => /\b(female|male)\b/i.test(l) && (/spay|neuter|intact|date of birth/i.test(l) || /\b(female|male)\b/i.test(l))) || '';
  if (!patient) {
    const afterPi = head.match(/patient information\s*\n([^\n]{2,80})/i);
    if (afterPi) {
      const tok = afterPi[1].trim().split(/\s{2,}|\s+(?=female|male|spay|neuter)/i)[0];
      if (tok && !/^(female|male|patient)/i.test(tok)) patient = tok.replace(/\s+/g, ' ').trim();
    }
  }

  const sexBlob = `${sexRaw} ${infoLine}`.slice(0, 200);
  let sex = null;
  if (/\bfemale\b|\bF\s*\(/i.test(sexBlob) || /\bsex\s*[:.]?\s*F\b/i.test(head.slice(0, 2000))) sex = 'F';
  else if (/\bmale\b|\bM\s*\(/i.test(sexBlob) || /\bsex\s*[:.]?\s*M\b/i.test(head.slice(0, 2000))) sex = 'M';
  const intact = /intact|not\s+(?:spay|neuter)|unspayed|unneutered/i.test(sexBlob);
  const altered = /spay|neuter|castrat|altered/i.test(sexBlob);
  let spayed_neutered = null;
  if (intact) spayed_neutered = false;
  else if (altered) spayed_neutered = true;

  let species = null;
  if (speciesRaw) {
    if (/feline|\bcat\b/i.test(speciesRaw)) species = 'cat';
    else if (/canine|\bdog\b/i.test(speciesRaw)) species = 'dog';
    else species = speciesRaw.toLowerCase();
  }

  const wHit = String(weightRaw).match(/(\d+(?:\.\d+)?)\s*(lb|lbs|kg)?/i);
  const weight_lb = wHit ? ( /kg/i.test(wHit[2] || '') ? Math.round(parseFloat(wHit[1]) * 2.20462 * 100) / 100 : parseFloat(wHit[1]) ) : null;

  const microchip = blank(microRaw) && /^\d{9,15}$/.test(String(microRaw).replace(/\s/g, ''))
    ? String(microRaw).replace(/\s/g, '')
    : null;

  const agePrinted = blank(labeled('age'));
  const bcsMatch = head.match(/BCS\s*[:.]?\s*(\d(?:\.\d)?)\s*(?:[–\-]\s*\d)?/i);
  const bcs = bcsMatch ? parseInt(bcsMatch[1], 10) : NaN;

  return {
    owner,
    patient,
    species,
    breed,
    weight_lb: Number.isFinite(weight_lb) ? weight_lb : null,
    sex,
    spayed_neutered,
    microchip,
    allergies,
    patient_id: patientId,
    date_of_birth: date_of_birth || null,
    document_date: detectDocumentDate(head),
    age_printed: agePrinted,
    bcs: Number.isFinite(bcs) ? bcs : null,
  };
}

export function parseConditions(text, onsetDate = null) {
  const out = [];
  const onset = onsetDate || null;
  if (/BCS\s*[89]|obese|overweight/i.test(text)) {
    out.push({ name: 'Obese (BCS 8–9)', kind: 'condition', status: 'active', notes: 'BCS 8–9', onset_date: onset, event_date: onset });
  }
  if (/not jumping normally|musculoskeletal|lameness/i.test(text)) {
    out.push({ name: 'Musculoskeletal — not jumping normally', kind: 'condition', status: 'monitoring', onset_date: onset, event_date: onset });
  }
  if (/Strongid|pyrantel|deworm/i.test(text)) {
    out.push({ name: 'Strongid T deworming', kind: 'medication', status: 'monitoring', notes: 'repeat as directed', onset_date: onset, event_date: onset });
  }
  return out;
}

export function batchBlocks(blocks, maxChars) {
  const batches = [];
  let cur = [];
  let n = 0;
  for (const b of blocks) {
    if (n + b.text.length > maxChars && cur.length) {
      batches.push(cur);
      cur = [];
      n = 0;
    }
    cur.push(b);
    n += b.text.length;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

export function mergeParsed(parts) {
  const out = {
    vaccinations: [],
    conditions: [],
    medications: [],
    visits: [],
    labs: [],
    weights: [],
    owner_notes: [],
    ai_note: '',
  };
  for (const p of parts) {
    if (!p) continue;
    for (const k of Object.keys(out)) {
      if (k === 'ai_note') {
        if (p.ai_note) out.ai_note += (out.ai_note ? '\n' : '') + p.ai_note;
      } else if (Array.isArray(p[k])) out[k].push(...p[k]);
    }
  }
  return out;
}

export const EXAM_SYSTEMS = [
  'Subjective', 'Oral-Nasal-Throat', 'Ears', 'Eyes', 'Cardiovascular', 'Respiratory',
  'Abdominal', 'Genitourinary', 'Musculoskeletal', 'Integument', 'Lymphatics', 'Neurological', 'Rectal',
  'Mucous membranes',
];

function examNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

export function parseExam(text, date, clinic) {
  const slice = String(text || '').slice(0, 8000);
  const vitals = {
    temp_f: examNum((slice.match(/(?:temperature|temp)\s*[:=]?\s*(\d{2,3}(?:\.\d)?)\s*(?:°|deg)?\s*F/i) || [])[1]),
    hr: examNum((slice.match(/(?:heart rate|HR|pulse)\s*[:=]?\s*(\d{2,3})/i) || [])[1]),
    rr: examNum((slice.match(/(?:respiratory rate|resp(?:iratory)? rate|RR)\s*[:=]?\s*(\d{1,3})/i) || [])[1]),
    bcs: examNum((slice.match(/BCS\s*[:=]?\s*(\d(?:\.\d)?)/i) || [])[1]),
    pain: examNum((slice.match(/pain(?: score)?\s*[:=]?\s*(\d)/i) || [])[1]),
    hydration: ((slice.match(/hydrat(?:ion|ed)\s*[:=]?\s*([A-Za-z-]{3,24})/i) || [])[1] || '').trim() || null,
    mm: ((slice.match(/mucous membranes?\s*[:=]?\s*(pink|pale|white|icteric|cyanotic|injected)/i) || slice.match(/\bMM\s*[:=]?\s*(pink|pale|white|icteric|cyanotic)/i) || [])[1] || '').trim() || null,
  };
  const systems = EXAM_SYSTEMS.map((name) => {
    const key = name.split(/[- ]/)[0];
    const re = new RegExp(`${key}[^\\n]{0,140}(NSF|WNL|normal|abnormal|enlarged|inflamed|unremarkable)`, 'i');
    const m = slice.match(re);
    if (!m) return { name, status: 'not_examined', note: null };
    const status = /abnormal|enlarged|inflamed/i.test(m[1]) ? 'abnormal' : 'normal';
    return { name, status, note: m[0].slice(0, 180) };
  });
  const has = vitals.bcs || vitals.temp_f || vitals.hr || vitals.rr || /physical exam|PE:|BCS|TPR/i.test(slice);
  if (!has && !date) return null;
  return { visit_date: date || null, clinic: clinic || null, vitals, systems };
}

export function parseFlowsheet(text) {
  const out = [];
  const re = /(\d{1,2}\/\d{1,2}\/\d{2,4})(?:[ T](\d{1,2}:\d{2}))?[^\d]{0,24}(\d{2,3}(?:\.\d)?)[^\d]{1,8}(\d{2,3})[^\d]{1,8}(\d{1,3})/g;
  let m;
  while ((m = re.exec(text))) {
    const iso = toIso(m[1]);
    if (!iso) continue;
    const temp = parseFloat(m[3]);
    const hr = parseFloat(m[4]);
    const rr = parseFloat(m[5]);
    if (temp < 96 || temp > 106 || hr < 40 || hr > 280 || rr < 8 || rr > 80) continue;
    out.push({ at: m[2] ? `${iso}T${m[2]}` : iso, temp_f: temp, hr, rr, weight_lb: null, bcs: null });
  }
  return out;
}

export function parseMedsTable(text) {
  const out = [];
  const re = /(?:Inventory Item|Rx|Administered)\s*[—:-]\s*([A-Za-z][A-Za-z0-9 +\-\/]{2,40})/gi;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1].trim();
    if (/vaccine|purevax|fvrcp|rabies/i.test(name)) continue;
    out.push({ name, dose: null, route: /SQ|SC|IV|PO|IM/i.test(m[0]) ? (m[0].match(/SQ|SC|IV|PO|IM/i) || [])[0] : null, given_on: null, status: 'completed' });
  }
  if (/strongid|pyrantel/i.test(text)) out.push({ name: 'Strongid T', dose: null, route: 'PO', given_on: null, status: 'completed' });
  const seen = new Set();
  return out.filter((x) => {
    const k = x.name.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function harvestKnownFacts(text) {
  const src = String(text || '');
  const labs = [];
  const vaccinations = [];
  const weights = [];
  const visits = [];

  const pushLab = (analyte, value, extra = {}) => {
    if (!analyte || value == null || value === '') return;
    const key = `${String(analyte).toLowerCase()}|${String(value).toLowerCase()}`;
    if (labs.some((l) => `${String(l.analyte).toLowerCase()}|${String(l.value).toLowerCase()}` === key)) return;
    labs.push({
      analyte,
      value: String(value).trim(),
      unit: extra.unit || null,
      flag: extra.flag || null,
      ref_low: extra.ref_low ?? null,
      ref_high: extra.ref_high ?? null,
      collected_on: extra.collected_on || null,
      prior_value: extra.prior_value ?? null,
      prior_date: extra.prior_date || null,
      group: extra.group || null,
    });
  };

  const t4 = src.match(/\b(?:total\s*)?T4\b[^0-9]{0,24}(\d+(?:\.\d+)?)\s*(µ?g\/dL|ug\/dL|ng\/mL|nmol\/L)?/i);
  if (t4) pushLab('T4', t4[1], { unit: t4[2] ? t4[2].replace('ug', 'µg') : 'µg/dL', group: 'endocrinology' });

  const felvFiv = src.match(/FeLV\s*\/?\s*FIV[^.\n]{0,48}?\b(negative|positive|not detected|detected)\b/i);
  if (felvFiv) {
    const v = /pos/i.test(felvFiv[1]) || /^detected$/i.test(felvFiv[1]) ? 'positive' : 'negative';
    pushLab('FeLV', v, { flag: v === 'negative' ? 'normal' : 'abnormal', group: 'serology' });
    pushLab('FIV', v, { flag: v === 'negative' ? 'normal' : 'abnormal', group: 'serology' });
  } else {
    const felv = src.match(/\bFeLV\b[^.\n]{0,40}?\b(negative|positive|not detected|detected)\b/i);
    const fiv = src.match(/\bFIV\b[^.\n]{0,40}?\b(negative|positive|not detected|detected)\b/i);
    if (felv) {
      const v = /pos/i.test(felv[1]) || /^detected$/i.test(felv[1]) ? 'positive' : 'negative';
      pushLab('FeLV', v, { flag: v === 'negative' ? 'normal' : 'abnormal', group: 'serology' });
    }
    if (fiv) {
      const v = /pos/i.test(fiv[1]) || /^detected$/i.test(fiv[1]) ? 'positive' : 'negative';
      pushLab('FIV', v, { flag: v === 'negative' ? 'normal' : 'abnormal', group: 'serology' });
    }
  }

  const protein = src.match(/(\d\+|trace)\s*protein\b/i)
    || src.match(/(?:urinalysis|UA|urine)[^\n]{0,80}?protein[^\n]{0,24}(\d\+|trace|neg(?:ative)?|\+|negative)/i)
    || src.match(/\bprotein\b[^\n]{0,16}(\d\+)/i);
  if (protein) {
    const v = protein[1].toLowerCase().startsWith('neg') ? 'negative' : protein[1];
    pushLab('Urine protein', v, { flag: /neg|0/.test(v) ? 'normal' : 'abnormal', group: 'urinalysis' });
  }

  const usg = src.match(/(?:urine\s*)?(?:specific gravity|USG)\s*[:=]?\s*(1\.\d{2,4})/i);
  if (usg) pushLab('USG', usg[1], { group: 'urinalysis' });

  const fpl = src.match(/spec\s*fPL[^0-9]{0,20}(\d+(?:\.\d+)?)/i);
  if (fpl) pushLab('Spec fPL', fpl[1], { unit: 'µg/L', group: 'chemistry' });

  const PROSE_LABS = [
    { re: /\bcreatinine\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'Creatinine', unit: 'mg/dL', group: 'chemistry' },
    { re: /\bBUN\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'BUN', unit: 'mg/dL', group: 'chemistry' },
    { re: /\bALT\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'ALT', unit: 'U/L', group: 'chemistry' },
    { re: /\bALP\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'ALP', unit: 'U/L', group: 'chemistry' },
    { re: /\bAST\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'AST', unit: 'U/L', group: 'chemistry' },
    { re: /\bglucose\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'Glucose', unit: 'mg/dL', group: 'chemistry' },
    { re: /\bphosphorus\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'Phosphorus', unit: 'mg/dL', group: 'chemistry' },
    { re: /\b(?:total\s*)?protein\b[^0-9]{0,16}(\d+(?:\.\d+)?)(?!\s*\+)/i, analyte: 'Total protein', unit: 'g/dL', group: 'chemistry' },
    { re: /\balbumin\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'Albumin', unit: 'g/dL', group: 'chemistry' },
    { re: /\bWBC\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'WBC', unit: 'K/µL', group: 'hematology' },
    { re: /\b(?:HCT|hematocrit)\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'HCT', unit: '%', group: 'hematology' },
    { re: /\bPCV\b[^0-9]{0,16}(\d+(?:\.\d+)?)/i, analyte: 'PCV', unit: '%', group: 'hematology' },
  ];
  for (const spec of PROSE_LABS) {
    const hit = src.match(spec.re);
    if (hit) pushLab(spec.analyte, hit[1], { unit: spec.unit, group: spec.group });
  }

  const pushVax = (row) => {
    const name = String(row.name || row.product || '').replace(/\s+/g, ' ').trim();
    if (!name) return;
    const type = /rabies/i.test(name) ? 'rabies' : /fvrcp|distemper/i.test(name) ? 'fvrcp' : /felv|leukemia/i.test(name) ? 'felv' : name.toLowerCase();
    const existing = vaccinations.find((v) => {
      const t = /rabies/i.test(v.name) ? 'rabies' : /fvrcp/i.test(v.name) ? 'fvrcp' : /felv/i.test(v.name) ? 'felv' : String(v.name || '').toLowerCase();
      return t === type;
    });
    if (existing) {
      if (!existing.given && row.given) existing.given = row.given;
      if (!existing.next_due && row.next_due) existing.next_due = row.next_due;
      if (!existing.status && row.status) existing.status = row.status;
      if (!existing.notes && row.notes) existing.notes = row.notes;
      if (!existing.lot && row.lot) existing.lot = row.lot;
      if (!existing.brand && row.brand) existing.brand = row.brand;
      return;
    }
    vaccinations.push({
      name,
      product: row.product || name,
      brand: row.brand || (/purevax/i.test(name) ? 'PUREVAX' : null),
      lot: row.lot || null,
      given: row.given || null,
      administered_on: row.given || null,
      next_due: row.next_due || null,
      site: row.site || null,
      status: row.status || (row.given ? 'given' : null),
      notes: row.notes || null,
    });
  };

  let m;
  const vaxRe = /\b(FVRCP(?:\s*\d[-\s]*year)?|Purevax\s+Rabies(?:\s+Feline)?(?:\s+3\s*-?\s*yr(?:ear)?)?|Rabies|FeLV vaccine|Bordetella|Feline Leukemia)\b([^\n]{0,120})/gi;
  while ((m = vaxRe.exec(src))) {
    const line = (m[1] + (m[2] || '')).replace(/\s+/g, ' ');
    const dates = [...line.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/g)]
      .map((x) => toIso(x[1]))
      .filter(Boolean);
    const through = line.match(/(?:current|valid)?\s*(?:through|thru|until|expires?(?:\s+on)?)\s+([A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    const missed = /missed|overdue|incomplete|late/i.test(line);
    const next_due = monthEndIso(through?.[1]) || ((/due|expires|valid thru|through|thru|next|reminder|current/i.test(line)) ? (dates[0] || monthEndIso(through?.[1])) : null);
    pushVax({
      name: m[1].replace(/\s+/g, ' ').trim(),
      product: m[1].replace(/\s+/g, ' ').trim(),
      brand: /purevax/i.test(line) ? 'PUREVAX' : null,
      lot: (line.match(/\blot\s*[:#]?\s*([A-Z0-9-]+)/i) || [])[1] || null,
      given: null,
      next_due,
      site: (line.match(/\b(SC|SQ|IM|IN)\b[^,\n]{0,40}/i) || [])[0] || null,
      status: missed ? 'overdue' : (next_due ? STATUS_CURRENT_UNKNOWN : null),
      notes: missed ? line.trim().slice(0, 160) : (next_due ? line.trim().slice(0, 160) : null),
    });
  }
  if (/\bFVRCP\b/i.test(src) && /missed|overdue|incomplete/i.test(src)) {
    const note = (src.match(/[^\n]{0,40}FVRCP[^\n]{0,60}/i) || ['FVRCP booster missed'])[0].replace(/\s+/g, ' ').trim();
    pushVax({ name: 'FVRCP', product: 'FVRCP', given: null, next_due: null, status: 'overdue', notes: note });
  }
  if (/\brabies\b/i.test(src) && /current|through|thru/i.test(src)) {
    const through = src.match(/rabies[^\n]{0,80}?(?:current|valid)?\s*(?:through|thru|until)\s+([A-Za-z]{3,9}\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)
      || src.match(/(?:current|through|thru)\s+([A-Za-z]{3,9}\s+\d{4}).{0,40}rabies/i);
    pushVax({
      name: 'Rabies',
      product: 'Rabies',
      given: null,
      next_due: monthEndIso(through?.[1]) || null,
      status: STATUS_CURRENT_UNKNOWN,
      notes: (through?.[0] || 'Rabies current').replace(/\s+/g, ' ').trim().slice(0, 160),
    });
  }

  const wRe = /(\d{1,2}\/\d{1,2}\/\d{2,4})?[^\n]{0,12}(?<![\d.])(\d{1,2}(?:\.\d{1,2})?)\s*(lb|lbs|kg)\b/gi;
  while ((m = wRe.exec(src.slice(0, 12000)))) {
    const n = parseFloat(m[2]);
    if (n < 1 || n > 200) continue;
    weights.push({ value: n, unit: (m[3] || 'lb').toLowerCase().startsWith('kg') ? 'kg' : 'lb', measured_on: toIso(m[1]) });
  }

  const visitDate = detectVisitDate(src);
  const exporting = detectExportingPractice(src);
  const clinic = detectClinic(src, exporting);
  const identity = harvestIdentity(src, visitDate);
  if (looksLikeInvoice(src)) {
    return inheritVisitDate({
      labs: [],
      vaccinations: [],
      weights: [],
      visits: [],
      lifestyle: null,
      identity,
      date: visitDate,
      clinic,
    }, visitDate);
  }
  const vet = detectVet(src);
  const reason = detectReason(src);
  const findings = detectSection(src, /findings|assessment|physical exam/i);
  const plan = detectSection(src, /plan|recommendations?|follow[- ]up/i);
  const isVisitDoc = Boolean(
    visitDate || clinic || reason || labs.length || vaccinations.length
    || /visit|exam|service on|vomiting|assessment|soap|chief complaint/i.test(src.slice(0, 2500)),
  );
  if (isVisitDoc) {
    visits.push({
      date: visitDate,
      event_date: visitDate,
      clinic,
      vet,
      vets: vet ? [vet] : [],
      reason,
      findings,
      plan,
      summary: [reason, findings, plan].filter(Boolean).join(' · ') || null,
      visit_type: inferVisitType({ clinic, reason }, src),
    });
  }

  const lifestyle = harvestLifestyle(src);

  return inheritVisitDate({ labs, vaccinations, weights, visits, lifestyle, identity, date: visitDate, clinic }, visitDate);
}

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

export function monthEndIso(s) {
  if (!s) return null;
  const exact = toIso(s);
  if (exact) return exact;
  const m = String(s).match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{4})\b/i);
  if (!m) return null;
  const mm = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!mm) return null;
  const y = parseInt(m[2], 10);
  const last = new Date(y, parseInt(mm, 10), 0).getDate();
  return `${y}-${mm}-${String(last).padStart(2, '0')}`;
}

export function detectVisitDate(src) {
  const head = String(src || '').slice(0, 2500)
    .replace(/date of birth[^\n]*/gi, '')
    .replace(/\bDOB\b[^\n]*/gi, '');
  const labeled = head.match(/(?:service on|visit date|exam date|date of (?:visit|exam|service)|date)\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i);
  if (labeled) return toIso(labeled[1]) || monthEndIso(labeled[1]);
  const named = head.match(/\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/);
  if (named) return toIso(named[1]);
  const slash = head.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  return slash ? toIso(slash[1]) : null;
}

/** Printed / report date from the letterhead — not DOB, not Service on. */
export function detectDocumentDate(text) {
  const head = String(text || '').slice(0, 2500)
    .replace(/date of birth[^\n]*/gi, '')
    .replace(/\bDOB\b[^\n]*/gi, '');
  const labeled = head.match(/(?:printed|report(?:ed)?|document|run|generated|as of)\s*(?:on|:)?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i);
  if (labeled) return toIso(labeled[1]) || monthEndIso(labeled[1]);
  const named = head.match(/\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/);
  if (named) return toIso(named[1]);
  return null;
}

export function coalesceDate(...cands) {
  for (const c of cands) {
    if (!c) continue;
    const iso = toIso(c) || (/^\d{4}-\d{2}-\d{2}/.test(String(c)) ? String(c).slice(0, 10) : null) || monthEndIso(c);
    if (iso) return iso;
  }
  return null;
}

/** Block date > document date > null. Never today. Does not invent vaccine given dates. */
export function stampEventDates(parsed, documentDate = null) {
  const docDate = coalesceDate(documentDate, parsed?.document_date, parsed?.identity?.document_date);
  const setEvent = (row, ...blockDates) => {
    if (!row || typeof row !== 'object') return;
    row.event_date = coalesceDate(row.event_date, ...blockDates, docDate);
  };
  for (const vis of parsed.visits || []) {
    setEvent(vis, vis.date, vis.visit_date, vis.occurred_on);
    if (!vis.date) vis.date = vis.event_date || null;
  }
  for (const l of parsed.labs || []) setEvent(l, l.collected_on);
  for (const w of parsed.weights || []) setEvent(w, w.measured_on);
  for (const v of parsed.vaccinations || []) {
    // Given dates stay printed-only (inventory). event_date is the given date if present.
    v.event_date = coalesceDate(v.given, v.administered_on) || null;
  }
  for (const c of parsed.conditions || []) {
    setEvent(c, c.onset_date);
    if (!c.onset_date && c.event_date) c.onset_date = c.event_date;
  }
  for (const e of parsed.exams || []) {
    setEvent(e, e.visit_date);
    if (!e.visit_date) e.visit_date = e.event_date || null;
  }
  for (const m of parsed.medications || []) setEvent(m, m.given_on, m.administered_on);
  for (const n of parsed.owner_notes || []) setEvent(n, n.date);
  for (const inv of parsed.invoices || []) {
    setEvent(inv, inv.invoice_date);
    if (!inv.invoice_date) inv.invoice_date = inv.event_date || null;
  }
  return parsed;
}

/** Conditions inherit onset from their first mention (earliest event_date). */
export function coalesceConditionOnset(conditions) {
  const byName = new Map();
  for (const c of conditions || []) {
    const k = String(c.name || '').trim().toLowerCase();
    if (!k) continue;
    const onset = coalesceDate(c.onset_date, c.event_date);
    const existing = byName.get(k);
    if (!existing) {
      byName.set(k, { ...c, onset_date: onset || null, event_date: onset || c.event_date || null });
      continue;
    }
    const first = [onset, existing.onset_date].filter(Boolean).sort()[0] || null;
    existing.onset_date = first;
    existing.event_date = first || existing.event_date || null;
    if (c.notes && !existing.notes) existing.notes = c.notes;
  }
  return [...byName.values()];
}

const PASSING_CLINIC_LINE = /(?:copy\s*to|cc\s*:|primary\s+rdvm|referring\s+(?:vet|veterinarian|dvm)|rdvm\s*:|referr(?:ed|al)|ordered\s+by|prior\s+history|previously\s+(?:seen|treated)|outside\s+(?:records?|lab))/i;
const KNOWN_CLINIC_RE = /\b(BondVet|Bond\s+Vet(?:\s+Hell'?s Kitchen)?|At[- ]Home(?:\s+Veterinary)?|VEG(?:\s+Chelsea)?|VCA[^\n,]{0,40}|Banfield|BluePearl|ASPCA|Animal Medical|Dutch(?:\.com)?|InstaVet|Instavet)\b/i;

function cleanClinicName(s) {
  const name = String(s || '').replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  if (!name || /^(n\/?a|unknown|practice|clinic|medical chart|provider)$/i.test(name)) return null;
  if (isValidVetName(name)) return null;
  return name;
}

function clinicKey(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function clinicNamesEqual(a, b) {
  const ka = clinicKey(a);
  const kb = clinicKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  if (ka.startsWith('bondvet') && kb.startsWith('bondvet')) return true;
  if (ka.startsWith('athome') && kb.startsWith('athome')) return true;
  return ka.includes(kb) || kb.includes(ka);
}

function stripPassingMentions(s) {
  return String(s || '')
    .split('\n')
    .filter((line) => !PASSING_CLINIC_LINE.test(line) && !/^\s*practice\s*:/i.test(line))
    .join('\n');
}

/** Letterhead / logo / Medical Chart title / footer. */
export function detectExportingPractice(text) {
  const src = String(text || '');
  // Brand on the invoice page beats a refund-receipt letterhead (At Home).
  if (/VEG\s*[|/I]?\s*ER\s+for\s+Pets/i.test(src)) return 'VEG ER for Pets';
  const firstService = src.search(/Service on\s+\d{1,2}\/\d{1,2}/i);
  let preamble = '';
  if (firstService > 0) preamble = src.slice(0, firstService);
  else if (firstService < 0) preamble = src.slice(0, 2000);
  const foot = src.slice(Math.max(0, src.length - 1200));
  const from = (chunk) => {
    const clean = stripPassingMentions(chunk);
    const logo = clean.match(/^\s*(BondVet|Bond\s+Vet(?:\s+Hell'?s Kitchen)?|At[- ]Home(?:\s+Veterinary)?)\s*$/im);
    if (logo) {
      const n = cleanClinicName(logo[1]);
      if (n) return n;
    }
    const chart = clean.match(/([A-Z][^\n]{2,70})\r?\n[^\n]{0,80}Medical Chart/i)
      || clean.match(/Medical Chart[^\n]{0,40}\r?\n([A-Z][^\n]{2,70})/i);
    if (chart) {
      const n = cleanClinicName(chart[1]);
      if (n) return n;
    }
    const labeled = clean.match(/(?:^|\n)\s*(?:clinic|facility|hospital)\s*[:.]\s*([^\n]{3,80})/i);
    if (labeled) {
      const n = cleanClinicName(labeled[1]);
      if (n) return n;
    }
    const known = clean.match(KNOWN_CLINIC_RE);
    return known ? known[0].replace(/\s+/g, ' ').trim() : null;
  };
  return from(preamble) || from(foot);
}

/** Only an explicit Provider: / Seen at: line in this block names another practice. */
export function detectProviderOverride(block) {
  const m = String(block || '').match(/(?:^|\n)\s*(?:provider|seen at)\s*[:.]\s*([^\n]{3,80})/i);
  if (!m) return null;
  return cleanClinicName(m[1]);
}

/** A non-passing clinic-name line in the block (not copy-to / Practice / Ordered by). */
export function detectNamedClinicInBlock(block, exportingPractice = null) {
  const override = detectProviderOverride(block);
  if (override) return override;
  const lines = String(block || '').split('\n');
  for (const line of lines) {
    if (PASSING_CLINIC_LINE.test(line) || /^\s*practice\s*:/i.test(line)) continue;
    if (/^\s*service on/i.test(line)) continue;
    const known = line.match(KNOWN_CLINIC_RE);
    if (!known) continue;
    const name = known[0].replace(/\s+/g, ' ').trim();
    if (exportingPractice && clinicNamesEqual(name, exportingPractice)) return exportingPractice;
    return name;
  }
  return null;
}

export function detectClinic(src, exportingPractice = null) {
  const named = detectNamedClinicInBlock(src, exportingPractice);
  if (named) return named;
  const labeled = String(src || '').match(/(?:^|\n)\s*(?:clinic|facility|hospital)\s*[:.]\s*([^\n]{3,80})/i);
  if (labeled) {
    const around = String(src || '').slice(Math.max(0, labeled.index - 24), labeled.index + labeled[0].length);
    if (!PASSING_CLINIC_LINE.test(around)) {
      const n = cleanClinicName(labeled[1]);
      if (n) return n;
    }
  }
  return exportingPractice || null;
}

export function detectReason(src) {
  const labeled = String(src || '').match(/(?:reason|presenting complaint|chief complaint|cc)\s*[:.]\s*([^\n]{4,120})/i);
  if (labeled) return labeled[1].replace(/\s+/g, ' ').trim();
  const vomit = String(src || '').match(/intermittent vomiting|vomiting|diarrhea|lethargy|not eating|inappetence|limping/i);
  return vomit ? vomit[0] : null;
}

function detectSection(src, heading) {
  const re = new RegExp(`(?:${heading.source})\\s*[:.\\-–]\\s*([^\\n]{8,280})`, 'i');
  const m = String(src || '').match(re);
  if (m) return m[1].replace(/\s+/g, ' ').trim();
  if (heading.test('plan') && /follow-?up vaccination|fecal pending/i.test(src)) {
    const bits = [];
    if (/follow-?up vaccination[^\n.]{0,40}/i.test(src)) bits.push((src.match(/follow-?up vaccination[^\n.]{0,40}/i) || [])[0]);
    if (/fecal pending/i.test(src)) bits.push('fecal pending');
    return bits.filter(Boolean).join('; ') || null;
  }
  return null;
}

export function harvestLifestyle(src) {
  const text = String(src || '');
  if (looksLikeInvoice(text)) return null;
  const dietLine = (text.match(/(?:diet|fed|feeding|food)\s*[:.]\s*([^\n]{4,80})/i)
    || text.match(/\b(Purina(?:\s+Pro\s+Plan)?(?:\s+\w+)?(?:\s+(?:dry|wet|canned|kibble))?)\b/i)
    || [])[1];
  const parasite = (text.match(/parasite prevention\s*[:.]\s*([^\n]{2,60})/i)
    || text.match(/(?:heartworm|flea|tick|prevention)\s*[:.]\s*(none|no|not on file|[^\n]{2,40})/i)
    || [])[1];
  if (!dietLine && !parasite) return null;
  const diet = dietLine ? dietLine.replace(/\s+/g, ' ').trim() : null;
  let food_brand = null;
  let food_product = null;
  let food_type = null;
  if (diet) {
    const purina = diet.match(/^(purina)\s+(.*)$/i);
    if (purina) {
      food_brand = 'Purina';
      const rest = purina[2].trim();
      const typeHit = rest.match(/\b(dry|wet|canned|kibble|raw)\b/i);
      food_type = typeHit ? typeHit[1].toLowerCase() : null;
      food_product = rest.replace(/\b(dry|wet|canned|kibble)\b/i, '').replace(/\s+/g, ' ').trim() || 'Pro Plan';
    } else {
      const parts = diet.split(/\s+/);
      food_brand = parts[0];
      food_product = parts.slice(1).join(' ') || null;
    }
    if (!food_type && /\b(dry|wet|canned|kibble)\b/i.test(diet)) food_type = (diet.match(/\b(dry|wet|canned|kibble)\b/i) || [])[1].toLowerCase();
  }
  return {
    diet,
    food_brand,
    food_product,
    food_type,
    parasite_prevention: parasite ? parasite.replace(/\s+/g, ' ').trim() : null,
    source: 'ai_extracted',
  };
}

export function harvestIdentity(src, asOf) {
  const text = String(src || '');
  const ageHit = text.match(/\bage\s*[:.]?\s*(\d+(?:\.\d+)?)\s*(y(?:ears?)?|yr|yo)\b/i)
    || text.match(/\b(\d+(?:\.\d+)?)\s*[- ]?years?[- ]old\b/i);
  const ageMonths = text.match(/\bage\s*[:.]?\s*(\d+(?:\.\d+)?)\s*(mo|mos|months?)\b/i);
  let printedAge = null;
  if (ageHit) printedAge = parseFloat(ageHit[1]);
  else if (ageMonths) printedAge = parseFloat(ageMonths[1]) / 12;
  const header = parsePatientHeader(text);
  let date_of_birth = header.date_of_birth || null;
  if (!date_of_birth && printedAge && asOf) date_of_birth = dobFromAge(printedAge, asOf);
  const asOfDate = header.document_date || asOf || null;
  return {
    ...header,
    date_of_birth,
    date_of_birth_estimated: Boolean(!header.date_of_birth && date_of_birth),
    age_years: ageYearsAt(date_of_birth, asOfDate),
  };
}

/** Years at asOf from DOB, one decimal. Null only when DOB or asOf is missing. Never persist. */
export function ageYearsAt(dob, asOf) {
  const dobIso = toIso(dob);
  const asOfIso = toIso(asOf);
  if (!dobIso || !asOfIso) return null;
  const a = Date.parse(`${dobIso}T12:00:00Z`);
  const b = Date.parse(`${asOfIso}T12:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round(((b - a) / (365.25 * 864e5)) * 10) / 10;
}

export function attachDerivedAge(identity, fallbackDate) {
  if (!identity) return identity;
  const asOf = identity.document_date || fallbackDate || null;
  identity.age_years = ageYearsAt(identity.date_of_birth, asOf);
  return identity;
}

/** Write extracted identity only when the field is empty or was not owner-entered. */
export function canApplyIdentityField(current, source) {
  if (current == null || current === '') return true;
  return Boolean(source) && source !== 'owner';
}

export function dobFromAge(ageYears, asOf) {
  const n = Number(ageYears);
  if (!Number.isFinite(n) || n <= 0 || n > 30) return null;
  const iso = toIso(asOf) || String(asOf || '').slice(0, 10);
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() - Math.round(n * 365.25));
  return d.toISOString().slice(0, 10);
}

export function inheritVisitDate(parsed, fallbackDate) {
  const visitDate = parsed.date
    || (parsed.visits || []).map((v) => v.date).find(Boolean)
    || fallbackDate
    || null;
  if (!visitDate) return parsed;
  if (!parsed.date) parsed.date = visitDate;
  for (const l of parsed.labs || []) {
    if (!l.collected_on) l.collected_on = visitDate;
  }
  for (const w of parsed.weights || []) {
    if (w && !w.measured_on) w.measured_on = visitDate;
  }
  for (const vis of parsed.visits || []) {
    if (!vis.date) vis.date = visitDate;
    if (!vis.event_date) vis.event_date = vis.date || visitDate;
  }
  return parsed;
}

export function itemsTrulyUndated(parsed) {
  const undated = [];
  const push = (kind, summary, raw) => {
    if (!summary) return;
    if (undated.some((u) => u.kind === kind && u.summary === summary)) return;
    undated.push({ kind, summary, raw: raw || null });
  };
  const visitDate = parsed.date || (parsed.visits || []).some((v) => v.date);
  if (visitDate) return undated;
  for (const v of parsed.vaccinations || []) {
    if (v && (v.name || v.product) && !v.administered_on && !v.given && !v.next_due && !v.status) {
      push('vaccine', v.product || v.name, JSON.stringify(v));
    }
  }
  for (const w of parsed.weights || []) {
    if (w && w.value != null && !w.measured_on) push('weight', `${w.value} ${w.unit || 'lb'}`, JSON.stringify(w));
  }
  for (const vis of parsed.visits || []) {
    if (vis && (vis.reason || vis.clinic || vis.findings) && !vis.date) {
      push('visit', vis.reason || vis.clinic || vis.findings, JSON.stringify(vis));
    }
  }
  for (const l of parsed.labs || []) {
    if (l && l.analyte && !l.collected_on) push('lab', `${l.analyte} ${l.value ?? ''}`.trim(), JSON.stringify(l));
  }
  return undated;
}

export function reconcileVaxDates(text, vaccinations) {
  const src = String(text || '');
  const mismatches = [];
  const windows = [];
  const re = /(PUREVAX\s+Rabies(?:\s+Feline)?(?:\s+3\s*-?\s*yr(?:ear)?)?|PUREVAX\s+FVRCP|FVRCP|Rabies)[^\n]{0,180}/gi;
  let m;
  while ((m = re.exec(src))) {
    const line = m[0];
    const dates = [...line.matchAll(/(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/g)]
      .map((x) => toIso(x[1]))
      .filter(Boolean);
    windows.push({
      name: m[1].replace(/\s+/g, ' '),
      line,
      dates,
      dueish: /due|expires|valid thru|next|reminder|current through/i.test(line),
    });
  }
  const out = (vaccinations || []).map((v) => {
    const hasGiven = Boolean(v.given || v.administered_on);
    const statusLc = String(v.status || '').toLowerCase();
    // Reminders / current-through: never invent administered_on from a due date.
    if (!hasGiven) {
      if (statusLc === 'overdue') return { ...v, given: null, administered_on: null };
      if (v.next_due || statusLc.includes('unknown') || statusLc === 'current') {
        return { ...v, given: null, administered_on: null, status: STATUS_CURRENT_UNKNOWN };
      }
      return { ...v, given: null, administered_on: null };
    }
    const product = String(v.product || v.name || '');
    const key = product.split(/\s+/)[0].toLowerCase();
    const hits = windows.filter((w) => w.name.toLowerCase().includes(key) || product.toLowerCase().includes(w.name.split(/\s+/)[0].toLowerCase()));
    const noteDates = hits.flatMap((h) => h.dates);
    if (v.given && noteDates.length && !noteDates.includes(v.given) && !isoInText(v.given, src)) {
      mismatches.push({ kind: 'vaccine_date', mention: `${product} structured ${v.given} but note has ${noteDates.join(', ') || 'no matching date'}` });
    }
    return v;
  });
  return { vaccinations: out, mismatches };
}

export const AURORA_VISIT_FIXTURE = `Aurora — Visit report
Clinic: Bond Vet Hell's Kitchen
Date: September 2, 2026
Age: 1.2 y
Reason: intermittent vomiting

Labs: creatinine 1.5, BUN 19, T4 1.7 µg/dL
Urinalysis: 1+ protein
FeLV/FIV negative

Vaccines:
Rabies current through September 2026
second FVRCP booster missed

Diet: Purina Pro Plan dry
Parasite prevention: none

Findings: intermittent vomiting, otherwise BAR
Plan: follow-up vaccination in 3 weeks, fecal pending
`;

export const DUTCH_TELEHEALTH_FIXTURE = `Dutch
Online visit · video consult
Patient: Aurora
Date: March 14, 2025
Reason: appetite check
Plan: continue current diet, follow up if vomiting returns
`;

export function detectVet(src) {
  const text = String(src || '');
  const found = [];
  // D.V.M. / DVM / VMD — walk 2–4 Capitalized tokens before the credential.
  // Split on all whitespace so "Veterinary\nJonathan Leshanski DVM" still yields
  // Jonathan Leshanski; longest-first then shorter drops clinic-name words.
  const dvmRe = /(?:\bD\.V\.M\.?|\bDVM\b|\bVMD\b)/gi;
  let m;
  while ((m = dvmRe.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 80), m.index);
    const tokens = before.trim().split(/\s+/).filter(Boolean);
    const names = [];
    for (let i = tokens.length - 1; i >= 0 && names.length < 4; i--) {
      const t = tokens[i].replace(/[,:]+$/g, '');
      if (!/^[A-Z][a-z'\-]+$/.test(t)) break;
      names.unshift(t);
    }
    const cred = /vmd/i.test(m[0]) ? 'VMD' : 'DVM';
    for (let n = names.length; n >= 2; n--) {
      found.push(`${names.slice(names.length - n).join(' ')} ${cred}`);
    }
  }
  // Dr. Firstname Lastname stays on one line so "Dr. Jane Doe\nTemp 101" does not swallow Temp.
  const drRe = /\bDr\.?[ \t]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z'\-]+)+)/g;
  while ((m = drRe.exec(text))) {
    const cap = m[1].replace(/[ \t]+/g, ' ').replace(/[ \t]+(D\.?V\.?M\.?|VMD)\b/i, '').trim();
    found.push(`Dr. ${cap}`);
  }
  for (const c of found) {
    const n = normalizeVetName(c);
    if (n) return n;
  }
  return null;
}

/** IDEXX / reference-lab cover sheet: practice + Ordered by + collected date. */
export function detectIdexxHeader(text) {
  const head = String(text || '').slice(0, 2500);
  const practice = head.match(/(?:practice|facility|hospital|clinic)\s*[:.]\s*([^\n]{3,80})/i);
  // Practice:/Ordered by on an IDEXX sheet are copy-to / requester, not the visit clinic.
  const collected = head.match(/(?:collected|drawn|taken|specimen|order(?:ed)?(?:\s+date)?|reported)\s*(?:on)?\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i);
  const date = collected ? (toIso(collected[1]) || monthEndIso(collected[1])) : detectVisitDate(head);
  return { clinic: null, vet: null, date: date || null, practice: practice ? cleanClinicName(practice[1]) : null };
}

export function latestVisit(visits) {
  return (visits || [])
    .slice()
    .sort((a, b) => String(b.event_date || b.date || '').localeCompare(String(a.event_date || a.date || '')))
    .find((v) => v && (v.event_date || v.date || v.clinic)) || null;
}

export function inferVisitType(visit, blob) {
  if (visit?.visit_type === 'telehealth' || visit?.visit_type === 'house_call' || visit?.visit_type === 'in_person' || visit?.visit_type === 'ER') {
    return visit.visit_type;
  }
  const clinic = `${visit?.clinic || ''}`;
  const text = `${clinic} ${visit?.reason || ''} ${visit?.title || ''} ${blob || ''}`.toLowerCase();
  if (/\bdutch\b|telehealth|tele-health|telemedicine|online visit|virtual (consult|visit|appointment)|video visit/.test(text)) {
    return 'telehealth';
  }
  if (/\bveg\b|\ber for pets\b|\bemergency\b/.test(clinic.toLowerCase())) return 'ER';
  if (/house\s*call|at[- ]home veterinary|in-home visit/.test(text)) return 'house_call';
  return 'in_person';
}

export function stampVisitTypes(merged, text) {
  const blob = String(text || '');
  if (!merged.visits) merged.visits = [];
  for (const v of merged.visits) {
    v.visit_type = inferVisitType(v, blob);
  }
  const wantsTele = /\bdutch\b|telehealth|tele-health|online visit|virtual (consult|visit)/i.test(blob);
  if (wantsTele && !merged.visits.some((v) => v.visit_type === 'telehealth')) {
    const clinic = /\bdutch\b/i.test(blob) ? 'Dutch' : (merged.issuing_clinic || merged.clinic || 'Telehealth');
    const date = merged.document_date || merged.date || null;
    merged.visits.push({
      date,
      event_date: date,
      clinic,
      visit_type: 'telehealth',
      reason: 'Telehealth visit',
      findings: null,
      plan: null,
      summary: 'Telehealth visit',
    });
  }
  return merged;
}

function applyLabSegmentHeader(seg, visitBlocks, exporting = null) {
  const hdr = detectIdexxHeader(seg.text);
  const date = hdr.date || seg.date || null;
  const precedingSameDate = visitBlocks.filter((v) => (v.start || 0) <= (seg.start || 0) && date && v.date === date);
  const match = precedingSameDate.length ? precedingSameDate[precedingSameDate.length - 1] : null;
  // Never take clinic/vet from IDEXX Practice / Ordered by / copy-to.
  if (match) {
    seg.clinic = match.clinic || exporting || null;
    seg.vet = match.vet || null;
    seg.date = match.date || date || null;
    return;
  }
  seg.clinic = exporting || null;
  seg.vet = null;
  seg.date = date || null;
}

export function looksLikeInvoice(text) {
  const src = String(text || '');
  if (/\binvoice\s*(?:number|no\.?|#)/i.test(src)) return true;
  if (/\binvoice\s*#?\s*\d{3,}/i.test(src)) return true;
  // Messy OCR: "Invoice" and "Paid"/"Subtotal" plus money, $ optional.
  if (/\binvoice\b/i.test(src) && /\b(paid|subtotal|amount due|total due|balance due)\b/i.test(src) && /\d+\.\d{2}/.test(src)) return true;
  const money = src.match(/\$\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})/g) || [];
  if (money.length >= 2 && /\b(subtotal|amount due|balance due|sales tax|total due|\bpaid\b)/i.test(src)) return true;
  return false;
}

export function lifestyleHasFields(life) {
  if (!life || typeof life !== 'object') return false;
  return ['diet', 'food_brand', 'food_product', 'food_type', 'parasite_prevention'].some((k) => {
    const v = life[k];
    return v != null && String(v).trim() !== '' && String(v).toLowerCase() !== 'null';
  });
}

/** Invoice # / totals / $ line items beat a food product on the same bill. */
export function preferInvoiceOverDiet(out) {
  if (!out || typeof out !== 'object') return out;
  const inv = Array.isArray(out.invoices) ? out.invoices.filter((row) => row && (row.total != null || row.invoice_no || (row.line_items || []).length)) : [];
  out.invoices = inv;
  if (inv.length) {
    out.lifestyle = null;
    if (!out.kind || out.kind === 'clinic_export' || out.kind === 'diet' || out.kind === 'exam_visit') out.kind = 'invoice';
  } else if (!lifestyleHasFields(out.lifestyle)) {
    out.lifestyle = null;
  }
  return out;
}

export function classifyInvoiceCategory(desc) {
  const s = String(desc || '').toLowerCase();
  if (/\b(rabies|fvrcp|felv|vaccine|vaccin|purevax|bordetella|dhpp|lepto|booster)\b/.test(s)) return 'vaccines';
  if (/\b(lab|idexx|cbc|chemistry|fecal|urinalys|t4|blood|snap|pcr|panel|radiograph|x-?ray)\b/.test(s)) return 'labs';
  if (/\b(sx|surg|spay|neuter|dental|anesthes|mass remov)\b/.test(s)) return 'surgery';
  if (/\b(board|hospitaliz|kennel)\b/.test(s)) return 'boarding';
  if (/\b(rx|medicat|antibiotic|prescription|tablet|capsule|convenia|onsior|rimadyl|pain|inj)\b/.test(s)) return 'meds';
  if (/\b(exam|office visit|consultation|wellness|office call|physical|office|emergency examination)\b/.test(s)) return 'exam';
  return 'other';
}

function parseMoney(s) {
  const n = parseFloat(String(s || '').replace(/[$,]/g, '').trim());
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function labeledMoney(text, re) {
  const m = String(text || '').match(re);
  return m ? parseMoney(m[1]) : null;
}

function isMoneyToken(tok) {
  const raw = String(tok || '').trim();
  if (!raw) return false;
  const hadDollar = raw.startsWith('$');
  const t = raw.replace(/^\$/, '').replace(/,/g, '');
  if (/^-?\d+\.\d{2}$/.test(t)) return true;
  if (hadDollar && /^-?\d+$/.test(t)) return true;
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d{2})?$/.test(raw.replace(/^\$/, ''))) return true;
  return false;
}

function isQtyToken(tok) {
  const t = String(tok || '').replace(/,/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(t)) return false;
  const n = parseFloat(t);
  return n > 0 && n <= 48;
}

const INVOICE_SECTION_HEADERS = [
  { re: /^general\s+services\s*$/i, label: 'General Services' },
  { re: /^diagnostics\s*$/i, label: 'Diagnostics' },
  { re: /^external\s+labs?\s*$/i, label: 'External Labs' },
  { re: /^medications?\s*$/i, label: 'Medications' },
  { re: /^tasks?\s*$/i, label: 'Tasks' },
  { re: /^inventory\s*$/i, label: 'Inventory' },
  { re: /^procedures?\s*$/i, label: 'Procedures' },
];

const INVOICE_TOTALS_LINE =
  /^(?:grand\s+)?total(?:\s+due)?$|^subtotal$|^discount$|^(?:sales\s*)?tax$|^payments?$|^payment\s+total$|^refund\s+due$|^balance(?:\s+due)?$|^amount\s+due$|^change\s+due$/i;

const INVOICE_TABLE_HEADER = /^(?:order|description|qty|quantity|cost|unit(?:\s*cost)?|adj(?:ustment)?|total|amount|#)\b/i;

const PAY_METHODS =
  /\b(american express|amex|mastercard|visa|discover|carecredit|apple pay|google pay|debit|credit card|cash|check)\b/i;

function collectLineMoney(text, label) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const m = t.match(label);
    if (!m || (m.index ?? 0) !== 0) continue;
    const rest = t.slice(m[0].length).trim();
    const money = rest.match(/\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})\s*$/);
    if (!money) continue;
    const n = parseMoney(money[1]);
    if (n != null) out.push(n);
  }
  return out;
}

function lineMoneyLast(text, label) {
  const all = collectLineMoney(text, label);
  return all.length ? all[all.length - 1] : null;
}

function pickInvoiceTotal(totals, sub, discount, tax, refund) {
  if (!totals.length) return null;
  const expected = sub != null ? Math.round(((sub || 0) - (discount || 0) + (tax || 0)) * 100) / 100 : null;
  const notRefund = totals.filter((n) => refund == null || Math.abs(n - refund) > 0.02);
  const pool = notRefund.length ? notRefund : totals;
  if (expected != null) {
    const hit = pool.find((n) => Math.abs(n - expected) <= 0.02);
    if (hit != null) return hit;
  }
  return Math.max(...pool);
}

function pickInvoiceTax(taxes) {
  if (!taxes.length) return null;
  const nonzero = taxes.filter((n) => n !== 0);
  return nonzero.length ? nonzero[nonzero.length - 1] : taxes[taxes.length - 1];
}

function maskReferringBlocks(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (PASSING_CLINIC_LINE.test(lines[i])) {
      out.push('');
      if (i + 1 < lines.length) {
        out.push('');
        i += 1;
      }
      continue;
    }
    out.push(lines[i]);
  }
  return out.join('\n');
}

export function detectInvoiceVisitClinic(text) {
  const src = maskReferringBlocks(text);
  const vegLoc = src.match(/\bVEG\s+Chelsea\b/i);
  if (vegLoc) return 'VEG Chelsea';
  const loc = src.match(/\b(Bond\s+Vet(?:\s+Hell'?s Kitchen)?)\b/i);
  return loc ? loc[1].replace(/\s+/g, ' ').trim() : null;
}

function cleanPersonName(s) {
  return String(s || '')
    .replace(/\s*,?\s*(?:D\.?V\.?M\.?|VMD)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectReferringVet(text) {
  const src = String(text || '');
  const labeled = src.match(
    /(?:primary\s+rdvm|referring\s+(?:veterinarian|vet|dvm))\s*[:.][ \t]*(?:Dr\.?[ \t]+)?([A-Z][a-z]+(?:[ \t]+[A-Z][a-z']+){0,2})/i,
  );
  if (labeled) return cleanPersonName(labeled[1]);
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/(?:primary\s+rdvm|referring\s+(?:veterinarian|vet|dvm)|^\s*rdvm\s*$)/i.test(lines[i])) continue;
    const afterColon = lines[i].includes(':') ? lines[i].slice(lines[i].indexOf(':') + 1) : '';
    const tryLine = (s) => {
      const n = String(s || '').match(/(?:Dr\.?[ \t]+)?([A-Z][a-z]+(?:[ \t]+[A-Z][a-z']+){0,2})/);
      if (!n) return null;
      if (/primary|referring|rdvm|copy|^vet$/i.test(n[1])) return null;
      return cleanPersonName(n[1]);
    };
    const fromLabel = tryLine(afterColon);
    if (fromLabel) return fromLabel;
    if (i + 1 < lines.length) {
      const next = tryLine(lines[i + 1]);
      if (next) return next;
    }
  }
  return null;
}

export function detectTreatingVet(text) {
  const src = maskReferringBlocks(text);
  const labeled = src.match(
    /(?:^|\n)[ \t]*(?:Doctor|Veterinarian|Attending(?:[ \t]+(?:Veterinarian|DVM))?|Treating(?:[ \t]+(?:Veterinarian|DVM))?|Clinician)[ \t]*[:.][ \t]*(Dr\.?[ \t]+[A-Z][a-z]+(?:[ \t]+[A-Z][a-z']+){0,2}|[A-Z][a-z]+(?:[ \t]+[A-Z][a-z']+){0,2}[ \t]*,?[ \t]*DVM)/,
  );
  if (labeled) {
    const raw = labeled[1].replace(/\s*,?\s*DVM\b/i, '').replace(/[ \t]+/g, ' ').trim();
    return /^dr\.?\s+/i.test(raw) ? raw.replace(/^dr\.?\s+/i, 'Dr. ') : `Dr. ${raw}`;
  }
  const dr = src.match(/\bDr\.?[ \t]+([A-Z][a-z]+(?:[ \t]+[A-Z][a-z'\-]+){0,2})/);
  if (dr) return `Dr. ${dr[1].replace(/[ \t]+/g, ' ').trim()}`;
  return detectVet(src);
}

function formatPayMethod(raw, last4) {
  let m = String(raw || '').replace(/\s+/g, ' ').trim();
  if (/american\s*express|^amex$/i.test(m)) m = 'Amex';
  else m = m.replace(/\b\w/g, (c) => c.toUpperCase());
  if (last4) m = `${m} \u2026${last4}`;
  return m;
}

/** Payment method comes only from the Payments table — never guessed. */
export function parseInvoicePayments(text) {
  const src = String(text || '');
  const out = [];
  const seen = new Set();
  const lines = src.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (/^payments?\s*[:.]?\s*\$?\s*[\d,.]+$/i.test(t)) continue;
    const window = [i > 0 ? lines[i - 1].trim() : '', t, i + 1 < lines.length ? lines[i + 1].trim() : ''].join(' ');
    const methodHit = t.match(PAY_METHODS) || window.match(PAY_METHODS);
    if (!methodHit) continue;
    const dateHit = t.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/) || window.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
    const last4Hit = t.match(/(?:\.{2,}|\*{2,}|\u2026|x{2,}|ending in\s*)(\d{4})\b/i)
      || window.match(/(?:\.{2,}|\*{2,}|\u2026|x{2,}|ending in\s*)(\d{4})\b/i);
    const moneyHit = t.match(/\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d{2})|-?\d+\.\d{2})\s*$/);
    const amount = moneyHit ? parseMoney(moneyHit[1]) : null;
    if (amount == null || amount <= 0) continue;
    const date = dateHit ? toIso(dateHit[1]) : null;
    const last4 = last4Hit ? last4Hit[1] : null;
    const method = formatPayMethod(methodHit[1], last4);
    const key = `${method.toLowerCase()}|${date}|${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ method, last4, date, amount });
  }
  return out;
}

function skipInvoiceItemLine(t) {
  if (!t) return true;
  if (INVOICE_TOTALS_LINE.test(t)) return true;
  if (INVOICE_TABLE_HEADER.test(t) && t.split(/\s+/).length <= 6) return true;
  if (/^(invoice|date|due|patient|owner|page|client|visit date|invoice date|doctor|primary rdvm|referring|copy to|payment receipt)\b/i.test(t)) {
    return true;
  }
  if (PASSING_CLINIC_LINE.test(t)) return true;
  if (PAY_METHODS.test(t)) return true;
  if (/,\s*[A-Z]{2}\s+\d{5}\b/.test(t) || /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2}\b/.test(t)) return true;
  if (/^(?:grand\s+)?total\b|^subtotal\b|^discount\b|^(?:sales\s*)?tax\b|^payments?\b|^refund\b|^balance\b|^amount\s+due\b|\bsales\s*tax\b/i.test(t)) {
    return true;
  }
  return false;
}

function parseInvoiceItemRow(raw, category) {
  const t = raw.trim();
  if (!t || skipInvoiceItemLine(t)) return null;
  if (INVOICE_SECTION_HEADERS.some((s) => s.re.test(t))) return null;

  const tokens = t.split(/\s+/);
  if (!tokens.length) return null;
  const nums = [];
  while (tokens.length && isMoneyToken(tokens[tokens.length - 1])) {
    nums.unshift(tokens.pop());
    if (nums.length >= 4) break;
  }
  if (tokens.length && nums.length && nums.length < 4 && isQtyToken(tokens[tokens.length - 1])) {
    nums.unshift(tokens.pop());
  }
  const desc = tokens.join(' ').replace(/^[\-\*\d.)\s]+/, '').replace(/\s{2,}/g, ' ').trim();
  if (!desc || desc.length < 2) return null;
  if (/^(invoice|date|due|patient|owner|page|qty|quantity|#|order)\b/i.test(desc)) return null;
  if (INVOICE_TOTALS_LINE.test(desc)) return null;

  const parsed = nums.map((n) => parseMoney(n)).filter((n) => n != null);
  if (!parsed.length) return null;

  let qty = 1;
  let unit_cost = null;
  let adjustment = null;
  let total;

  if (parsed.length === 1) {
    total = parsed[0];
  } else if (parsed.length === 2) {
    if (parsed[0] > 0 && parsed[0] <= 48 && Number.isInteger(parsed[0])) {
      qty = parsed[0];
      total = parsed[1];
      unit_cost = total;
    } else {
      unit_cost = parsed[0];
      total = parsed[1];
    }
  } else if (parsed.length === 3) {
    qty = parsed[0] > 0 && parsed[0] <= 48 ? parsed[0] : 1;
    unit_cost = parsed[1];
    total = parsed[2];
  } else {
    qty = parsed[0] > 0 && parsed[0] <= 48 ? parsed[0] : 1;
    unit_cost = parsed[1];
    adjustment = parsed[2];
    total = parsed[3];
  }

  if (total <= 0) return null;
  const cat = category || classifyInvoiceCategory(desc);
  return { description: desc, qty, unit_cost, adjustment, total, amount: total, category: cat };
}

function parseInvoiceLineItems(text) {
  const items = [];
  let category = '';
  for (const raw of String(text || '').split(/\r?\n/)) {
    const t = raw.trim();
    if (!t) continue;
    const header = INVOICE_SECTION_HEADERS.find((s) => s.re.test(t));
    if (header) {
      category = header.label;
      continue;
    }
    const row = parseInvoiceItemRow(t, category);
    if (row) items.push(row);
  }
  return items;
}

function invoicePageCount(text) {
  const src = String(text || '');
  const of = src.match(/page\s+\d+\s+of\s+(\d+)/i);
  if (of) return parseInt(of[1], 10) || 1;
  const pages = src.match(/^\s*page\s+\d+/gim);
  if (pages && pages.length > 1) return pages.length;
  return 1;
}

function drugNameFromDesc(desc) {
  const cleaned = desc.replace(/\([^)]+\)/g, ' ').replace(/\s+/g, ' ').trim();
  const hit = cleaned.match(/^([A-Z][a-z]+(?:[a-z]+)?)/);
  return hit ? hit[1] : cleaned.split(/\s+/)[0];
}

function medicationsGivenFromItems(items, date) {
  const meds = items.filter((i) => /medication/i.test(i.category) || i.category === 'meds');
  const out = [];
  const seen = new Set();
  for (const m of meds) {
    const name = drugNameFromDesc(m.description);
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, description: m.description, given_on: date });
  }
  return out;
}

/** Invoice / bill block: Invoice #, $ line items, subtotal / tax / total, Paid.
 *  2-page VEG bills print a refund receipt first (At Home / $79.42) then the invoice.
 *  TOTAL is subtotal − discount + tax — never the refund. Payments[] come only from the Payments table. */
export function parseInvoice(src, fallbackDate, fallbackClinic, opts = {}) {
  const text = String(src || '');
  const forced = Boolean(opts.forced);
  if (!forced && !looksLikeInvoice(text)) return [];

  const invoice_no = (text.match(/invoice\s*(?:number|no\.?|#)\s*[:.]?\s*([A-Z0-9\-]{3,})/i) || [])[1]
    || (text.match(/#\s*(\d{3,8})\b/) || [])[1]
    || (forced ? ((text.match(/\b(\d{4,8})\b/) || [])[1] || null) : null);

  const visitDate = text.match(/(?:visit|service)\s*date\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/i);
  const service = text.match(/service\s*(?:date|on)\s*[:.]?\s*([A-Za-z0-9,/\s]+?\d{4})/i);
  const invDate = text.match(/invoice\s*date\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4})/i);
  const due = text.match(/(?:due(?:\s+date)?)\s*[:.]?\s*([A-Za-z0-9,/\s]+?\d{4})/i);
  const invoice_date = toIso((visitDate && visitDate[1]) || '')
    || toIso((service && service[1]) || '')
    || toIso((invDate && invDate[1]) || '')
    || fallbackDate
    || detectDocumentDate(text)
    || toIso((due && due[1]) || '')
    || null;
  const due_date = toIso((due && due[1]) || '') || null;

  const subtotal = lineMoneyLast(text, /^(?:subtotal)\b/i)
    ?? labeledMoney(text, /subtotal\s*[:.]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
  const discount = lineMoneyLast(text, /^(?:discount)\b/i)
    ?? labeledMoney(text, /discount\s*[:.]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
  const tax = pickInvoiceTax([
    ...collectLineMoney(text, /^(?:sales\s*)?tax\b/i),
    labeledMoney(text, /(?:sales\s*)?tax\s*[:.]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i) ?? Number.NaN,
  ].filter((n) => Number.isFinite(n)));
  const refund_due = lineMoneyLast(text, /^refund\s+due\b/i)
    ?? labeledMoney(text, /refund\s+due\s*[:.]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/i);
  const payments_total = lineMoneyLast(text, /^payments?\b/i)
    ?? labeledMoney(text, /(?:^|\n)\s*payments?\s*[:.]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/im);
  const balance = lineMoneyLast(text, /^balance(?:\s+due)?\b/i)
    ?? labeledMoney(text, /(?:^|\n)\s*balance(?:\s+due)?\s*[:.]?\s*\$?\s*([\d,]+(?:\.\d{2})?)/im);

  let sub = subtotal;
  const line_items = parseInvoiceLineItems(text);
  if (sub == null && line_items.length) {
    sub = Math.round(line_items.reduce((a, x) => a + Number(x.total || x.amount || 0), 0) * 100) / 100;
  }

  const totalHits = [
    ...collectLineMoney(text, /^(?:grand\s+)?total(?:\s+due)?\b/i),
    ...collectLineMoney(text, /^amount\s+due\b/i),
  ];
  let tot = pickInvoiceTotal(totalHits, sub, discount ?? 0, tax, refund_due);
  if (tot == null && (sub != null || tax != null || discount != null)) {
    tot = Math.round(((sub || 0) - (discount || 0) + (tax || 0)) * 100) / 100;
  }

  if (!line_items.length) {
    const money = [];
    const re = /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))|\b(\d+\.\d{2})\b/g;
    let m;
    while ((m = re.exec(text))) {
      const n = parseMoney(m[1] || m[2]);
      if (n == null || n <= 0 || n > 100000) continue;
      if (refund_due != null && Math.abs(n - refund_due) < 0.02) continue;
      money.push(n);
    }
    const unique = [];
    for (const n of money) {
      if (!unique.includes(n)) unique.push(n);
    }
    const small = unique.filter((n) => n > 0 && n < 30);
    const large = unique.filter((n) => n >= 30);
    const taxVal = tax != null ? tax : (small.length ? small[0] : null);
    if (sub == null && large.length) sub = large[0];
    if (tot == null && large.length) {
      const withTax = Math.round(((large[0] + (taxVal || 0)) * 100)) / 100;
      tot = unique.includes(withTax) ? withTax : large[large.length - 1];
    }
    if (large.length) {
      line_items.push({
        description: 'Services',
        qty: 1,
        amount: large[0],
        total: large[0],
        unit_cost: large[0],
        adjustment: null,
        category: 'exam',
      });
    }
  }

  if (sub == null && line_items.length) {
    sub = Math.round(line_items.reduce((a, x) => a + Number(x.total || x.amount || 0), 0) * 100) / 100;
  }
  if (tot == null && (sub != null || tax != null || discount != null)) {
    tot = Math.round(((sub || 0) - (discount || 0) + (tax || 0)) * 100) / 100;
  }

  const expected = Math.round(((sub || 0) - (discount || 0) + (tax || 0)) * 100) / 100;
  const needs_review = tot != null && Math.abs(tot - expected) > 0.02;
  const paid = /\bpaid\b/i.test(text) && !/\b(unpaid|not paid|balance due)\b/i.test(text);

  const issuing = detectExportingPractice(text) || fallbackClinic || null;
  const location = detectInvoiceVisitClinic(text);
  const vet = detectTreatingVet(text);
  const referring_vet = detectReferringVet(text);
  const patientHit = text.match(/(?:^|\n)\s*patient\s*[:.]?\s*([A-Za-z][^\n,]{1,40})/i);
  const patient = patientHit ? patientHit[1].replace(/\s+/g, ' ').trim() : null;

  if (!invoice_no && !line_items.length && tot == null) return [];

  const payments = parseInvoicePayments(text);
  const visit_type = /VEG|\bER\b|emergency/i.test(`${issuing || ''} ${location || ''} ${text.slice(0, 800)}`)
    ? 'ER'
    : 'in_person';
  const visit = (invoice_date || location || vet)
    ? {
        visit_type,
        clinic: location || issuing,
        vet,
        date: invoice_date,
        event_date: invoice_date,
        invoice_no: invoice_no ? String(invoice_no) : null,
      }
    : null;

  return [{
    clinic: issuing,
    issuing_clinic: issuing,
    location_clinic: location,
    referring_vet,
    vet,
    invoice_date,
    due_date,
    document_date: invoice_date,
    invoice_no: invoice_no ? String(invoice_no) : null,
    patient,
    page_count: invoicePageCount(text),
    line_items,
    subtotal: sub,
    discount: discount ?? 0,
    tax,
    total: tot,
    payments_total: payments_total ?? (payments.length ? Math.round(payments.reduce((a, p) => a + p.amount, 0) * 100) / 100 : null),
    refund_due,
    balance,
    payments,
    paid,
    needs_review,
    visit,
    medications_given: medicationsGivenFromItems(line_items, invoice_date),
    event_date: invoice_date,
    source: 'ai_extracted',
  }];
}


export const SEGMENT_TYPES = ['visit', 'vitals', 'labs', 'vaccines', 'weights', 'reminders', 'identity', 'invoice', 'narrative'];
export const TABLE_TYPES = new Set(['weights', 'reminders', 'labs', 'invoice']);

const SEGMENT_MARKERS = [
  { re: /Service on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/gi, type: 'visit', dateGroup: 1 },
  { re: /(?:^|\n)\s*Patient Information\b/gi, type: 'identity' },
  { re: /(?:^|\n)\s*Weight History\b/gi, type: 'weights' },
  { re: /(?:^|\n)\s*Reminders?\b/gi, type: 'reminders' },
  { re: /(?:^|\n)\s*Invoice\s*(?:#|No\.?|Number)/gi, type: 'invoice' },
  // IDEXX / panel tables only — not inline "Urinalysis: 1+ protein" in a visit note.
  { re: /(?:^|\n)\s*(?:IDEXX(?:\s+Reference(?:\s+Laboratories)?)?|Chemistry Panel|CBC(?:\s+with(?:\s+diff(?:erential)?)?)?)\b/gim, type: 'labs' },
];

export function classifySegment(seg) {
  const text = String(seg?.text || '');
  const head = text.slice(0, 280);
  if (looksLikeInvoice(text)) return 'invoice';
  if (/weight\s+history/i.test(head)) return 'weights';
  if (/(?:^|\n)\s*reminders?\b/i.test(head) && !/service on/i.test(head)) return 'reminders';
  if (/(?:^|\n)\s*(?:IDEXX|TEST RESULTS?|REFERENCE VALUES?|Reference Ranges?|Chemistry Panel)\b/i.test(head)) return 'labs';
  if (/patient information/i.test(head)) return 'identity';
  if (/service on/i.test(head)) return 'visit';
  if (/inventory item/i.test(head) && /purevax|fvrcp|rabies|felv/i.test(text)) return 'vaccines';
  if (/(?:^|\n)\s*(?:vaccines?|immunizations?)\b/i.test(head) && !/visit report|service on|reason:/i.test(head)) return 'vaccines';
  if (/physical exam|\bTPR\b|\bBCS\b/i.test(head) && text.length < 1800) return 'vitals';
  if (seg?.type && SEGMENT_TYPES.includes(seg.type)) return seg.type;
  if (/visit report|reason:|findings:|plan:|telehealth|online visit|\bdutch\b/i.test(head)) return 'visit';
  return 'narrative';
}

export function segment(text) {
  const src = String(text || '');
  const exporting = detectExportingPractice(src);
  // 2-page bills print Invoice # on the refund receipt AND the invoice. Parse as one document.
  if (looksLikeInvoice(src) && !/Service on\s+\d{1,2}\/\d{1,2}/i.test(src)) {
    return [{
      type: 'invoice',
      clinic: exporting,
      vet: detectTreatingVet(src),
      date: detectVisitDate(src) || detectDocumentDate(src),
      text: src,
      start: 0,
    }];
  }
  const hits = [];
  for (const marker of SEGMENT_MARKERS) {
    const re = new RegExp(marker.re.source, marker.re.flags);
    let m;
    while ((m = re.exec(src))) {
      hits.push({
        index: m.index,
        type: marker.type,
        date: marker.dateGroup ? toIso(m[marker.dateGroup]) : null,
      });
    }
  }
  hits.sort((a, b) => a.index - b.index);
  const collapsed = [];
  for (const h of hits) {
    const last = collapsed[collapsed.length - 1];
    if (last && h.index - last.index < 28) continue;
    collapsed.push(h);
  }
  if (!collapsed.length) {
    const one = {
      type: classifySegment({ text: src }),
      clinic: detectClinic(src, exporting),
      vet: detectVet(src),
      date: detectVisitDate(src),
      text: src,
      start: 0,
    };
    one.type = classifySegment(one);
    return [one];
  }
  const segs = [];
  if (collapsed[0].index > 50) {
    const pre = src.slice(0, collapsed[0].index);
    segs.push({
      type: 'identity',
      clinic: detectClinic(pre, exporting),
      vet: detectVet(pre),
      date: detectVisitDate(pre),
      text: pre,
      start: 0,
    });
  }
  for (let i = 0; i < collapsed.length; i++) {
    const h = collapsed[i];
    const end = i + 1 < collapsed.length ? collapsed[i + 1].index : src.length;
    const body = src.slice(h.index, end);
    segs.push({
      type: h.type,
      clinic: detectClinic(body, exporting),
      vet: detectVet(body),
      date: h.date || detectVisitDate(body),
      text: body,
      start: h.index,
    });
  }
  const visitBlocks = [];
  for (const s of segs) {
    s.type = classifySegment(s);
    const isVisitBoundary = s.type === 'visit' || /service on/i.test((s.text || '').slice(0, 40));
    if (isVisitBoundary) {
      s.clinic = detectClinic(s.text, exporting);
      s.vet = detectVet(s.text) || null;
      s.date = s.date || detectVisitDate(s.text);
      visitBlocks.push({ clinic: s.clinic, vet: s.vet, date: s.date, start: s.start || 0 });
    } else if (s.type === 'labs') {
      applyLabSegmentHeader(s, visitBlocks, exporting);
    } else if (visitBlocks.length) {
      const open = visitBlocks[visitBlocks.length - 1];
      if ((s.start || 0) >= (open.start || 0) && s.type !== 'weights' && s.type !== 'reminders' && s.type !== 'identity') {
        if (!s.clinic) s.clinic = open.clinic;
        if (!s.vet) s.vet = open.vet;
        if (!s.date) s.date = open.date;
      }
    }
    if (!s.clinic) s.clinic = exporting || null;
  }
  return segs;
}

export function inheritSegmentHeader(rows, seg) {
  const date = seg?.date || null;
  const clinic = seg?.clinic || null;
  const vet = normalizeVetName(seg?.vet);
  for (const l of rows.labs || []) {
    if (date && !l.collected_on) l.collected_on = date;
    if (clinic) l.clinic = clinic;
    l.vet = normalizeVetName(l.vet) || vet || null;
    l.event_date = l.event_date || l.collected_on || date || null;
  }
  for (const w of rows.weights || []) {
    if (date && !w.measured_on) w.measured_on = date;
    w.event_date = w.event_date || w.measured_on || null;
  }
  for (const v of rows.vaccinations || []) {
    if (clinic) v.clinic = clinic;
    v.vet = normalizeVetName(v.vet) || vet || null;
    if (v.next_due && !v.given && !v.administered_on && String(v.status || '').toLowerCase() !== 'overdue') {
      v.status = STATUS_CURRENT_UNKNOWN;
    }
  }
  for (const vis of rows.visits || []) {
    if (date && !vis.date) vis.date = date;
    vis.event_date = vis.event_date || vis.date || date || null;
    if (clinic) vis.clinic = clinic;
    vis.vet = normalizeVetName(vis.vet) || vet || null;
  }
  for (const e of rows.exams || []) {
    if (date && !e.visit_date) e.visit_date = date;
    e.event_date = e.event_date || e.visit_date || date || null;
    if (clinic) e.clinic = clinic;
    e.vet = normalizeVetName(e.vet) || vet || null;
  }
  for (const c of rows.conditions || []) {
    c.event_date = c.event_date || c.onset_date || date || null;
    if (!c.onset_date) c.onset_date = c.event_date || null;
  }
  return rows;
}

function emptyRows() {
  return {
    vaccinations: [],
    labs: [],
    weights: [],
    visits: [],
    exams: [],
    conditions: [],
    medications: [],
    vitals_series: [],
    owner_notes: [],
    identity: null,
    lifestyle: null,
    invoices: [],
  };
}

export function parseSegmentCode(seg) {
  const rows = emptyRows();
  const t = seg.text || '';
  const type = classifySegment(seg);
  if (type === 'invoice' || looksLikeInvoice(t)) {
    rows.invoices = parseInvoice(t, seg.date, seg.clinic);
    return inheritSegmentHeader(rows, seg);
  }
  if (type === 'weights' || /weight\s+history/i.test(t.slice(0, 80))) {
    rows.weights = parseWeightHistory(t);
  }
  if (type === 'reminders' || (/\breminders?\b/i.test(t.slice(0, 80)) && type !== 'visit')) {
    rows.vaccinations = parseReminders(t);
  }
  if (type === 'labs' || /(?:^|\n)\s*(?:IDEXX|TEST RESULTS?|REFERENCE VALUES?)/i.test(t)) {
    rows.labs = parseLabTables(t);
  }
  if (type === 'identity') {
    rows.identity = harvestIdentity(t, seg.date);
  }
  if (type === 'vaccines' || /inventory item/i.test(t)) {
    parseInventoryVaccines(t, seg.date).forEach((v) => rows.vaccinations.push(v));
  }
  if (type === 'vitals' || type === 'visit') {
    const ex = parseExam(t, seg.date, seg.clinic);
    if (ex) rows.exams.push(ex);
    parseFlowsheet(t).forEach((x) => rows.vitals_series.push(x));
  }
  const harvestTypes = new Set(['visit', 'narrative', 'identity', 'vaccines', 'labs']);
  if (harvestTypes.has(type)) {
    const harvested = harvestKnownFacts(t);
    if (type !== 'vaccines') {
      harvested.labs.forEach((l) => {
        if (!rows.labs.some((x) => String(x.analyte).toLowerCase() === String(l.analyte).toLowerCase() && String(x.value) === String(l.value))) {
          rows.labs.push(l);
        }
      });
    }
    harvested.vaccinations.forEach((v) => {
      const hasFact = v.given || v.administered_on || v.next_due || String(v.status || '').toLowerCase() === 'overdue';
      if (!hasFact) return;
      if (!rows.vaccinations.some((x) => String(x.name).toLowerCase() === String(v.name).toLowerCase() && (x.given || '') === (v.given || '') && (x.next_due || '') === (v.next_due || ''))) {
        rows.vaccinations.push(v);
      }
    });
    if (type === 'visit' || type === 'narrative') {
      harvested.weights.forEach((w) => {
        if (!rows.weights.some((x) => x.measured_on === w.measured_on && x.value === w.value)) rows.weights.push(w);
      });
      harvested.visits.forEach((v) => rows.visits.push(v));
      if (harvested.lifestyle) rows.lifestyle = harvested.lifestyle;
      if (harvested.identity) rows.identity = { ...(rows.identity || {}), ...harvested.identity };
      parseInventoryVaccines(t, seg.date).forEach((v) => {
        if (!rows.vaccinations.some((x) => String(x.name).toLowerCase() === String(v.name).toLowerCase() && (x.given || '') === (v.given || ''))) {
          rows.vaccinations.push(v);
        }
      });
      parseLabTables(t).forEach((l) => {
        if (!rows.labs.some((x) => String(x.analyte).toLowerCase() === String(l.analyte).toLowerCase() && String(x.value) === String(l.value))) {
          rows.labs.push({ ...l, collected_on: l.collected_on || seg.date });
        }
      });
      parseConditions(t, coalesceDate(seg.date)).forEach((c) => rows.conditions.push(c));
      parseMedsTable(t).forEach((m) => rows.medications.push(m));
    } else if (type === 'identity') {
      if (harvested.identity) rows.identity = { ...(rows.identity || {}), ...harvested.identity };
    }
  }
  if (type === 'visit' && !rows.visits.length) {
    rows.visits.push({
      date: seg.date,
      event_date: seg.date || null,
      clinic: seg.clinic,
      vet: seg.vet,
      reason: detectReason(t),
      findings: null,
      plan: null,
      summary: t.slice(0, 400),
    });
  }
  return inheritSegmentHeader(rows, seg);
}

function isoInText(iso, text) {
  if (!iso || !text) return false;
  const src = String(text);
  if (src.includes(iso)) return true;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return src.includes(String(iso));
  const y = m[1];
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  const slash = `${mo}/${d}/${y}`;
  const slash0 = `${String(mo).padStart(2, '0')}/${String(d).padStart(2, '0')}/${y}`;
  if (src.includes(slash) || src.includes(slash0)) return true;
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const name = months[mo - 1];
  if (name && new RegExp(`${name}\\s+${d},?\\s+${y}`, 'i').test(src)) return true;
  if (name && new RegExp(`${name.slice(0, 3)}\\.?\\s+${d},?\\s+${y}`, 'i').test(src)) return true;
  // Inferred month-end ("Rabies current through September 2026" → 2026-09-30).
  const last = new Date(Number(y), mo, 0).getDate();
  if (d === last && name && new RegExp(`\\b${name}\\s+${y}\\b`, 'i').test(src)) return true;
  if (d === last && name && new RegExp(`\\b${name.slice(0, 3)}\\.?\\s+${y}\\b`, 'i').test(src)) return true;
  return false;
}

export function numbersInText(text) {
  const src = String(text || '');
  const dates = [];
  const dateSpans = [];
  const dateRe = /\b(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/g;
  let m;
  while ((m = dateRe.exec(src))) {
    const iso = toIso(m[1]) || monthEndIso(m[1]);
    if (iso) dates.push(iso);
    dateSpans.push([m.index, m.index + m[0].length]);
  }
  const inDate = (idx) => dateSpans.some(([a, b]) => idx >= a && idx < b);
  const nums = [];
  const numRe = /\b(\d+\.\d+|\d+)\b/g;
  while ((m = numRe.exec(src))) {
    if (inDate(m.index)) continue;
    const raw = m[1];
    const start = m.index;
    const before = src.slice(Math.max(0, start - 8), start);
    if (/page\s*$/i.test(before)) continue;
    if (raw.length >= 9) continue;
    if (/^\d{4}$/.test(raw) && +raw >= 1990 && +raw <= 2035) continue;
    const n = parseFloat(raw);
    if (!Number.isFinite(n)) continue;
    if (n === 0) continue;
    nums.push(raw);
  }
  return { dates, nums };
}

function rowBlob(rows) {
  const parts = [];
  const walk = (v) => {
    if (v == null) return;
    if (typeof v === 'object') Object.values(v).forEach(walk);
    else parts.push(String(v));
  };
  walk(rows);
  return parts.join(' | ').toLowerCase();
}

export function verify(seg, rows) {
  const text = String(seg?.text || '');
  const { dates, nums } = numbersInText(text);
  const blob = rowBlob(rows);
  const missing = [];
  for (const d of dates) {
    if (blob.includes(d)) continue;
    if (isoInText(d, blob)) continue;
    missing.push({ kind: 'date', mention: d });
  }
  for (const n of nums) {
    if (blob.includes(String(n).toLowerCase())) continue;
    const f = parseFloat(n);
    if (Number.isFinite(f)) {
      const rounded = String(Math.round(f * 10) / 10);
      if (blob.includes(rounded)) continue;
    }
    missing.push({ kind: 'number', mention: n });
  }
  const ungrounded = [];
  const rejectDate = (kind, iso) => {
    if (!iso) return;
    if (isoInText(iso, text)) return;
    ungrounded.push({ kind, mention: `${kind} ${iso} not in segment` });
  };
  const rejectNum = (kind, val) => {
    if (val == null || val === '') return;
    const s = String(val);
    const found = (s.match(/\d+(?:\.\d+)?/g) || []);
    for (const n of found) {
      if (text.includes(n) || text.includes(n.replace(/\.0$/, ''))) continue;
      ungrounded.push({ kind, mention: `${kind} ${s} not in segment` });
    }
  };
  for (const l of rows.labs || []) {
    rejectNum('lab', l.value);
    rejectDate('lab_date', l.collected_on);
  }
  for (const w of rows.weights || []) {
    rejectNum('weight', w.value);
    rejectDate('weight_date', w.measured_on);
  }
  for (const v of rows.vaccinations || []) {
    rejectDate('vax_given', v.given || v.administered_on);
    rejectDate('vax_due', v.next_due);
  }
  return {
    ok: missing.length === 0 && ungrounded.length === 0,
    missing,
    ungrounded,
  };
}

export function dropUngrounded(rows, ungrounded) {
  if (!ungrounded?.length) return rows;
  const dropGiven = new Set(ungrounded.filter((u) => u.kind === 'vax_given').map((u) => u.mention));
  const out = { ...rows };
  if (dropGiven.size) {
    out.vaccinations = (rows.vaccinations || []).map((v) => {
      const iso = v.given || v.administered_on;
      if (iso && ungrounded.some((u) => u.kind === 'vax_given' && u.mention.includes(iso))) {
        return { ...v, given: null, administered_on: null, date: v.next_due ? v.date : null };
      }
      return v;
    });
  }
  out.labs = (rows.labs || []).filter((l) => !ungrounded.some((u) => u.kind === 'lab' && String(u.mention).includes(String(l.value))));
  out.weights = (rows.weights || []).filter((w) => !ungrounded.some((u) => u.kind === 'weight' && String(u.mention).includes(String(w.value))));
  return out;
}

export function mergeRowSets(parts) {
  const out = emptyRows();
  for (const p of parts) {
    if (!p) continue;
    for (const k of ['vaccinations', 'labs', 'weights', 'visits', 'exams', 'conditions', 'medications', 'vitals_series', 'owner_notes', 'invoices']) {
      if (Array.isArray(p[k])) out[k].push(...p[k]);
    }
    if (p.identity) out.identity = { ...(out.identity || {}), ...p.identity };
    if (p.lifestyle) out.lifestyle = out.lifestyle || p.lifestyle;
  }
  return out;
}

export function pipelineCode(text) {
  const segs = segment(text);
  const exporting = detectExportingPractice(text);
  const document_date = detectDocumentDate(text);
  const stats = [];
  const parts = segs.map((seg) => {
    const rows = parseSegmentCode(seg);
    const rec = reconcileVaxDates(seg.text, rows.vaccinations);
    rows.vaccinations = rec.vaccinations;
    const check = verify(seg, rows);
    const repaired = check.ungrounded.length ? dropUngrounded(rows, check.ungrounded) : rows;
    stats.push({
      type: seg.type,
      clinic: seg.clinic,
      date: seg.date,
      chars: (seg.text || '').length,
      extracted: {
        vax: (repaired.vaccinations || []).length,
        labs: (repaired.labs || []).length,
        weights: (repaired.weights || []).length,
        visits: (repaired.visits || []).length,
        invoices: (repaired.invoices || []).length,
      },
      missing: check.missing.length,
      ungrounded: check.ungrounded.length,
      mode: 'code',
    });
    repaired.mentioned_but_missing = check.missing;
    return repaired;
  });
  const merged = mergeRowSets(parts);
  const harvested = harvestKnownFacts(text);
  const header = parsePatientHeader(text);
  merged.identity = { ...header, ...(merged.identity || {}), ...(harvested.identity || {}) };
  if (harvested.lifestyle && !merged.lifestyle) merged.lifestyle = harvested.lifestyle;
  // Safety net for single-visit prose (e.g. Aurora) if a greedy split hid vaccines/labs.
  if (!merged.vaccinations.length && harvested.vaccinations.length) merged.vaccinations = harvested.vaccinations;
  if (!merged.visits.length && harvested.visits.length) merged.visits = harvested.visits;
  if (!merged.labs.length && harvested.labs.length) merged.labs = harvested.labs;
  {
    const inv = parseInvoice(text, document_date, exporting);
    if (inv.length) merged.invoices = inv;
  }
  merged.issuing_clinic = merged.invoices?.[0]?.issuing_clinic || exporting || null;
  merged.document_date = document_date || merged.identity?.document_date || null;
  if (merged.identity && !merged.identity.document_date) merged.identity.document_date = merged.document_date;
  merged.conditions = coalesceConditionOnset(merged.conditions);
  stampEventDates(merged, merged.document_date);
  const latest = latestVisit(merged.visits);
  const datedVisits = (merged.visits || []).filter((v) => v && (v.event_date || v.date));
  if (datedVisits.length <= 1) {
    inheritVisitDate(merged, latest?.event_date || latest?.date || segs[0]?.date || harvested.date);
  }
  merged.undated = itemsTrulyUndated(merged);
  merged.segment_stats = stats;
  merged.mentioned_but_missing = parts.flatMap((p) => p.mentioned_but_missing || []);
  if ((merged.invoices || []).length) {
    // Invoice row is the structure — leftover SKUs / page integers are not a gap list.
    merged.mentioned_but_missing = [];
    merged.lifestyle = null;
  } else if (!lifestyleHasFields(merged.lifestyle)) {
    merged.lifestyle = null;
  }
  preferInvoiceOverDiet(merged);
  if ((merged.invoices || []).length) {
    const inv0 = merged.invoices[0];
    merged.clinic = inv0.clinic || merged.issuing_clinic || merged.clinic;
    merged.date = inv0.invoice_date || merged.date;
    merged.document_date = inv0.document_date || inv0.invoice_date || merged.document_date;
    merged.vet = inv0.vet || merged.vet;
  } else {
    merged.date = latest?.event_date || latest?.date || harvested.date || segs[0]?.date || merged.invoices?.[0]?.invoice_date || null;
    merged.clinic = latest?.clinic || (datedVisits.length <= 1 ? (harvested.clinic || segs[0]?.clinic || merged.invoices?.[0]?.clinic || null) : null);
  }
  if (!(merged.invoices || []).length) merged.vet = latest?.vet || null;
  if (merged.identity) {
    attachDerivedAge(merged.identity, merged.document_date || latest?.event_date || latest?.date || merged.date);
  }
  stampVisitTypes(merged, text);
  return merged;
}

export const GINA_CLINIC_FIXTURE = `At Home Veterinary
Medical Chart

Patient Information
Gina  Female  Spayed  Date of Birth 6/15/2020
Microchip 981020000000001

Weight History
8/7/2026 18.48 lb
5/2/2026 18.2 lb
9/6/2023 12.1 lb

Reminders
Rabies 8/12/2026
FVRCP 11/7/2026

Service on 9/2/2026
Jonathan Leshanski DVM
Temp 101.2 F  HR 180  RR 28  BCS 8
Assessment: doing well
Plan: continue current diet

Service on 8/7/2026
Jonathan Leshanski DVM
Inventory Item PUREVAX Rabies Feline 3 year
Given 8/7/2026 lot 12345 SC over right hind
Assessment: wellness vaccines
Copy to: Bond Vet Hell's Kitchen

Service on 5/2/2026
Jonathan Leshanski DVM
weight 8.2 lb
Vomiting overnight

IDEXX Reference Laboratories
Practice: Bond Vet Hell's Kitchen
Ordered by: Bond Vet
Collected: 8/7/2026
TEST RESULT  REFERENCE RANGE
ALT 190 H 12-130
`;

export const RYAN_CLINIC_FIXTURE = `BondVet
Medical Chart
Owner: Listed Owner
Patient: Private Ryan
Age: 3 y
Species: Canine
Breed: Terrier Mix
Weight: 22.4 lb
Sex: Female (Intact)
Microchip: None listed
Allergies: None listed
Patient ID: BV-10482
DOB: 01/15/2022
January 7, 2025
Service on 1/7/2025
Wellness exam
`;

export const BONDVET_INVOICE_FIXTURE = `BondVet
Invoice #13422
Invoice date: 05/22/2026
Service date: 05/22/2026
Due: 05/23/2026
Patient: Private Ryan

Office visit / exam                         $200.00
NY sales tax                                  $2.37

Subtotal                                    $200.00
Tax                                           $2.37
Total                                       $202.37
Paid
`;

/** Real VEG #3436605 is 2 pages: refund receipt (At Home / $79.42) then the invoice. */
export const VEG_INVOICE_3436605 = `Page 1 of 2
At Home Veterinary
Payment receipt
Date: 07/25/2026
Invoice #3436605
Patient: Gina
Primary RDVM: Jonathan Leshanski, DVM
Copy to: at home veterinary

Amount due                                                $79.42
Tax                                                        $0.00
Total                                                     $79.42

Page 2 of 2
VEG | ER for Pets
VEG Chelsea
162 West 22nd Street
New York, NY 10011

Invoice #3436605
Visit date: 07/24/2026
Invoice date: 07/24/2026
Patient: Gina
Species: Feline

Primary RDVM: Jonathan Leshanski, DVM
Referring vet: Jonathan Leshanski
Copy to: at home veterinary

Doctor: Dr. Adrian Simon

ORDER
Description                          Qty     Cost      Adj     Total

General Services
Emergency Examination                1      295.00     0.00    295.00
Hospitalization                      1      385.00     0.00    385.00
IV Catheter Placement                1      125.00     0.00    125.00
IV Fluid Therapy                     1      185.00     0.00    185.00

Diagnostics
Complete Blood Count (CBC)           1       98.00     0.00     98.00
Chemistry Panel                      1      186.00     0.00    186.00
Abdominal Radiographs (3 views)      1      325.00     0.00    325.00
FeLV/FIV SNAP                        1       72.00     0.00     72.00

External Labs
Spec cPL (pancreatic lipase)         1      148.00     0.00    148.00

Medications
Dexmedetomidine 0.5 mg/mL inj        1       86.00     0.00     86.00
Methadone 10 mg/mL inj               1       64.00     0.00     64.00
Maropitant (Cerenia) 10 mg/mL inj    1       78.00     0.00     78.00

Tasks
Serial monitoring / TPR              1       95.00     0.00     95.00
Treatment / injection fee            1       45.00     0.00     45.00

Subtotal                                                 2,187.00
Discount                                                     0.00
Tax                                                         54.74
TOTAL                                                    2,241.74
Payments                                                 2,321.16
Refund due                                                  79.42
Balance                                                      0.00

Payments
Date            Method                         Amount
07/24/2026      American Express  ...4006      2,321.16
`;


