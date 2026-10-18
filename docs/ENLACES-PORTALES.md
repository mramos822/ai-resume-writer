# Qué portales se pueden pegar con "Add a job" (probado el 18 de octubre de 2026)

Se probó con **un anuncio real de cada portal** (una petición por sitio, con pausa), pegándolo como lo hace una persona. "Se lee" quiere decir que
el servidor descargó la página y la IA sacó título, empresa, lugar y requisitos. "No se lee" quiere decir que el propio sitio rechaza a los programas
(401, 403, 429 o una verificación humana tipo Cloudflare): **no se intenta saltar**; la app lo dice enseguida y ofrece **Paste the text**.

| Región | Se lee | No se lee (pegar el texto) |
|---|---|---|
| **EE. UU.** | LinkedIn (anuncio individual), Dice, Wellfound, Built In, USAJOBS, y los de las empresas (Greenhouse, Lever, Ashby, Workable, Workday…) | Indeed (401), Glassdoor, ZipRecruiter, Monster, SimplyHired, CareerBuilder (verificación humana) |
| **Latinoamérica** | Computrabajo (todos los países; el de una empresa con `#id` también), Chiletrabajos, Trabajando.cl, Elempleo (Colombia), Catho, Vagas e InfoJobs (Brasil), Get on Board | OCC Mundial (403), Indeed de cada país (401/403) |
| **Europa** | Reed (UK), Welcome to the Jungle (Francia), Jobs.ch (Suiza), Pracuj.pl (Polonia) | CV-Library (403), InfoJobs España (verificación humana), Indeed de cada país; Totaljobs y StepStone no respondieron a tiempo |

- "Estructurado" (mejor lectura, con sueldo): LinkedIn, Dice, Wellfound, Chiletrabajos, Trabajando.cl, Elempleo, Catho, Vagas, Reed, Welcome to the Jungle,
  Jobs.ch, Computrabajo. En los otros la IA lee el bloque principal de la página (`<main>`/`<article>`), con menos precisión.
- Sueldos leídos del propio anuncio en su moneda: p. ej. `COP 4,500,001 – COP 5,500,000 per month` (Elempleo), `CHF 87,500 – CHF 127,500` (Jobs.ch).
- Un enlace de **lista** (página de una empresa, resultados de búsqueda) no es un anuncio: la app lo dice. Los de Computrabajo con `#id` abren el anuncio.
- Los resultados cambian: los sitios ajustan sus protecciones. Volver a probar con un anuncio real cada pocos meses.

## Lo que no se puede arreglar desde el servidor
Un sitio que bloquea a los programas solo se puede leer desde el navegador de la persona. Ideas, en orden de esfuerzo:
1. Lo que ya hay: copiar el texto del anuncio y pegarlo en "Paste the text" (nunca se guarda ni se comparte).
2. Un *bookmarklet* "Enviar a Kaizo" que copia el texto y los datos del anuncio abierto en la pestaña de la persona.
3. Una extensión de Chrome que lo envíe directamente a su cuenta (la lectura la hace su navegador, con su sesión).
