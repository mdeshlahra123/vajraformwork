import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toNum, validate, setsNeeded, purchasedArea, compare, inr } from '../calc.js';

const base = { area: 1000, pours: 20, plyPrice: 65, plyUses: 6, ppPrice: 110, ppUses: 50, wastePct: 0, panelArea: null };

test('one pour needs one set of each material', () => {
  const r = compare({ ...base, pours: 1 });
  assert.equal(r.ply.sets, 1);
  assert.equal(r.pp.sets, 1);
  assert.equal(r.ply.total, 65000);
  assert.equal(r.pp.total, 110000);
  assert.ok(r.diff < 0, 'PP costs more for a single pour');
});

test('period ending exactly at the reuse limit needs one set', () => {
  assert.equal(setsNeeded(6, 6), 1);
  assert.equal(compare({ ...base, pours: 6 }).ply.sets, 1);
});

test('one pour past the reuse limit needs a second set', () => {
  assert.equal(setsNeeded(7, 6), 2);
  assert.equal(compare({ ...base, pours: 7 }).ply.sets, 2);
});

test('larger period needs multiple sets', () => {
  const r = compare({ ...base, pours: 20 });
  assert.equal(r.ply.sets, 4); // ceil(20/6)
  assert.equal(r.ply.total, 260000);
  assert.equal(r.pp.sets, 1);
  assert.equal(r.pp.total, 110000);
  assert.equal(r.diff, 150000);
  assert.equal(r.ply.perPour, 13000);
});

test('whole-panel rounding buys complete panels', () => {
  // 1000 sq ft / 18 sq ft panels = 55.56 -> 56 panels = 1008 sq ft
  const b = purchasedArea(1000, 0, 18);
  assert.equal(b.panels, 56);
  assert.equal(b.area, 1008);
  // exact multiple does not round up
  assert.equal(purchasedArea(180, 0, 18).panels, 10);
  // wastage applied before rounding: 1000 * 1.05 = 1050 / 18 = 58.33 -> 59
  assert.equal(purchasedArea(1000, 5, 18).panels, 59);
  const r = compare({ ...base, panelArea: 18 });
  assert.equal(r.ply.buyArea, 1008);
  assert.equal(r.ply.total, 4 * 1008 * 65);
});

test('wastage increases purchased area', () => {
  const r = compare({ ...base, wastePct: 10 });
  assert.ok(Math.abs(r.ply.buyArea - 1100) < 1e-9);
  assert.ok(Math.abs(r.ply.total - 4 * 1100 * 65) < 1e-6);
});

test('invalid and missing inputs are rejected, never NaN', () => {
  assert.equal(toNum(''), null);
  assert.equal(toNum('abc'), null);
  assert.equal(toNum('Infinity'), null);
  assert.equal(toNum(' 12 '), 12);
  for (const bad of [
    { area: null }, { area: 0 }, { area: -5 },
    { pours: 0 }, { pours: 2.5 }, { plyUses: 0 }, { ppUses: -1 },
    { plyPrice: null }, { wastePct: -1 }, { wastePct: 150 }, { panelArea: 0 },
  ]) {
    const r = compare({ ...base, ...bad });
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.ok(Object.keys(r.errors).length > 0);
  }
  assert.equal(inr(NaN), '—');
  assert.equal(inr(Infinity), '—');
});

test('missing PP price still returns ply cost and break-even price', () => {
  const r = compare({ ...base, ppPrice: null });
  assert.equal(r.ok, true);
  assert.equal(r.pp, null);
  assert.equal(r.ply.total, 260000);
  assert.equal(r.breakEvenPpPrice, 260); // 260000 / (1 set * 1000)
});

test('identical cost-per-use gives zero difference', () => {
  // ply: 60/sq ft lasting 5; PP: 120/sq ft lasting 10; 10 pours -> 2 ply sets vs 1 PP set
  const r = compare({ ...base, pours: 10, plyPrice: 60, plyUses: 5, ppPrice: 120, ppUses: 10 });
  assert.equal(r.ply.total, r.pp.total);
  assert.equal(r.diff, 0);
});

test('PP cheaper and PP dearer scenarios', () => {
  assert.ok(compare({ ...base, pours: 20 }).diff > 0);
  assert.ok(compare({ ...base, pours: 3 }).diff < 0);
});

test('minimum PP uses to break even', () => {
  // ply total 260000 for 20 pours; PP 110/sq ft * 1000 = 110000 per set.
  // u=10 -> 2 sets = 220000 <= 260000; u=9 -> 3 sets = 330000 > 260000.
  assert.equal(compare({ ...base }).minPpUses, 10);
  // PP so expensive that even one set lasting all pours loses -> null
  assert.equal(compare({ ...base, ppPrice: 1000 }).minPpUses, null);
});

test('INR formatting uses Indian grouping', () => {
  assert.equal(inr(260000), '₹2,60,000');
  assert.equal(inr(12345678), '₹1,23,45,678');
});
