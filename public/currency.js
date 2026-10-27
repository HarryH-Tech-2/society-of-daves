// Shows prices in pounds to UK visitors. The pages are written in dollars;
// /api/geo says which currency this visitor gets (from Vercel's country
// header), and this swaps the Society's own prices ($1, $6, $12) and the
// "one dollar" wording. Checkout forms get a hidden "currency" field so
// Stripe charges exactly what the page showed. Anything inside
// [data-fixed-currency] is left alone.

(function () {
  const KEY = 'dave-currency';
  const SWAPS = {
    gbp: [
      [/\$(12|6|1)(?![\d.,]*\d)/g, '£$1'],
      [/\b(one|One|your|Your|each) dollar\b/g, '$1 pound'],
      [/\bin US dollars\b/g, 'in pounds'],
    ],
    usd: [
      [/£(12|6|1)(?![\d.,]*\d)/g, '$$$1'],
      [/\b(one|One|your|Your|each) pound\b/g, '$1 dollar'],
      [/\bin pounds\b/g, 'in US dollars'],
    ],
  };
  let shown = 'usd';

  // Always tell checkout what's on screen, even if the lookup below fails.
  function setForms(currency) {
    document.querySelectorAll('form[action="/api/checkout"], form[action="/api/gift-checkout"]').forEach((form) => {
      let field = form.querySelector('input[name="currency"]');
      if (!field) {
        field = document.createElement('input');
        field.type = 'hidden';
        field.name = 'currency';
        form.appendChild(field);
      }
      field.value = currency;
    });
  }

  function apply(currency) {
    if (currency === shown) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement.closest('script, style, textarea, [data-fixed-currency]')
        ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      let text = node.nodeValue;
      for (const [re, to] of SWAPS[currency]) text = text.replace(re, to);
      if (text !== node.nodeValue) node.nodeValue = text;
    }
    setForms(currency);
    document.documentElement.dataset.currency = currency;
    shown = currency;
  }

  // Use the last answer straight away to avoid a flash of dollars, then
  // check once per visit in case they've travelled.
  setForms('usd');
  let cached = null;
  try { cached = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  if (cached === 'gbp') apply('gbp');

  let checked = false;
  try { checked = sessionStorage.getItem(KEY) === '1'; } catch (e) { /* storage blocked */ }
  if (checked && cached) return;

  fetch('/api/geo')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (!data || !SWAPS[data.currency]) return;
      apply(data.currency);
      try {
        localStorage.setItem(KEY, data.currency);
        sessionStorage.setItem(KEY, '1');
      } catch (e) { /* storage blocked: ask again next page */ }
    })
    .catch(() => { /* offline or blocked: dollars it is */ });
})();
