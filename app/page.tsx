import Link from "next/link";

const applications = [
  {
    title: "Legal review",
    description:
      "Upload agreements, policies, and contracts to extract clauses, summarize obligations, and surface key risks faster.",
    highlight: "Save hours on first-pass review",
    metrics: ["Clause detection", "Risk spotting", "Structured summaries"],
  },
  {
    title: "Research workflows",
    description:
      "Turn long reports, whitepapers, and technical PDFs into concise insights your team can scan and act on immediately.",
    highlight: "Go from document to insight in minutes",
    metrics: ["Key takeaways", "Topic grouping", "Source tracing"],
  },
  {
    title: "Operations support",
    description:
      "Use uploaded files to answer internal process questions, standardize onboarding, and keep operations knowledge in one place.",
    highlight: "A better knowledge assistant for teams",
    metrics: ["SOP lookup", "Onboarding help", "Reusable answers"],
  },
];

const usages = [
  {
    title: "Ask questions about PDFs",
    detail:
      "Find answers inside uploaded documents without manually scanning every page.",
  },
  {
    title: "Summarize long files",
    detail:
      "Generate concise summaries for reports, proposals, invoices, and policy docs.",
  },
  {
    title: "Compare multiple documents",
    detail:
      "Use the dashboard to keep related files organized and compare information side by side.",
  },
  {
    title: "Support decision making",
    detail:
      "Turn raw document data into clear insights that help you move faster with confidence.",
  },
];

const workflow = [
  {
    step: "01",
    title: "Upload a document",
    description:
      "Drop in a PDF and the system prepares it for analysis without adding extra friction.",
  },
  {
    step: "02",
    title: "Let DocuMind process it",
    description:
      "The app extracts content and organizes it so the important details are easier to work with.",
  },
  {
    step: "03",
    title: "Chat, search, and act",
    description:
      "Use the dashboard to ask questions, review outputs, and move from document to decision quickly.",
  },
];

const stats = [
  { label: "Fast insights", value: "24/7" },
  { label: "Document types", value: "PDF-first" },
  { label: "Best for", value: "Teams & solo users" },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-blue-300">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-7 text-gray-600 dark:text-gray-300">
        {description}
      </p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.14),_transparent_28%),linear-gradient(to_bottom,_#eff6ff,_#ffffff_22%,_#f8fafc_60%,_#ffffff)] text-gray-900 dark:bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(99,102,241,0.16),_transparent_24%),linear-gradient(to_bottom,_#020617,_#0f172a_40%,_#020617)] dark:text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-20 px-6 py-10 sm:px-8 lg:px-10">
        <section className="relative overflow-hidden rounded-[2rem] border border-blue-100/80 bg-white/85 p-8 shadow-[0_20px_80px_rgba(59,130,246,0.12)] backdrop-blur dark:border-white/10 dark:bg-slate-900/75 sm:p-10 lg:p-14">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(59,130,246,0.08),transparent_35%,rgba(99,102,241,0.08))] dark:bg-[linear-gradient(135deg,rgba(59,130,246,0.12),transparent_35%,rgba(99,102,241,0.12))]" />
          <div className="relative grid gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:items-center">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-4 py-1 text-sm font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200">
                Document intelligence for practical work
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-gray-950 dark:text-white sm:text-5xl lg:text-6xl">
                Understand PDFs faster, and use them where the work actually happens.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-gray-600 dark:text-gray-300">
                DocuMind helps people upload documents, ask questions, summarize content, and turn
                dense files into useful answers. This page highlights the main applications and
                the day-to-day ways teams can use the product.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:scale-[1.01] hover:from-blue-500 hover:to-indigo-500"
                >
                  Get started
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-white/15 dark:bg-white/5 dark:text-gray-100 dark:hover:border-blue-400/40 dark:hover:text-blue-200"
                >
                  Sign in
                </Link>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-4 shadow-sm dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="text-2xl font-semibold text-gray-950 dark:text-white">
                      {item.value}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-blue-500/20 via-indigo-500/10 to-transparent blur-2xl" />
              <div className="relative rounded-[2rem] border border-gray-200 bg-white p-6 shadow-xl shadow-blue-950/10 dark:border-white/10 dark:bg-slate-950/80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      Example usage
                    </p>
                    <p className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">
                      Uploaded PDF summary
                    </p>
                  </div>
                  <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-200">
                    Live-ready
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Best for
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      Legal teams, researchers, operations leaders, and anyone who works through
                      large document sets every day.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {["Summaries", "Questions", "Key facts", "Action items"].map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 dark:border-white/10 dark:bg-slate-900 dark:text-gray-200"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-10">
          <SectionHeading
            eyebrow="Applications"
            title="Where the website fits into real workflows"
            description="These examples show the kinds of problems DocuMind is meant to solve. Each one is intentionally broad so it can adapt to different teams and document libraries."
          />
          <div className="grid gap-6 lg:grid-cols-3">
            {applications.map((item) => (
              <article
                key={item.title}
                className="group rounded-[1.75rem] border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-950/10 dark:border-white/10 dark:bg-slate-900/70"
              >
                <p className="text-sm font-semibold text-blue-600 dark:text-blue-300">
                  {item.highlight}
                </p>
                <h3 className="mt-3 text-2xl font-semibold text-gray-950 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-4 text-sm leading-7 text-gray-600 dark:text-gray-300">
                  {item.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {item.metrics.map((metric) => (
                    <span
                      key={metric}
                      className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:border-blue-400/20 dark:bg-blue-500/10 dark:text-blue-200"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="space-y-6 rounded-[1.75rem] border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
            <SectionHeading
              eyebrow="How it works"
              title="A simple path from file upload to usable insight"
              description="The flow is intentionally straightforward so people can move quickly from document to decision."
            />
            <div className="space-y-4">
              {workflow.map((item) => (
                <div key={item.step} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-bold text-white">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-950 dark:text-white">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6">
            <div className="rounded-[1.75rem] border border-gray-200 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-slate-900/70">
              <SectionHeading
                eyebrow="Common usages"
                title="Ways people use the app every day"
                description="A practical list of what users can do once they land in the product."
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {usages.map((usage) => (
                  <div
                    key={usage.title}
                    className="rounded-2xl border border-gray-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-white/5"
                  >
                    <h3 className="text-base font-semibold text-gray-950 dark:text-white">
                      {usage.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                      {usage.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-blue-100 bg-gradient-to-br from-blue-600 via-indigo-600 to-slate-900 p-8 text-white shadow-xl shadow-blue-950/20 dark:border-white/10">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-100">
                Ready to explore
              </p>
              <h3 className="mt-4 text-3xl font-semibold tracking-tight">
                Move from uploads to answers without changing tools.
              </h3>
              <p className="mt-4 max-w-xl text-sm leading-7 text-blue-50/90">
                Use the dashboard for document-driven work, keep your files organized, and let the
                app handle the repetitive reading for you.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/documents"
                  className="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                >
                  View documents
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
