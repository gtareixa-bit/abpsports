/* ABP Sport — GA4 + Consent Mode v2 + banner de cookies.
   GA4 solo se carga tras "Aceptar". Por defecto todo denegado. */
(function () {
  'use strict';
  var GA_ID = 'G-LFX8QGD49K';
  var KEY = 'abp_cookie_consent'; // 'granted' | 'denied'

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', wait_for_update: 500
  });

  function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function read() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }

  var loaded = false;
  function loadGA() {
    if (loaded) return; loaded = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
    if (/^\/gracias(-pedido)?(\.html)?\/?$/.test(location.pathname)) {
      var pedido = /pedido/.test(location.pathname);
      gtag('event', 'form_submit_success', { form_name: pedido ? 'pedido-tienda' : 'inscripcion_contacto' });
      if (!pedido) gtag('event', 'generate_lead', { method: 'formulario' });
    }
  }

  function grant() {
    gtag('consent', 'update', { analytics_storage: 'granted' });
    loadGA();
  }

  function track(name, params) { if (loaded) gtag('event', name, params || {}); }

  /* Eventos de interacción (delegados; solo se envían si hay consentimiento) */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)/i.test(h)) track('contact_whatsapp', { link_url: h });
    else if (/^tel:/i.test(h)) track('contact_phone', { link_url: h });
    else if (/^mailto:/i.test(h)) track('contact_email', { link_url: h });
    else if (/^https?:\/\//i.test(h) && a.hostname && a.hostname !== location.hostname) track('outbound_click', { link_url: h });
    if (a.classList.contains('btn') || a.classList.contains('cta')) track('cta_click', { link_text: (a.textContent || '').trim().slice(0, 60), page: location.pathname });
  }, true);

  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (f && f.getAttribute) track('form_submit', { form_name: f.getAttribute('name') || 'form' });
  }, true);

  /* Banner */
  function banner() {
    if (document.getElementById('abp-cookie-banner')) return;
    var st = document.createElement('style');
    st.textContent =
      '#abp-cookie-banner{position:fixed;left:0;right:0;bottom:0;z-index:99999;background:#101010;color:#fff;padding:16px 20px;box-shadow:0 -4px 20px rgba(0,0,0,.35);font:15px/1.5 Inter,system-ui,sans-serif}' +
      '#abp-cookie-banner .in{max-width:1100px;margin:0 auto;display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}' +
      '#abp-cookie-banner p{margin:0;flex:1 1 380px}#abp-cookie-banner a{color:#fff;text-decoration:underline}' +
      '#abp-cookie-banner .b{display:flex;gap:10px;flex:0 0 auto}' +
      '#abp-cookie-banner button{cursor:pointer;border:2px solid #d61f26;border-radius:6px;padding:10px 20px;font:600 15px Inter,system-ui,sans-serif}' +
      '#abp-cookie-banner .ok{background:#d61f26;color:#fff}#abp-cookie-banner .no{background:transparent;color:#fff}' +
      '#abp-cookie-banner button:focus-visible{outline:3px solid #fff;outline-offset:2px}';
    document.head.appendChild(st);
    var d = document.createElement('div');
    d.id = 'abp-cookie-banner';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-label', 'Aviso de cookies');
    d.innerHTML = '<div class="in"><p>Usamos cookies analíticas (Google Analytics) para mejorar la web. Solo se activan si las aceptas. Más información en la <a href="cookies.html">política de cookies</a>.</p><div class="b"><button type="button" class="no">Rechazar</button><button type="button" class="ok">Aceptar</button></div></div>';
    document.body.appendChild(d);
    d.querySelector('.ok').addEventListener('click', function () { store('granted'); grant(); d.remove(); });
    d.querySelector('.no').addEventListener('click', function () { store('denied'); d.remove(); });
  }

  function init() {
    var c = read();
    if (c === 'granted') grant();
    else if (c !== 'denied') banner();
    /* enlace "Gestionar cookies" opcional: <a href="#" data-cookie-settings> */
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-cookie-settings]');
      if (t) { e.preventDefault(); store(''); banner(); }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
