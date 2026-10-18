# Publicar la beta de Kaizo (gratis, sin cobrar)

Esta guía es para publicar la app en **Vercel (plan Hobby)** con tu propio dominio. El plan gratis de Vercel **no permite uso comercial**:
mientras no cobres ni pongas anuncios, está bien. Antes de cobrar, pasa a Vercel Pro (unos USD 20 al mes) o a otro servicio que lo permita.
Lo que no se puede hacer desde el código (cuentas, claves, dominio) lo haces tú; aquí está en orden.

## 0. Antes de empezar
- El código está en GitHub: `mramos822/ai-resume-writer`, rama `app-redesign`.
- Nunca subas `.env.local`: está en `.gitignore` y tiene tus claves.
- Si alguna clave se pegó alguna vez en un chat, una captura o un log, cámbiala (ver `docs/OPERATIONS.md`).

## 1. MongoDB Atlas (la base de datos)
1. **Network Access** → *Add IP Address* → *Allow access from anywhere* (`0.0.0.0/0`). Vercel no tiene IP fija; la seguridad es el usuario y
   la contraseña de la base de datos (usa una contraseña larga y distinta de las demás).
2. Anota `MONGODB_USER`, `MONGODB_PASS` y `MONGODB_HOST` (el de tu cluster, algo como `xxxx.mongodb.net`).
3. **Importante:** la app usa la base de datos por defecto de la conexión (`test`). **No inventes un valor para `MONGODB_DB` pensando que es el
   nombre de la base**: en el código solo se usa como nombre de la conexión. Déjalo vacío o igual que en tu `.env.local`.
4. El plan gratis (M0) tiene 512 MB y **no tiene copias de seguridad**. La ingesta se detiene sola a los 380 MB. Con usuarios reales, pasa a
   un plan con backups.

## 2. Firebase (inicio de sesión)
1. **Authentication → Settings → Authorized domains** → agrega `tu-app.vercel.app` y, cuando lo tengas, tu dominio propio (`kaizo.app`, etc.).
   Sin esto, el inicio de sesión con Google falla en producción.
2. Publica las reglas: `firebase deploy --only firestore:rules` (archivo `firestore.rules`).
3. **Project settings → Service accounts → Generate new private key**: el JSON completo, **en una sola línea**, es `FIREBASE_ADMIN_KEY`.
4. Las variables `NEXT_PUBLIC_FIREBASE_*` salen de **Project settings → General → Your apps** (son las mismas de tu `.env.local`).

## 3. Vercel
1. Crea la cuenta con tu GitHub → **Add New… → Project** → importa `ai-resume-writer`.
2. **Rama de producción:** Vercel publica `main` por defecto, y tus cambios están en `app-redesign`. Elige una:
   - Abre un Pull Request de `app-redesign` a `main`, revísalo y únelo (lo más ordenado), o
   - En **Settings → Git → Production Branch** escribe `app-redesign`.
3. **Settings → Functions → Region:** elige la región más cercana a tu cluster de Atlas (si está en AWS Virginia, `iad1`). Acerca la app a la
   base de datos y baja la latencia de cada búsqueda.
4. **Settings → Environment Variables** (Production y Preview):

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | La dirección final, con `https://` (ej. `https://kaizo.app`). Sirve para los enlaces canónicos y el sitemap. |
| `NEXT_PUBLIC_FIREBASE_API_KEY`, `..._AUTH_DOMAIN`, `..._PROJECT_ID`, `..._STORAGE_BUCKET`, `..._MESSAGING_SENDER_ID`, `..._APP_ID` | Firebase → Project settings (paso 2.4) |
| `FIREBASE_ADMIN_KEY` | JSON de la cuenta de servicio en una línea (paso 2.3) |
| `MONGODB_USER`, `MONGODB_PASS`, `MONGODB_HOST` | Atlas (paso 1) |
| `AI_API_KEY` | Tu clave de Google AI Studio (Gemini). La gratis tiene límites bajos. |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | developer.adzuna.com |
| `ADMIN_EMAILS` | Tu correo (ves el buzón de mensajes de contacto). |
| `CRON_SECRET` | 16 o más caracteres al azar. Lo usa Vercel para llamar a los cron; también sirve para lanzar la ingesta a mano. |
| `CONTACT_WEBHOOK_URL` | Opcional: un aviso en Slack/Discord por cada mensaje de contacto. |
| `JOB_FACTS_PER_DAY` | Opcional (por defecto 150): cuántos empleos lee la IA por día. Súbelo solo si activas la facturación de Gemini. |

5. **Deploy.** La primera vez tarda unos minutos.

