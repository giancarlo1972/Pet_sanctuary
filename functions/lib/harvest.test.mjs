import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AURORA_VISIT_FIXTURE,
  GINA_CLINIC_FIXTURE,
  harvestKnownFacts,
  inheritVisitDate,
  itemsTrulyUndated,
  monthEndIso,
  dobFromAge,
  segment,
  classifySegment,
  parseSegmentCode,
  pipelineCode,
  verify,
  detectVet,
  normalizeVetName,
  isValidVetName,
  parseReminders,
  parseInventoryVaccines,
  STATUS_CURRENT_UNKNOWN,
  detectExportingPractice,
  detectProviderOverride,
} from './clinic-export.js';

describe('Aurora visit harvest', () => {
  const raw = harvestKnownFacts(AURORA_VISIT_FIXTURE);
  inheritVisitDate(raw, raw.date);
  const undated = itemsTrulyUndated(raw);

  it('extracts ≥3 labs including creatinine, BUN, T4, protein', () => {
    assert.ok(raw.labs.length >= 3, `labs=${raw.labs.length} ${raw.labs.map((l) => l.analyte).join(',')}`);
    const names = raw.labs.map((l) => String(l.analyte).toLowerCase());
    assert.ok(names.some((n) => n.includes('creatinine')));
    assert.ok(names.some((n) => n === 'bun'));
    assert.ok(names.some((n) => n === 't4'));
    assert.ok(names.some((n) => n.includes('protein')));
    assert.ok(raw.labs.every((l) => l.collected_on === '2026-09-02'), JSON.stringify(raw.labs));
  });

  it('extracts Rabies current + FVRCP overdue without dropping undated vaccines', () => {
    assert.equal(raw.vaccinations.length, 2, JSON.stringify(raw.vaccinations));
    const rabies = raw.vaccinations.find((v) => /rabies/i.test(v.name));
    const fvrcp = raw.vaccinations.find((v) => /fvrcp/i.test(v.name));
    assert.ok(rabies);
    assert.equal(rabies.status, STATUS_CURRENT_UNKNOWN);
    assert.equal(rabies.next_due, '2026-09-30');
    assert.equal(rabies.given, null);
    assert.ok(fvrcp);
    assert.equal(fvrcp.status, 'overdue');
    assert.match(String(fvrcp.notes), /missed/i);
  });

  it('treats the report as a visit', () => {
    assert.equal(raw.visits.length, 1);
    assert.equal(raw.visits[0].date, '2026-09-02');
    assert.match(String(raw.visits[0].clinic), /Bond Vet/i);
    assert.match(String(raw.visits[0].reason), /vomiting/i);
    assert.match(String(raw.visits[0].plan || ''), /vaccination|fecal/i);
  });

  it('extracts diet for the Food card', () => {
    assert.ok(raw.lifestyle);
    assert.match(String(raw.lifestyle.food_brand), /Purina/i);
    assert.match(String(raw.lifestyle.food_product), /Pro Plan/i);
    assert.equal(raw.lifestyle.food_type, 'dry');
    assert.match(String(raw.lifestyle.parasite_prevention), /none/i);
    assert.equal(raw.lifestyle.source, 'ai_extracted');
  });

  it('suggests DOB from age 1.2 y', () => {
    assert.ok(raw.identity?.date_of_birth);
    assert.equal(raw.identity.date_of_birth, dobFromAge(1.2, '2026-09-02'));
    assert.equal(raw.identity.date_of_birth_estimated, true);
  });

  it('has 0 undated items', () => {
    assert.equal(undated.length, 0, JSON.stringify(undated));
  });
});

describe('monthEndIso', () => {
  it('maps September 2026 to the last day', () => {
    assert.equal(monthEndIso('September 2026'), '2026-09-30');
  });
});

