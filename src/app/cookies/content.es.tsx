import Link from "@/i18n/navigation";
import type { LegalSection } from "@/components/legalLayout";

// Spanish (neutral) version of the Cookie Policy. The English text is the one that prevails.
const stored = [
  { name: "Sesión de inicio de sesión", where: "Almacenamiento del navegador (Firebase)", why: "Mantiene tu sesión iniciada, incluidas las sesiones de invitado.", howLong: "Hasta que cierres sesión o borres los datos del sitio" },
  { name: "Tema", where: "Almacenamiento local", why: "Recuerda el modo claro u oscuro.", howLong: "Hasta que borres los datos del sitio" },
  { name: "Idioma", where: "Cookie", why: "Recuerda el idioma que elegiste (solo se guarda cuando lo eliges tú).", howLong: "1 año" },
  { name: "Progreso del creador", where: "Almacenamiento local", why: "Guarda tu borrador de currículum sin terminar y recuerda que terminaste la configuración inicial.", howLong: "Hasta que termines, empieces de nuevo o borres los datos del sitio" },
  { name: "Aviso de cookies", where: "Almacenamiento local", why: "Recuerda que leíste este aviso para no mostrarlo otra vez.", howLong: "Hasta que borres los datos del sitio" },
];

export const cookiesEs: LegalSection[] = [
  {
    id: "what",
    title: "Qué son las cookies y el almacenamiento local",
    body: <p>Las cookies son pequeños archivos que un sitio web guarda en tu navegador. El almacenamiento local y herramientas similares hacen el mismo trabajo en otro lugar. Los sitios web los usan para recordar cosas entre visitas. Esta página usa &laquo;cookies&raquo; para referirse a todos ellos.</p>,
  },
  {
    id: "use",
    title: "Qué guarda Kaizo",
    body: (
      <>
        <p>Kaizo solo guarda lo que necesita para funcionar. Son <strong>estrictamente necesarios</strong> y no requieren tu consentimiento según las reglas que se aplican a las cookies:</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Qué</th>
                <th className="px-4 py-2.5 font-semibold">Dónde</th>
                <th className="px-4 py-2.5 font-semibold">Por qué</th>
                <th className="px-4 py-2.5 font-semibold">Cuánto tiempo</th>
              </tr>
            </thead>
            <tbody>
              {stored.map((r) => (
                <tr key={r.name} className="border-t border-gray-200 align-top">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5">{r.where}</td>
                  <td className="px-4 py-2.5">{r.why}</td>
                  <td className="px-4 py-2.5">{r.howLong}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    ),
  },
  {
    id: "not",
    title: "Qué no usamos",
    body: (
      <ul>
        <li>Ninguna cookie publicitaria ni de marketing y ningún píxel de rastreo.</li>
        <li>Ninguna analítica ni herramientas de grabación de sesiones.</li>
        <li>Ningún botón de redes sociales que te rastree.</li>
        <li>Las fuentes se cargan desde nuestro propio sitio, no desde un servicio de fuentes externo.</li>
      </ul>
    ),
  },
  {
    id: "third",
    title: "Terceros",
    body: <p>Para mostrar el logotipo de una empresa en un empleo, tu navegador pide un pequeño ícono al servicio de favicon de Google. Es una solicitud de imagen, no una cookie que nosotros establezcamos, pero Google recibe tu dirección IP, como con cualquier imagen. La búsqueda de empleo y las funciones de IA se ejecutan desde nuestros servidores, así que esos proveedores no establecen nada en tu navegador. Consulta la <Link href="/privacy">Política de privacidad</Link> para ver la lista completa.</p>,
  },
  {
    id: "control",
    title: "Tu control",
    body: (
      <>
        <p>Puedes borrar lo que Kaizo guardó en cualquier momento desde la configuración de tu navegador (busca &laquo;borrar datos del sitio&raquo;). Si lo haces, se cerrará tu sesión y un currículum de invitado que no se guardó en una cuenta no se podrá recuperar. También puedes bloquear el almacenamiento por completo, pero Kaizo no funcionará bien sin él.</p>
        <p>Si algún día agregamos cookies opcionales, como analíticas, primero pediremos tu consentimiento y nada opcional se cargará antes de que digas que sí.</p>
      </>
    ),
  },
  {
    id: "contact",
    title: "Preguntas",
    body: <p>Escríbenos mediante el <Link href="/contact">formulario de contacto</Link>.</p>,
  },
];
