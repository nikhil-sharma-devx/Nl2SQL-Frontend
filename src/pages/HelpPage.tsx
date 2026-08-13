import { useState } from 'react';
import {
  Search,
  Database,
  Upload,
  Clock,
  BarChart3,
  Bookmark,
  BrainCircuit,
  Settings,
  ChevronDown,
  ChevronRight,
  Keyboard,
  Zap,
  MessageSquare,
  Send,
  RefreshCw,
  HelpCircle,
  Sparkles,
  Play,
  FileJson,
  Link2,
  LayoutDashboard,
  Clock3,
  BadgeCheck,
  FileCode2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useLenisScroll } from '@/hooks/useLenisScroll';

/* ── Types ──────────────────────────────────────────────────────────────── */

interface FaqItem {
  q: string;
  a: string;
}

interface Section {
  id: string;
  icon: React.ElementType;
  title: string;
  color: string;
  summary: string;
  content: string[];
  tips?: string[];
  faqs?: FaqItem[];
}

/* ── Data ───────────────────────────────────────────────────────────────── */

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    icon: Sparkles,
    title: 'Getting Started',
    color: 'text-primary',
    summary: 'Set up your database and ask your first question in minutes.',
    content: [
      'Home is your workspace landing page — quick stats, recent activity, and one-click access to continue a chat, open a dashboard, or jump into Query Studio.',
      'Connect a database via Schema → Database Connections. Give it a name and paste a connection string (PostgreSQL or MySQL); it\'s tested and encrypted before it\'s saved. You can add more than one and switch between them anytime.',
      'Click "Sync now" (on the Tables card) or "Refresh Schema from Live DB" to let the AI learn your table structures. This only needs to be done once per connection, or after schema changes.',
      'Navigate to Query Studio and type any question about your data in plain English.',
      'The AI generates SQL, optionally executes it, and shows results in a table with auto-suggested charts.',
    ],
    tips: [
      'The more descriptive your question, the better the SQL. Mention column names or table names when you know them.',
      'Toggle "Execute query" on to run SQL automatically instead of just generating it.',
      'Every session is saved — use History to revisit past conversations.',
    ],
    faqs: [
      {
        q: 'Which databases are supported?',
        a: 'PostgreSQL and MySQL are fully supported via connection strings. Dialect is selectable per query, and you can also work schema-only via JSON upload without a live connection.',
      },
      {
        q: 'Is my database password stored securely?',
        a: 'Connection strings are stored encrypted at rest and masked in the UI. Each connection is tested before it\'s saved.',
      },
      {
        q: 'Can I connect more than one database?',
        a: 'Yes — add as many named connections as you like from Schema → Database Connections. Each has its own isolated schema index; switching the active connection re-scopes chat, schema, and query execution.',
      },
    ],
  },
  {
    id: 'query-studio',
    icon: Database,
    title: 'Query Studio',
    color: 'text-primary',
    summary: 'The main chat interface for turning English into SQL.',
    content: [
      'Type any natural-language question in the input box and press Enter (or Shift+Enter for a new line).',
      'The AI responds with generated SQL and, if "Execute query" is on, live results from your database.',
      'Each message shows: the generated SQL, tables used, execution results, validation status, and suggested follow-up questions.',
      '"Execute query" toggle — when on, SQL runs against your live database immediately after generation.',
      '"Dialect" selector — switch between PostgreSQL and MySQL per query without changing your connection.',
      '"Show Graph" button — opens a visual diagram of your schema alongside the chat so you can see table relationships.',
      '"Visual Builder" button — opens a drag-and-drop SQL query builder for users who prefer a no-code approach.',
      'Click any "Suggested follow-up" chip to instantly send that question.',
      'Got a wrong result? Use the correction box under a response to describe what\'s off instead of retyping the question — the AI regenerates SQL taking that correction into account.',
      'Edit a previous question to rephrase and resend it, or hit Regenerate on an AI response for a fresh SQL attempt at the same question.',
      'Every result has Export (CSV / JSON / SQL / PDF) and Share (link with optional expiry, email, Slack, revoke) controls above the table.',
      'Use the bookmark icon on any AI response to save the query to Saved Queries, or send a result straight to a Dashboard as a widget.',
    ],
    tips: [
      'Start messages with action words: "Show me…", "Find all…", "Count how many…", "Compare…".',
      'Mention time ranges explicitly: "…in the last 30 days", "…from January to March".',
      'Ask follow-up questions in the same session — the AI remembers context from earlier messages.',
    ],
    faqs: [
      {
        q: 'Why did the AI generate wrong SQL?',
        a: 'Sync your schema first (Schema → Sync now) so the AI has current table/column names. Then rephrase with more specific column or table references, or use the correction box on the response.',
      },
      {
        q: 'How do I start a new conversation?',
        a: 'Click "New chat" at the top of the sidebar, or use the keyboard shortcut Alt+N.',
      },
      {
        q: 'What does "Execute query" actually do?',
        a: 'When enabled, the generated SQL is run against your active connection and results are shown in a table directly in the chat. Your DB credentials are used server-side; no SQL is exposed to third parties.',
      },
    ],
  },
  {
    id: 'schema',
    icon: Upload,
    title: 'Schema Management',
    color: 'text-blue-400',
    summary: 'Connect your database(s) and keep the AI up to date with your schema.',
    content: [
      'Database Connections — add one or more named connections (e.g. "Production", "Staging") with a connection string. Test, edit, or delete any connection, and switch the active one at any time — it scopes chat, schema, and query execution.',
      'Sync now / Refresh Schema from Live DB — reflects all tables from the active connection into the AI\'s vector store. Run this after any table or column change.',
      'Tables — browse every table the AI knows about; expand one to see its columns, types, primary/foreign keys, and NOT NULL flags. Newly discovered tables are flagged "New".',
      'Explain (lightbulb icon) — ask the AI to explain what a table or column means in plain English.',
      'Editable descriptions — add a short business description to any table to help the AI understand its purpose.',
      'Pinned Tables — pin the tables you use most; pinned tables are always included as retrieval hints, so the AI prioritizes them for relevant questions.',
      'Upload Schema — upload a JSON file describing your schema instead of (or alongside) a live connection. Useful for offline or staging setups.',
      'Schema Status — shows how many schema chunks are stored and whether the vector store is ready for queries.',
      'Reset existing schema — when uploading, check this box to wipe previous schema data and start fresh.',
    ],
    tips: [
      'Re-sync your schema after any migration or ALTER TABLE to keep AI suggestions accurate.',
      'Pin your most-queried tables — it measurably improves SQL accuracy on ambiguous questions.',
      'The JSON upload format accepts tables with columns, types, and primary key flags — see the example on the Schema page.',
    ],
    faqs: [
      {
        q: 'Do I need a live DB connection to use the app?',
        a: 'No. You can upload a JSON schema file and still get SQL generation. Live execution requires an active connection.',
      },
      {
        q: 'How often should I sync the schema?',
        a: 'After every schema change (new tables, renamed columns, etc.). For production databases that change rarely, once per deployment is usually enough.',
      },
      {
        q: 'What happens to a connection\'s data if I delete it?',
        a: 'Deleting a connection also removes its schema index. Saved queries, dashboards, and schedules tied to it may stop working — switch them to another connection first if you need to keep them.',
      },
    ],
  },
  {
    id: 'history',
    icon: Clock,
    title: 'Chat History',
    color: 'text-cyan-400',
    summary: 'Browse and resume every past conversation.',
    content: [
      'All sessions are listed chronologically, grouped by Today / Yesterday / Last 7 days / Last 30 days.',
      'Click any session to see its full message thread including SQL, results, and validation details.',
      'Use "Continue Chat" inside a session to resume it in Query Studio with full context.',
      'Delete individual sessions or clear all history from the History page.',
      'The sidebar also lists recent sessions for quick access — use the search box to filter by title.',
    ],
    faqs: [
      {
        q: 'Are deleted sessions recoverable?',
        a: 'Deletion from the History page is permanent. However, the Settings → Data & Privacy → Clear History option is a soft-delete recoverable within 30 days.',
      },
      {
        q: 'How many sessions are shown?',
        a: 'The sidebar loads the 50 most recent. The History page shows all sessions with pagination.',
      },
    ],
  },
  {
    id: 'saved-queries',
    icon: Bookmark,
    title: 'Saved Queries',
    color: 'text-amber-400',
    summary: 'Bookmark your most useful SQL queries for instant reuse.',
    content: [
      'Click the bookmark icon on any AI-generated SQL response to save it.',
      'Saved queries store the natural-language prompt, the generated SQL, and the dialect.',
      'Search saved queries by keyword, or filter to starred-only using the star toggle.',
      'Star important queries to pin them at the top of filtered views.',
      '"Re-run" (play icon) re-executes a saved query against your current database.',
      'Pagination supports large query libraries — 20 queries per page.',
    ],
    faqs: [
      {
        q: 'Can I edit a saved query\'s SQL?',
        a: 'Not from the Saved Queries page — re-run the query in Query Studio and save the updated version. The original is then deleted or kept alongside.',
      },
    ],
  },
  {
    id: 'dashboards',
    icon: LayoutDashboard,
    title: 'Dashboards',
    color: 'text-teal-400',
    summary: 'Compose saved query results into live, refreshable charts.',
    content: [
      'Create a dashboard by giving it a name — it becomes a canvas for charts built from your queries.',
      'Add a widget from Query Studio: on any result, choose "Add to Dashboard" and pick an existing dashboard or create a new one on the fly.',
      'Each widget stores its underlying SQL, so Refresh re-runs every widget\'s query and pulls fresh data into the dashboard.',
      'Change a widget\'s chart type (table, bar, line, pie, scatter, histogram, KPI) directly from the dropdown on the widget.',
      'Rename a dashboard by clicking its title, duplicate it to branch off a variant, or delete individual widgets or the whole dashboard.',
    ],
    tips: [
      'Group related metrics from different questions onto one dashboard for a single-glance view.',
      'Use the KPI chart type for a single headline number, and bar/line for anything you want to track over time.',
    ],
    faqs: [
      {
        q: 'Why is my dashboard empty right after creating it?',
        a: 'New dashboards start with no widgets — go to Query Studio, run a query, and use "Add to Dashboard" on the result to populate it.',
      },
    ],
  },
  {
    id: 'schedules',
    icon: Clock3,
    title: 'Scheduled Queries & Alerts',
    color: 'text-orange-400',
    summary: 'Run a saved question on a recurring cadence and get emailed the results.',
    content: [
      'Create a schedule with a name, a natural-language question (e.g. "total revenue by day"), and a plain-English cadence (e.g. "every morning", "daily at 9am", "every Monday").',
      'Pick which connection the schedule runs against — it defaults to your currently active connection.',
      '"Email me" condition controls when you\'re notified: every run, only when there are results, or only when results change since the last run.',
      'Pause / resume a schedule without deleting it, or use "Run now" to trigger an on-demand run immediately.',
      'View history to see each past run\'s status, row count, and any error.',
      'Status badges show at a glance whether a schedule is healthy, failing, paused, or has never run yet.',
    ],
    tips: [
      'Use "on_change" notifications for monitoring — you\'ll only get an email when something actually shifted.',
      'Run a schedule immediately with "Run now" after creating it to confirm it behaves as expected before waiting for the next cadence.',
    ],
    faqs: [
      {
        q: 'What happens if a scheduled run fails?',
        a: 'The schedule is marked "Failing" and the error is recorded in its history — it keeps retrying on the next scheduled cadence rather than disabling itself.',
      },
    ],
  },
  {
    id: 'metrics',
    icon: BadgeCheck,
    title: 'Metrics Catalog',
    color: 'text-fuchsia-400',
    summary: 'Governed business metrics the SQL generator prefers over ad-hoc calculations.',
    content: [
      'Create a metric with a name, description, a SQL definition (e.g. "SELECT SUM(amount) - SUM(refunds) FROM orders"), and tags.',
      'Preview a metric to run its SQL definition and sanity-check the result before relying on it.',
      'Certify a metric once it\'s trustworthy — certified metrics are surfaced to the SQL generator so questions like "what\'s our net revenue" reuse the governed definition instead of the AI guessing at one.',
      'Metrics with SQL validation warnings can\'t be certified until the warning is resolved.',
      'Search metrics by name/description, or filter to certified-only to audit what\'s governed.',
    ],
    tips: [
      'Certify the metrics finance/leadership actually rely on first — that\'s where ad-hoc AI guesses are most costly if wrong.',
      'Keep metric SQL definitions dialect-neutral where possible so they resolve correctly regardless of which connection is active.',
    ],
    faqs: [
      {
        q: 'What\'s the difference between a metric and a saved query?',
        a: 'A saved query is a specific NL question + its generated SQL, reused as-is. A metric is a named, governed calculation the AI\'s SQL generator can reference inside any query — closer to a semantic-layer definition than a one-off query.',
      },
    ],
  },
  {
    id: 'templates',
    icon: FileCode2,
    title: 'Query Templates',
    color: 'text-sky-400',
    summary: 'Parameterized SQL patterns you fill in and run without re-writing SQL.',
    content: [
      'Create a template with a natural-language pattern and a SQL pattern, both using {{placeholder}} variables — e.g. "Show me {{metric}} for {{time_period}}".',
      'Expand a template and switch to the Render tab to fill in each placeholder\'s value and preview the rendered NL and SQL.',
      'Tag templates (e.g. "revenue, monthly, finance") to keep a growing library organized and searchable.',
      'Edit a template\'s name, description, NL pattern, SQL pattern, or tags at any time; delete ones you no longer need.',
    ],
    tips: [
      'Templates are best for questions your team asks repeatedly with only a date range, region, or metric changing.',
      'A template with no {{placeholders}} still works — it\'s just used as a fixed, reusable pattern.',
    ],
    faqs: [
      {
        q: 'Does rendering a template execute the SQL?',
        a: 'No — Render only fills in the placeholders and shows you the resulting NL/SQL text. Run it in Query Studio (or the Visual Builder) to actually execute it.',
      },
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics',
    color: 'text-violet-400',
    summary: 'Monitor query performance, cache usage, and failure patterns.',
    content: [
      'Total Queries, Success Rate, Cache Hit Rate, and Avg Response time — the headline stats for the selected period.',
      'Popular Queries — top most-asked questions, useful for spotting repeated tasks worth turning into a Template or a Schedule.',
      'Table Usage — which database tables the AI references most often.',
      'Success vs Failed — the split between queries that produced valid SQL and ones that didn\'t.',
      'Failure Patterns — error categories and counts to help you fix recurring issues.',
      'Cache Layers — hit/miss breakdown across the caching layers, and Latency Breakdown — where response time is spent.',
      'Intent Distribution — breakdown of query types (SELECT, aggregate, JOIN, etc.).',
      'Prompt Versions — success rates across different AI prompt versions.',
      'Switch between charts using the selector, and refresh or clear the cache from the toolbar.',
    ],
    faqs: [
      {
        q: 'What does "Reset Analytics" do?',
        a: 'It clears all analytics counters back to zero. This is permanent and cannot be undone. Use it when starting a fresh benchmark period.',
      },
    ],
  },
  {
    id: 'training',
    icon: BrainCircuit,
    title: 'Model Training',
    color: 'text-violet-400',
    summary: 'Export your query history as training data or fine-tune a model.',
    content: [
      'Every successful query you run is automatically collected as a training record.',
      'You need at least 10 records before you can export or fine-tune.',
      'Download Training Data (Free) — exports your NL+SQL pairs as JSONL or JSON. Compatible with OpenAI, Together AI, Hugging Face, and local fine-tuning tools.',
      'Cloud Fine-Tuning (Paid) — requires a Together AI API key set as TOGETHER_API_KEY. Submits data directly and manages the training job.',
      'Prepare File first to stage the training data on the server, then Start Fine-Tuning to submit the job.',
      'Deploy — once a cloud job succeeds, hot-swap the model with zero server restart.',
      'The Jobs table shows all fine-tuning jobs with status, token count, and timing.',
    ],
    tips: [
      'Use JSONL format for best compatibility with most fine-tuning pipelines.',
      'Google Colab and Hugging Face AutoTrain are free options for using the downloaded JSONL.',
      'Llama 3.1 8B is the recommended starting point — fast, cheap, and good quality for SQL tasks.',
    ],
    faqs: [
      {
        q: 'Where do I add my Together AI key?',
        a: 'Click your avatar in the bottom-left → Profile & API Keys. Your key is stored encrypted and used automatically for fine-tuning jobs.',
      },
      {
        q: 'Does fine-tuning replace the base model permanently?',
        a: 'Only when you click Deploy on a succeeded job. Until then, the base model is used for all queries.',
      },
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    color: 'text-muted-foreground',
    summary: 'Customize how the AI generates SQL and manages your data.',
    content: [
      'Open Settings from your avatar in the bottom-left of the sidebar. It\'s a single popup with a tab rail on the left — no separate settings pages to hunt through.',
      'General — toggle auto-execute, set the default SQL dialect, and configure output format.',
      'Appearance — pick a theme, font size, and UI density (comfortable / compact).',
      'SQL Style — choose keyword casing (UPPER / lower / Title), indentation size, and whether to include semicolons.',
      'Instructions — write custom instructions included in every AI prompt, e.g. "Always use table aliases" or "Never use SELECT *".',
      'Glossary — define business terms and synonyms (term → definition) so the AI understands your domain-specific language.',
      'RAG — tune retrieval behavior (how much schema context is pulled in per query and related toggles), with inline tooltips explaining each setting.',
      'Notifications — control in-app and email notifications, e.g. alerts from Scheduled Queries.',
      'Usage — see your token consumption and query counts for the current billing period.',
      'Data & Privacy — export your full data archive, clear history, set data retention policy, or delete your account.',
      'Security — manage active login sessions and revoke any sessions you don\'t recognize.',
    ],
    faqs: [
      {
        q: 'What are Custom Instructions?',
        a: 'A free-text field injected into every AI prompt before your question. Use it for persistent rules like preferred JOIN style, naming conventions, or domain-specific context.',
      },
      {
        q: 'What does "Don\'t store" data retention do?',
        a: 'When set to "Don\'t store", new queries are not saved to history after the session ends. Existing history is unaffected.',
      },
      {
        q: 'What\'s the difference between Instructions and Glossary?',
        a: 'Instructions are style/behavior rules for the AI (how to write SQL). Glossary maps business terms to their meaning (what a word means) — both are injected into every prompt, but Glossary is for vocabulary, Instructions is for conventions.',
      },
    ],
  },
  {
    id: 'shortcuts',
    icon: Keyboard,
    title: 'Keyboard Shortcuts',
    color: 'text-muted-foreground',
    summary: 'Move around the app without touching the mouse.',
    content: [
      'Ctrl+K (or Cmd+K) — open the command palette to jump to any page or run a quick action.',
      'Alt+N — start a new chat from anywhere in the app.',
      'Enter or Ctrl+Enter — submit your question in Query Studio.',
      'Shift+Enter — insert a new line in the query box instead of submitting.',
      '↑ / ↓ — move through autocomplete suggestions while typing a question.',
      'Esc — close the open dialog or dismiss suggestions.',
      '? — toggle this shortcuts cheat-sheet from anywhere (except while typing in a field).',
    ],
    tips: [
      'The command palette (Ctrl+K) also doubles as a fast way to jump straight to Schema, Dashboards, Metrics, or any other page.',
    ],
  },
];

/* ── Sub-components ─────────────────────────────────────────────────────── */

function AccordionItem({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        {item.q}
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
      )}
    </div>
  );
}

