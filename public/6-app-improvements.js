/* ABP Sport – 6-app-improvements.js
 * Validación en tiempo real, envío con cabecera CSRF y prevención de doble envío.
 * Requiere 1-security-fixes.js cargado antes.
 * Funciona con la función propia (fetch + CSRF) y con Netlify Forms (form[data-secure], envío nativo).
 */
(function () {
  'use strict';
  var S = window.ABPSecurity;
  var RULES = {
    nombre: { re: /^[A-Za-zÀ-ÿñÑ' -]{2,80}$/, msg: 'Nombre no válido (2-80 letras).' },
    alumno_nombre: { re: /^[A-Za-zÀ-ÿñÑ' -]{2,80}$/, msg: 'Nombre no válido (2-80 letras).' },
    tutor_nombre: { re: /^[A-Za-zÀ-ÿñÑ' -]{2,80}$/, msg: 'Nombre no válido (2-80 letras).' },
    dni_nie: { re: /^([0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z]|[A-Za-z0-9]{6,12})$/, msg: 'Documento no válido.' },
    telefono_emergencia: { re: /^\+?[0-9 ]{9,15}$/, msg: 'Teléfono no válido.' },
    tutor_dni: { re: /^([0-9]{8}[A-Za-z]|[XYZxyz][0-9]{7}[A-Za-z])$/, msg: 'DNI/NIE no válido.' },
    email: { re: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, msg: 'Email no válido.' },
    telefono: { re: /^\+?[0-9 ]{9,15}$/, msg: 'Teléfono no válido.' },
    edad: { test: function (v) { var n = +v; return n >= 4 && n <= 99; }, msg: 'Edad entre 4 y 99.' },
    mensaje: { test: function (v) { return v.length >= 5 && v.length <= 2000; }, msg: 'Mensaje entre 5 y 2000 caracteres.' }
  };

  function check(el) {
    var v = (el.value || '').trim();
    var rule = RULES[el.name];
    var ok = true, msg = '';
    if (el.required && !v) { ok = false; msg = 'Campo obligatorio.'; }
    else if (v && rule) {
      ok = rule.re ? rule.re.test(v) : rule.test(v);
      if (!ok) msg = rule.msg;
    }
    el.setAttribute('aria-invalid', ok ? 'false' : 'true');
    var span = el.parentNode && el.parentNode.querySelector('.error-message');
    if (!span && el.parentNode && el.type !== 'checkbox') {
      span = document.createElement('span'); span.className = 'error-message'; span.setAttribute('aria-live', 'polite');
      el.parentNode.appendChild(span);
    }
    if (span) span.textContent = msg;
    return ok;
  }

  function showStatus(form, text, isError) {
    var box = form.querySelector('.form-status');
    if (!box) { box = document.createElement('div'); box.className = 'form-status'; box.setAttribute('role', 'status'); form.appendChild(box); }
    box.textContent = text; // textContent: sin riesgo XSS
    box.style.color = isError ? '#dc2626' : '#16a34a';
  }

  function bind(form) {
    var fields = form.querySelectorAll('[data-validate]');
    fields.forEach(function (el) {
      el.addEventListener('blur', function () { check(el); });
      el.addEventListener('input', function () { if (el.getAttribute('aria-invalid')) check(el); });
    });

    var native = !/\/\.netlify\/functions\/handler/.test(form.getAttribute('action') || '');
    form.addEventListener('submit', function (e) {
      if (form.dataset.sending === '1') { e.preventDefault(); return; }
      var ok = true;
      fields.forEach(function (el) { if (!check(el)) ok = false; });
      if (native) {
        // Netlify Forms: validar y dejar que el envío nativo siga su curso
        if (!ok) { e.preventDefault(); return showStatus(form, 'Revisa los campos marcados.', true); }
        if (S && S.looksLikeBot(form)) { e.preventDefault(); return showStatus(form, 'No se pudo enviar. Inténtalo de nuevo.', true); }
        if (S && S.rateLimited()) { e.preventDefault(); return showStatus(form, 'Demasiados intentos. Espera un minuto.', true); }
        form.dataset.sending = '1';
        var b = form.querySelector('[type="submit"]'); if (b) b.disabled = true;
        return;
      }
      e.preventDefault();
      var allOk = true;
      fields.forEach(function (el) { if (!check(el)) allOk = false; });
      if (!allOk) return showStatus(form, 'Revisa los campos marcados.', true);
      if (S && S.looksLikeBot(form)) return showStatus(form, 'No se pudo enviar. Inténtalo de nuevo.', true);
      if (S && S.rateLimited()) return showStatus(form, 'Demasiados intentos. Espera un minuto.', true);

      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = S ? S.sanitizeInput(v, 2000) : v; });
      var btn = form.querySelector('[type="submit"]');
      form.dataset.sending = '1'; if (btn) btn.disabled = true;

      fetch(form.action, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': S ? S.getToken() : '' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (res) {
          if (res.ok) { showStatus(form, res.j.message || '¡Enviado! Te contactaremos pronto.'); form.reset(); fields.forEach(function (el) { el.removeAttribute('aria-invalid'); }); }
          else showStatus(form, res.j.error || 'Error al enviar.', true);
        })
        .catch(function () { showStatus(form, 'Error de conexión.', true); })
        .finally(function () { form.dataset.sending = '0'; if (btn) btn.disabled = false; });
    });
  }

  function init() { document.querySelectorAll('form[action*="/.netlify/functions/handler"], form[data-secure]').forEach(bind); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
