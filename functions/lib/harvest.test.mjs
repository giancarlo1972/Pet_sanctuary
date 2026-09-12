import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AURORA_VISIT_FIXTURE,
  DUTCH_TELEHEALTH_FIXTURE,
  GINA_CLINIC_FIXTURE,
  RYAN_CLINIC_FIXTURE,
  harvestKnownFacts,
  inheritVisitDate,
  itemsTrulyUndated,
  monthEndIso,
  dobFromAge,
  ageYearsAt,
  attachDerivedAge,
  canApplyIdentityField,
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
  parsePatientHeader,
  latestVisit,
  inferVisitType,
  stampVisitTypes,
  looksLikeInvoice,
  parseInvoice,
  classifyInvoiceCategory,
  harvestLifestyle,
  lifestyleHasFields,
  BONDVET_INVOICE_FIXTURE,
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
    assert.equal(raw.identity.age_years, 1.2);
  });

  it('has 0 undated items', () => {
    assert.equal(undated.length, 0, JSON.stringify(undated));
  });
});

describe('Dutch telehealth visit', () => {
  it('stamps visit_type=telehealth and clinic Dutch', () => {
    const out = stampVisitTypes({ visits: [], document_date: '2025-03-14' }, DUTCH_TELEHEALTH_FIXTURE);
    assert.ok(out.visits.length >= 1, JSON.stringify(out.visits));
    const v = out.visits.find((x) => x.visit_type === 'telehealth') || out.visits[0];
    assert.equal(v.visit_type, 'telehealth');
    assert.match(String(v.clinic), /Dutch/i);
    assert.equal(v.date || v.event_date, '2025-03-14');
    assert.equal(inferVisitType({ clinic: 'Dutch' }, ''), 'telehealth');
  });

  it('latest visit prefers BondVet 2026 over Dutch 2025', () => {
    const visits = [
      { date: '2025-03-14', clinic: 'Dutch', visit_type: 'telehealth' },
      { date: '2025-06-01', clinic: 'InstaVet' },
      { date: '2026-09-02', clinic: "Bond Vet Hell's Kitchen" },
    ];
    const latest = latestVisit(visits);
    assert.equal(latest.date, '2026-09-02');
    assert.match(String(latest.clinic), /Bond Vet/i);
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

  it('identity: Gina Female Spayed DOB 2020-06-15, microchip kept, issuing At Home', () => {
    const ident = out.identity || {};
    assert.equal(ident.patient, 'Gina');
    assert.equal(ident.sex, 'F');
    assert.equal(ident.spayed_neutered, true);
    assert.equal(ident.date_of_birth, '2020-06-15');
    assert.equal(ident.microchip, '981020000000001');
    assert.equal(ident.age_years, 6.2);
    assert.equal(out.issuing_clinic, 'At Home Veterinary');
    assert.equal(detectExportingPractice(GINA_CLINIC_FIXTURE), 'At Home Veterinary');
    for (const v of out.visits) {
      assert.match(String(v.clinic), /At Home/i);
      assert.doesNotMatch(String(v.clinic || ''), /Bond/i);
      assert.ok(v.event_date, JSON.stringify(v));
    }
    const obese = out.conditions.find((c) => /obese/i.test(c.name));
    assert.ok(obese, JSON.stringify(out.conditions));
    assert.equal(obese.onset_date, '2026-09-02');
    const latest = latestVisit(out.visits);
    assert.equal(latest.event_date || latest.date, '2026-09-02');
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

describe('pipeline — Ryan BondVet identity header', () => {
  const out = pipelineCode(RYAN_CLINIC_FIXTURE);
  const ident = out.identity || {};
  const header = parsePatientHeader(RYAN_CLINIC_FIXTURE);

  it('issuing clinic is BondVet from the letterhead logo', () => {
    assert.equal(detectExportingPractice(RYAN_CLINIC_FIXTURE), 'BondVet');
    assert.equal(out.issuing_clinic, 'BondVet');
    assert.match(String(out.clinic), /BondVet|Bond Vet/i);
  });

  it('parses the identity block as a first-class object', () => {
    assert.equal(header.owner, 'Listed Owner');
    assert.equal(header.patient, 'Private Ryan');
    assert.equal(header.species, 'dog');
    assert.equal(header.breed, 'Terrier Mix');
    assert.equal(header.weight_lb, 22.4);
    assert.equal(header.sex, 'F');
    assert.equal(header.spayed_neutered, false);
    assert.equal(header.microchip, null);
    assert.equal(header.allergies, null);
    assert.equal(header.patient_id, 'BV-10482');
    assert.equal(header.date_of_birth, '2022-01-15');
    assert.equal(header.document_date, '2025-01-07');
    assert.equal(ident.owner, 'Listed Owner');
    assert.equal(ident.patient, 'Private Ryan');
    assert.equal(ident.sex, 'F');
    assert.equal(ident.spayed_neutered, false);
    assert.equal(ident.microchip, null);
    assert.equal(ident.patient_id, 'BV-10482');
    assert.equal(ident.date_of_birth, '2022-01-15');
    assert.equal(ident.document_date, '2025-01-07');
    assert.equal(ident.age_years, 3.0);
    assert.equal(out.document_date, '2025-01-07');
  });

  it('Female (Intact) is F + spayed false; None listed is null', () => {
    assert.equal(ident.sex, 'F');
    assert.equal(ident.spayed_neutered, false);
    assert.equal(ident.microchip, null);
    assert.equal(ident.allergies, null);
  });

  it('latest visit is BondVet · 2025-01-07 with event_date', () => {
    const latest = latestVisit(out.visits);
    assert.ok(latest, JSON.stringify(out.visits));
    assert.equal(latest.event_date || latest.date, '2025-01-07');
    assert.match(String(latest.clinic), /BondVet|Bond Vet/i);
    assert.equal(out.date, '2025-01-07');
  });

  it('a named BondVet Service block on an At Home chart is BondVet; copy-to is not', () => {
    const named = `At Home Veterinary
Medical Chart
Service on 8/7/2026
BondVet
Wellness exam
`;
    const vis = segment(named).find((s) => s.type === 'visit');
    assert.match(String(vis.clinic), /BondVet|Bond Vet/i);
    const copy = `At Home Veterinary
Medical Chart
Service on 8/7/2026
Copy to: BondVet
Wellness exam
`;
    const vis2 = segment(copy).find((s) => s.type === 'visit');
    assert.match(String(vis2.clinic), /At Home/i);
    assert.doesNotMatch(String(vis2.clinic || ''), /Bond/i);
  });
});

describe('ageYearsAt — derived at document_date, never stored', () => {
  it('Ryan DOB 2022-01-15 at 2025-01-07 is 3.0', () => {
    assert.equal(ageYearsAt('2022-01-15', '2025-01-07'), 3.0);
  });

  it('one-decimal example 3.6 (DOB 2021-06-07 at 2025-01-07)', () => {
    assert.equal(ageYearsAt('2021-06-07', '2025-01-07'), 3.6);
  });

  it('Gina DOB 2020-06-15 at latest visit 2026-09-02 is 6.2', () => {
    assert.equal(ageYearsAt('2020-06-15', '2026-09-02'), 6.2);
  });

  it('null when DOB missing; never invents today', () => {
    assert.equal(ageYearsAt(null, '2025-01-07'), null);
    assert.equal(ageYearsAt('2022-01-15', null), null);
  });

  it('attachDerivedAge uses document_date over fallback', () => {
    const ident = attachDerivedAge(
      { date_of_birth: '2022-01-15', document_date: '2025-01-07' },
      '2026-09-02',
    );
    assert.equal(ident.age_years, 3.0);
  });
});

describe('canApplyIdentityField — owner-entered always wins', () => {
  it('writes when current is null', () => {
    assert.equal(canApplyIdentityField(null, null), true);
    assert.equal(canApplyIdentityField('', null), true);
    assert.equal(canApplyIdentityField(null, 'owner'), true);
  });

  it('blocks when value exists and source is owner or unknown', () => {
    assert.equal(canApplyIdentityField('2020-06-15', 'owner'), false);
    assert.equal(canApplyIdentityField('2020-06-15', null), false);
    assert.equal(canApplyIdentityField('female', undefined), false);
    assert.equal(canApplyIdentityField(false, 'owner'), false);
  });

  it('allows overwrite of prior AI/clinic extract', () => {
    assert.equal(canApplyIdentityField('2020-06-15', 'ai_extracted'), true);
    assert.equal(canApplyIdentityField('female', 'clinic'), true);
    assert.equal(canApplyIdentityField(true, 'ai_extracted'), true);
  });
});

describe('pipeline — BondVet invoice #13422', () => {
  const out = pipelineCode(BONDVET_INVOICE_FIXTURE);
  const inv = (out.invoices || [])[0];

  it('classifies the document as invoice, not visit/narrative', () => {
    assert.equal(looksLikeInvoice(BONDVET_INVOICE_FIXTURE), true);
    assert.equal(classifySegment({ text: BONDVET_INVOICE_FIXTURE }), 'invoice');
    const types = segment(BONDVET_INVOICE_FIXTURE).map((s) => s.type);
    assert.ok(types.includes('invoice'), JSON.stringify(types));
    assert.ok(!types.includes('visit'), JSON.stringify(types));
  });

  it('extracts invoice #13422, BondVet, 2026-05-22, $200 exam, tax 2.37, total 202.37, paid', () => {
    assert.ok(inv, JSON.stringify(out.invoices));
    assert.equal(inv.invoice_no, '13422');
    assert.match(String(inv.clinic), /BondVet|Bond Vet/i);
    assert.equal(inv.invoice_date, '2026-05-22');
    assert.equal(inv.subtotal, 200);
    assert.equal(inv.tax, 2.37);
    assert.equal(inv.total, 202.37);
    assert.equal(inv.paid, true);
    const exam = (inv.line_items || []).find((l) => l.amount === 200);
    assert.ok(exam, JSON.stringify(inv.line_items));
    assert.equal(classifyInvoiceCategory(exam.description), 'exam');
    assert.equal(out.issuing_clinic, 'BondVet');
  });

  it('does not dump dates and amounts into mentioned_but_missing', () => {
    const missing = out.mentioned_but_missing || [];
    assert.equal(missing.length, 0, JSON.stringify(missing));
    assert.equal((out.vaccinations || []).length, 0);
    assert.equal((out.labs || []).length, 0);
  });

  it('SKU-like integers from a 2-page bill do not become a numbers wall', () => {
    const messy = `${BONDVET_INVOICE_FIXTURE}
610 10019 917 443 2152 10128 646 688 3087
date: 2026-05-23
number: 5
number: 23
number: 52
`;
    const messyOut = pipelineCode(messy);
    assert.equal((messyOut.invoices || [])[0]?.invoice_no, '13422');
    assert.equal((messyOut.invoices || [])[0]?.total, 202.37);
    assert.equal((messyOut.mentioned_but_missing || []).length, 0, JSON.stringify(messyOut.mentioned_but_missing));
  });

  it('clinic charts are not invoices', () => {
    assert.equal(looksLikeInvoice(GINA_CLINIC_FIXTURE), false);
    assert.equal(looksLikeInvoice(RYAN_CLINIC_FIXTURE), false);
    assert.notEqual(classifySegment({ text: GINA_CLINIC_FIXTURE }), 'invoice');
    assert.notEqual(classifySegment({ text: RYAN_CLINIC_FIXTURE }), 'invoice');
  });

  it('parseInvoice is forced-mode still returns 13422', () => {
    const rows = parseInvoice(BONDVET_INVOICE_FIXTURE, null, null, { forced: true });
    assert.equal(rows[0].invoice_no, '13422');
    assert.equal(rows[0].total, 202.37);
  });

  it('invoice beats diet when a food product is a line item', () => {
    const withFood = `${BONDVET_INVOICE_FIXTURE}
Hill's Science Diet Adult                           $48.00
Royal Canin Gastrointestinal                        $36.50
`;
    assert.equal(looksLikeInvoice(withFood), true);
    assert.equal(classifySegment({ text: withFood }), 'invoice');
    assert.equal(harvestLifestyle(withFood), null);
    const foodOut = pipelineCode(withFood);
    assert.equal((foodOut.invoices || []).length, 1, JSON.stringify(foodOut.invoices));
    assert.equal(foodOut.invoices[0].invoice_no, '13422');
    assert.equal(foodOut.lifestyle, null);
    assert.equal(lifestyleHasFields(foodOut.lifestyle), false);
    const desc = (foodOut.invoices[0].line_items || []).map((l) => l.description).join(' ');
    assert.match(desc, /Diet|Canin|exam|Office/i);
  });
});
