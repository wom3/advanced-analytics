import Link from "next/link";

export const metadata = {
  title: "Flows Deep Dive | defi-analytica",
  description: "Flows deep-dive page scaffold for DEX volume and TVL analytics.",
};

const UPCOMING_SECTIONS = [
  {
    title: "DEX Volume and TVL Flow Charts",
    description:
      "Chart surface reserved for net flow direction, acceleration windows, and context overlays.",
    status: "Planned in Feature 14 task 2",
  },
  {
    title: "Protocol and Chain Filters",
    description:
      "Control rail for protocol scope, chain scope, and synchronized time window selection.",
    status: "Planned in Feature 14 task 3",
  },
  {
    title: "Export Actions",
    description:
      "CSV and JSON exports for snapshots and selected flow ranges without changing API contracts.",
    status: "Planned in Feature 14 task 4",
  },
] as const;

export default function DashboardFlowsPage() {
  return (
    <main
      className="min-h-screen px-6 py-10 md:px-10"
      style={{
        fontFamily: "var(--font-geist-sans), ui-sans-serif, sans-serif",
        background:
          "radial-gradient(circle at 12% 16%, #dbeafe 0, transparent 35%), radial-gradient(circle at 90% 5%, #cffafe 0, transparent 30%), linear-gradient(180deg, #f8fafc 0%, #ecfeff 45%, #e2e8f0 100%)",
      }}
    >
      <section className="mx-auto w-full max-w-6xl">
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Feature 14
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
              Flows Deep Dive
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 md:text-base">
              Dedicated workspace for volume and TVL flow analytics, built in staged tasks.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-3 text-xs text-slate-600 shadow-sm backdrop-blur">
            <p>
              Route: <span className="font-medium text-slate-800">/dashboard/flows</span>
            </p>
            <p className="mt-1">
              Status: <span className="font-medium text-slate-800">Scaffolded</span>
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Page Foundation</h2>
          <p className="mt-2 text-sm text-slate-600">
            This initial implementation establishes route wiring, metadata, and page structure. Data
            visualizations and interactive controls are intentionally deferred to the next Feature
            14 tasks.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {UPCOMING_SECTIONS.map((section) => (
              <article
                key={section.title}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                  {section.status}
                </p>
                <h3 className="mt-2 text-base font-semibold text-slate-900">{section.title}</h3>
                <p className="mt-2 text-sm text-slate-600">{section.description}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="mt-8 text-sm text-slate-600">
          Feature 14 task 1 complete: flows route scaffold is available.
          <Link
            href="/dashboard"
            className="ml-2 font-medium text-slate-900 underline decoration-slate-300 underline-offset-4"
          >
            Back to dashboard
          </Link>
        </footer>
      </section>
    </main>
  );
}
