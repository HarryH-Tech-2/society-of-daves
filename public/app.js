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
      // Count the click before the page leaves for Stripe, so visitors who
      // give up on the card form still show up. Matches the purchase events
      // on welcome.html and gift-sent.html.
      if (typeof window.gtag === 'function') {
        const isGift = form.action.endsWith('/api/gift-checkout');
        const months = isGift ? Number(new FormData(form).get('plan')) || 0 : 0;
        const currency = form.elements.currency && form.elements.currency.value === 'gbp' ? 'GBP' : 'USD';
        const item = isGift
          ? { item_id: 'gift-' + months, item_name: months + '-month gift membership', price: months, quantity: 1 }
          : { item_id: 'membership', item_name: 'Monthly membership', price: 1, quantity: 1 };
        window.gtag('event', 'begin_checkout', {
          currency, value: item.price, items: [item], transport_type: 'beacon',
        });
      }
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

  // Hero headline: swaps between the lines in data-rotate every 5 seconds.
  // The lines are stacked in one grid cell so the heading never changes
  // height. Built before currency.js runs, so "$1" still becomes "£1".
  const heroTitle = document.querySelector('h1[data-rotate]');
  if (heroTitle) {
    const lines = [heroTitle.textContent, ...heroTitle.dataset.rotate.split('|')];
    heroTitle.textContent = '';
    heroTitle.classList.add('rotating');
    const spans = lines.map((text, i) => {
      const span = document.createElement('span');
      span.textContent = text;
      if (i) span.setAttribute('aria-hidden', 'true');
      heroTitle.appendChild(span);
      return span;
    });
    let current = 0;
    let paused = false;
    heroTitle.addEventListener('mouseenter', () => { paused = true; });
    heroTitle.addEventListener('mouseleave', () => { paused = false; });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setInterval(() => {
        if (paused || document.hidden) return;
        spans[current].setAttribute('aria-hidden', 'true');
        current = (current + 1) % spans.length;
        spans[current].removeAttribute('aria-hidden');
      }, 5000);
    }
  }

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

  // The hero deck: a stack of name badges that flips through the ways to be
  // a Dave around the world (the same list as "Dave around the world").
  const deckName = document.getElementById('deck-name');
  if (deckName) {
    const NAMES = [
      ['Dave', 'English'], ['Dafydd', 'Welsh'], ['Dàibhidh', 'Scottish Gaelic'], ['Dáibhí', 'Irish'],
      ['Davide', 'Italian'], ['Davi', 'Brazilian Portuguese'], ['Dawid', 'Polish'], ['Dávid', 'Hungarian'],
      ['Davíð', 'Icelandic'], ['Taavetti', 'Finnish'], ['Davit', 'Georgian'], ['Dawud', 'Arabic'],
      ['Dovid', 'Yiddish'], ['Kawika', 'Hawaiian'],
    ];
    const DAVES = /^(dave|davey|davie|davy|david|dafydd|dai|davide|davi|dawid|dovid)$/i;
    const front = document.getElementById('deck-front');
    const lang = document.getElementById('deck-lang');
    const count = document.getElementById('deck-count');
    const backs = document.querySelectorAll('.deck-card');
    const setName = (i) => {
      const [name, language] = NAMES[i];
      deckName.textContent = name;
      deckName.style.setProperty('--len', String(Math.max(4, name.length)));
      lang.textContent = language;
      count.textContent = String(i + 1);
    };

    // Arriving from someone's shared badge (/badge/Name): show their name
    // crossed out and corrected to Dave, and hold still.
    const sharedName = (params.get('badge') || '').trim().slice(0, 24);
    if (sharedName) {
      if (!DAVES.test(sharedName)) {
        const theirName = document.getElementById('their-name');
        theirName.textContent = sharedName;
        theirName.hidden = false;
        document.getElementById('badge-name').classList.add('corrected');
        lang.textContent = 'Corrected';
      } else {
        deckName.textContent = sharedName;
        deckName.style.setProperty('--len', String(Math.max(4, sharedName.length)));
        lang.textContent = 'Already a Dave';
      }
      count.parentElement.hidden = true;
    } else {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches || !front.animate;
      const TILT = 'rotate(-3deg)';
      let i = 0;
      let busy = false;
      setInterval(async () => {
        if (document.hidden || busy) return;
        busy = true;
        i = (i + 1) % NAMES.length;
        if (still) { setName(i); busy = false; return; }
        await front.animate(
          [{ transform: `${TILT} rotateY(0deg)` }, { transform: `${TILT} rotateY(90deg) scale(0.96)` }],
          { duration: 220, easing: 'cubic-bezier(.5, 0, .9, .5)' },
        ).finished.catch(() => {});
        setName(i);
        deckName.classList.remove('write-in', 'rewrite');
        void deckName.offsetWidth; // restart the write-in animation
        deckName.classList.add('rewrite');
        front.animate(
          [{ transform: `${TILT} rotateY(-90deg) scale(0.96)` }, { transform: `${TILT} rotateY(0deg)` }],
          { duration: 420, easing: 'cubic-bezier(.2, 1.4, .4, 1)' },
        );
        backs.forEach((card, n) => card.animate(
          [{ translate: '0 0' }, { translate: `${n ? -10 : 8}px ${n ? 6 : -6}px` }, { translate: '0 0' }],
          { duration: 520, easing: 'ease-in-out', delay: 60 * n },
        ));
        busy = false;
      }, 2800);
    }
  }
})();
