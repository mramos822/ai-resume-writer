import Link from "@/i18n/navigation";
import type { LegalSection } from "@/components/legalLayout";

// Spanish (neutral) version of the Accessibility page. The English text is the one that prevails.
export const accessibilityEs: LegalSection[] = [
  {
    id: "goal",
    title: "Nuestro objetivo",
    body: <p>Kaizo debe poder usarse por la mayor cantidad de personas posible, incluidas las que usan teclado, lector de pantalla, zoom o un teléfono. Buscamos seguir las Pautas de Accesibilidad para el Contenido Web (WCAG) 2.2, nivel AA, en las páginas públicas y en el creador de currículums.</p>,
  },
  {
    id: "done",
    title: "Lo que hemos hecho",
    body: (
      <ul>
        <li>Un enlace &laquo;Saltar al contenido&raquo; al inicio de cada página, y un área principal y un título principal por página.</li>
        <li>Todo se puede usar con el teclado, con un contorno de foco visible.</li>
        <li>Los campos de formulario tienen etiquetas, y los errores se muestran junto al campo y se anuncian a los lectores de pantalla.</li>
        <li>Los botones y enlaces miden al menos 24 por 24 píxeles, y ningún texto es menor de 11 píxeles.</li>
        <li>Las páginas funcionan en un teléfono y con el texto agrandado, sin desplazamiento lateral.</li>
        <li>Las animaciones que aparecen al desplazarte se desactivan si tu dispositivo pide menos movimiento.</li>
        <li>Temas claro y oscuro, y el sitio en inglés y en español.</li>
      </ul>
    ),
  },
  {
    id: "limits",
    title: "Lo que aún no es perfecto",
    body: (
      <ul>
        <li>Hemos revisado el sitio nosotros mismos y con herramientas automáticas. <strong>No</strong> ha tenido una auditoría de un experto externo en accesibilidad.</li>
        <li>La vista previa del currículum es una imagen de la página tal como se imprimirá. Los archivos PDF y DOCX que creamos están pensados para verse bien y para los sistemas de seguimiento de candidatos; no podemos prometer que estén totalmente etiquetados para lectores de pantalla.</li>
        <li>Algunos textos, como las descripciones de empleo, vienen de otros sitios web o de ti, y no controlamos cómo están escritos.</li>
      </ul>
    ),
  },
  {
    id: "feedback",
    title: "Cuéntanos si algo falla",
    body: <p>Si algo no te funciona, cuéntanoslo en el <Link href="/contact">formulario de contacto</Link>: qué intentabas hacer, la página, y el dispositivo o la herramienta de apoyo que usas. Una persona lee cada mensaje, e intentaremos arreglarlo u ofrecerte otra forma de hacer lo mismo.</p>,
  },
];
