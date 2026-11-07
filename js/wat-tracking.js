/* WAT Agency: consent-first analytics, 2026-11.
 * GA4 is configured IN CODE (G-4SVZ02R7E2), not in GTM.
 * Do NOT add another GA4 Google tag to GTM-K2BP584R.
 * Contact-click events are intent proxies, NOT verified enquiries.
 */
(function () {
  'use strict';
  var GTM_ID = 'GTM-K2BP584R';
  var GA4_ID = 'G-4SVZ02R7E2';
  var CONSENT_KEY = 'wat_analytics_consent_v1';
  var initialized = false;
  var accepted = false;
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  function language() {
    return document.documentElement.getAttribute('data-lang') === 'nl' ||
      document.documentElement.lang.toLowerCase().indexOf('nl') === 0 ? 'nl' : 'en';
  }
  function getStored() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; }
  }
  function store(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (_) {}
  }
  function loadScript(src) {
    var node = document.createElement('script');
    node.async = true;
    node.src = src;
    document.head.appendChild(node);
  }
  function startAnalytics() {
    if (initialized) return;
    initialized = true;
    window.gtag('js', new Date());
    window.gtag('config', GA4_ID, { send_page_view: true });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_ID));
    // The GTM container is available for future tags, but has no GA4 tag.
    window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    loadScript('https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(GTM_ID));
  }
  function applyConsent(value) {
    accepted = value === 'accepted';
    window.gtag('consent', 'update', {
      analytics_storage: accepted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    if (accepted) startAnalytics();
    if (typeof window.watConsentRender === 'function') window.watConsentRender();
  }
  function track(name, location) {
    if (!accepted || !initialized) return;
    window.gtag('event', name, {
      link_location: location || 'other',
      page_path: locationPath(),
      site_language: language()
    });
  }
  function locationPath() { return window.location.pathname; }
  document.addEventListener('click', function (event) {
    var el = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!el) return;
    var href = el.getAttribute('href') || '';
    var source = el.closest('nav') ? 'navigation' : el.closest('footer') ? 'footer' :
      el.closest('header') ? 'header' : 'content';
    var whatsappLink = false;
    try {
      var linkUrl = new URL(href, window.location.href);
      whatsappLink = (linkUrl.protocol === 'https:' || linkUrl.protocol === 'http:') &&
        ['wa.me', 'api.whatsapp.com', 'web.whatsapp.com'].indexOf(linkUrl.hostname.toLowerCase()) !== -1;
    } catch (_) {}
    if (whatsappLink) {
      track('click_whatsapp', source);
    } else if (/^mailto:/i.test(href)) {
      track('click_email', source);
    } else if (/^tel:/i.test(href)) {
      track('click_phone', source);
    }
  }, true);

  function setupUI() {
    var css = document.createElement('style');
    css.textContent = [
      '#wat-consent-banner{position:fixed;z-index:2147483645;bottom:18px;left:18px;right:18px;max-width:600px;padding:20px 22px;border:1px solid #575757;border-radius:12px;background:#161616;color:#fff;box-shadow:0 12px 45px #0008;font:14px/1.5 system-ui,Arial,sans-serif}',
      '#wat-consent-banner h2{font:700 17px/1.4 system-ui,Arial,sans-serif;color:#fff;margin:0 0 8px}',
      '#wat-consent-banner p{color:#ededed;margin:0 0 14px;font-size:13px}',
      '#wat-consent-banner .wat-consent-actions{display:flex;flex-wrap:wrap;gap:10px}',
      '#wat-consent-banner button,#wat-consent-open{border:1px solid #b5b5b5;border-radius:6px;padding:9px 15px;cursor:pointer;font:600 13px system-ui,Arial,sans-serif;background:transparent;color:white}',
      '#wat-consent-banner .wat-accept{background:#aaff44;color:#141414;border-color:#aaff44}',
      '#wat-consent-open{position:fixed;z-index:2147483644;left:14px;bottom:12px;background:#242424;color:#fff;padding:7px 12px;font-size:12px}',
      '#wat-consent-banner[hidden],#wat-consent-open[hidden]{display:none!important}',
      '@media(max-width:640px){#wat-consent-banner{bottom:8px;left:8px;right:8px;padding:16px}}'
    ].join('');
    document.head.appendChild(css);
    var banner = document.createElement('section');
    banner.id = 'wat-consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Analytics cookie choice');
    var manage = document.createElement('button');
    manage.id = 'wat-consent-open';
    manage.type = 'button';
    manage.textContent = 'Cookie settings';
    manage.addEventListener('click', function () { banner.hidden = false; manage.hidden = true; });
    var heading = document.createElement('h2');
    var copy = document.createElement('p');
    var actions = document.createElement('div');
    actions.className = 'wat-consent-actions';
    var reject = document.createElement('button');
    reject.type = 'button';
    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'wat-accept';
    actions.appendChild(reject);
    actions.appendChild(accept);
    banner.appendChild(heading);
    banner.appendChild(copy);
    banner.appendChild(actions);
    document.body.appendChild(banner);
    document.body.appendChild(manage);
    function render() {
      var nl = language() === 'nl';
      heading.textContent = nl ? 'Cookies en statistieken' : 'Cookies and analytics';
      copy.textContent = nl ?
        'We gebruiken noodzakelijke opslag voor de werking van deze website. Alleen met jouw toestemming gebruiken we Google Analytics om websitebezoek en contactklikken te meten. Reclamecookies zijn niet ingeschakeld. Je kan je keuze later wijzigen.' :
        'We use essential storage to operate this site. Only with your permission do we use Google Analytics to measure visits and contact clicks. Advertising cookies are not enabled. You can change your choice later.';
      reject.textContent = nl ? 'Weigeren' : 'Reject analytics';
      accept.textContent = nl ? 'Accepteren' : 'Accept analytics';
      manage.textContent = nl ? 'Cookie-instellingen' : 'Cookie settings';
      var choice = getStored();
      banner.hidden = choice === 'accepted' || choice === 'rejected';
      manage.hidden = !banner.hidden;
    }
    window.watConsentRender = render;
    reject.addEventListener('click', function () { store('rejected'); applyConsent('rejected'); });
    accept.addEventListener('click', function () { store('accepted'); applyConsent('accepted'); });
    render();
  }
  var prior = getStored();
  if (prior === 'accepted') applyConsent('accepted');
  else applyConsent('rejected');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupUI);
  else setupUI();
})();