describe('pipelineCode — Sep 2 2026 Aurora fixture', () => {
  const segs = segment(AURORA_VISIT_FIXTURE);
  const out = pipelineCode(AURORA_VISIT_FIXTURE);
  inheritVisitDate(out, out.date);

  it('keeps the visit as one segment (does not split on Urinalysis prose)', () => {
    assert.equal(segs.length, 1, segs.map((s) => s.type).join(','));
    assert.equal(segs[0].type, 'visit');
  });

  it('segments the visit instead of one blob', () => {
    assert.ok(out.segment_stats?.length >= 1, JSON.stringify(out.segment_stats));
  });

  it('acceptance: ≥3 labs, 2 vaccines, 1 visit, diet, 0 undated', () => {
    assert.ok(out.labs.length >= 3, `labs=${out.labs.length}`);
    const names = out.labs.map((l) => String(l.analyte).toLowerCase());
    assert.ok(names.some((n) => n.includes('creatinine')));
    assert.ok(names.some((n) => n === 'bun'));
    assert.ok(names.some((n) => n === 't4'));
    assert.ok(names.some((n) => n.includes('protein')));
    const rabies = out.vaccinations.find((v) => /rabies/i.test(v.name));
    const fvrcp = out.vaccinations.find((v) => /fvrcp/i.test(v.name));
    assert.ok(rabies, JSON.stringify(out.vaccinations));
    assert.equal(rabies.next_due, '2026-09-30');
    assert.equal(rabies.given, null);
    assert.equal(rabies.status, STATUS_CURRENT_UNKNOWN);
    assert.ok(fvrcp);
    assert.equal(fvrcp.status, 'overdue');
    assert.equal(out.visits.length, 1);
    assert.equal(out.visits[0].date, '2026-09-02');
    assert.match(String(out.visits[0].clinic), /Bond Vet/i);
    assert.match(String(out.lifestyle?.food_brand), /Purina/i);
    assert.equal(itemsTrulyUndated(out).length, 0);
  });

  it('verify grounds Rabies next_due month-end from "September 2026"', () => {
    const rows = parseSegmentCode(segs[0]);
    const check = verify(segs[0], rows);
    assert.equal(check.ungrounded.filter((u) => u.kind === 'vax_due').length, 0, JSON.stringify(check.ungrounded));
  });
});

