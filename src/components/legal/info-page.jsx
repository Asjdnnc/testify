import Link from "next/link";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Shared shell for public information pages (privacy, terms, security,
 * docs, support). Matches the landing page chrome and theme tokens.
 *
 * sections: [{ id, title, content: ReactNode }]
 */
export function InfoPage({ eyebrow, title, intro, lastUpdated, sections = [], children }) {
  return (
    <div className="min-h-screen flex flex-col bg-testify-bg text-testify-text selection:bg-testify-accent selection:text-white font-sans overflow-x-hidden">
      <Navbar />

      <div className="fixed bottom-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <main className="flex-1 w-full pt-28 pb-20">
        {/* Header */}
        <header className="relative border-b border-testify-border">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--testify-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--testify-border)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,#000_30%,transparent_100%)] opacity-60 pointer-events-none" />
          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pb-12">
            {eyebrow && (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-testify-accent mb-4">{eyebrow}</p>
            )}
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.05]">{title}</h1>
            {intro && <p className="mt-5 max-w-2xl text-base sm:text-lg text-testify-muted leading-relaxed">{intro}</p>}
            {lastUpdated && (
              <p className="mt-6 text-xs font-mono text-testify-muted2">Last updated: {lastUpdated}</p>
            )}
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12">
          {children}

          {sections.length > 0 && (
            <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
              {/* Table of contents */}
              <nav aria-label="On this page" className="hidden lg:block">
                <div className="sticky top-28">
                  <p className="text-xs font-semibold uppercase tracking-wider text-testify-muted2 mb-3">On this page</p>
                  <ol className="space-y-2 text-sm border-l border-testify-border">
                    {sections.map((s) => (
                      <li key={s.id}>
                        <a
                          href={`#${s.id}`}
                          className="block -ml-px pl-4 border-l border-transparent text-testify-muted hover:text-testify-text hover:border-testify-accent transition-colors"
                        >
                          {s.title}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
              </nav>

              <article className="min-w-0 space-y-12">
                {sections.map((s, i) => (
                  <section key={s.id} id={s.id} className="scroll-mt-28">
                    <h2 className="flex items-baseline gap-3 text-xl sm:text-2xl font-semibold tracking-tight">
                      <span className="font-mono text-sm text-testify-accent tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      {s.title}
                    </h2>
                    <div className="mt-4 space-y-4">{s.content}</div>
                  </section>
                ))}
              </article>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/** Consistent styled building blocks for page bodies. */
export function P({ children }) {
  return <p className="text-[15px] leading-7 text-testify-muted">{children}</p>;
}

export function UL({ items }) {
  return (
    <ul className="space-y-2.5 text-[15px] leading-7 text-testify-muted">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-testify-accent" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function Strong({ children }) {
  return <strong className="font-semibold text-testify-text">{children}</strong>;
}

export function A({ href, children }) {
  const external = href.startsWith("http") || href.startsWith("mailto:");
  const cls = "text-testify-accent hover:text-testify-accent2 underline underline-offset-4 decoration-testify-accent/40";
  return external ? (
    <a href={href} className={cls}>{children}</a>
  ) : (
    <Link href={href} className={cls}>{children}</Link>
  );
}

export function Card({ title, children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-testify-border bg-testify-bg2 p-6 ${className}`}>
      {title && <h3 className="font-semibold text-testify-text mb-2">{title}</h3>}
      <div className="text-sm leading-6 text-testify-muted">{children}</div>
    </div>
  );
}

export function Table({ head, rows }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-testify-border">
      <table className="w-full text-sm">
        <thead className="bg-testify-bg2 text-left">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold text-testify-text whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-testify-border">
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top text-testify-muted">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