## 4. Después del primer deploy
1. Abre `https://tu-app.vercel.app/api/health`: debe decir `{"status":"ok"}` (significa que la base responde y que se aplicaron las migraciones).
2. Inicia sesión con Google y comprueba: crear un CV, descargar el PDF, buscar empleos y abrir uno.
3. **Carga el índice de empleos** (la búsqueda queda vacía hasta que corra la ingesta; si no la lanzas, corre sola a las 6 h de la primera búsqueda):
   ```
   curl -X POST https://tu-app.vercel.app/api/admin/ingest-jobs -H "Authorization: Bearer TU_CRON_SECRET"
   curl -X POST "https://tu-app.vercel.app/api/admin/ingest-jobs?only=smartrecruiters" -H "Authorization: Bearer TU_CRON_SECRET"
   ```
   La primera tarda unos 40 s y devuelve cuántos empleos leyó. La segunda lee las empresas de SmartRecruiters (repítela 2 o 3 veces: lee
   120 empleos nuevos por empresa en cada corrida).
4. Revisa en **Vercel → Settings → Cron Jobs** que aparezcan los dos del archivo `vercel.json`
   (`/api/admin/ingest-jobs` a las 06:00 UTC y `?only=smartrecruiters` a las 06:30 UTC). La segunda también hace la limpieza diaria de la
   política de privacidad (sesiones de invitado de 30 días y mensajes viejos).

### Que el número de cada empleo sea el real desde el principio (opcional, recomendado)
La IA lee cada empleo una sola vez (años, nivel, habilidades) y el porcentaje deja de ser un estimado (~). Para que lea **todos** antes de que
nadie los vea hay una tarea lista: `.github/workflows/enrich-jobs.yml` llama cada 5 minutos a `/api/admin/enrich-jobs`.
1. En GitHub → **Settings → Secrets and variables → Actions**, crea `SITE_URL` (`https://tu-dominio`, sin barra al final) y `CRON_SECRET` (el mismo de Vercel).
2. Con la clave **gratis** de Gemini solo caben unas 150 lecturas al día (`JOB_FACTS_PER_DAY`, por defecto 150). Para leer miles al día activa la
   **facturación** de Gemini y sube `JOB_FACTS_PER_DAY` (por ejemplo 3000). Cada lectura usa unos 3 mil tokens: calcula el costo con el precio actual de tu modelo.
   Medido con la clave gratis: sostiene unas **10 lecturas por minuto** si van de a una (una ráfaga rápida la deja en "ocupada"). Por eso el proceso lee
   de a una, con 3 s de pausa: cada llamada (45 s) lee unas 8 y, llamada cada 5 minutos, son unas 2,300 al día (si subes `JOB_FACTS_PER_DAY`). Con una clave de
   pago puedes subir `ENRICH_PARALLEL` (por ejemplo 4) y `ENRICH_PAUSE_MS` baja a 1000 para leer mucho más rápido.
3. Sin esto la app funciona igual: lee a demanda (al abrir un empleo y los 10 de la pantalla) y marca con **~** los que aún no se leyeron.

## 5. Tu propio dominio
1. Compra el dominio en un registrador (Namecheap, Cloudflare, Porkbun…; unos USD 10–15 al año).
2. **Vercel → Settings → Domains → Add** y escribe el dominio. Vercel te dice qué registros DNS poner (un `A` o un `CNAME`).
3. En el panel del registrador crea esos registros. El HTTPS se activa solo (puede tardar unos minutos).
4. Cuando funcione: pon el dominio en `NEXT_PUBLIC_SITE_URL`, agrégalo a los dominios autorizados de Firebase (paso 2.1) y vuelve a desplegar.
5. Cambiar de hosting después es mover las variables de entorno, apuntar el DNS y repetir el cron: no se pierden usuarios ni datos
   (la base está en Atlas y las cuentas en Firebase).

## 6. Límites del plan gratis de Vercel (Hobby)
- Solo uso no comercial: sin cobros, sin anuncios.
- Cada función dura como máximo 60 segundos (la ingesta usa unos 40 s).
- Los cron corren a lo sumo una vez al día cada uno, y se permiten 2 (comprueba el límite actual en la documentación de Vercel).
- Los límites de peticiones de `src/lib/rateLimit.ts` se cuentan por servidor, y en Vercel hay varios: son aproximados (ver `docs/OPERATIONS.md`).

## 7. Lo que sigue en tu lista antes de cobrar (no de la beta)
Revisión de un abogado (términos, privacidad, uso de datos de Greenhouse, Lever, Ashby, SmartRecruiters y Adzuna), LLC, etiqueta
"Jobs by Adzuna" que exigen sus términos, cuenta de Stripe, plan Pro de Vercel y facturación de Gemini.