describe('pipeline — Gina clinic export fixture', () => {
  const segs = segment(GINA_CLINIC_FIXTURE);
  const out = pipelineCode(GINA_CLINIC_FIXTURE);

  it('splits Patient Information, Weight History, Reminders, each Service on, and IDEXX', () => {
    const types = segs.map((s) => s.type);
    assert.ok(types.includes('identity'), types.join(','));
    assert.ok(types.includes('weights'), types.join(','));
    assert.ok(types.includes('reminders'), types.join(','));
    assert.ok(types.includes('labs'), types.join(','));
    assert.equal(segs.filter((s) => s.type === 'visit').length, 3, types.join(','));
  });

  it('does not leak BondVet into At Home — every Service on is the exporting practice', () => {
    const visits = segs.filter((s) => s.type === 'visit');
    assert.equal(visits.length, 3, JSON.stringify(segs.map((s) => ({ type: s.type, clinic: s.clinic, date: s.date }))));
    for (const v of visits) {
      assert.match(String(v.clinic), /At Home/i);
      assert.doesNotMatch(String(v.clinic || ''), /Bond/i);
    }
    assert.equal(detectExportingPractice(GINA_CLINIC_FIXTURE), 'At Home Veterinary');
    const sep2 = segs.find((s) => s.type === 'visit' && s.date === '2026-09-02');
    assert.ok(sep2);
    assert.match(String(sep2.clinic), /At Home/i);
    assert.match(String(sep2.vet), /Leshanski/i);
  });

  it('parses Weight History in code (3 points, latest 18.48)', () => {
    const wseg = segs.find((s) => s.type === 'weights');
    const rows = parseSegmentCode(wseg);
    assert.ok(rows.weights.length >= 3, JSON.stringify(rows.weights));
    const latest = rows.weights.slice().sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on)))[0];
    assert.equal(latest.value, 18.48);
    assert.equal(latest.measured_on, '2026-08-07');
  });

  it('8/7 is At Home Veterinary · PUREVAX Rabies given · ALT 190', () => {
    const v87 = out.visits.find((v) => v.date === '2026-08-07');
    assert.ok(v87, JSON.stringify(out.visits));
    assert.match(String(v87.clinic), /At Home/i);
    assert.doesNotMatch(String(v87.clinic || ''), /Bond/i);
    const rabies = out.vaccinations.find((v) => /rabies/i.test(v.name) && (v.given === '2026-08-07' || v.administered_on === '2026-08-07'));
    assert.ok(rabies, JSON.stringify(out.vaccinations));
    assert.match(String(rabies.clinic), /At Home/i);
    assert.doesNotMatch(String(rabies.clinic || ''), /Bond/i);
    const alt = out.labs.find((l) => String(l.analyte).toUpperCase() === 'ALT');
    assert.ok(alt, JSON.stringify(out.labs));
    assert.equal(String(alt.value), '190');
    assert.equal(alt.collected_on, '2026-08-07');
    assert.match(String(alt.clinic), /At Home/i);
    assert.doesNotMatch(String(alt.clinic || ''), /Bond/i);
  });

  it('latest visit is At Home Veterinary · 2026-09-02 with Leshanski', () => {
    const latest = out.visits.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    assert.ok(latest);
    assert.equal(latest.date, '2026-09-02');
    assert.match(String(latest.clinic), /At Home/i);
    assert.match(String(latest.vet), /Leshanski/i);
    assert.doesNotMatch(String(latest.clinic), /Bond/i);
    assert.equal(out.date, '2026-09-02');
    assert.match(String(out.clinic), /At Home/i);
    assert.match(String(out.vet), /Leshanski/i);
  });

  it('IDEXX Practice/Ordered by Bond is a passing mention, not the lab clinic', () => {
    const labSeg = segs.find((s) => s.type === 'labs');
    assert.ok(labSeg, JSON.stringify(segs.map((s) => s.type)));
    assert.match(String(labSeg.clinic), /At Home/i);
    assert.doesNotMatch(String(labSeg.clinic || ''), /Bond/i);
    assert.equal(labSeg.date, '2026-08-07');
  });

  it('verify rejects a Rabies given date that is not in the visit segment', () => {
    const visit = segs.find((s) => s.type === 'visit' && s.date === '2026-08-07');
    const bad = verify(visit, { vaccinations: [{ name: 'Rabies', given: '2026-08-12', administered_on: '2026-08-12' }], labs: [], weights: [] });
    assert.ok(bad.ungrounded.length >= 1, JSON.stringify(bad));
  });

  it('copy-to / Practice Bond never set clinic; Provider:/Seen at: does', () => {
    const text = `At Home Veterinary
Medical Chart

Service on 8/7/2026
Jonathan Leshanski DVM
Inventory Item PUREVAX Rabies Feline 3 year
Given 8/7/2026
Copy to: Bond Vet Hell's Kitchen

Service on 9/2/2026
Jonathan Leshanski DVM
Assessment: doing well

IDEXX Reference Laboratories
Practice: Bond Vet Hell's Kitchen
Ordered by: Bond Vet
Collected: 8/7/2026
TEST RESULT  REFERENCE RANGE
ALT 190 H 12-130
`;
    const lab = segment(text).find((s) => s.type === 'labs');
    assert.ok(lab);
    assert.match(String(lab.clinic), /At Home/i);
    assert.doesNotMatch(String(lab.clinic || ''), /Bond/i);
    assert.equal(lab.date, '2026-08-07');
    const out2 = pipelineCode(text);
    const alt = out2.labs.find((l) => String(l.analyte).toUpperCase() === 'ALT');
    assert.ok(alt);
    assert.match(String(alt.clinic), /At Home/i);
    assert.doesNotMatch(String(alt.clinic || ''), /Bond/i);
    assert.equal(alt.collected_on, '2026-08-07');
    const v87 = out2.visits.find((v) => v.date === '2026-08-07');
    assert.match(String(v87?.clinic), /At Home/i);

    const seen = `At Home Veterinary
Medical Chart
Service on 8/7/2026
Seen at: VEG Chelsea
Inventory Item PUREVAX Rabies Feline 3 year
Given 8/7/2026
`;
    assert.equal(detectProviderOverride(seen), 'VEG Chelsea');
    const vis = segment(seen).find((s) => s.type === 'visit');
    assert.match(String(vis.clinic), /VEG Chelsea/i);
    const provider = `At Home Veterinary
Medical Chart
Service on 8/7/2026
Provider: Banfield
Assessment: wellness
`;
    assert.match(String(segment(provider).find((s) => s.type === 'visit').clinic), /Banfield/i);
  });

  it('Reminders table is next_due only; inventory given is 8/7', () => {
    const reminderSeg = segs.find((s) => s.type === 'reminders');
    const reminderRows = parseSegmentCode(reminderSeg).vaccinations;
    assert.ok(reminderRows.length >= 2, JSON.stringify(reminderRows));
    for (const v of reminderRows) {
      assert.equal(v.given, null, JSON.stringify(v));
      assert.equal(v.administered_on, null);
      assert.ok(v.next_due, JSON.stringify(v));
      assert.equal(v.status, STATUS_CURRENT_UNKNOWN);
    }
    const rabiesDue = reminderRows.find((v) => /rabies/i.test(v.name));
    assert.equal(rabiesDue.next_due, '2026-08-12');
    const given = out.vaccinations.find((v) => /rabies/i.test(v.name) && (v.given === '2026-08-07' || v.administered_on === '2026-08-07'));
    assert.ok(given, JSON.stringify(out.vaccinations));
    assert.equal(given.status, 'given');
    const dueOnly = out.vaccinations.find((v) => /rabies/i.test(v.name) && v.next_due === '2026-08-12');
    assert.ok(dueOnly, JSON.stringify(out.vaccinations));
    assert.equal(dueOnly.given, null);
    assert.equal(dueOnly.administered_on, null);
    assert.equal(dueOnly.status, STATUS_CURRENT_UNKNOWN);
  });
});

