import type { ReactNode } from "react";

export const CONTACT_EMAIL = "sssebas2005@gmail.com";
export const ISSUES_URL = "https://github.com/Sebas-dlt/pixelpress/issues";
const UPDATED = "30 de septiembre de 2026";

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 font-display text-2xl font-extrabold first:mt-0">{children}</h2>;
}

function P({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`mt-3 leading-relaxed text-ink/75 ${className}`}>{children}</p>;
}

function UL({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-ink/75 marker:text-brand">
      {items.map((it, i) => (
        <li key={i} className="leading-relaxed">
          {it}
        </li>
      ))}
    </ul>
  );
}

function Page({ title, lead, children }: { title: string; lead: ReactNode; children: ReactNode }) {
  return (
    <section className="pb-16 pt-8">
      <a href="#/" className="text-sm font-bold text-brand-ink hover:underline">
        ← Volver al convertidor
      </a>
      <h1 className="mt-4 font-display text-4xl leading-[1.05] font-extrabold sm:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-ink/70">{lead}</p>
      <div className="mt-8 max-w-3xl">{children}</div>
    </section>
  );
}

export function Privacidad() {
  return (
    <Page
      title="Política de privacidad"
      lead={
        <>
          Última actualización: {UPDATED}. PixelPress convierte PDF y Word <strong>dentro de tu
          navegador</strong>: no hay servidor de conversión, ni cuentas, ni base de datos de usuarios.
          Esta política explica qué datos se tratan, con qué finalidad, durante cuánto tiempo y cómo
          ejercer tus derechos.
        </>
      }
    >
      <H2>1. Responsable del tratamiento</H2>
      <P>
        PixelPress es un sitio web de código abierto (licencia AGPL-3.0) operado de forma independiente.
        Para cualquier consulta sobre privacidad o para ejercer un derecho de protección de datos,
        escribí a <a className="font-bold text-brand-ink underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
        o abrí un ticket en <a className="font-bold text-brand-ink underline" href={ISSUES_URL} target="_blank" rel="noreferrer">nuestro repositorio público</a>.
      </P>

      <H2>2. Qué datos tratamos</H2>
      <P>
        <strong>a) Tus archivos (datos que vos cargás).</strong> Los PDF o DOCX que elegís se leen y
        escriben <strong>en memoria de tu propio navegador</strong>, usando WebAssembly. No se envían a
        ningún servidor de PixelPress porque el sitio no tiene: no hay subida, no hay copia remota, no
        hay cola de trabajos. El archivo vive mientras dura la pestaña y se libera al terminar la
        conversión, recargar o cerrar la página.
      </P>
      <P>
        <strong>b) Datos técnicos de acceso.</strong> El sitio se sirve desde un proveedor de hosting
        estático (Vercel). Al entregar la página, ese proveedor registra datos técnicos de la petición
        —dirección IP, URL, agente de usuario y código de respuesta— con la finalidad de servir el
        sitio, prevenir abusos y garantizar seguridad. Esos registros los conserva el proveedor según su
        propia política; nosotros no los consultamos ni los usamos con ninguna otra finalidad. Base
        jurídica: interés legítimo (art. 6.1.f del RGPD).
      </P>
      <P>
        <strong>c) Datos que NO recopilamos.</strong> No pedimos nombre, correo, teléfono ni
        documento de identidad. No hay registro de usuarios. No usamos cookies, ni almacenamiento
        local, ni identificadores de dispositivo, ni píxeles publicitarios, ni analítica de terceros.
        No compramos ni vendemos datos personales de ninguna clase.
      </P>

      <H2>3. Base de datos y registros</H2>
      <P>
        <strong>PixelPress no mantiene ninguna base de datos de datos personales.</strong> No existe
        tabla, archivo, caché ni índice con información que te identifique o permita identificarte: el
        único dato personal que interviene (el archivo que cargás) se procesa localmente y nunca se
        persiste.
      </P>
      <P>
        Por eso no corresponde ningún registro de bases de datos: no hay una que registrar. En el marco
        del Reglamento General de Protección de Datos (RGPD, Reglamento (UE) 2016/679), tampoco se
        genera un registro de actividades de tratamiento con datos identificativos de usuarios, dado que
        el tratamiento no va más allá de lo puramente ocasional y no existen categorías especiales de
        datos. Si en el futuro se incorporaran cuentas, listas de correo, analítica o cualquier
        almacenamiento persistente, esta política se actualizará y se valorará el registro que corresponda.
      </P>
      <P className="text-ink/60">
        Nota regional: si el sitio llegara a operar con una base de datos de datos personales en
        Argentina, la Ley 25.326 (protección de datos personales) y su reglamento exigirían el registro
        ante la autoridad de control (AAIP). Con la arquitectura actual, no corresponde.
      </P>

      <H2>4. Para qué usamos los datos y base jurídica</H2>
      <UL
        items={[
          <>
            <strong>Convertir tu archivo</strong> (finalidad exclusiva del sitio): ejecutar la
            transformación localmente y entregarte el resultado descargable. Base jurídica: medidas
            precontractuales o ejecución del servicio solicitado por vos (art. 6.1.b RGPD) y, para la
            parte que depende de tu decisión expresa, tu <strong>consentimiento</strong> manifestado
            mediante la casilla de la política de privacidad (art. 6.1.a RGPD), otorgado
            libremente, específico, informado y revocable en cualquier momento.
          </>,
          <>
            <strong>Entregar y asegurar el sitio</strong>: hosting, disponibilidad y seguridad.
            Base jurídica: interés legítimo (art. 6.1.f RGPD).
          </>,
          <>
            <strong>Responder consultas o pedidos de eliminación</strong> que nos envíes por correo o
            por issues. Base jurídica: tu solicitud y nuestro interés legítimo en atenderla
            (art. 6.1.b y 6.1.f).
          </>,
        ]}
      />

      <H2>5. Cuánto tiempo conservamos los datos</H2>
      <UL
        items={[
          <>Tus archivos: solo mientras dura la pestaña; se descartan al cerrar o recargar.</>,
          <>
            Registros técnicos del hosting: según la política de retención del proveedor de hosting,
            con fines de seguridad y disponibilidad.
          </>,
          <>
            Correos o tickets que nos mandes: el tiempo necesario para atender tu pedido y después se
            eliminan.
          </>,
        ]}
      />

      <H2>6. Con quién se comparten datos</H2>
      <P>
        No vendemos, ni cedemos, ni alquilamos datos personales. No hay publicidad ni analítica de
        terceros. La única transferencia que ocurre es la del hosting: el proveedor que entrega los
        archivos del sitio (Vercel Inc., con infraestructura en EE. UU.) trata datos técnicos de acceso
        como encargado, amparado por sus cláusulas contractuales tipo y su adhesión al marco de
        privacidad transatlántico. No se realizan transferencias con fines publicitarios.
      </P>

      <H2>7. Tus derechos</H2>
      <P>
        Podés ejercer, de forma gratuita y en cualquier momento, los derechos que reconoce el RGPD y
        normativas equivalentes (CCPA/CPRA en California, LGPD en Brasil, Ley 25.326 en Argentina):
      </P>
      <UL
        items={[
          <>acceso a los datos que tratamos sobre vos;</>,
          <>rectificación de datos inexactos;</>,
          <>supresión ("derecho al olvido");</>,
          <>opposición y limitación del tratamiento;</>,
          <>portabilidad de los datos;</>,
          <>retirada del consentimiento en cualquier momento, sin que eso afecte la licitud del tratamiento previo (art. 7.3 RGPD);</>,
          <>presentar una reclamación ante la autoridad de control de tu país de residencia (art. 77 RGPD).</>,
        ]}
      />
      <P>
        Como no vendemos datos personales, no existe un botón de "no vender mis datos" que mostrar: el
        derecho corresponde, simplemente no hay venta que ejercer.
      </P>

      <H2>8. Cómo pedir que se borren tus datos</H2>
      <P>
        Por arquitectura, <strong>no queda nada que borrar de nuestro lado</strong>: nunca recibimos tu
        archivo. Aun así, si querés dejar el sitio limpio en tu equipo, el camino es este:
      </P>
      <UL
        items={[
          <>
            <strong>En tu navegador</strong>: ajustes → privacidad y seguridad → borrar datos de
            sitios → elegí este sitio y borralo. Eso elimina cualquier resto en caché de la pestaña.
          </>,
          <>
            <strong>Si querés una confirmación por escrito</strong>, mandanos el pedido con el asunto
            "Solicitud de eliminación de datos" a{" "}
            <a className="font-bold text-brand-ink underline" href={`mailto:${CONTACT_EMAIL}?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20datos%20-%20PixelPress`}>
              {CONTACT_EMAIL}
            </a>{" "}
            o abrí un ticket en{" "}
            <a className="font-bold text-brand-ink underline" href={ISSUES_URL} target="_blank" rel="noreferrer">
              GitHub Issues
            </a>
            . Respondemos en un plazo máximo de 30 días.
          </>,
        ]}
      />

      <H2>9. Cookies, analítica y píxeles</H2>
      <P>
        <strong>El sitio no usa cookies propias ni de terceros, no carga Google Analytics, ni el píxel
        de Meta, ni ninguna herramienta de medición.</strong> Por eso no hay banner de cookies: no hay
        nada que aceptar o rechazar, y ninguna de esas tecnologías se carga antes de un consentimiento
        porque no se carga ninguna. Las tipografías están auto-hospedadas en el propio dominio, así que
        la página no hace peticiones a terceros. Si alguna vez se incorporara analítica o publicidad,
        se instalará un banner que bloquee su carga hasta que el usuario la acepte expresamente, y esta
        política se actualizará.
      </P>

      <H2>10. Menores de edad</H2>
      <P>
        El sitio no está dirigido a menores de 16 años y no recopilamos conscientemente sus datos. Si
        detectás que un menor ha facilitado datos, avisanos para suprimirlos.
      </P>

      <H2>11. Seguridad</H2>
      <P>
        El diseño elimina la superficie de ataque principal: al no existir subida de archivos, no hay
        endpoint que vulnerar, ni base que filtrar. El sitio se sirve por HTTPS, con aislamiento de
        origen (COOP/COEP) para que los módulos trabajen en contexto aislado, y el código fuente es
        público y auditable bajo licencia AGPL-3.
      </P>

      <H2>12. Cambios en esta política</H2>
      <P>
        Cualquier modificación se publica en esta misma página con su fecha de actualización. Si el
        cambio es sustancial y afecta la base jurídica del tratamiento, se pedirá el consentimiento
        nuevamente.
      </P>

      <H2>13. Contacto</H2>
      <P>
        Privacidad y datos personales:{" "}
        <a className="font-bold text-brand-ink underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
        · Código y issues:{" "}
        <a className="font-bold text-brand-ink underline" href={ISSUES_URL} target="_blank" rel="noreferrer">
          github.com/Sebas-dlt/pixelpress
        </a>
      </P>
    </Page>
  );
}

