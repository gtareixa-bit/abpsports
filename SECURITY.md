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

## Antes de hacer merge
- Verificar que la CSP no bloquea scripts/estilos inline actuales (consola → `[CSP] bloqueado`).
- Si `netlify.toml` del sitio ya existe en otro repo/config, fusionar las cabeceras.
- El rate limit en memoria es por instancia; para límite estricto usar Netlify Blobs/Upstash.
- Conectar el `TODO` de notificación (Resend/SendGrid) y cumplir RGPD (no loguear datos personales).
