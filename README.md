# Beibi Doll

Tienda online de ropa (San Juan, envíos a todo el país). Next.js 15 + Supabase + Mercado Pago, desplegada en Vercel.

Sin variables de entorno el sitio arranca en **vista previa**: catálogo y fotos de muestra, compras simuladas y panel de solo lectura.

## Puesta en marcha

1. **Supabase**: crear un proyecto (región São Paulo) y correr, en el SQL Editor y en orden:
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_seed.sql`
   - `supabase/migrations/0003_security.sql`
2. **Auth de Supabase**
   - Authentication > Sign In / Providers > Email: dejar activado "Allow new users to sign up" (las clientas crean su cuenta) y "Confirm email".
   - Authentication > Policies (o Passwords): mínimo 10 caracteres, letras y números, y activar **Require current password when changing password**.
   - Authentication > Multi-Factor: dejar **App Authenticator (TOTP)** habilitado (viene así). El panel obliga a usarlo.
   - Authentication > Attack Protection: activar **CAPTCHA** con Cloudflare Turnstile y pegar la Secret Key (la misma de `TURNSTILE_SECRET_KEY`).
   - Authentication > Users > Add user: crear la cuenta de Fernanda con email y contraseña.
   - URL Configuration: Site URL = dominio final; Redirect URLs = `https://DOMINIO/cuenta/callback`, `https://DOMINIO/cuenta/restablecer` y `https://DOMINIO/admin/restablecer`.
   - Darle permiso de administradora:
     ```sql
     insert into public.admins (user_id, email)
     select id, email from auth.users where email = 'EMAIL_DE_FERNANDA';
     ```
3. **Vercel**: importar el repo y cargar las variables de `.env.example`.
4. **Mercado Pago** (cuenta de Fernanda): Tus integraciones > crear aplicación (Checkout Pro).
   - Credenciales de producción: copiar el Access Token a `MP_ACCESS_TOKEN`.
   - Webhooks: URL `https://DOMINIO/api/mp/webhook`, evento **Pagos**. Copiar la clave secreta a `MP_WEBHOOK_SECRET`.
5. Entrar a `/admin`, completar **Envíos y pagos** (tarifas de Vía Cargo, alias, CBU, WhatsApp, datos legales) y cargar los productos.

## Productos: colores y talles

Cada prenda tiene colores (nombre + tono) y talles. Cada combinación color + talle tiene su propio stock y su aviso de "Avisame cuando vuelva". Las fotos se pueden marcar por color: cuando la clienta elige un color, la galería muestra esas fotos primero. El peso de cada prenda se usa para calcular el envío.

## Envíos

- **Retiro en el local**: gratis. Si se paga en efectivo, sólo con retiro.
- **Tarifas propias por provincia y peso** (por ejemplo, la tabla de Vía Cargo): se cargan en el panel. Cada tarifa vale para las provincias marcadas (sin marcar = todo el país) y tiene escalones de peso. La clienta pone su provincia y código postal y la tienda calcula sola. Si la tarifa es "a sucursal", se pide en qué sucursal retira.
- **Correo Argentino (opcional)**: con credenciales de la API de MiCorreo (`CORREO_API_USER`, `CORREO_API_PASSWORD`, `CORREO_CUSTOMER_ID`) y la opción activada en el panel, se suma la cotización en tiempo real a domicilio y a sucursal. Si la API no responde se ofrecen sólo las tarifas propias.
- El precio del envío siempre se recalcula en el servidor al confirmar el pedido (nunca se usa el que manda el navegador).

## Mails (Resend)

1. Crear cuenta en resend.com y verificar el dominio (registros DNS que indica Resend).
2. Cargar en Vercel `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` y `ADMIN_NOTIFY_EMAIL` y volver a publicar.
3. Supabase → Authentication → Emails → SMTP Settings: host `smtp.resend.com`, puerto 465, usuario `resend`, contraseña = la API key.
4. Supabase → Authentication → Emails → Templates: pegar los HTML de `supabase/email-templates/` (Confirm signup, Reset password, Change email).