function SectionCard({ section, isOpen, onToggle }: { section: Section; isOpen: boolean; onToggle: () => void }) {
  const Icon = section.icon as React.ComponentType<{ className?: string }>;
  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-background/60', isOpen && 'bg-primary/10 border-primary/30')}>
          <Icon className={cn('h-5 w-5', isOpen ? 'text-primary' : section.color)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">{section.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{section.summary}</p>
        </div>
        <ChevronRight className={cn('h-5 w-5 shrink-0 text-muted-foreground/60 transition-transform duration-200', isOpen && 'rotate-90')} />
      </button>

      {isOpen && (
        <div className="border-t border-border bg-background/30 px-5 pb-5 pt-4">
          {/* Main content */}
          <ul className="space-y-2.5">
            {section.content.map((line, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-foreground/85 leading-relaxed">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                {line}
              </li>
            ))}
          </ul>

          {/* Tips */}
          {section.tips && section.tips.length > 0 && (
            <div className="mt-5 rounded-xl border border-primary/20 bg-primary/8 p-4">
              <p className="mb-2.5 flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest text-primary">
                <Zap className="h-3.5 w-3.5" /> Tips
              </p>
              <ul className="space-y-2">
                {section.tips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-xs text-primary/90 leading-relaxed">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* FAQs */}
          {section.faqs && section.faqs.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Frequently Asked
              </p>
              <div className="rounded-xl border border-border bg-card/60 px-4">
                {section.faqs.map((faq, i) => (
                  <AccordionItem key={i} item={faq} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function HelpPage() {
  const { wrapperRef, contentRef, scrollTo } = useLenisScroll<HTMLDivElement>();
  const [search, setSearch] = useState('');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['getting-started']));

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = search.trim()
    ? SECTIONS.filter((s) =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.summary.toLowerCase().includes(search.toLowerCase()) ||
        s.content.some((c) => c.toLowerCase().includes(search.toLowerCase())) ||
        s.faqs?.some((f) => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
      )
    : SECTIONS;

  return (
    <div ref={wrapperRef} className="h-full overflow-y-auto overflow-x-hidden custom-scrollbar">
    <div ref={contentRef} className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      {/* Hero */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_36px_color-mix(in_srgb,var(--primary)_25%,transparent)]">
          <HelpCircle className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-gradient-hero">Help &amp; Documentation</h1>
        <p className="mt-2 text-muted-foreground">Everything you need to get the most out of Vectrix.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <label htmlFor="help-search" className="sr-only">Search help topics</label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
        <input
          id="help-search"
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (e.target.value.trim()) {
              setOpenSections(new Set(SECTIONS.map((s) => s.id)));
            }
          }}
          placeholder="Search help topics…"
          className="w-full rounded-xl border border-border bg-card/60 py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 backdrop-blur-sm"
        />
      </div>

      {/* Quick links */}
      {!search && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: MessageSquare, label: 'Query Studio', id: 'query-studio' },
            { icon: Link2, label: 'Schema Setup', id: 'schema' },
            { icon: LayoutDashboard, label: 'Dashboards', id: 'dashboards' },
            { icon: Keyboard, label: 'Shortcuts', id: 'shortcuts' },
          ].map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => {
                setOpenSections((prev) => new Set([...prev, id]));
                setTimeout(() => {
                  scrollTo(`#section-${id}`);
                }, 50);
              }}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card/60 p-4 text-center text-xs font-medium text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/8 hover:text-foreground card-lift"
            >
              <Icon className="h-5 w-5 text-primary" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="py-14 text-center text-muted-foreground">
            No results for "<span className="text-foreground">{search}</span>"
          </div>
        )}
        {filtered.map((section) => (
          <div key={section.id} id={`section-${section.id}`}>
            <SectionCard
              section={section}
              isOpen={openSections.has(section.id)}
              onToggle={() => toggle(section.id)}
            />
          </div>
        ))}
      </div>

      
      {/* Workflow Overview */}
      {!search && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2.5 text-base">
              <Zap className="h-5 w-5 text-primary" />
              Typical Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {(() => {
                const steps = [
                  { icon: Link2, color: 'bg-violet-500/15 text-violet-400', step: 'Connect your database', detail: 'Schema → Database Connections → Add connection' },
                  { icon: RefreshCw, color: 'bg-primary/15 text-primary', step: 'Sync the schema', detail: 'Schema → Sync now / Refresh Schema from Live DB' },
                  { icon: Send, color: 'bg-cyan-500/15 text-cyan-400', step: 'Ask a question', detail: 'Query Studio → type in plain English → Enter' },
                  { icon: Play, color: 'bg-primary/15 text-primary', step: 'Execute & explore', detail: 'Toggle "Execute query" on → view live results + charts' },
                  { icon: Bookmark, color: 'bg-amber-500/15 text-amber-400', step: 'Save & organize', detail: 'Bookmark queries, pin key tables, certify metrics' },
                  { icon: Clock3, color: 'bg-orange-500/15 text-orange-400', step: 'Automate', detail: 'Turn a question into a Schedule or a Dashboard widget' },
                  { icon: FileJson, color: 'bg-violet-500/15 text-violet-400', step: 'Train a custom model', detail: 'Training → Download JSONL → fine-tune anywhere for free' },
                ];
                return steps.map(({ icon: Icon, color, step, detail }, i) => (
                  <li key={step} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      {i < steps.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-3 pt-1">
                      <p className="text-sm font-semibold text-foreground">{step}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{detail}</p>
                    </div>
                  </li>
                ));
              })()}
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      <div className="rounded-xl border border-border bg-card/40 p-5 text-center">
        <p className="text-sm text-muted-foreground">
          Need more help? Check the{' '}
          <span className="font-medium text-foreground">README</span> or open an issue in the project repository.
        </p>
      </div>
    </div>
    </div>
  );
}
