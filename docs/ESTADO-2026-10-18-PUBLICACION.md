# Estado de Kaizo al final del 18 de octubre de 2026: ya está publicada (para retomar)

**La app está en línea:** https://kaizoresumebuilder.vercel.app (la dirección vieja `ai-resume-writer-seven.vercel.app` redirige a esta).
Código en GitHub `mramos822/ai-resume-writer`, rama **`main`** (es la que publica Vercel), último commit `fa39221`. 511 pruebas en 78 suites, `tsc` limpio.
Único archivo sin commit: `src/lib/plans.ts` (los pagos, en pausa). La rama `app-redesign` quedó atrás; ya no hace falta: se trabaja en `main`.

## 1. Lo que se hizo hoy (además de lo del recap de la mañana, `docs/ESTADO-2026-10-18.md`)

### Fuentes de empleos y datos
- **Sueldos:** se quitaron las estimaciones de Adzuna; `payFromText` lee el sueldo del texto en **cualquier moneda** (soles, pesos, reales, euros, rupias…), con unidades en español, portugués, alemán y francés; "$" suelto = pesos del país del empleo. Medido con 6,000 anuncios reales: 4,381 → 5,197 leídos.
- **Índice propio: unos 32,000 empleos.** Se sumaron Workable, Recruitee y Teamtailor (106 empresas, incluyendo Latinoamérica), **Computrabajo** (Perú y Chile, 14 piezas, lectura lenta y educada), **Get on Board** (~990, tecnología de LatAm), **USAJOBS** (2,000 federales), **Remote OK** (99), **Jobicy** (100).
- **Ingesta en llamadas que caben en el minuto de Vercel Hobby** (medido EN Vercel): empresas 44 s, agregadores (`{"only":"feeds"}`) 25 s, SmartRecruiters 7 s, una pieza de Computrabajo (`{"only":"computrabajo","part":N}`) ~49 s.
- **"Add a job":** probado con un anuncio real de ~25 portales (`docs/ENLACES-PORTALES.md`). Se leen LinkedIn, Dice, Wellfound, USAJOBS, Computrabajo, Chiletrabajos, Elempleo, Catho, Get on Board, Reed, Jobs.ch… **No se leen** Indeed, Glassdoor, ZipRecruiter, Monster, OCC, CV-Library: bloquean programas (401/403/verificación humana); la app lo dice y ofrece pegar el texto (no se evade la protección). Enlace de empresa de Computrabajo con `#id` abre ese anuncio; un enlace a una lista se avisa; botón **X** para borrar el enlace; límite de 45 s.
- **Caché y enlaces:** lo leído desde un enlace se guarda 14 días (`job_imports`, nunca el texto pegado a mano); un anuncio de Computrabajo agregado entra al índice general al instante; cualquier otro entra cuando lo agrega una **segunda persona distinta**; cada empleo tiene enlace propio `/home/job-ads?job=<clave>` con botón "Copiar enlace".
- **Países:** el selector ahora lista los 19 de Adzuna más ~50 donde el índice tiene empleos (incluye todos los de habla hispana de América).
- Careerjet: la clave está guardada (`CAREERJET_API_KEY` en `.env.local`); **la integración NO está hecha**.

### Publicación en Vercel (esto es lo nuevo de la noche)
- **MongoDB Atlas:** acceso desde cualquier IP (`0.0.0.0/0`) agregado; usuario nuevo **`kaizo_app`** para la app publicada (el usuario `marianojramos_db_user` es atlasAdmin y NO se usa en Vercel). La app publicada y la local **comparten la misma base (`test`) y las mismas cuentas de Firebase**.
- **Firebase:** `kaizoresumebuilder.vercel.app` agregado a dominios autorizados.
- **Vercel (plan Hobby, no comercial):** proyecto `ai-resume-writer`, rama de producción `main`, 18 variables importadas desde `.env.vercel` + `NEXT_PUBLIC_SITE_URL` (solo Production). Dominio elegido: `kaizoresumebuilder.vercel.app`.
- Comprobado en producción: `/api/health` ok, `robots.txt` con la dirección nueva, la ingesta sin clave da 401, las cuatro llamadas de ingesta funcionan.
- **Error encontrado en producción y arreglado:** generar el PDF fallaba (`Cannot find module '…/pdfkit/js/standard-fonts/Helvetica.cjs'`: Vercel no empaquetaba las fuentes de pdfkit; también rompía la medición de página de la revisión de CV). Arreglo en `next.config.ts` (`outputFileTracingIncludes`), commit `5aa0734`, **desplegado, pero el usuario todavía NO lo ha vuelto a probar**.
- **Error de la vista previa arreglado** (commit `fa39221`): con "Let Kaizo decide", pasar de una plantilla de una hoja a una de dos y volver dejaba el corte en dos hojas (`fit()` no limpiaba `split` en la rama de columnas). Verificado en el navegador.

