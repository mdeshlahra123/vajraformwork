// Formwork material cost model. Pure functions, no DOM. Used by main.js and tests.
// Model: you buy one "set" of material covering the slab area (plus wastage),
// rounded up to whole panels if a panel size is given. A set lasts `uses` pours,
// then must be replaced. Sets needed = ceil(pours / uses).

/** Parse a user value to a finite number, or null if empty/invalid. */
export function toNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Validate inputs. Returns { ok, errors } where errors maps field -> message. */
export function validate(i) {
  const e = {};
  const pos = (k, label, max) => {
    const v = i[k];
    if (v === null || v === undefined) e[k] = `Enter ${label}`;
    else if (!(v > 0)) e[k] = `${label} must be more than 0`;
    else if (max && v > max) e[k] = `${label} looks too high`;
  };
  pos('area', 'area', 1e7);
  pos('pours', 'number of pours', 10000);
  pos('plyPrice', 'plywood price', 100000);
  pos('plyUses', 'plywood uses', 10000);
  if (i.ppPrice !== null && i.ppPrice !== undefined) pos('ppPrice', 'PP price', 100000);
  pos('ppUses', 'PP uses', 10000);
  const w = i.wastePct ?? 0;
  if (!(w >= 0 && w <= 100)) e.wastePct = 'Wastage must be 0 to 100%';
  if (i.panelArea != null && !(i.panelArea > 0)) e.panelArea = 'Panel area must be more than 0';
  if ((e.pours === undefined) && !Number.isInteger(i.pours)) e.pours = 'Pours must be a whole number';
  if ((e.plyUses === undefined) && !Number.isInteger(i.plyUses)) e.plyUses = 'Uses must be a whole number';
  if ((e.ppUses === undefined) && !Number.isInteger(i.ppUses)) e.ppUses = 'Uses must be a whole number';
  return { ok: Object.keys(e).length === 0, errors: e };
}

/** Sets of material needed over `pours`, each set lasting `uses` pours. */
export function setsNeeded(pours, uses) {
  return Math.ceil(pours / uses);
}

/**
 * Area purchased per set: area + wastage, rounded up to whole panels when
 * panelArea is given. Returns { area, panels }.
 */
export function purchasedArea(area, wastePct = 0, panelArea = null) {
  const gross = area * (1 + wastePct / 100);
  if (panelArea) {
    // Small epsilon so 18.0000000001 doesn't become an extra panel from float error.
    const panels = Math.ceil(gross / panelArea - 1e-9);
    return { area: panels * panelArea, panels };
  }
  return { area: gross, panels: null };
}

/** Cost for one material over the period. */
export function materialCost({ area, pours, price, uses, wastePct = 0, panelArea = null }) {
  const sets = setsNeeded(pours, uses);
  const buy = purchasedArea(area, wastePct, panelArea);
  const perSet = buy.area * price;
  const total = sets * perSet;
  return { sets, buyArea: buy.area, panels: buy.panels, perSet, total, perPour: total / pours };
}

/**
 * Full comparison. ppPrice may be null (not quoted yet).
 * breakEvenPpPrice: highest PP price per sq ft at which PP total <= ply total.
 * minPpUses: fewest PP uses at which PP total <= ply total, at the given PP price
 *            (null if even lasting all pours on one set doesn't break even).
 */
export function compare(input) {
  const v = validate(input);
  if (!v.ok) return { ok: false, errors: v.errors };
  const { area, pours, plyPrice, plyUses, ppPrice, ppUses } = input;
  const wastePct = input.wastePct ?? 0;
  const panelArea = input.panelArea ?? null;

  const ply = materialCost({ area, pours, price: plyPrice, uses: plyUses, wastePct, panelArea });
  const ppSets = setsNeeded(pours, ppUses);
  const ppBuy = purchasedArea(area, wastePct, panelArea);
  const breakEvenPpPrice = ply.total / (ppSets * ppBuy.area);

  if (ppPrice === null || ppPrice === undefined) {
    return { ok: true, ply, pp: null, diff: null, breakEvenPpPrice, minPpUses: null, ppSets };
  }
  const pp = materialCost({ area, pours, price: ppPrice, uses: ppUses, wastePct, panelArea });
  // Fewest uses per PP set such that PP total <= ply total.
  let minPpUses = null;
  for (let u = 1; u <= pours; u++) {
    if (setsNeeded(pours, u) * ppBuy.area * ppPrice <= ply.total + 1e-6) { minPpUses = u; break; }
  }
  return { ok: true, ply, pp, diff: ply.total - pp.total, breakEvenPpPrice, minPpUses, ppSets };
}

/** Indian rupee formatting, no decimals. */
export function inr(n) {
  if (!Number.isFinite(n)) return '—';
  return '₹' + Math.round(n).toLocaleString('en-IN');
}
