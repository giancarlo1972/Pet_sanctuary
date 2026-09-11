import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AURORA_VISIT_FIXTURE,
  harvestKnownFacts,
  inheritVisitDate,
  itemsTrulyUndated,
  monthEndIso,
  dobFromAge,
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