export function Terminos() {
  return (
    <Page
      title="Términos y condiciones"
      lead={
        <>
          Última actualización: {UPDATED}. Estos términos regulan el uso de PixelPress. Al usar el
          sitio aceptás las condiciones descritas acá; si no estás de acuerdo, no lo uses.
        </>
      }
    >
      <H2>1. Qué es el servicio</H2>
      <P>
        PixelPress convierte archivos PDF a Word (.docx) y Word a PDF usando un motor que corre
        íntegramente en tu navegador. Es un servicio gratuito, sin registro y sin cuenta.
      </P>

      <H2>2. Límites técnicos</H2>
      <UL
        items={[
          <>Formatos admitidos: .pdf y .docx.</>,
          <>Tamaño máximo por archivo: 50 MB.</>,
          <>PDF con contraseña: no se convierten; se avisa en lugar de devolver un archivo vacío.</>,
          <>
            PDF escaneados (sin capa de texto): no hay texto que extraer y no se realiza OCR; se avisa
            antes de entregar un resultado inútil.
          </>,
          <>
            La fidelidad es alta pero no perfecta: diseños muy complejos (columnas múltiples, cuadros
            flotantes, campos de formulario) pueden requerir ajustes manuales después de convertir.
          </>,
        ]}
      />

      <H2>3. Uso aceptable</H2>
      <P>
        Te comprometés a usar el sitio solo para fines lícitos y a no intentar: procesar malware, vulnerar
        el sitio, suplantar a terceros ni usarlo para difundir contenido ilegal. El uso es bajo tu
        responsabilidad y la de quien comparta el archivo con vos.
      </P>

      <H2>4. Tus archivos y su propiedad</H2>
      <P>
        Sos el único dueño de los archivos que cargás. PixelPress no reclama ningún derecho sobre ellos,
        no los copia, no los comparte y no los conserva: se procesan localmente y se descartan con la
        pestaña. Podés leer cómo se tratan en la{" "}
        <a className="font-bold text-brand-ink underline" href="#/privacidad">política de privacidad</a>.
      </P>

      <H2>5. Ausencia de garantías y limitación de responsabilidad</H2>
      <P>
        El servicio se presta "tal cual", sin garantía de resultado. En la máxima medida permitida por
        la ley aplicable, no nos hacemos responsables por daños derivados del uso o de la imposibilidad
        de usar el sitio, incluyendo la pérdida de un archivo por fallas del navegador, del equipo o del
        propio archivo de origen. Tus derechos como consumidor o consumidora son irrenunciables: nada
        en estos términos limita los que la ley de tu país te confiera.
      </P>

      <H2>6. Licencias de recursos: tipografías, íconos y fotos</H2>
      <P>Listado completo de los recursos gráficos y tipográficos que usa el sitio:</P>
      <UL
        items={[
          <>
            <strong>Tipografías Baloo 2 y Nunito</strong> — licencia SIL Open Font License 1.1.
            <strong> Uso comercial permitido</strong>: se pueden usar, hospedar y empaquetar con
            productos comerciales; solo no se pueden vender por sí solas. Están auto-hospedadas en este
            dominio.
          </>,
          <>
            <strong>Íconos</strong> — no hay librería de íconos: se usan los emojis de la fuente del
            sistema operativo del usuario, sin archivo ni licencia propia.
          </>,
          <>
            <strong>Fotografías</strong> — no se usa ninguna fotografía ni imagen de stock; no hay
            licencias de bancos de imágenes que verificar.
          </>,
          <>
            <strong>Logotipo y favicon</strong> — dibujados con CSS y SVG propios, sin terceros.
          </>,
          <>
            <strong>Código</strong> — mupdf (AGPL-3.0), LibreOffice converter (LGPL/MPL de The
            Document Foundation), docx y React (MIT), resto de dependencias bajo licencias OSI
            compatibles con uso comercial.
          </>,
        ]}
      />
      <P>
        <strong>Recursos con licencia que no permite uso comercial: ninguno.</strong>
      </P>

      <H2>7. Derecho de arrepentimiento</H2>
      <P>
        <strong>PixelPress no vende nada</strong>: no hay precios, ni carrito, ni cobros, ni
        contratos de compraventa a distancia. Por eso no corresponde mostrar un botón de arrepentimiento.
        Si en el futuro se incorporara la venta de productos o servicios, se implementará un botón de
        arrepentimiento visible y permanente, conforme a lo que exija la normativa del país del usuario
        (por ejemplo, el derecho de desistimiento de 14 días de la Directiva 2011/83/UE en la Unión
        Europea, o el botón de arrepentimiento de la Ley 26.361 y el Decreto 1033/2018 en Argentina).
      </P>

      <H2>8. Software de código abierto</H2>
      <P>
        El código de PixelPress se publica bajo licencia AGPL-3.0 en{" "}
        <a className="font-bold text-brand-ink underline" href={ISSUES_URL.replace("/issues", "")} target="_blank" rel="noreferrer">
          github.com/Sebas-dlt/pixelpress
        </a>
        . Podés auditarlo, copiarlo y modificarlo bajo los términos de esa licencia.
      </P>

      <H2>9. Contacto</H2>
      <P>
        <a className="font-bold text-brand-ink underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>{" "}
        · <a className="font-bold text-brand-ink underline" href="#/privacidad">Política de privacidad</a>
      </P>
    </Page>
  );
}
