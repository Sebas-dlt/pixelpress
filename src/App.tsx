import { useRef, useState } from "react";
import { ConvertError, convertFile, detectKind, type Kind } from "./convert";

type Status =
  | { phase: "idle" }
  | { phase: "working"; message: string; percent?: number }
  | { phase: "done"; url: string; name: string }
  | { phase: "error"; message: string };

const MODES: { kind: Kind; icon: string; title: string; sub: string }[] = [
  { kind: "pdf", icon: "📄", title: "PDF → Word", sub: "Obtén un .docx editable" },
  { kind: "docx", icon: "📝", title: "Word → PDF", sub: "Obtén un .pdf nítido" },
];

const FEATURES = [
  {
    icon: "📄",
    tint: "bg-brand/15",
    title: "PDF a Word",
    body: "Respeta párrafos, tamaños, negritas y alineación. Editable de verdad.",
    link: "Convertir",
    href: "#convertidor",
    dark: false,
    cta: "bg-brand-ink text-white",
  },
  {
    icon: "📝",
    tint: "bg-mint/15",
    title: "Word a PDF",
    body: "Títulos, listas, tablas e imágenes intactos. Texto seleccionable, no capturas.",
    link: "Convertir",
    href: "#convertidor",
    dark: false,
    cta: "bg-grape text-white",
  },
  {
    icon: "🔒",
    tint: "bg-sun/20 text-cream",
    title: "Privacidad total",
    body: "Procesado local. Tu archivo nunca sale de tu dispositivo, ni siquiera un momento.",
    link: "Saber más",
    href: "#preguntas",
    dark: true,
    cta: "bg-sun text-ink",
  },
];

const STATS = [
  { n: "0", label: "Archivos en servidores", tone: "text-sun" },
  { n: "0", label: "Cuentas o registros", tone: "text-mint" },
  { n: "100%", label: "Procesado en tu navegador", tone: "text-brand" },
];

const FAQ = [
  {
    q: "¿Se suben mis documentos?",
    a: "No. La conversión ocurre dentro de tu pestaña: mupdf y LibreOffice corren en tu navegador y el archivo nunca sale de tu equipo. Sin servidores, sin cuentas, sin registro.",
  },
  {
    q: "¿Qué tan fiel es el resultado?",
    a: "De PDF a Word conservamos texto, tipografías, tamaños, negritas, cursivas, subrayados, alineación, listas, tablas y figuras ancladas. De Word a PDF convertimos con LibreOffice: títulos, listas, tablas e imágenes con texto seleccionable.",
  },
  {
    q: "¿Funciona sin conexión?",
    a: "La conversión no usa la red. Una vez cargada la pestaña puedes seguir convirtiendo sin internet, mientras el navegador la mantenga abierta o en su caché.",
  },
  {
    q: "¿Y los PDF escaneados?",
    a: "Si el PDF no tiene capa de texto no hay nada que extraer: lo detectamos y te avisamos, en lugar de entregarte un Word vacío. Tampoco convertimos archivos con contraseña ni de más de 50 MB.",
  },
];

