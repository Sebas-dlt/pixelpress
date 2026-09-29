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
    tint: "bg-sun/40",
    title: "PDF a Word",
    body: "Respeta párrafos, tamaños, negritas y alineación. Editable de verdad.",
    link: "Convertir",
    href: "#convertidor",
  },
  {
    icon: "📝",
    tint: "bg-mint/40",
    title: "Word a PDF",
    body: "Títulos, listas, tablas e imágenes intactos. Texto seleccionable, no capturas.",
    link: "Convertir",
    href: "#convertidor",
  },
  {
    icon: "🔒",
    tint: "bg-grape/30",
    title: "Privacidad total",
    body: "Procesado local. Tu archivo nunca sale de tu dispositivo, ni siquiera un momento.",
    link: "Saber más",
    href: "#preguntas",
  },
];

const STATS = [
  { n: "0", label: "Archivos en servidores" },
  { n: "0", label: "Cuentas o registros" },
  { n: "100%", label: "Procesado en tu navegador" },
];

const FAQ = [
  {
    q: "¿Se suben mis documentos?",
    a: "No. La conversión ocurre dentro de tu navegador. No existe ningún envío ni almacenamiento en la nube.",
  },
  {
    q: "¿Qué tan fiel es el resultado?",
    a: "De PDF a Word recuperamos texto, tipografías, tamaños y alineación. De Word a PDF conservamos títulos, listas, tablas e imágenes con texto seleccionable.",
  },
  {
    q: "¿Funciona sin conexión?",
    a: "Una vez cargada la página, sí: el motor de conversión ya está en tu equipo.",
  },
  {
    q: "¿Y los PDF escaneados?",
    a: "Un PDF que solo contiene imágenes no tiene texto que recuperar; te avisamos en lugar de entregarte un Word vacío.",
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
      <header className="sticky top-0 z-40 border-b border-ink/10 bg-cream/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <a href="#" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand font-display text-lg font-bold text-white">
              P
            </span>
            <span className="font-display text-xl font-bold">PixelPress</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm font-bold text-muted-foreground sm:flex">
            <a className="hover:text-ink" href="#convertidor">
              Convertir
            </a>
            <a className="hover:text-ink" href="#privacidad">
              Privacidad
            </a>
            <a className="hover:text-ink" href="#preguntas">
              Preguntas
            </a>
          </nav>
          <a
            href="#convertidor"
            className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream hover:opacity-90"
          >
            Convertir ahora
          </a>
        </div>
      </header>

      <main>
        <section className="px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-ink/10 bg-paper px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
            100% privado · cero exposición
          </p>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] sm:text-6xl">
            Convierte PDF a Word <span className="text-brand">sin miedo.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
            Tu documento vive solo en tu navegador. Sin servidores, sin nubes, sin riesgos. Fiel al
            original, editable al instante.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#convertidor"
              className="rounded-full bg-brand-ink px-7 py-3.5 font-bold text-white shadow-sm hover:brightness-110"
            >
              Empezar gratis
            </a>
            <a
              href="#privacidad"
              className="rounded-full border border-ink/15 bg-paper px-7 py-3.5 font-bold hover:bg-white"
            >
              Cómo protegemos tus archivos
            </a>
          </div>
        </section>

        <section id="convertidor" className="scroll-mt-20 px-4 sm:px-6">
          <div className="mx-auto max-w-3xl rounded-3xl border border-ink/10 bg-paper p-5 shadow-sm sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-ink">
              convertidor local
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {MODES.map((m) => (
                <button
                  key={m.kind}
                  type="button"
                  aria-pressed={mode === m.kind}
                  disabled={busy}
                  onClick={() => setMode(m.kind)}
                  className={`rounded-2xl border-2 p-4 text-left transition ${
                    mode === m.kind
                      ? "border-brand bg-brand/5"
                      : "border-ink/10 bg-cream/50 hover:border-ink/25"
                  }`}
                >
                  <span className="font-display text-lg font-bold">
                    {m.icon} {m.title}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">{m.sub}</span>
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
              className={`mt-4 rounded-2xl border-2 border-dashed p-8 text-center transition sm:p-10 ${
                dragging ? "border-brand bg-brand/5" : "border-ink/20 bg-cream/60"
              }`}
            >
              {status.phase === "idle" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="w-full cursor-pointer"
                >
                  <span className="block font-display text-xl font-bold">
                    Arrastra tus archivos aquí
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
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
                  <span className="mt-1 block text-sm text-muted-foreground">
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
                      className="rounded-full border border-ink/15 px-6 py-3 font-bold hover:bg-white"
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
                  <span className="mx-auto mt-1 block max-w-md text-sm text-muted-foreground">
                    {status.message}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatus({ phase: "idle" })}
                    className="mt-5 rounded-full border border-ink/15 px-6 py-3 font-bold hover:bg-white"
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

            <p className="mt-4 text-center text-xs font-semibold text-muted-foreground">
              🛡️ Todo se procesa en tu navegador · 0 archivos enviados
            </p>
          </div>
        </section>

        <section id="privacidad" className="scroll-mt-20 px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-brand-ink">
              Fiel al original
            </p>
            <h2 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">
              Elige tu conversión
            </h2>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {FEATURES.map((f) => (
                <article
                  key={f.title}
                  className="rounded-3xl border border-ink/10 bg-paper p-6 shadow-sm"
                >
                  <span
                    className={`grid size-12 place-items-center rounded-2xl text-2xl ${f.tint}`}
                  >
                    {f.icon}
                  </span>
                  <h3 className="mt-4 font-display text-xl font-bold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  <a href={f.href} className="mt-4 inline-block text-sm font-extrabold text-brand-ink hover:underline">
                    {f.link} →
                  </a>
                </article>
              ))}
            </div>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {STATS.map((s) => (
                <div key={s.label} className="rounded-3xl border border-ink/10 bg-paper p-6 text-center">
                  <div className="font-display text-5xl font-extrabold text-brand">{s.n}</div>
                  <div className="mt-1 text-sm font-bold text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="preguntas" className="scroll-mt-20 px-4 pb-20 sm:px-6">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center font-display text-3xl font-extrabold sm:text-4xl">
              Preguntas frecuentes
            </h2>
            <div className="mt-8 space-y-3">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-2xl border border-ink/10 bg-paper px-5 py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display font-bold [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span className="text-brand transition-transform group-open:rotate-45">＋</span>
                  </summary>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
        PixelPress · Hecho para confiar en tus documentos
      </footer>
    </div>
  );
}
