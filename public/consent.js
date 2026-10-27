// Cookie consent banner. Google Analytics starts with every cookie denied
// (see the consent defaults in each page's <head>); this asks once, remembers
// the answer in localStorage, and tells Google. Any element with
// data-cookie-settings reopens the banner.

(function () {
  const KEY = 'dave-cookies';
  const GRANTED = {
    analytics_storage: 'granted', ad_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted',
  };
  const DENIED = {
    analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  };

  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function decide(choice) {
    try { localStorage.setItem(KEY, choice); } catch (e) { /* storage blocked: ask again next page */ }
    if (typeof window.gtag === 'function') window.gtag('consent', 'update', choice === 'granted' ? GRANTED : DENIED);
    close();
  }

  let banner = null;
  let returnFocus = null;

  function open(trigger) {
    if (banner) return;
    returnFocus = trigger || null;
    banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-labelledby', 'cookie-title');
    banner.innerHTML = `
      <div class="cookie-card">
        <p class="cookie-stamp" aria-hidden="true">Ref. D/COOKIE/1</p>
        <h2 id="cookie-title">A small matter of cookies, Dave</h2>
        <p>The Society would like to use Google cookies to count how many Daves pass through the building and which adverts sent them. That's all they're for, and we never sell them.</p>
        <p class="cookie-fine">Not a Dave? We'll ask you anyway. See our <a href="/privacy#cookies">privacy notice</a>.</p>
        <div class="cookie-actions">
          <button type="button" class="cookie-yes" data-choice="granted">Fine by me</button>
          <button type="button" class="cookie-no" data-choice="denied">No thanks</button>
        </div>
      </div>`;
    banner.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-choice]');
      if (button) decide(button.dataset.choice);
    });
    banner.addEventListener('keydown', (event) => {
      // Escape closes it without deciding; it comes back on the next page.
      if (event.key === 'Escape') close();
    });
    document.body.appendChild(banner);
    // Only move focus when someone asked for the banner, so it doesn't
    // hijack screen readers on page load.
    if (trigger) banner.querySelector('button').focus();
  }

  function close() {
    if (!banner) return;
    const wasFocused = banner.contains(document.activeElement);
    banner.remove();
    banner = null;
    if (wasFocused && returnFocus) returnFocus.focus();
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-cookie-settings]');
    if (!link) return;
    event.preventDefault();
    open(link);
  });

  if (!stored()) open();
})();