export default function App() {
  const [mode, setMode] = useState<Kind>("pdf");
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<string | null>(null);

  const busy = status.phase === "working";

  async function start(file: File) {
    const kind = detectKind(file.name);
    if (!kind) {
      setStatus({ phase: "error", message: "Formato no soportado. Sube un PDF o un DOCX." });
      return;
    }
    setMode(kind);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setStatus({ phase: "working", message: "Preparando…" });
    try {
      const out = await convertFile(file, (p) => setStatus({ phase: "working", ...p }));
      const url = URL.createObjectURL(new Blob([out.data as BlobPart], { type: out.mimeType }));
      urlRef.current = url;
      setStatus({ phase: "done", url, name: out.filename });
    } catch (e) {
      setStatus({
        phase: "error",
        message:
          e instanceof ConvertError
            ? e.message
            : e instanceof Error
              ? e.message
              : "Error desconocido durante la conversión.",
      });
    }
  }

  function pick(files: FileList | null) {
    if (busy || !files?.[0]) return;
    void start(files[0]);
  }

  return (
    <div className="min-h-screen">
      <header>
        <div className="mx-auto flex h-24 max-w-6xl items-center justify-between px-6">
          <a href="#" className="flex items-center gap-3">
            <span className="grid size-12 -rotate-6 place-items-center rounded-full bg-brand font-display text-2xl font-extrabold text-white">
              P
            </span>
            <span className="font-display text-2xl font-extrabold">
              Pixel<span className="text-brand">Press</span>
            </span>
          </a>
          <nav className="hidden items-center gap-8 font-semibold text-ink/70 md:flex">
            <a className="transition-colors hover:text-brand" href="#convertidor">
              Convertir
            </a>
            <a className="transition-colors hover:text-brand" href="#privacidad">
              Privacidad
            </a>
            <a className="transition-colors hover:text-brand" href="#preguntas">
              Preguntas
            </a>
          </nav>
          <a
            href="#convertidor"
            className="rounded-full bg-ink px-6 py-3 font-bold text-cream transition-opacity hover:opacity-90"
          >
            Convertir ahora
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section id="convertidor" className="grid items-center gap-12 pb-16 pt-8 md:grid-cols-2">
          <div>
            <p className="inline-flex -rotate-2 items-center gap-2 rounded-full bg-sun px-4 py-2 text-sm font-bold text-ink">
              <span aria-hidden="true" className="size-2 rounded-full bg-brand-ink" />
              100% privado · cero exposición
            </p>
            <h1 className="mt-6 font-display text-[2.75rem] leading-[0.95] font-extrabold sm:text-[3.5rem] lg:text-[4.5rem]">
              Convierte PDF a Word <span className="text-brand">sin miedo.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg font-medium text-ink/70">
              Tu documento vive solo en tu navegador. Sin servidores, sin nubes, sin riesgos. Fiel al
              original, editable al instante.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#convertidor"
                className="btn-push rounded-full bg-brand-ink px-8 py-4 font-display text-lg font-bold text-white"
              >
                Empezar gratis
              </a>
              <a
                href="#privacidad"
                className="rounded-full border-2 border-ink bg-paper px-8 py-4 font-display text-lg font-bold text-ink transition-colors hover:bg-sun"
              >
                Cómo protegemos tus archivos
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="card-pop-lg rounded-[2rem] border-2 border-ink bg-paper p-6">
              <div className="mb-4 flex items-center justify-between">
                <span aria-hidden="true" className="flex gap-2">
                  <span className="size-3 rounded-full bg-[#ff5f57] ring-1 ring-black/15" />
                  <span className="size-3 rounded-full bg-[#febc2e] ring-1 ring-black/15" />
                  <span className="size-3 rounded-full bg-[#28c840] ring-1 ring-black/15" />
                </span>
                <span className="text-xs font-bold text-ink/60">convertidor</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {MODES.map((m) => (
                  <button
                    key={m.kind}
                    type="button"
                    aria-pressed={mode === m.kind}
                    disabled={busy}
                    onClick={() => setMode(m.kind)}
                    className={`rounded-3xl border-2 p-4 text-left transition ${
                      mode === m.kind
                        ? "border-ink bg-sun"
                        : "border-dashed border-ink/20 bg-cream hover:border-ink/50"
                    }`}
                  >
                    <span className="block text-[30px] leading-9">{m.icon}</span>
                    <span className="mt-2 block font-display font-bold">{m.title}</span>
                    <span className="mt-1 block text-xs font-semibold text-ink/60">{m.sub}</span>
                  </button>
                ))}
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  pick(e.dataTransfer.files);
                }}
                className={`mt-4 rounded-3xl border-2 border-dashed p-7 text-center transition ${
                  dragging ? "border-brand bg-brand/10" : "border-ink/25 bg-cream"
                }`}
              >
                {status.phase === "idle" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => inputRef.current?.click()}
                    className="w-full cursor-pointer"
                  >
                    <span className="block font-display text-lg font-bold">
                      Arrastra tus archivos aquí
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-ink/60">
                      o haz clic para elegirlos · PDF y DOCX
                    </span>
                  </button>
                )}

                {status.phase === "working" && (
                  <div role="status" aria-live="polite">
                    <span className="mx-auto block size-9 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
                    <span className="mt-4 block font-display font-bold">{status.message}</span>
                    <span
                      className="mx-auto mt-4 block h-2 w-full max-w-sm overflow-hidden rounded-full bg-ink/10"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={status.percent}
                    >
                      <span
                        className="block h-full rounded-full bg-brand transition-all"
                        style={{ width: `${status.percent ?? 30}%` }}
                      />
                    </span>
                  </div>
                )}

                {status.phase === "done" && (
                  <div>
                    <span className="block text-3xl">✅</span>
                    <span className="mt-2 block truncate font-display font-bold" title={status.name}>
                      {status.name}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-ink/60">
                      Listo · convertido en tu navegador
                    </span>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={status.url}
                        download={status.name}
                        className="rounded-full bg-brand-ink px-6 py-3 font-bold text-white hover:brightness-110"
                      >
                        Descargar
                      </a>
                      <button
                        type="button"
                        onClick={() => setStatus({ phase: "idle" })}
                        className="rounded-full border-2 border-ink px-6 py-3 font-bold hover:bg-white"
                      >
                        Convertir otro
                      </button>
                    </div>
                  </div>
                )}

                {status.phase === "error" && (
                  <div role="alert">
                    <span className="block text-3xl">⚠️</span>
                    <span className="mt-2 block font-display font-bold text-destructive">
                      No se pudo convertir
                    </span>
                    <span className="mx-auto mt-1 block max-w-md text-sm font-semibold text-ink/70">
                      {status.message}
                    </span>
                    <button
                      type="button"
                      onClick={() => setStatus({ phase: "idle" })}
                      className="mt-5 rounded-full border-2 border-ink px-6 py-3 font-bold hover:bg-white"
                    >
                      Intentar de nuevo
                    </button>
                  </div>
                )}

                <input
                  ref={inputRef}
                  type="file"
                  aria-label="Elegir archivo para convertir"
                  className="sr-only"
                  accept={mode === "pdf" ? ".pdf" : ".docx"}
                  onChange={(e) => {
                    pick(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              <p className="mt-4 text-center text-xs font-bold text-ink/60">
                Todo se procesa en tu navegador · 0 archivos enviados
              </p>
            </div>
            <span className="absolute -top-5 -right-4 rotate-6 rounded-full bg-grape px-4 py-2 font-display text-sm font-bold text-white shadow-[4px_4px_0_0_var(--color-ink)]">
              Fiel al original
            </span>
          </div>
        </section>

        <section id="privacidad" className="pb-16">
          <h2 className="mb-8 font-display text-4xl font-extrabold">Elige tu conversión</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className={`card-pop rounded-[1.75rem] border-2 border-ink p-7 transition-transform hover:-translate-y-1 ${
                  f.dark ? "bg-ink text-cream shadow-[6px_6px_0_0_var(--color-sun)]" : "bg-paper"
                }`}
              >
                <span className={`grid size-14 place-items-center rounded-2xl text-[30px] ${f.tint}`}>
                  {f.icon}
                </span>
                <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
                <p
                  className={`mt-2 text-sm font-medium ${f.dark ? "text-cream/70" : "text-ink/60"}`}
                >
                  {f.body}
                </p>
                <a
                  href={f.href}
                  className={`mt-5 block w-full rounded-full py-3 text-center font-bold transition-transform hover:-translate-y-0.5 ${f.cta}`}
                >
                  {f.link}
                </a>
              </article>
            ))}
          </div>

          <div className="mt-16 rounded-[2.5rem] bg-ink px-8 py-12 sm:px-14">
            <div className="grid gap-8 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className={`font-display text-5xl font-extrabold ${s.tone}`}>{s.n}</div>
                  <div className="mt-2 font-semibold text-cream/70">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preguntas" className="pb-16">
          <h2 className="mb-8 font-display text-4xl font-extrabold">Preguntas frecuentes</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {FAQ.map((f) => (
              <div key={f.q} className="card-pop rounded-[1.75rem] border-2 border-ink bg-paper p-7">
                <h3 className="font-display text-lg font-bold">{f.q}</h3>
                <p className="mt-2 text-sm font-medium text-ink/60">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-sm font-semibold text-ink/60">
        PixelPress · Hecho para confiar en tus documentos
      </footer>
    </div>
  );
}
