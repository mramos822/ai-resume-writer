import Link from "@/i18n/navigation";
import type { LegalSection } from "@/components/legalLayout";

// Spanish (neutral) version of the Terms of Service. The English text is the one that prevails.
export const termsEs: LegalSection[] = [
  {
    id: "acceptance",
    title: "Aceptación de estos términos",
    body: (
      <>
        <p>Al usar Kaizo Resume Builder (&laquo;Kaizo&raquo;, &laquo;el servicio&raquo;, &laquo;nosotros&raquo;) aceptas estos términos y nuestra <Link href="/privacy">Política de privacidad</Link>. Si no estás de acuerdo, por favor no uses el servicio.</p>
        <p>Debes tener al menos 16 años para usar Kaizo y, cuando creas una cuenta, confirmas que los tienes. Kaizo no está dirigido a menores de 13 años y no recopilamos a sabiendas información personal de nadie menor de 16. Si nos enteramos de que una persona menor de 16 años nos dio información, la eliminamos y cerramos la cuenta. Si crees que esto ocurrió, <Link href="/contact">contáctanos</Link>.</p>
      </>
    ),
  },
  {
    id: "service",
    title: "Qué hace Kaizo",
    body: (
      <>
        <p>Kaizo te ayuda a redactar currículums y cartas de presentación. Ingresas o importas tus datos, eliges un estilo y descargas el resultado en PDF o DOCX. Las funciones opcionales buscan ofertas de empleo públicas, estiman qué tan bien encaja tu perfil con un empleo, te hacen preguntas sobre él, revisan un borrador frente a él y preparan un currículum y una carta de presentación adaptados.</p>
        <p>Kaizo prepara el material de tu postulación. <strong>No</strong> se postula a empleos en tu nombre ni contacta a los empleadores.</p>
      </>
    ),
  },
  {
    id: "plans",
    title: "Uso gratuito y planes de pago",
    body: (
      <>
        <p>Hoy Kaizo se puede usar gratis. Planeamos ofrecer en el futuro planes o funciones de pago. No se cobra nada a menos que elijas a sabiendas una opción de pago.</p>
        <p>Cuando ofrezcamos opciones de pago, antes de que pagues te mostraremos, junto al botón que confirma la compra: el precio y la moneda, qué incluye, cada cuánto se cobra, <strong>si el plan se renueva automáticamente y cuándo</strong>, y cómo cancelar. Te enviaremos una confirmación por correo y podrás cancelar en línea en unos pocos clics, sin llamar a nadie. Cancelar detiene los cobros futuros y conservas el acceso hasta el final del período que ya pagaste.</p>
        <p>Cuando la ley te dé derecho a desistir de una compra digital o a un reembolso (por ejemplo, un período de desistimiento de 14 días para consumidores de la UE y el Reino Unido, salvo que pidas iniciar el servicio de inmediato y aceptes perder ese derecho), lo respetaremos y lo explicaremos al pagar. Los pagos los gestionará un proveedor de pagos; no guardaremos el número completo de tu tarjeta. Los precios pueden cambiar, pero nunca para un período que ya pagaste, y te avisaremos antes de que un cambio afecte tu renovación.</p>
        <p>Estos términos se actualizarán con los detalles de cada plan de pago antes de que esté disponible.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Cuentas y sesiones de invitado",
    body: (
      <>
        <p>Puedes empezar a crear un currículum sin una cuenta, como invitado. Una sesión de invitado vive en el navegador que usaste. Si borras los datos del navegador o usas otro dispositivo, es posible que un currículum de invitado ya no esté disponible, y una sesión de invitado que no se usa durante 30 días se elimina. Crea una cuenta para conservar tu trabajo.</p>
        <p>Eres responsable de mantener segura tu contraseña y de lo que ocurra en tu cuenta. Danos información veraz y avísanos si crees que otra persona usa tu cuenta.</p>
      </>
    ),
  },
  {
    id: "content",
    title: "Tu contenido",
    body: (
      <>
        <p>Todo lo que ingresas en Kaizo (tu perfil, los currículums que subes, las descripciones de empleo y los documentos que generamos para ti) es <strong>tu contenido</strong>. Conservas todos los derechos sobre él. Nos das un permiso limitado para almacenarlo, procesarlo y mostrártelo, solo para poder prestar el servicio que pediste.</p>
        <p>Tu contenido es privado de tu cuenta. No lo publicamos y Kaizo no es un lugar donde los usuarios compartan archivos entre sí.</p>
        <p>Prometes que tienes derecho a subir lo que subes y que tu currículum es veraz. Por favor, no incluyas información de otras personas sin su permiso ni más información sensible de la que necesita un empleador.</p>
      </>
    ),
  },
  {
    id: "truth",
    title: "Lo que declaras debe ser verdad",
    body: (
      <>
        <p>Kaizo escribe currículums y cartas de presentación con la información que le das: tu perfil, las habilidades que dices tener y tus respuestas a las preguntas que te hace sobre un empleo. <strong>Kaizo no verifica nada de eso.</strong></p>
        <p>Antes de crear un currículum con algo que añadiste para un empleo concreto, te pedimos que declares que es verdad. Al hacer esa declaración confirmas que cada habilidad, experiencia, estudio o dato que confirmaste es real, y que eres <strong>el único responsable</strong> de la veracidad de tu currículum, tu carta de presentación y de todo lo que contienen, y de lo que envías a un empleador. Una afirmación falsa o exagerada puede llevar a que un empleador rechace tu postulación o termine tu contrato y, en algunos lugares, puede tener consecuencias legales.</p>
        <p>Guardamos la fecha de cada declaración y lo que confirmaste, vinculados a esa postulación, para poder mostrarlo si hace falta. Se elimina cuando eliminas la postulación o tu cuenta.</p>
        <p>En la máxima medida que permita la ley, Kaizo no es responsable de las pérdidas que resulten de información falsa, inexacta o engañosa que tú hayas dado, y aceptas mantener indemne a Kaizo frente a reclamaciones de empleadores o de otros terceros que se deriven de ella.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "Contenido escrito con IA",
    body: (
      <>
        <p>Algunas funciones usan inteligencia artificial para sugerir redacción, revisar tu currículum y escribir cartas de presentación. La IA puede equivocarse. <strong>Lee todo antes de enviarlo.</strong> Tú eres el autor de tu currículum y eres responsable de que sea exacto y de con qué te postulas.</p>
        <p>No prometemos que un currículum supere un sistema de seguimiento de candidatos en particular, que consigas una entrevista o un empleo, ni que las sugerencias sean adecuadas para tu situación. Los puntajes y las verificaciones de Kaizo son una guía, no una garantía.</p>
        <p>El porcentaje de &laquo;afinidad&raquo;, las preguntas que Kaizo te hace sobre un empleo, la revisión de un borrador y los resúmenes de las ofertas son estimaciones hechas por software a partir del texto disponible. No son una decisión de contratación, no te describen como persona y pueden ser erróneos o incompletos. Revisa siempre la oferta original.</p>
      </>
    ),
  },
  {
    id: "jobs",
    title: "Ofertas de empleo de otras fuentes",
    body: (
      <>
        <p>Las ofertas de empleo provienen de fuentes de terceros como Adzuna, Remotive y Arbeitnow. No las escribimos, verificamos ni respaldamos, y pueden estar desactualizadas o haber sido retiradas. Postularse siempre ocurre en el sitio del empleador o de la fuente, bajo sus propios términos y prácticas de privacidad.</p>
        <p>Para que una oferta sea más fácil de leer, Kaizo puede leer la página pública de la oferta y usar IA para resumirla en secciones. Un resumen puede omitir o malinterpretar detalles, así que revisa la oferta original antes de postularte. Las distancias, los lugares cercanos y la &laquo;ciudad grande más cercana&raquo; son aproximaciones.</p>
        <p>Si añades un empleo pegando un enlace o un texto, confirmas que puedes usar ese contenido y que no usas contenido al que accediste con la sesión de otra persona. Kaizo no está afiliado a los sitios de donde vienen las ofertas, como LinkedIn.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "Uso aceptable",
    body: (
      <>
        <p>Por favor, no:</p>
        <ul>
          <li>uses Kaizo para hacer currículums falsos o engañosos, ni para suplantar a alguien;</li>
          <li>subas nada ilegal, dañino o que infecte otros sistemas con software malicioso;</li>
          <li>intentes dañar, sobrecargar, extraer datos o aplicar ingeniería inversa al servicio, ni eludir sus límites y su seguridad;</li>
          <li>accedas a cuentas o datos que no son tuyos;</li>
          <li>uses el servicio de formas que infrinjan la ley.</li>
        </ul>
        <p>Podemos limitar o suspender el acceso si se incumplen estas reglas o para proteger el servicio y a otras personas.</p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Nuestra propiedad",
    body: <p>El nombre Kaizo, el logotipo, el software, las plantillas y el diseño nos pertenecen a nosotros o a nuestros licenciantes y están protegidos por la ley. Te damos un derecho personal, no exclusivo e intransferible para usarlos a través del servicio. Los currículums que generas son tuyos y puedes usarlos donde quieras.</p>,
  },
  {
    id: "changes",
    title: "Cambios, disponibilidad y fin del servicio",
    body: (
      <>
        <p>Seguimos mejorando Kaizo, así que las funciones pueden cambiar o retirarse. Trabajamos para mantener el servicio disponible, pero no podemos prometer que será siempre ininterrumpido o sin errores.</p>
        <p>Puedes dejar de usar Kaizo en cualquier momento y eliminar tus currículums y perfiles desde la app. Para cerrar tu cuenta por completo, usa <strong>Eliminar mi cuenta</strong> en Configuración (allí también puedes descargar antes una copia de tus datos). Podemos suspender o cerrar una cuenta que incumpla estos términos.</p>
      </>
    ),
  },
  {
    id: "warranty",
    title: "Sin garantías",
    body: <p>Kaizo se ofrece &laquo;tal cual&raquo; y &laquo;según disponibilidad&raquo;. En la máxima medida que permita la ley, no damos garantías de ningún tipo, expresas o implícitas, incluidas las de idoneidad para un fin particular, exactitud de lo que produce la IA o resultados de tu búsqueda de empleo.</p>,
  },
  {
    id: "liability",
    title: "Límite de responsabilidad",
    body: <p>En la máxima medida que permita la ley, Kaizo y las personas que lo operan no son responsables de pérdidas indirectas, incidentales, especiales o consecuentes, ni de oportunidades, ingresos o datos perdidos, derivados de tu uso del servicio. Nada de estos términos limita los derechos que tienes bajo leyes de protección al consumidor que no se pueden renunciar, ni una responsabilidad que la ley no permita excluir.</p>,
  },
  {
    id: "law",
    title: "Cambios a estos términos y ley aplicable",
    body: (
      <>
        <p>Podemos actualizar estos términos. Cuando los cambios sean importantes lo indicaremos en el sitio y cambiará la fecha de arriba. Usar Kaizo después de una actualización significa que la aceptas.</p>
        <p>Estos términos, y cualquier disputa sobre ellos o sobre el servicio, se rigen por las leyes del <strong>Estado de Nueva Jersey</strong> y las leyes federales de Estados Unidos que allí apliquen, sin tener en cuenta las reglas de conflicto de leyes. Toda disputa que no pueda resolverse hablando primero con nosotros se presentará ante los tribunales estatales o federales ubicados en Nueva Jersey, y tanto tú como nosotros aceptamos su jurisdicción. Esto no elimina las protecciones obligatorias para el consumidor que te da la ley del lugar donde vives, ni tu derecho a presentar un reclamo ante tus tribunales locales cuando la ley lo permita.</p>
        <p>Kaizo puede usarse desde muchos países. Eres responsable de cumplir las leyes que te apliquen donde vives, y nosotros tratamos los datos personales según las reglas descritas en la <Link href="/privacy">Política de privacidad</Link>, que incluye los derechos que las personas tienen bajo leyes como el RGPD, el RGPD del Reino Unido, las leyes de privacidad de California y la LGPD de Brasil.</p>
      </>
    ),
  },
  {
    id: "general",
    title: "Disposiciones generales",
    body: <p>Si una parte de estos términos se considera inválida, el resto sigue vigente. Si en algún momento no hacemos valer un derecho, no renunciamos a él. No puedes transferir tu cuenta ni estos términos a otra persona sin nuestro acuerdo; nosotros podemos transferirlos como parte de una reorganización del servicio. Estos términos y la Política de Privacidad son el acuerdo completo entre tú y Kaizo sobre el servicio.</p>,
  },
  {
    id: "contact",
    title: "Contacto",
    body: <p>¿Preguntas sobre estos términos? Escríbenos mediante el <Link href="/contact">formulario de contacto</Link>.</p>,
  },
];