Mails automáticos a la clienta: pedido recibido (transferencia o efectivo), pago confirmado, listo para retirar (retiro en el local), enviado (con empresa, plazo, sucursal y seguimiento), entregado, cancelado, arrepentimiento y "volvió tu talle". Avisos a la tienda de pedidos nuevos y arrepentimientos. El panel tiene un redactor de novedades con vista previa, prueba y baja en un clic.

## Cómo funciona el stock

- Al crear un pedido el stock se **reserva** en la base, de forma atómica: dos personas no pueden comprar la última unidad a la vez.
- Mercado Pago: la reserva dura 45 min. Si se aprueba el pago, el pedido pasa a "Pagado" solo (webhook firmado + verificación del monto contra la API de MP).
- Transferencia: 48 h. Efectivo al retirar: 72 h. Fernanda confirma el pago desde el panel.
- Si la reserva vence o se cancela el pedido, las unidades vuelven solas al stock.
- La reposición desde el panel suma diferencias (no pisa ventas que entren mientras edita).

## Seguridad

### Panel: verificación en dos pasos (obligatoria)
- Después de la contraseña, el panel pide el código de 6 números de una app del celular (Google o Microsoft Authenticator). La primera vez muestra un QR para vincularla.
- No es sólo una pantalla: la base (`is_admin()`) exige sesión `aal2`, así que sin el código no se puede leer ni cambiar nada aunque alguien tenga la contraseña.
- Si Fernanda pierde el celular, se reinicia desde el SQL Editor y vuelve a vincular al entrar:
  ```sql
  delete from auth.mfa_factors
  where user_id = (select id from auth.users where email = 'EMAIL_DE_FERNANDA');
  ```
- Cada cambio en los medios de pago (alias, CBU, titular…) queda registrado (`audit_log`, visible en Mi cuenta) y manda un mail de aviso.

### Anti-abusos
- Límite de intentos compartido entre servidores (tabla `rate_limits`, IP resumida con hash).
- Cloudflare Turnstile invisible en checkout, suscripción, avisos de stock, arrepentimiento, login y registro. Sin las claves queda apagado.
- Cupo diario de mails: las novedades nunca dejan sin mails a las compras; lo que no entra sale solo en los días siguientes (`EMAIL_DAILY_LIMIT`).
- Avisos por mail a la tienda si falla una compra, Mercado Pago no responde o llega un pago que no coincide con el pedido (máx. uno por hora por tipo).

### GitHub
- **Dependabot** (`.github/dependabot.yml`): PRs semanales con actualizaciones.
- **Revisión** (`.github/workflows/ci.yml`): tipos, build y `npm audit` en cada cambio.
- **Backup de la base** (`.github/workflows/backup.yml`): diario y cifrado. Cargar los secrets `SUPABASE_DB_URL` (Session pooler) y `BACKUP_PASSPHRASE`. Cómo restaurar: `docs/RESTAURAR.md`.

### Resto

- RLS en todas las tablas. El público sólo lee productos activos y ajustes.
- Los pedidos se crean únicamente desde el servidor; precios, descuentos, tarifas y peso se recalculan en Postgres.
- El estado de un pedido sólo cambia por funciones que mueven el stock; la administradora no puede editarlo a mano.
- Fotos: bucket público de lectura, escritura sólo administradoras, máx. 8 MB, sólo imágenes. Se convierten a WebP en el navegador (se borran metadatos como la ubicación GPS).
- Cabeceras: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`. Panel y páginas de pedido con `noindex` y `no-store`.
- Checkout, cotizador de envío y botón de arrepentimiento con control de origen, límite de intentos y trampa anti-bots.

## Requisitos legales incluidos

- Botón de arrepentimiento en el pie de todas las páginas (Res. SCI 424/2020) con código de trámite.
- Enlace a Defensa de las y los Consumidores y espacio para el QR de Data Fiscal (ARCA).
- Términos, privacidad (Ley 25.326) y política de cambios. **Revisarlos con su contador o abogado antes de publicar.**