describe('vet-name extraction', () => {
  it('accepts Jonathan Leshanski DVM and Dr. Jonathan Leshanski', () => {
    assert.equal(normalizeVetName('Jonathan Leshanski DVM'), 'Jonathan Leshanski DVM');
    assert.equal(normalizeVetName('Dr. Jonathan Leshanski'), 'Dr. Jonathan Leshanski');
    assert.equal(isValidVetName('Dr Jonathan Leshanski, DVM'), true);
    assert.equal(detectVet('Jonathan Leshanski DVM'), 'Jonathan Leshanski DVM');
    assert.equal(detectVet('Dr. Jonathan Leshanski'), 'Dr. Jonathan Leshanski');
  });

  it('rejects clinic-name words and the Veterinary-prefixed leak', () => {
    assert.equal(normalizeVetName('Veterinary Jonathan Leshanski DVM'), null);
    assert.equal(normalizeVetName('Bond Vet'), null);
    assert.equal(normalizeVetName('At Home Veterinary'), null);
    assert.equal(normalizeVetName('Veterinary'), null);
    assert.equal(normalizeVetName('Animal Care Center'), null);
    assert.equal(normalizeVetName('Emergency Clinic'), null);
    assert.equal(detectVet("Bond Vet Hell's Kitchen"), null);
  });

  it('drops Veterinary from a newline-split At Home block', () => {
    const block = `Service on 9/2/2026
At Home Veterinary
Jonathan Leshanski DVM
Temp 101.2 F`;
    assert.equal(detectVet(block), 'Jonathan Leshanski DVM');
    assert.doesNotMatch(detectVet(block) || '', /Veterinary/i);
    const prefixed = detectVet('Veterinary Jonathan Leshanski DVM');
    assert.equal(prefixed, 'Jonathan Leshanski DVM');
  });
});

describe('given vs due', () => {
  it('parseReminders never sets administered_on', () => {
    const rows = parseReminders('Reminders\nRabies 8/12/2026\nFVRCP 11/7/2026');
    assert.equal(rows.length, 2);
    for (const v of rows) {
      assert.equal(v.given, null);
      assert.equal(v.administered_on, null);
      assert.ok(v.next_due);
      assert.equal(v.status, STATUS_CURRENT_UNKNOWN);
    }
  });

  it('inventory given only from Service on + Inventory Item', () => {
    const given = parseInventoryVaccines(
      `Service on 8/7/2026\nAt Home Veterinary\nInventory Item PUREVAX Rabies Feline 3 year\nGiven 8/7/2026`,
      '2026-08-07',
    );
    assert.equal(given.length, 1);
    assert.match(given[0].name, /PUREVAX Rabies/i);
    assert.equal(given[0].given, '2026-08-07');
    assert.equal(given[0].administered_on, '2026-08-07');
    assert.equal(given[0].status, 'given');
    const noService = parseInventoryVaccines('Inventory Item PUREVAX Rabies Feline 3 year', '2026-08-07');
    assert.equal(noService.length, 0);
    const noItem = parseInventoryVaccines('Service on 8/7/2026\nPUREVAX Rabies Feline 3 year', '2026-08-07');
    assert.equal(noItem.length, 0);
  });
});
