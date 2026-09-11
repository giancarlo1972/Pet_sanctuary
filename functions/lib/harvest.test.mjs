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
    assert.equal(rabies.status, 'current');
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

  it('splits Patient Information, Weight History, Reminders, and each Service on', () => {
    const types = segs.map((s) => s.type);
    assert.ok(types.includes('identity'), types.join(','));
    assert.ok(types.includes('weights'), types.join(','));
    assert.ok(types.includes('reminders'), types.join(','));
    assert.equal(segs.filter((s) => s.type === 'visit').length, 2, types.join(','));
  });

  it('does not leak BondVet into the At Home visit', () => {
    const atHome = segs.find((s) => s.type === 'visit' && s.date === '2026-05-02');
    assert.ok(atHome, JSON.stringify(segs.map((s) => ({ type: s.type, clinic: s.clinic, date: s.date }))));
    assert.match(String(atHome.clinic), /At Home/i);
    assert.doesNotMatch(String(atHome.clinic), /Bond/i);
    const bond = segs.find((s) => s.type === 'visit' && s.date === '2026-08-07');
    assert.match(String(bond.clinic), /Bond Vet/i);
    assert.match(String(bond.vet), /Leshanski/i);
  });

  it('parses Weight History in code (3 points, latest 18.48)', () => {
    const wseg = segs.find((s) => s.type === 'weights');
    const rows = parseSegmentCode(wseg);
    assert.ok(rows.weights.length >= 3, JSON.stringify(rows.weights));
    const latest = rows.weights.slice().sort((a, b) => String(b.measured_on).localeCompare(String(a.measured_on)))[0];
    assert.equal(latest.value, 18.48);
    assert.equal(latest.measured_on, '2026-08-07');
  });

  it('grounds Rabies given 8/7 not reminder 8/12; ALT 190 on BondVet visit', () => {
    const bond = out.visits.find((v) => v.date === '2026-08-07') || out.visits.find((v) => /Bond/i.test(v.clinic || ''));
    assert.ok(bond);
    const rabies = out.vaccinations.find((v) => /rabies/i.test(v.name) && (v.given === '2026-08-07' || v.administered_on === '2026-08-07'));
    assert.ok(rabies, JSON.stringify(out.vaccinations));
    assert.notEqual(rabies.given, '2026-08-12');
    const alt = out.labs.find((l) => String(l.analyte).toUpperCase() === 'ALT');
    assert.ok(alt, JSON.stringify(out.labs));
    assert.equal(String(alt.value), '190');
    assert.equal(alt.collected_on, '2026-08-07');
  });

  it('verify rejects a Rabies given date that is not in the visit segment', () => {
    const visit = segs.find((s) => s.type === 'visit' && s.date === '2026-08-07');
    const bad = verify(visit, { vaccinations: [{ name: 'Rabies', given: '2026-08-12', administered_on: '2026-08-12' }], labs: [], weights: [] });
    assert.ok(bad.ungrounded.length >= 1, JSON.stringify(bad));
  });
});