## 2. Decisiones y reglas del usuario (acumuladas)
- Beta **gratis** en Vercel Hobby (sin cobrar ni anuncios); antes de cobrar: Vercel Pro, abogado, LLC, Stripe en prueba. Si Careerjet paga por clics es ingreso: pasar antes a Pro.
- Computrabajo: el usuario revisó sus términos y **sí permiten** leer los anuncios (no hay API pública). Se lee sin saltarse nada: respeta `robots.txt`, ≥1 s entre peticiones, un anuncio una sola vez, se detiene a la primera 403/429.
- No evadir protecciones anti-bots (Cloudflare, etc.); no guardar ni compartir texto pegado a mano.
- "El nombre `.vercel.app` no me gustaba": cambiado a `kaizoresumebuilder`. Un dominio propio (~USD 10-15 al año) queda para después.

## 3. Mis errores y cuidados de hoy
- **Adzuna me bloqueó la conexión (403)** porque pedí ~400 páginas seguidas para medir formatos. Sigue bloqueada o puede estarlo: no lanzar lecturas masivas.
- Varias veces pegaste claves o contraseñas en el chat (clave de USAJOBS, clave de Careerjet, contraseña de `kaizo_app`): **cámbialas** (ver pendientes). `.env.local` y `.env.vercel` están en `.gitignore` y nunca se subieron (se escaneó el historial).
- Los scripts de shell con `bash -e`/heredocs **se comen los backslashes** de las expresiones regulares: se editó con la herramienta de edición o con códigos de carácter explícitos.
- El usuario `kaizo_app` tiene el rol "en cualquier base"; conviene dejarlo en `readWrite` solo sobre `test`.

## 4. Pendiente, en el orden que recomiendo
1. **Probar generar el PDF y la revisión de CV en la web publicada** (arreglo ya desplegado). Si falla: Vercel → Logs → errores, y pegar la línea.
2. **Cambiar las credenciales que se pegaron en el chat:** contraseña de `kaizo_app` (Atlas → Database Users → Edit; actualizar `MONGODB_PASS` en Vercel y `MONGODB_PASS_VERCEL` en `.env.local`, y volver a desplegar), clave de USAJOBS y clave de Careerjet si compartes la conversación.
3. **Borrar `C:\Users\Mariano\Desktop\ai-resume-writer\.env.vercel`** (contiene todos los secretos; ya se importó).
4. **Secretos de GitHub** (Settings → Secrets and variables → Actions): `SITE_URL` = `https://kaizoresumebuilder.vercel.app` y `CRON_SECRET` (el mismo de `.env.local`). Con eso corren solas la lectura con IA (`enrich-jobs.yml`), y los agregadores + Computrabajo (`ingest-extra.yml`, cada 8 h). Ejecutar `ingest-extra` a mano un par de veces para llenar Computrabajo (quedan 12 de las 14 piezas).
5. **Careerjet:** conectarlo como bloque "ver más empleos" en los resultados (su API pide la IP y el navegador del visitante y da solo un extracto de 120 caracteres; no entra al índice).
6. Vercel: Settings → Functions → **Region** cerca del cluster de Atlas (no verificado); revisar `/api/stats/stream` (los registros muestran "Task timed out after 300 seconds": es un flujo continuo, ver si consume tiempo de función); dominio propio.
7. **Workday** para empresas grandes de Perú y Chile: su lista pública responde en JSON sin clave (probado con NVIDIA), falta ver el texto completo, qué empresas locales lo usan y sus términos.
8. Etiqueta "Jobs by Adzuna" + licencia de Adzuna tras los 14 días de prueba; abogado (términos, privacidad, uso de datos de las fuentes); LLC; Stripe en prueba (`src/lib/plans.ts` es el comienzo); política de privacidad y avisos antes de abrir al público (una beta cerrada, solo con invitados, puede empezar sin eso).
9. Otros abiertos de antes: login con LinkedIn, mover proyectos viejos de Internships a Projects, quejas del informe QA, el rebote de la barra inferior en celular, habilidades mal leídas (".JFF", "Ruby") en el panel de "también piden".
10. Un *bookmarklet* o extensión de Chrome "Enviar a Kaizo" sería la salida real para Indeed, Glassdoor y los sitios que bloquean programas.

## 5. Cómo retomar
- Servidor local: `npm run dev` (puerto 3000). Pruebas: `npx jest`, `npx tsc --noEmit`, `npx eslint src`. Compilación de producción de prueba: `NEXT_DIST_DIR=.next-check npx next build`, después `git restore public/sw.js public/workbox-*.js tsconfig.json`.
- Cargar el índice en producción: `POST https://kaizoresumebuilder.vercel.app/api/admin/ingest-jobs` con `Authorization: Bearer <CRON_SECRET>` y cuerpo `{}` (empresas), `{"only":"feeds"}`, `{"only":"smartrecruiters"}`, `{"only":"computrabajo","part":0..13}`.
- Trabajar en `main` (Vercel despliega cada push). Guía completa de publicación: `docs/PUBLICAR-BETA.md`; operación: `docs/OPERATIONS.md`; portales: `docs/ENLACES-PORTALES.md`.
- Variables nuevas: `USAJOBS_API_KEY`, `USAJOBS_EMAIL`, `CAREERJET_API_KEY`, `CRON_SECRET`, `MONGODB_USER_VERCEL`, `MONGODB_PASS_VERCEL` (estas dos últimas solo en `.env.local`).
