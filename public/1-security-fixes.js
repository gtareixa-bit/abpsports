/* ABP Sport – 1-security-fixes.js
 * CSRF token, sanitización XSS, rate limit cliente, detección básica de bots.
 */
(function () {
  'use strict';
  var KEY = 'abp_csrf';
  var RL_KEY = 'abp_rl';
  var RL_WINDOW = 60 * 1000; // 60 s
  var RL_MAX = 3;            // envíos por ventana
  var loadTime = Date.now();
  var interactions = 0;

  function randomToken() {
    var a = new Uint8Array(32);
    crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }

  function getToken() {
    var t;
    try { t = sessionStorage.getItem(KEY); } catch (e) {}
    if (!t) { t = randomToken(); try { sessionStorage.setItem(KEY, t); } catch (e) {} }
    // Double-submit cookie: el servidor compara cookie y campo/cabecera
    document.cookie = KEY + '=' + t + '; Path=/; SameSite=Strict; Secure';
    return t;
  }

  function sanitizeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\//g, '&#x2F;');
  }

  function sanitizeInput(str, max) {
    return String(str == null ? '' : str)
      .replace(/[\u0000-\u001F\u007F]/g, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, '')
      .trim()
      .slice(0, max || 500);
  }

  function rateLimited() {
    var now = Date.now(), list = [];
    try { list = JSON.parse(localStorage.getItem(RL_KEY) || '[]'); } catch (e) {}
    list = list.filter(function (t) { return now - t < RL_WINDOW; });
    if (list.length >= RL_MAX) return true;
    list.push(now);
    try { localStorage.setItem(RL_KEY, JSON.stringify(list)); } catch (e) {}
    return false;
  }

  function looksLikeBot(form) {
    var elapsed = Date.now() - loadTime;
    var honeypot = form && form.querySelector('input[name="website"], input[name="bot-field"]');
    if (honeypot && honeypot.value) return true;
    if (elapsed < 3000) return true;          // demasiado rápido
    if (interactions < 2) return true;        // sin interacción humana
    if (navigator.webdriver) return true;
    return false;
  }

  ['keydown', 'mousemove', 'touchstart', 'focusin'].forEach(function (ev) {
    document.addEventListener(ev, function () { interactions++; }, { passive: true });
  });

  document.addEventListener('securitypolicyviolation', function (e) {
    console.warn('[CSP] bloqueado:', e.blockedURI, e.violatedDirective);
  });

  function injectHiddenFields() {
    var token = getToken();
    // Solo formularios que van a la función propia; Netlify Forms no necesita estos campos
    document.querySelectorAll('form[action*="/.netlify/functions/handler"]').forEach(function (f) {
      var c = f.querySelector('input[name="csrf_token"]');
      if (!c) { c = document.createElement('input'); c.type = 'hidden'; c.name = 'csrf_token'; f.appendChild(c); }
      c.value = token;
      var s = f.querySelector('input[name="_submit_time"]');
      if (!s) { s = document.createElement('input'); s.type = 'hidden'; s.name = '_submit_time'; f.appendChild(s); }
      s.value = String(loadTime);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', injectHiddenFields);
  else injectHiddenFields();

  window.ABPSecurity = {
    getToken: getToken,
    sanitizeHTML: sanitizeHTML,
    sanitizeInput: sanitizeInput,
    rateLimited: rateLimited,
    looksLikeBot: looksLikeBot
  };
})();
