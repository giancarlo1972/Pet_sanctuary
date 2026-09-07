export function toIso(s) {
  if (!s) return null;
  const m = String(s).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) {
    const iso = String(s).match(/^(\d{4}-\d{2}-\d{2})/);
    return iso ? iso[1] : null;
  }
  const y = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
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
      next_due: toIso(m[2]),
      manufacturer: /purevax/i.test(m[1]) ? 'Boehringer Ingelheim (Purevax)' : null,
    });
  }
  return vax;
}

export function parseInventoryVaccines(blockText, serviceDate) {
  const vax = [];
  const re = /Inventory Item\s*[—\-:]?\s*(PUREVAX[^,\n]+|FVRCP[^,\n]+|FeLV[^,\n]+|Rabies[^,\n]+)/gi;
  let m;
  while ((m = re.exec(blockText))) {
    const name = m[1].replace(/\s+/g, ' ').trim();
    const site = (blockText.match(/\bSC over [^.\n]+/i) || blockText.match(/\b(SQ|SC|IM|IN)\b[^.\n]{0,40}/i) || [])[0] || null;
    vax.push({
      name,
      product: name,
      manufacturer: /purevax/i.test(name) ? 'Boehringer Ingelheim (Purevax)' : null,
      given: serviceDate,
      next_due: null,
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
  const prior = /(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(-?[\d.]+|Detected|Not detected)/g;
  return labs;
}

export function parsePatientHeader(text) {
  const head = text.slice(0, 12000);
  const dob = toIso((head.match(/(?:date of birth|DOB)\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i) || [])[1]);
  const microchip = (head.match(/microchip\s*[:.#]?\s*([0-9]{9,15})/i) || [])[1] || null;
  const species = (head.match(/species\s*[:.]?\s*(cat|dog|feline|canine)/i) || [])[1] || null;
  const sexLine = (head.match(/sex\s*[:.]?\s*([^\n]{0,40})/i) || [])[1] || '';
  const spayed = /spay|neuter|castrat/i.test(sexLine) || /spayed|neutered/i.test(head.slice(0, 8000));
  const sex = /female/i.test(sexLine) ? 'female' : /male/i.test(sexLine) ? 'male' : null;
  const bcs = parseInt((head.match(/BCS\s*[:.]?\s*(\d(?:\.\d)?|\d\s*[–-]\s*\d)/i) || [])[1], 10);
  return {
    date_of_birth: dob,
    microchip,
    species,
    sex,
    spayed_neutered: spayed,
    bcs: Number.isFinite(bcs) ? bcs : null,
  };
}

export function parseConditions(text) {
  const out = [];
  if (/BCS\s*[89]|obese|overweight/i.test(text)) {
    out.push({ name: 'Obese (BCS 8–9)', kind: 'condition', status: 'active', notes: 'BCS 8–9' });
  }
  if (/not jumping normally|musculoskeletal|lameness/i.test(text)) {
    out.push({ name: 'Musculoskeletal — not jumping normally', kind: 'condition', status: 'monitoring' });
  }
  if (/Strongid|pyrantel|deworm/i.test(text)) {
    out.push({ name: 'Strongid T deworming', kind: 'medication', status: 'monitoring', notes: 'repeat as directed' });
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
  };
  const systems = EXAM_SYSTEMS.map((name) => {
    const key = name.split(/[- ]/)[0];
    const re = new RegExp(`${key}[^\\n]{0,140}(NSF|WNL|normal|abnormal|enlarged|inflamed|unremarkable)`, 'i');
    const m = slice.match(re);
    if (!m) return { name, status: 'normal', note: null };
    const status = /abnormal|enlarged|inflamed/i.test(m[1]) ? 'abnormal' : 'normal';
    return { name, status, note: m[0].slice(0, 180) };
  });
  const has = vitals.bcs || vitals.temp_f || vitals.hr || /physical exam|PE:|BCS/i.test(slice);
  if (!has) return null;
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

