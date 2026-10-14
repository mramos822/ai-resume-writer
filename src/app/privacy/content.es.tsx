import Link from "@/i18n/navigation";
import type { LegalSection } from "@/components/legalLayout";

// Spanish (neutral) version of the Privacy Policy. The English text is the one that prevails.
export const privacyEs: LegalSection[] = [
  {
    id: "who",
    title: "Quiénes somos",
    body: (
      <p>Kaizo Resume Builder (&laquo;Kaizo&raquo;, &laquo;nosotros&raquo;) es el servicio que decide cómo y por qué se usan tus datos personales, como se describe aquí. Puedes comunicarte con nosotros mediante el <Link href="/contact">formulario de contacto</Link>.</p>
    ),
  },
  {
    id: "collect",
    title: "Qué datos recopilamos",
    body: (
      <>
        <p>Solo recopilamos lo que el servicio necesita:</p>
        <ul>
          <li><strong>Datos de la cuenta:</strong> tu nombre y correo, y una contraseña (la gestiona nuestro proveedor de inicio de sesión, nosotros nunca la vemos). Las sesiones de invitado reciben un identificador aleatorio y ningún nombre ni correo.</li>
          <li><strong>Datos del currículum que nos das:</strong> todo lo que escribes o importas en tu perfil: datos de contacto, dirección, foto, historial laboral, educación, habilidades, proyectos, idiomas y enlaces.</li>
          <li><strong>Archivos:</strong> los currículums que subes y los archivos PDF o DOCX que generamos para ti.</li>
          <li><strong>Actividad de empleo:</strong> las descripciones de empleo que pegas, los empleos que guardas y las postulaciones que preparas, incluidos el currículum y la carta de presentación adaptados.</li>
          <li><strong>Lo que confirmas en una postulación:</strong> las habilidades que dices tener, tus respuestas a las preguntas sobre un empleo y la fecha en que declaraste que son verdad, vinculadas a esa postulación.</li>
          <li><strong>Lugares que buscas:</strong> el país y el lugar que escribes o eliges en la búsqueda de empleo. Las sugerencias de ciudades y regiones se hacen en nuestros servidores a partir de una lista incluida, sin enviar lo que escribes a nadie más.</li>
          <li><strong>Mensajes</strong> que envías mediante nuestro formulario de contacto.</li>
          <li><strong>Configuración y progreso</strong>, como tu tema claro u oscuro y tu borrador sin terminar del creador.</li>
          <li><strong>Datos técnicos básicos</strong> que tu navegador envía a cualquier sitio web (como la dirección IP y el tipo de navegador), que nuestro alojamiento y nuestras herramientas de seguridad procesan para entregar el sitio y mantenerlo seguro.</li>
        </ul>
        <p>No usamos rastreadores publicitarios, analíticas ni herramientas de grabación de sesiones, y no creamos perfiles publicitarios.</p>
      </>
    ),
  },
  {
    id: "use",
    title: "Cómo lo usamos",
    body: (
      <ul>
        <li>para crear, guardar y mostrarte tus currículums y cartas de presentación;</li>
        <li>para leer un currículum que subes y llenar tu perfil;</li>
        <li>para revisar tu currículum, sugerir redacción y adaptarlo a un empleo (con IA);</li>
        <li>para buscar ofertas de empleo y estimar qué tan bien encajan contigo;</li>
        <li>para iniciar tu sesión, mantener segura tu cuenta y prevenir abusos;</li>
        <li>para responder tus mensajes;</li>
        <li>para cumplir nuestras obligaciones legales.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "Procesamiento con IA",
    body: (
      <>
        <p>Cuando usas una función de IA, el texto necesario para esa tarea (por ejemplo, el contenido de tu currículum y, si elegiste una, la descripción de un empleo) se envía a un proveedor de IA externo, por defecto la API de Gemini de Google, que nos devuelve el resultado. Enviamos solo lo que la tarea necesita y no usamos tu contenido para entrenar nuestros propios modelos.</p>
        <p>Esto incluye el texto de una oferta de empleo (de un listado o que pegas o enlazas), las partes de tu perfil necesarias para compararla y lo que confirmaste o respondiste para ese empleo, para que la IA pueda hacerte preguntas, revisar un borrador y escribir el currículum y la carta. Cuando nos das un enlace a un empleo, nuestros servidores descargan esa página pública para leerla; el sitio ve la dirección de nuestro servidor, no la tuya.</p>
        <p>El proveedor procesa ese texto según sus propios términos. Por favor, no pongas en tu currículum información que no quieras que se procese de esta manera.</p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Quién más recibe datos",
    body: (
      <>
        <p>No vendemos tus datos personales ni los compartimos con fines publicitarios. Usamos estos proveedores para operar el servicio:</p>
        <ul>
          <li><strong>Google Firebase</strong>: inicio de sesión y algunos ajustes de la cuenta.</li>
          <li><strong>MongoDB Atlas</strong>: la base de datos donde se guardan tu perfil, archivos y postulaciones.</li>
          <li><strong>API de Gemini de Google</strong> (o el proveedor de IA configurado para el servicio): funciones de IA, como se describió antes.</li>
          <li><strong>Adzuna, Remotive y Arbeitnow</strong>: ofertas de empleo. Nuestros servidores les envían los términos de búsqueda y el lugar que eliges, que pueden incluir tu puesto objetivo y tus habilidades principales (para que encuentren empleos que te convengan), nunca tu currículum, tu nombre, tus datos de contacto ni tu perfil. En una búsqueda por lugar también podemos enviar la ciudad cercana o la ciudad grande más próxima.</li>
          <li><strong>Google</strong> (servicio de favicon): para mostrar el logotipo de una empresa, tu navegador pide a Google un pequeño ícono usando la dirección web de la empresa. Google recibe tu dirección IP, como con cualquier solicitud de imagen.</li>
          <li><strong>Nuestro proveedor de alojamiento</strong>, que entrega el sitio.</li>
          <li><strong>La herramienta de chat del equipo</strong> (si está configurada): una nota breve, con las primeras líneas de tu mensaje, para verlo rápidamente.</li>
        </ul>
        <p>También podemos divulgar datos cuando la ley lo exija, o para proteger los derechos, la seguridad y la protección de Kaizo y sus usuarios.</p>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "Por qué podemos usar tus datos",
    body: <p>Cuando se aplican leyes como el RGPD, nos basamos en: la <strong>ejecución de nuestro contrato</strong> contigo (prestar el creador de currículum que pediste), <strong>nuestros intereses legítimos</strong> (mantener el servicio seguro y funcionando), <strong>tu consentimiento</strong> cuando lo pedimos y las <strong>obligaciones legales</strong>.</p>,
  },
  {
    id: "retention",
    title: "Cuánto tiempo lo conservamos",
    body: (
      <>
        <p>Conservamos tus datos mientras exista tu cuenta. Cuando eliminas un currículum o un perfil en la app, se borra de nuestra base de datos, y cuando eliminas tu cuenta se borra todo. Una sesión de invitado (sin cuenta) que no se haya usado durante <strong>30 días</strong> se elimina automáticamente con todo lo que contiene, y empezar un currículum nuevo como invitado elimina el que quedó sin terminar. Los mensajes de contacto se conservan como máximo <strong>24 meses</strong>. Las copias de seguridad pueden contener datos eliminados durante un breve tiempo antes de sobrescribirse.</p>
      </>
    ),
  },
  {
    id: "choices",
    title: "Tus derechos y opciones",
    body: (
      <>
        <p>Según donde vivas (por ejemplo, en la UE, el Reino Unido o California) puedes tener derecho a acceder a tus datos, corregirlos, eliminarlos u obtener una copia, a oponerte a algunos usos o limitarlos, y a retirar tu consentimiento. También tienes derecho a no ser discriminado por ejercer estos derechos. No vendemos ni compartimos tus datos personales con fines publicitarios, así que no hay nada de lo que puedas excluirte.</p>
        <ul>
          <li><strong>Edita</strong> tu información en cualquier momento en tu perfil.</li>
          <li><strong>Descarga</strong> cualquier currículum como PDF o DOCX desde la página Currículums.</li>
          <li><strong>Elimina</strong> currículums y perfiles completos desde la app.</li>
          <li><strong>Descarga una copia de tus datos</strong> y <strong>elimina tu cuenta</strong> tú mismo desde Configuración, cuando quieras. Eliminar borra para siempre tus perfiles, currículums, postulaciones, empleos guardados y tu cuenta de inicio de sesión (las copias de seguridad se sobrescriben en poco tiempo).</li>
          <li><strong>Cualquier otro derecho</strong> (por ejemplo, corregir, limitar u oponerte a un uso) escribiéndonos mediante el <Link href="/contact">formulario de contacto</Link>. Responderemos dentro del plazo que fija la ley (45 días bajo la NJDPA, 30 días en la mayoría de los demás lugares).</li>
          <li><strong>Cookies y almacenamiento local:</strong> consulta la <Link href="/cookies">Política de cookies</Link>.</li>
        </ul>
        <p>Si crees que manejamos mal tus datos, puedes presentar una queja ante tu autoridad local de protección de datos.</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Menores de edad (COPPA y leyes similares)",
    body: (
      <>
        <p>Kaizo es para personas de <strong>16 años o más</strong>. Es una herramienta para quienes buscan trabajo y no está dirigida a menores. En particular, no recopilamos, usamos ni compartimos a sabiendas información personal de menores de <strong>13 años</strong>, para lo cual la ley COPPA de Estados Unidos (y leyes similares en otros lugares) nos exigiría el consentimiento de un padre o tutor. Tampoco recopilamos a sabiendas datos de nadie menor de 16 años, que es la edad de consentimiento digital en varios países europeos.</p>
        <p>Las personas confirman su edad al crear una cuenta. No usamos publicidad, así que ningún menor es perfilado ni ve anuncios. Si nos enteramos de que tenemos información personal de alguien menor de 16 años, la eliminamos y cerramos la cuenta. Los <strong>padres o tutores</strong> que crean que su hijo nos dio información pueden <Link href="/contact">contactarnos</Link> para verla, eliminarla o pedirnos que dejemos de usarla.</p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Pagos (cuando lleguen los planes de pago)",
    body: (
      <p>Kaizo todavía no cobra nada y no recopila datos de pago. Cuando se introduzcan planes de pago, los pagos los procesará un proveedor de pagos que recibe los datos necesarios para cobrarte; nosotros recibiremos solo una confirmación, el plan que elegiste y los últimos dígitos de tu tarjeta, no el número completo. Añadiremos a ese proveedor a esta política antes de usarlo y conservaremos los registros de facturación durante el tiempo que exijan las leyes fiscales y contables.</p>
    ),
  },
  {
    id: "regions",
    title: "Derechos por región y señales de privacidad",
    body: (
      <>
        <p>Kaizo opera bajo las leyes del Estado de Nueva Jersey, incluidas la <strong>Ley de Privacidad de Datos de Nueva Jersey</strong> (NJDPA) y las leyes de ese estado sobre fraude al consumidor y notificación de filtraciones de datos. Aplicamos las mismas protecciones a todos y además respetamos los derechos que se aplican donde vives: en el Espacio Económico Europeo y el Reino Unido (RGPD), California y otros estados de EE. UU. (como la CCPA/CPRA), Brasil (LGPD), Canadá, Australia y otros lugares con una ley de protección de datos. Bajo la NJDPA puedes confirmar si tratamos tus datos y acceder a ellos, corregirlos, eliminarlos, obtener una copia portátil y excluirte de la publicidad dirigida, la venta de datos y la elaboración de perfiles; nosotros no hacemos ninguna de esas cosas. Puedes ejercerlos en la app (Configuración tiene <strong>Descargar mis datos</strong> y <strong>Eliminar mi cuenta</strong>) o mediante el <Link href="/contact">formulario de contacto</Link>; podemos pedirte que demuestres quién eres antes de entregar datos. Si rechazamos una solicitud, puedes apelar escribiéndonos de nuevo con la palabra &laquo;apelación&raquo;, y si aún no estás conforme puedes contactar a la División de Asuntos del Consumidor de Nueva Jersey o a tu propia autoridad de protección de datos.</p>
        <p>No vendemos datos personales, no los compartimos para publicidad entre contextos y no te rastreamos entre sitios, por lo que una señal de &laquo;No rastrear&raquo; o de Control Global de Privacidad no cambia nada: ya tratamos a todos los visitantes como si se hubieran excluido. No tomamos decisiones con efectos legales sobre ti usando únicamente procesamiento automatizado.</p>
      </>
    ),
  },
  {
    id: "security",
    title: "Seguridad",
    body: <p>Protegemos tus datos con conexiones cifradas, controles de acceso que vinculan cada currículum y perfil con su dueño, y acceso limitado a nuestros sistemas. Ningún servicio es perfectamente seguro. Si una filtración afecta tus datos, te lo diremos a ti y a las autoridades como lo exija la ley.</p>,
  },
  {
    id: "transfers",
    title: "Transferencias internacionales",
    body: <p>Nuestros proveedores pueden procesar datos en otros países, incluido Estados Unidos. Cuando los datos salen de tu región, nos apoyamos en las garantías que la ley reconoce, como las cláusulas contractuales tipo, cuando se aplican.</p>,
  },
  {
    id: "changes",
    title: "Cambios a esta política",
    body: <p>Si cambiamos cómo usamos los datos, actualizaremos esta página y la fecha de arriba, y te avisaremos en la app o por correo cuando el cambio sea importante.</p>,
  },
];
