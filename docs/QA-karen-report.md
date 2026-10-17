# Reporte de inspección "Karen" de Kaizo

Fecha: 17 de octubre de 2026. Rama `app-redesign`. Servidor local en `http://localhost:3000`.
Cuenta de prueba: `kaizoapp.contacto@gmail.com` (Google), con el currículum de ejemplo "Taylor Cook" (se conserva, como se pidió). Correo de contacto de las políticas: sin cambios.

**Cómo se hizo.** Dos pasadas quisquillosas, la segunda con el doble de minuciosidad:
1. Recorrido real en el navegador con una cuenta nueva: creador, parseo de un PDF, revisión con IA, "Fix all", panel, búsqueda de empleo, postulación completa, vista previa del PDF, Personalizar, Contacto, español.
2. Pruebas de código y de máquina: lint, 25 diseños de PDF × 8 casos extremos × 2 longitudes, sondeo de la API sin sesión, auditoría automática de cada pantalla (alt, nombres de botones, etiquetas, encabezados, ids repetidos, tamaños de texto y de botones, contraste, foco de teclado, rendimiento), emulación de móvil de 380 px con un iframe, metadatos y cabeceras.

**Etiquetas.** **REAL**: lo comprobé. **OPINIÓN**: mi gusto de Karen. **NO PROBADO**: no pude verificarlo. Estado: **ARREGLADO** (en el árbol de trabajo, sin commit) o **ABIERTO**.

---

## 1. Fallos graves (datos perdidos o que no funcionan)

| # | Queja | Estado |
|---|---|---|
| 1 | **Se borraban puestos al subir un currículum.** Se fundían puestos de empresas distintas si compartían una palabra del título y el mes de inicio. 10 puestos pasaron a 1. | ARREGLADO (`profileDedupe.ts`, 4 tests) |
| 2 | **Leer un archivo borraba las preferencias** (color, longitud, orden de secciones). | ARREGLADO (`parse/route.ts`, `onboarding.tsx`) |
| 3 | **La experiencia se calculaba sumando puestos simultáneos.** 10 puestos de dic. 2015 a may. 2019 daban "30,8 años" y nivel Senior; ahora "3,4 años", Mid-level. Eso inflaba el nivel, el buscador y los textos de la IA. | ARREGLADO (`reviewRubric.ts`, 5 tests) |
| 4 | **Essential se caía con dos páginas** (`ENOENT Carlito-Bold`). | ARREGLADO, con test |
| 5 | **El corte partía tablas** y dejaba títulos huérfanos. | ARREGLADO |
| 6 | **La IA tardaba casi un minuto** (modelo 3.7 con 429/503). Ahora 4,5 s. | ARREGLADO (`.env.local`) |
| 7 | **El texto de la IA decía "demasiado cargado para una página"** aunque hubieras elegido dos, y no se recalculaba al cambiar la longitud. | ARREGLADO: los prompts conocen el formato, la longitud y la página 2; y se recalcula solo |
| 8 | Entrar con Google en "Iniciar sesión" creaba cuenta sin confirmar la edad. | ARREGLADO |
| 9 | Cualquier usuario con sesión podía analizar el archivo de otro. | ARREGLADO |
| 10 | Al borrar la cuenta no se borraba la caché de IA. | ARREGLADO |
| 11 | "Fix it for me" bloqueaba todo. Ahora hay una **cola**: el botón pulsado pasa a "Waiting…" y luego a "Writing…", se aplican de uno en uno y "Fix all" sigue activo mientras quede uno. | ARREGLADO (probado en pantalla) |
| 12 | La longitud solo se elegía al crear o postular. Ahora también en Personalizar. | ARREGLADO |

## 2. Quejas de la primera pasada: estado

