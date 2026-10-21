import { toNum, compare, inr } from './calc.js';

document.getElementById('y').textContent = new Date().getFullYear();

// Mobile menu
const toggle = document.getElementById('navToggle');
const links = document.getElementById('navLinks');
if (toggle && links) {
  const close = () => { toggle.setAttribute('aria-expanded', 'false'); links.classList.remove('open'); };
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('open', open);
  });
  links.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}

// Calculator
const PANEL_SQFT = 18; // 1830 x 915 mm ≈ 6 x 3 ft
const $ = (id) => document.getElementById(id);
const fields = ['area', 'pours', 'plyP', 'plyU', 'ppP', 'ppU', 'waste'];
const map = { area: 'area', pours: 'pours', plyP: 'plyPrice', plyU: 'plyUses', ppP: 'ppPrice', ppU: 'ppUses', waste: 'wastePct' };

function read() {
  const v = Object.fromEntries(fields.map((f) => [map[f], toNum($(f).value)]));
  v.wastePct = v.wastePct ?? 0;
  v.panelArea = $('panels').checked ? PANEL_SQFT : null;
  return v;
}

function showErrors(errors) {
  for (const f of fields) {
    const el = $(f);
    const msg = errors[map[f]];
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    el.closest('label').querySelector('.err').textContent = msg || '';
  }
}

function calc() {
  const input = read();
  const r = compare(input);
  const out = ['oPly', 'oPlyN', 'oPP', 'oPPN', 'oDiff', 'oBE'];
  if (!r.ok) {
    showErrors(r.errors);
    out.forEach((id) => { $(id).textContent = id.startsWith('o') && id.length === 4 ? '—' : ''; });
    $('oDiff').textContent = 'Fix the highlighted fields to see the estimate.';
    $('oBE').textContent = '';
    return;
  }
  showErrors({});
  const sets = (n) => n + (n === 1 ? ' set' : ' sets');
  $('oPly').textContent = inr(r.ply.total);
  $('oPlyN').textContent = `${sets(r.ply.sets)} × ${Math.round(r.ply.buyArea).toLocaleString('en-IN')} sq ft · ${inr(r.ply.perPour)} per pour`;

  if (r.pp) {
    $('oPP').textContent = inr(r.pp.total);
    $('oPPN').textContent = `${sets(r.pp.sets)} × ${Math.round(r.pp.buyArea).toLocaleString('en-IN')} sq ft · ${inr(r.pp.perPour)} per pour`;
    $('oDiff').textContent = r.diff > 0
      ? `Estimated material saving with PP: ${inr(r.diff)} over ${input.pours} pours.`
      : r.diff < 0
        ? `At these numbers plywood costs ${inr(-r.diff)} less on material. PP makes more sense with more pours.`
        : 'At these numbers both cost the same on material.';
    $('oBE').textContent = r.minPpUses
      ? `PP needs to last at least ${r.minPpUses} pours per set to match plywood at this price.`
      : 'At this PP price, PP would not match plywood within these pours.';
  } else {
    $('oPP').textContent = '—';
    $('oPPN').textContent = 'Enter the price we quote you';
    $('oDiff').textContent = '';
    $('oBE').textContent = `PP breaks even with plywood at up to ${inr(r.breakEvenPpPrice)} per sq ft, if it lasts ${input.ppUses} pours.`;
  }

  const msg = `Hi VAJRA Formwork, I'd like a quote for PP hollow formwork.\nSite location: \nApprox. area: ${input.area} sq ft\nPours planned: ${input.pours}\nPanel thickness/type: \nExpected casting date: `;
  $('calcWa').href = 'https://wa.me/918305070160?text=' + encodeURIComponent(msg);
}

if ($('calcForm')) {
  [...fields, 'panels'].forEach((id) => $(id).addEventListener('input', calc));
  calc();
}
