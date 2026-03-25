import Link from "next/link";

export default function Home() {
  return (
    <main
      className="min-h-screen px-6 py-10 md:px-10"
      style={{
        fontFamily: "var(--font-geist-sans), ui-sans-serif, sans-serif",
        background:
          "radial-gradient(circle at 12% 18%, #dbeafe 0, transparent 30%), radial-gradient(circle at 88% 12%, #dcfce7 0, transparent 28%), linear-gradient(180deg, #f8fafc 0%, #eff6ff 48%, #f8fafc 100%)",
      }}
    >
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-sm backdrop-blur md:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
            Advanced Analytics
          </p>
          <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
            API-first crypto analytics for sentiment, flows, and market structure.
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
            defi-analytica blends Dune, DefiLlama, CoinGecko, Alternative.me, and
            internal feature engineering into typed /api/v1 routes and dashboard
            pages built for rapid research and operational monitoring.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Open Dashboard
            </Link>
            <Link
              href="/dashboard/sentiment?mode=demo"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Review Sentiment View
            </Link>
            <Link
              href="/api/v1"
              className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-5 py-3 text-sm font-medium text-sky-900 transition hover:border-sky-300 hover:bg-sky-100"
            >
              Inspect API Root
            </Link>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <article className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Operational Shape
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Request Flow</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  proxy.ts attaches request IDs, route handlers rate-limit and validate,
                  then adapters and services return normalized envelopes.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Provider Blend</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Dune, DefiLlama, CoinGecko, Alternative.me, and optional exchange
                  data feed shared analytics services.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-900">Frontend Surfaces</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Dashboard pages expose KPI cards, sentiment deep dives, and flow charts
                  backed by the internal API and service layer.
                </p>
              </div>
            </div>
          </article>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-slate-950 p-6 text-slate-100 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
              Quick Links
            </p>
            <div className="mt-4 space-y-3 text-sm">
              <Link href="/dashboard/flows?mode=demo" className="block rounded-2xl bg-white/5 p-4 transition hover:bg-white/10">
                <span className="font-medium">Flows Deep Dive</span>
                <span className="mt-1 block text-slate-300">
                  Compare demo DEX volume and TVL views with export actions.
                </span>
              </Link>
              <Link href="/dashboard/sentiment?mode=demo" className="block rounded-2xl bg-white/5 p-4 transition hover:bg-white/10">
                <span className="font-medium">Sentiment Deep Dive</span>
                <span className="mt-1 block text-slate-300">
                  Inspect regime history, confidence, and factor contribution trends.
                </span>
              </Link>
              <a
                href="https://nextjs.org/docs/app/getting-started"
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-2xl bg-white/5 p-4 transition hover:bg-white/10"
              >
                <span className="font-medium">App Router Reference</span>
                <span className="mt-1 block text-slate-300">
                  External framework reference for route handlers and server components.
                </span>
              </a>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}
