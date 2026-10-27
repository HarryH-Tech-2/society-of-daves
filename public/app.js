// Ad tracking pass-through, checkout error notice, sharing, and the name badge.

(function () {
  const params = new URLSearchParams(location.search);

  // Carry gclid/utm values from the ad click into Stripe, so paid members
  // can be traced back to the campaign. Kept for the session so a visitor
  // who browses around before joining still gets attributed.
  const TRACKING = ['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const tracked = {};
  for (const key of TRACKING) {
    let value = params.get(key);
    try {
      if (value) sessionStorage.setItem(key, value);
      else value = sessionStorage.getItem(key);
    } catch (e) { /* storage blocked: use the URL value only */ }
    if (value) tracked[key] = value;
  }
  document.querySelectorAll('form[data-checkout]').forEach((form) => {
    for (const [key, value] of Object.entries(tracked)) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = key;
      input.value = value;
      form.appendChild(input);
    }
    form.addEventListener('submit', () => {
      const button = form.querySelector('button[type="submit"], button:not([type])');
      button.dataset.label = button.textContent;
      button.disabled = true;
      button.textContent = 'Opening secure checkout…';
    });
  });

  // Re-enable buttons if the visitor comes back from Stripe with the back button.
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    document.querySelectorAll('form[data-checkout] button[data-label]').forEach((b) => {
      b.disabled = false;
      b.textContent = b.dataset.label;
    });
  });

  // Gift form: errors sent back by the server, the Christmas date, the
  // optional date picker and the message counter.
  const giftForm = document.querySelector('.gift-form');
  if (giftForm) {
    const giftError = document.getElementById('gift-error');
    const GIFT_ERRORS = {
      plan: 'Choose 6 or 12 months.',
      recipient_email: "Enter your Dave's email address.",
      recipient_name: "Enter your Dave's first name.",
      sender_name: "Enter your name, so they know who it's from.",
      deliver: 'Choose when to send the gift.',
      deliver_date: 'Choose a delivery date between today and a year from now.',
    };
    const errorText = GIFT_ERRORS[params.get('error')] || (params.get('checkout') === 'error'
      ? "We couldn't open the payment page. You haven't been charged. Please try again." : '');
    if (errorText) {
      giftError.textContent = errorText;
      giftError.hidden = false;
    }

    // Same rule as the server: this year's Christmas, or next year's once it has passed.
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getUTCFullYear();
    const christmasYear = today <= `${year}-12-25` ? year : year + 1;
    document.getElementById('christmas-label').textContent = `On Christmas Day (25 December ${christmasYear})`;

    const dateField = document.getElementById('date-field');
    const dateInput = document.getElementById('deliver_date');
    const max = new Date();
    max.setUTCFullYear(max.getUTCFullYear() + 1);
    dateInput.min = today;
    dateInput.max = max.toISOString().slice(0, 10);
    giftForm.querySelectorAll('input[name="deliver"]').forEach((radio) => {
      radio.addEventListener('change', () => {
        const custom = giftForm.deliver.value === 'date';
        dateField.hidden = !custom;
        dateInput.required = custom;
      });
    });

    const message = document.getElementById('message');
    const count = document.getElementById('message-count');
    message.addEventListener('input', () => { count.textContent = String(300 - message.value.length); });
  }

  const checkoutError = document.getElementById('checkout-error');
  if (checkoutError && params.get('checkout') === 'error') checkoutError.hidden = false;

  // The Dave wall: fill each background with enough Daves to cover it.
  // Sizes, tilts and colours come from nth-child rules in styles.css.
  document.querySelectorAll('.dave-wall').forEach((wall) => {
    const area = (wall.offsetWidth || 1200) * (wall.offsetHeight || 800);
    const count = Math.min(600, Math.ceil(area / 2600));
    wall.innerHTML = '<span>Dave</span>'.repeat(count);
  });

  // Scroll-triggered movement: chart bars grow, highlighter marks sweep,
  // numbers count up. CSS only hides things once this class is present.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('motion-ready');

    const countUp = (el) => {
      const target = Number(el.dataset.count);
      const decimals = Number(el.dataset.decimals || 0);
      const start = performance.now();
      const duration = 1200;
      const step = (t) => {
        const p = Math.min(1, (t - start) / duration);
        const eased = 1 - (1 - p) ** 3;
        el.textContent = (target * eased).toFixed(decimals);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        if (entry.target.dataset.count) countUp(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.35 });

    document.querySelectorAll('[data-count]').forEach((el) => {
      el.textContent = (0).toFixed(Number(el.dataset.decimals || 0));
    });
    document.querySelectorAll('.chart, .facts li, [data-count]').forEach((el) => observer.observe(el));
  }

  // FAQ dropdowns: animate open and closed instead of snapping.
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.faq details, .chart-table').forEach((details) => {
    const summary = details.querySelector('summary');
    let animation = null;

    summary.addEventListener('click', (e) => {
      if (reduceMotion || !details.animate) return; // let the browser toggle it
      e.preventDefault();
      if (animation) animation.cancel();

      const closedHeight = `${summary.offsetHeight}px`;
      const opening = !details.open;
      const startHeight = `${details.offsetHeight}px`;
      if (opening) details.open = true;
      const endHeight = opening ? `${details.scrollHeight}px` : closedHeight;

      details.style.overflow = 'hidden';
      details.classList.toggle('closing', !opening);
      animation = details.animate(
        { height: [startHeight, endHeight] },
        { duration: opening ? 320 : 240, easing: 'cubic-bezier(.2, .7, .3, 1)' },
      );
      const body = details.querySelector('.faq-body');
      if (opening && body) {
        body.animate(
          { opacity: [0, 1], transform: ['translateY(-6px)', 'translateY(0)'] },
          { duration: 320, easing: 'ease-out' },
        );
      }
      animation.onfinish = () => {
        animation = null;
        if (!opening) details.open = false;
        details.classList.remove('closing');
        details.style.overflow = '';
      };
      animation.oncancel = () => { animation = null; };
    });
  });

  // Sharing: the phone's share sheet where there is one, otherwise copy the
  // link. Counted in GA4 as a "share" event (no names are sent).
  async function share({ url, title, text, status, contentType }) {
    const track = (method) => {
      if (typeof window.gtag === 'function') window.gtag('event', 'share', { method, content_type: contentType, item_id: contentType });
    };
    if (navigator.share) {
      try {
        await navigator.share({ url, title, text });
        track('native');
        return;
      } catch (err) {
        if (err.name === 'AbortError') return; // they closed the share sheet
      }
    }
    try {
      // Some browsers leave this pending (e.g. waiting on a permission
      // prompt), so give up after a moment and show the link instead.
      await Promise.race([
        navigator.clipboard.writeText(url),
        new Promise((resolve, reject) => { setTimeout(() => reject(new Error('timeout')), 1500); }),
      ]);
      status.textContent = 'Link copied. Paste it anywhere a Dave might see it.';
      track('copy');
    } catch (err) {
      status.textContent = `Copy this link: ${url}`;
    }
  }

  // Any [data-share-url] button, e.g. "Share the link" on the welcome page.
  document.querySelectorAll('[data-share-url]').forEach((button) => {
    button.addEventListener('click', () => share({
      url: button.dataset.shareUrl,
      title: 'The Society of Daves',
      text: button.dataset.shareText || '',
      status: button.closest('[data-share-box]').querySelector('.share-status'),
      contentType: button.dataset.shareType || 'site',
    }));
  });

  // The badge: whatever name you type gets crossed out and corrected to Dave.
  const DAVES = /^(dave|davey|davie|davy|david|dafydd|dai|davide|davi|dawid|dovid)$/i;
  const input = document.getElementById('name-input');
  const nameBox = document.getElementById('badge-name');
  const theirName = document.getElementById('their-name');
  const verdict = document.getElementById('name-verdict');
  if (!input) return;

  document.getElementById('name-try').addEventListener('submit', (e) => e.preventDefault());

  input.addEventListener('input', () => {
    const name = input.value.trim();
    if (!name) {
      theirName.hidden = true;
      nameBox.classList.remove('corrected');
      verdict.textContent = '';
    } else if (DAVES.test(name)) {
      theirName.hidden = true;
      nameBox.classList.remove('corrected');
      verdict.textContent = 'Already a Dave. Welcome home.';
    } else {
      theirName.textContent = name;
      theirName.hidden = false;
      nameBox.classList.add('corrected');
      verdict.textContent = `Close enough. Welcome, Dave (formerly ${name}).`;
    }
    const badgeName = name || 'Dave';
    document.getElementById('badge-download').href = `/api/badge?name=${encodeURIComponent(badgeName)}&download=1`;
    document.getElementById('badge-share-status').textContent = '';
  });

  // Share a link whose preview is this badge (see api/share.js).
  document.getElementById('badge-share').addEventListener('click', () => {
    const name = input.value.trim().slice(0, 24) || 'Dave';
    const isDave = DAVES.test(name);
    share({
      url: `${location.origin}/badge/${encodeURIComponent(name)}`,
      title: 'The Society of Daves',
      text: isDave ? `${name} here. I'm a Dave, and there's a Society now.` : `My name is ${name}, but the Society of Daves says it's Dave now.`,
      status: document.getElementById('badge-share-status'),
      contentType: 'badge',
    });
  });
  document.getElementById('badge-download').addEventListener('click', () => {
    if (typeof window.gtag === 'function') window.gtag('event', 'share', { method: 'download', content_type: 'badge', item_id: 'badge' });
  });

  // Arriving from someone's shared badge: show their name on it.
  const sharedName = (params.get('badge') || '').trim().slice(0, 24);
  if (sharedName) {
    input.value = sharedName;
    input.dispatchEvent(new Event('input'));
  }
})();