| # | Queja | Estado |
|---|---|---|
| 13 | Sesión sin verificar: unas pantallas la aceptaban y otras te echaban a la página pública. | ARREGLADO: ahora te llevan a iniciar sesión (`authContext`) |
| 14 | `Missing or insufficient permissions` en cada carga con cuenta nueva. | ARREGLADO en el código (ya no es un error rojo); **falta publicar las reglas** de Firestore: añadí `firestore.rules` |
| 15 | El nombre se guardaba en MAYÚSCULAS. | ARREGLADO para lecturas nuevas (`nameCase.ts`, tests); el saludo también normaliza lo ya guardado |
| 16 | "Here's what we found" ocultaba teléfono, ciudad, resumen y puesto. | ARREGLADO |
| 17 | Saludo con el nombre de Google ("Kaizo") mientras el perfil es "TAYLOR COOK". | ARREGLADO |
| 18 | Títulos de pestaña mentirosos (`Kaizo \| Kaizo`, y "Kaizo Resume Builder" en Contacto, Inicio de sesión y Crear). | ARREGLADO |
| 19 | La página de registro mostraba "0" en el contador. | ARREGLADO: el número llega al instante |
| 20 | La lista de archivos se pedía cada 5 s, siempre. | ARREGLADO: 30 s y solo con la pestaña a la vista |
| 21 | Caracteres europeos perdidos en el PDF (Ł, č, ğ, griego, cirílico). | ARREGLADO con Carlito. **Chino, japonés, árabe y emoji siguen sin soporte** y se avisan |
| 22 | 2 `console.log` en producción y 3 `TODO` viejos. | ARREGLADO |
| 23 | ESLint: 1 error y unos 60 avisos; el lint estaba apagado en las compilaciones. | ARREGLADO: 0 errores, 33 avisos, y el lint ya se ejecuta al compilar |
| 24 | "Fix all" no decía cuántos puestos quitaba. | ARREGLADO: "N jobs removed" |
| 25 | El "1 Issue" rojo de Next. | NO ES DE LA APP: es el aviso de hidratación por el atributo `bis_skin_checked` que inyecta una extensión del navegador |
| 26 | El mensaje 502 de `review-resume/fix`. | POR DISEÑO: es el aviso de "la IA no pudo escribirlo ahora", con mensaje amable |
| 27 | "Profile complete! 100 %" con dirección, enlaces y proyectos vacíos. | ABIERTO (opinión: son secciones opcionales) |
| 28 | Letra diminuta con 16 puestos (Shokumu 46 %, Noir 48 %) y Blossom con 3 páginas. | ABIERTO: son diseños de una sola hoja; para eso existen "Dos páginas" y "Recortar por mí" |
| 29 | El correo de las políticas (`contact`) no coincide con la cuenta real (`contacto`). | SIN CAMBIOS, por petición |

## 3. Segunda revisión (el doble de minuciosa)

### Encontrado y ARREGLADO

| # | Queja | Etiqueta |
|---|---|---|
| 30 | **No había `robots.txt` ni `sitemap.xml`** (404), ni `canonical`, ni `og:url`; las páginas privadas (`/home`, `/build`, `/api`) no se marcaban como no indexables. | REAL |
| 31 | La cabecera `X-Powered-By: Next.js` estaba expuesta. | REAL |
| 32 | **No había página 404 ni de error propias**: se veía la genérica de Next, en inglés y sin marca. | REAL |
| 33 | **El formulario de Contacto mostraba un solo error, abajo y lejos del campo**, sin marcar el campo ni llevarte a él. Ahora cada campo tiene su error, está marcado y el foco va al primero. | REAL |
| 34 | **El título de la barra superior se cortaba en móvil** ("Dashboa…", "Setti…"). | REAL |
| 35 | Las políticas, el contacto y el inicio de sesión tenían la **misma etiqueta de pestaña**. | REAL |

### Encontrado y ABIERTO

