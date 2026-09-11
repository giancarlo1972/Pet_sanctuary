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
  const harvested = harvestKnownFacts(text);
  for (const l of harvested.labs) {
    if (!labs.some((x) => String(x.analyte).toLowerCase() === String(l.analyte).toLowerCase() && String(x.value) === String(l.value))) {
      labs.push(l);
    }
  }
  return labs;
}

export function parsePatientHeader(text) {
  const head = text.slice(0, 12000);
  const dobLine = (head.split(/\r?\n/).find((l) => /date of birth|\bDOB\b/i.test(l)) || '');
  const dob = toIso((dobLine.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/) || [])[1]);
  const microchip = (head.match(/microchip\s*[:.#]?\s*([0-9]{9,15})/i) || [])[1] || null;
  const species = (head.match(/species\s*[:.]?\s*(cat|dog|feline|canine)/i) || [])[1] || null;
  const sexLine = (head.match(/sex\s*[:.]?\s*([^\n]{0,40})/i) || [])[1] || '';
  const spayed = /spay|neuter|castrat/i.test(sexLine) || /spayed|neutered/i.test(head.slice(0, 8000));
  const sex = /female/i.test(sexLine) ? 'female' : /male/i.test(sexLine) ? 'male' : null;
  const bcsMatch = head.match(/BCS\s*[:.]?\s*(\d(?:\.\d)?)\s*(?:[–\-]\s*\d)?/i);
  const bcs = bcsMatch ? parseInt(bcsMatch[1], 10) : NaN;
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
    const current = /current|up[- ]to[- ]date/i.test(line);
    const dueish = /due|expires|valid thru|through|thru|next|reminder|current/i.test(line);
    const given = missed || (dueish && dates.length < 2 && !/given|administ/i.test(line)) ? null : (dates[0] || null);
    const next_due = monthEndIso(through?.[1]) || dates[1] || (dueish && !given ? (dates[0] || monthEndIso(through?.[1])) : null);
    pushVax({
      name: m[1].replace(/\s+/g, ' ').trim(),
      product: m[1].replace(/\s+/g, ' ').trim(),
      brand: /purevax/i.test(line) ? 'PUREVAX' : null,
      lot: (line.match(/\blot\s*[:#]?\s*([A-Z0-9-]+)/i) || [])[1] || null,
      given,
      next_due,
      site: (line.match(/\b(SC|SQ|IM|IN)\b[^,\n]{0,40}/i) || [])[0] || null,
      status: missed ? 'overdue' : (current || (next_due && !given) ? 'current' : (given ? 'given' : null)),
      notes: missed ? line.trim().slice(0, 160) : (current ? line.trim().slice(0, 160) : null),
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
      status: 'current',
      notes: (through?.[0] || 'Rabies current').replace(/\s+/g, ' ').trim().slice(0, 160),
    });
  }

  const wRe = /(\d{1,2}\/\d{1,2}\/\d{2,4})?[^\n]{0,12}\b(\d{1,2}(?:\.\d{1,2})?)\s*(lb|lbs|kg)\b/gi;
  while ((m = wRe.exec(src.slice(0, 12000)))) {
    const n = parseFloat(m[2]);
    if (n < 1 || n > 200) continue;
    weights.push({ value: n, unit: (m[3] || 'lb').toLowerCase().startsWith('kg') ? 'kg' : 'lb', measured_on: toIso(m[1]) });
  }

  const visitDate = detectVisitDate(src);
  const clinic = detectClinic(src);
  const vets = [];
  const vetRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\s*,?\s*(DVM|VMD)\b/g;
  let vm;
  while ((vm = vetRe.exec(src.slice(0, 8000)))) vets.push(`${vm[1]} ${vm[2]}`);
  const dr = src.match(/\bDr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
  if (dr) vets.push(`Dr. ${dr[1]}`);
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
      clinic,
      vet: vets[0] || null,
      vets,
      reason,
      findings,
      plan,
      summary: [reason, findings, plan].filter(Boolean).join(' · ') || null,
    });
  }

  const lifestyle = harvestLifestyle(src);
  const identity = harvestIdentity(src, visitDate);

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
  const head = String(src || '').slice(0, 2500);
  const labeled = head.match(/(?:service on|visit date|exam date|date of (?:visit|exam|service)|date)\s*[:.]?\s*(\d{1,2}\/\d{1,2}\/\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/i);
  if (labeled) return toIso(labeled[1]) || monthEndIso(labeled[1]);
  const named = head.match(/\b([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})\b/);
  if (named) return toIso(named[1]);
  const slash = head.match(/\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/);
  return slash ? toIso(slash[1]) : null;
}

export function detectClinic(src) {
  const labeled = String(src || '').match(/clinic\s*[:.]\s*([^\n]{3,60})/i);
  if (labeled) return labeled[1].replace(/\s+/g, ' ').trim();
  const known = String(src || '').match(/\b(Bond Vet(?:\s+Hell'?s Kitchen)?|VEG(?:\s+Chelsea)?|VCA[^\n,]{0,30}|Banfield|BluePearl|ASPCA|Animal Medical|At[- ]home(?:\s+veterinary)?)\b/i);
  return known ? known[0].replace(/\s+/g, ' ').trim() : null;
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
  let age_years = null;
  if (ageHit) age_years = parseFloat(ageHit[1]);
  else if (ageMonths) age_years = parseFloat(ageMonths[1]) / 12;
  const header = parsePatientHeader(text);
  let date_of_birth = header.date_of_birth || null;
  if (!date_of_birth && age_years && asOf) date_of_birth = dobFromAge(age_years, asOf);
  return {
    ...header,
    age_years,
    date_of_birth,
    date_of_birth_estimated: Boolean(!header.date_of_birth && date_of_birth),
  };
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
  }
  for (const v of parsed.vaccinations || []) {
    const status = String(v.status || '').toLowerCase();
    if (status === 'current' || status === 'overdue') continue;
    if (!v.administered_on && !v.given && !v.next_due && /given|administ/i.test(String(v.notes || ''))) {
      v.given = visitDate;
      v.administered_on = visitDate;
    }
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
      givenish: /given|administ|inventory item|administered|service on/i.test(line),
    });
  }
  const out = (vaccinations || []).map((v) => {
    const product = String(v.product || v.name || '');
    const key = product.split(/\s+/)[0].toLowerCase();
    const hits = windows.filter((w) => w.name.toLowerCase().includes(key) || product.toLowerCase().includes(w.name.split(/\s+/)[0].toLowerCase()));
    if (!hits.length) return v;
    const givenDates = hits.filter((h) => h.givenish && !h.dueish).flatMap((h) => h.dates);
    const noteDates = hits.flatMap((h) => h.dates);
    const preferred = givenDates[0] || (hits.length === 1 && hits[0].dates.length === 1 && !hits[0].dueish ? hits[0].dates[0] : null);
    if (preferred && v.given && preferred !== v.given) {
      mismatches.push({ kind: 'vaccine_date', mention: `${product} structured ${v.given} but note has ${preferred}` });
      return { ...v, given: preferred, administered_on: preferred, date: preferred };
    }
    if (!v.given && preferred && String(v.status || '').toLowerCase() !== 'current' && String(v.status || '').toLowerCase() !== 'overdue') {
      return { ...v, given: preferred, administered_on: preferred, date: preferred };
    }
    if (v.given && noteDates.length && !noteDates.includes(v.given) && preferred) {
      mismatches.push({ kind: 'vaccine_date', mention: `${product} structured ${v.given} but note has ${noteDates.join(', ')}` });
      return { ...v, given: preferred, administered_on: preferred, date: preferred };
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
