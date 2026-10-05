# ABP Sport – Capa de seguridad de formularios

## Archivos
| Archivo | Función |
|---|---|
| `public/1-security-fixes.js` | Token CSRF (double-submit cookie), sanitización XSS, rate limit cliente, antibots |
| `public/6-app-improvements.js` | Validación en tiempo real, envío JSON con `X-CSRF-Token`, anti doble envío |
| `netlify/functions/handler.js` | Validación servidor: CSRF, rate limit por IP (5/h inscripción, 3/h contacto), UA/honeypot/tiempo, sanitización |
| `netlify.toml` | Cabeceras HSTS, CSP, X-Frame-Options, nosniff, caché |

## Integración
1. En el `<head>` de cada página con formulario:
   ```html
   <script src="/1-security-fixes.js" defer></script>
   <script src="/6-app-improvements.js" defer></script>
   ```
2. Formularios:
   ```html
   <form method="POST" action="/.netlify/functions/handler?action=inscripcion"> <!-- o contacto -->
     <input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
     <div class="form-group">
       <label for="nombre">Nombre *</label>
       <input id="nombre" name="nombre" data-validate required>
       <span class="error-message"></span>
     </div>
     <!-- email, telefono, edad, disciplina (inscripción) | email, mensaje (contacto) -->
     <button type="submit">Enviar</button>
   </form>
   ```
   Los campos ocultos `csrf_token` y `_submit_time` se inyectan solos.
3. CSS:
   ```css
   [aria-invalid="false"]{border-color:#16a34a;background:#f0fdf4}
   [aria-invalid="true"]{border-color:#dc2626;background:#fef2f2}
   .error-message{color:#dc2626;font-size:12px;margin-top:4px}
   ```

## Variables de entorno (Netlify)
- `ALLOWED_ORIGINS` (por defecto `https://abpsports.es,https://www.abpsports.es`)
- `DISCIPLINAS` (lista separada por comas)

## Estado de la integración (rama security)
- `public/` contiene el sitio completo (copia del deploy en producción del 05/10/2026).
- `inscripcion.html` y `contacto.html` cargan los dos scripts; sus formularios llevan `data-secure` y siguen usando **Netlify Forms** (validación y antibots en cliente + honeypot de Netlify).
- `handler.js` queda disponible para cuando se quiera una función propia (`action="/.netlify/functions/handler?action=..."`); hoy no lo usa ningún formulario.
- CSP permite `'unsafe-inline'` en scripts porque las páginas usan `<script>` inline y `onchange`. Quitarlo exige mover ese código a archivos `.js`.
- `/inscripcion-legal` redirige temporalmente (302) a `/inscripcion#reserva` hasta que exista esa página.

## Pendiente
- Crear la página de inscripción legal online (contrato + DNI) o cambiar el botón.
- Subir los PDF de `docs/` (enlazados en `gracias.html`, hoy dan 404).
- El sitio se publica por subida manual: conectar este repo en Netlify (rama `main`, publish `public`) para que el merge despliegue.
- Activar en Netlify > Forms las notificaciones por email.