| # | Queja | Etiqueta |
|---|---|---|
| 36 | **Faltan `h1`** en Perfil y en Búsqueda de empleo (0 encabezados de primer nivel); en Contacto hay un salto de encabezado. | REAL |
| 37 | **Objetivos táctiles pequeños** (menos de 24 px): los enlaces de la barra de la portada (16 en total), "Refresh from my latest upload", los enlaces de texto de Ayuda ("Go to Dashboard →"), "Privacy Policy" en Ajustes y 19 a 22 enlaces en Contacto y en las políticas. WCAG 2.2 AA pide 24 px. | REAL |
| 38 | **Texto de 11 px o menos:** "FIT WITH YOU" (×15 en cada lista de empleos), "AI improved", los lazos "POPULAR" de las plantillas (11 en la portada) y "COMPLETE" en Perfil. | REAL |
| 39 | **Las políticas, Contacto y el 404 usan otra tipografía** (Geist / `ui-sans-serif`) que la portada y la app (Figtree y Bricolage Grotesque). | REAL |
| 40 | **La portada se queda en blanco hasta que entra cada animación** ("How it works" mostraba una sola tarjeta y mucho vacío al saltar con el scroll). Sin JavaScript o con el observador roto, esas secciones quedan vacías. | REAL |
| 41 | **Cada pantalla de la app descarga 2,1 a 3,9 MB y 95 a 150 peticiones** (en desarrollo, sin minificar). | NO PROBADO en producción |
| 42 | **Falta una política de seguridad de contenido (CSP)**; HSTS lo pone el alojamiento. | REAL |
| 43 | El 404 nuevo no tiene cabecera, logo ni pie. | OPINIÓN |
| 44 | La carta de presentación empieza con "I am very excited" y es genérica; no tiene firma ni nombre al final. | OPINIÓN |
| 45 | La IA escribió "Senior Java Developer" en el objetivo de una persona de 3,4 años: arrastraba el "Senior" del bug 3, guardado en los datos de prueba. | REAL (consecuencia del bug ya corregido) |
| 46 | El nombre de archivo de un currículum sale en mayúsculas si el nombre guardado lo está (`TAYLOR_COOK_…`). | REAL |
| 47 | Los cambios de longitud o diseño hechos en la pantalla de postular **no se guardan** al recargar (son borrador de esa oferta). | OPINIÓN: puede ser por diseño |
| 48 | **Contraste:** 0 fallos medibles en modo oscuro y en las páginas claras; no se puede medir el texto sobre degradados (lazos, banners). | NO PROBADO |

### Lo que sí está bien

- 0 imágenes rotas, 0 botones o enlaces sin nombre accesible, 0 campos sin etiqueta, 0 `id` repetidos, 0 desbordes horizontales a 380 px en 7 pantallas.
- **Foco de teclado visible** en los 34 elementos del panel y los 93 de la búsqueda.
- El español funciona (títulos, saludo, menú y formulario).
- Todas las rutas de la API responden 401/400 limpios sin sesión.
- La postulación completa funciona: se genera en unos 10 s, la carta lleva la etiqueta "Written with AI" y **el PDF sale en dos páginas con el corte entre puestos**.

## 4. Lo que NO pude probar

- La vista previa de móvil en el navegador real (cambiar el tamaño de la ventana no se aplicó; usé un iframe).
- Cambio de contraseña, "Descargar mis datos", "Borrar mi cuenta", guardar empleos, importar de LinkedIn, descargar el PDF o el DOCX.
- El arreglo del punto 2 de punta a punta con una subida nueva después de elegir la longitud.
- La calidad de la opinión de la IA con **dos puestos distintos**: el prompt lo pide y vi que habla del formato, pero no comparé puestos.
- Contraste sobre degradados y navegación completa con teclado.
- Rendimiento en producción.

## 5. Pendientes que dependen de ti

1. **Publicar `firestore.rules`** en Firebase (consola o `firebase deploy --only firestore:rules`).
2. Poner `NEXT_PUBLIC_SITE_URL` con el dominio real, para que `robots.txt`, el mapa del sitio y las etiquetas `canonical` apunten bien.
3. Decidir el correo definitivo (`contact` o `contacto`) y completar `OPERATOR` en `src/lib/legal.ts`.
4. Activar la facturación de Gemini: la clave actual parece del plan gratuito, y la política de privacidad promete lo contrario.
5. Aceptar los acuerdos de tratamiento de datos con Google, MongoDB y el alojamiento.
6. Revisión de un abogado y, antes de cobrar, la LLC.
