// Footer year
document.getElementById('y').textContent = new Date().getFullYear();

// Cost-per-dhalai calculator
(function () {
  const $ = (id) => document.getElementById(id);
  const ids = ['area', 'pours', 'plyP', 'plyU', 'ppP', 'ppU'];
  const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const num = (id) => parseFloat($(id).value);

  function calc() {
    const area = num('area'), pours = num('pours');
    const plyP = num('plyP'), plyU = num('plyU');
    const ppP = num('ppP'), ppU = num('ppU');
    const wa = $('calcWa');
    if (!(area > 0 && pours > 0 && plyP >= 0 && plyU > 0)) return;

    // Sets of panels needed = ceil(pours / uses per set)
    const plySets = Math.ceil(pours / plyU);
    const plyCost = plySets * area * plyP;
    $('oPly').textContent = inr(plyCost);
    $('oPlyN').textContent = plySets + ' set' + (plySets > 1 ? 's' : '') + ' · ' + inr(plyCost / pours) + ' per dhalai';

    const msg = 'Hi VAJRA, I need a PP formwork quote.\nSlab area: ' + area + ' sq ft\nDhalai planned: ' + pours + '\nSite: ';
    wa.href = 'https://wa.me/919630012636?text=' + encodeURIComponent(msg);

    if (ppP > 0 && ppU > 0) {
      const ppSets = Math.ceil(pours / ppU);
      const ppCost = ppSets * area * ppP;
      $('oPP').textContent = inr(ppCost);
      $('oPPN').textContent = ppSets + ' set' + (ppSets > 1 ? 's' : '') + ' · ' + inr(ppCost / pours) + ' per dhalai';
      const d = plyCost - ppCost;
      $('oDiff').textContent = d > 0
        ? 'PP saves about ' + inr(d) + ' on material over ' + pours + ' pours.'
        : 'At these numbers plywood is cheaper by ' + inr(-d) + '. PP makes sense with more pours.';
    } else {
      $('oPP').textContent = '—';
      $('oPPN').textContent = 'Enter the price we quote you';
      $('oDiff').textContent = '';
    }
  }
  ids.forEach((id) => $(id).addEventListener('input', calc));
  calc();
})();
