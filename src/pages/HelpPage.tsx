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
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
      'Connect your database via Schema → Database Connection. Paste your connection string (PostgreSQL or MySQL supported).',
      'Click "Refresh Schema from Live DB" to let the AI learn your table structures. This only needs to be done once, or after schema changes.',
      'Navigate to Query Studio (the home page) and type any question about your data in plain English.',
      'The AI generates SQL, optionally executes it, and shows results in a table with charts.',
    ],
    tips: [
      'The more descriptive your question, the better the SQL. Mention column names or table names when you know them.',
      'Toggle "Execute query" on to run SQL automatically instead of just generating it.',
      'Every session is saved — use History to revisit past conversations.',
    ],
    faqs: [
      {
        q: 'Which databases are supported?',
        a: 'PostgreSQL and MySQL are fully supported via connection strings. Dialect is selectable per query, and SQLite support can be added via the schema upload.',
      },
      {
        q: 'Is my database password stored securely?',
        a: 'Connection strings are stored encrypted at rest. Passwords are masked in the UI whenever possible.',
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
      'Use the bookmark icon on any AI response to save a query to Saved Queries.',
    ],
    tips: [
      'Start messages with action words: "Show me…", "Find all…", "Count how many…", "Compare…".',
      'Mention time ranges explicitly: "…in the last 30 days", "…from January to March".',
      'Ask follow-up questions in the same session — the AI remembers context from earlier messages.',
    ],
    faqs: [
      {
        q: 'Why did the AI generate wrong SQL?',
        a: 'Sync your schema first (Schema → Sync Live Schema) so the AI has current table/column names. Then rephrase with more specific column or table references.',
      },
      {
        q: 'How do I start a new conversation?',
        a: 'Click "New chat" at the top of the sidebar, or use the keyboard shortcut Alt+N.',
      },
      {
        q: 'What does "Execute query" actually do?',
        a: 'When enabled, the generated SQL is run against your configured database and results are shown in a table directly in the chat. Your DB credentials are used server-side; no SQL is exposed to third parties.',
      },
    ],
  },
  {
    id: 'schema',
    icon: Upload,
    title: 'Schema Management',
    color: 'text-blue-400',
    summary: 'Connect your database and keep the AI up to date with your schema.',
    content: [
      'Database Connection — paste a connection string in the format postgresql+asyncpg://user:pass@host:port/db and click Save. The connection is validated immediately.',
      'Sync Live Schema — reflects all tables from the active database into the AI\'s vector store. Run this after any table or column additions.',
      'Upload Schema — upload a JSON file describing your schema if you prefer not to use a live connection. Useful for offline or staging setups.',
      'Schema Status — shows how many schema chunks are stored and whether the vector store is ready for queries.',
      'Reset existing schema — when uploading, check this box to wipe previous schema data and start fresh.',
    ],
    tips: [
      'Re-sync your schema after any migration or ALTER TABLE to keep AI suggestions accurate.',
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
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics',
    color: 'text-violet-400',
    summary: 'Monitor query performance, cache usage, and failure patterns.',
    content: [
      'Total Queries — total number of NL-to-SQL requests in the selected period.',
      'Success Rate — percentage of queries that produced valid, executable SQL.',
      'Cache Hit Rate — how often responses were served from cache (faster and cheaper).',
      'Avg Response — mean time from question to SQL in milliseconds.',
      'Popular Queries chart — top 10 most-asked questions, useful for spotting repeated tasks to automate.',
      'Table Usage pie chart — which database tables the AI references most often.',
      'Failure Patterns — lists error categories and counts to help you fix recurring issues.',
      'Intent Distribution — breakdown of query types (SELECT, aggregate, JOIN, etc.).',
      'Prompt Version Performance — tracks success rates across different AI prompt versions.',
      'Use the Period selector (7 / 30 / 90 days) to zoom in or out on trends.',
      'Analytics auto-refresh every 30 seconds while the page is open.',
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
      'General — toggle auto-execute, set default dialect, and configure output format.',
      'SQL Style — choose keyword casing (UPPER / lower / Title), indentation size, and whether to include semicolons.',
      'Instructions — write custom instructions that are included in every AI prompt, e.g. "Always use table aliases" or "Never use SELECT *".',
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
  const Icon = section.icon;
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
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-10">
      {/* Hero */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 shadow-[0_0_36px_rgba(16,185,129,0.25)]">
          <HelpCircle className="h-7 w-7 text-primary" />
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-gradient-hero">Help &amp; Documentation</h1>
        <p className="mt-2 text-muted-foreground">Everything you need to get the most out of NL-to-SQL Copilot.</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
        <input
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
            { icon: Keyboard, label: 'Shortcuts', id: 'shortcuts' },
            { icon: BrainCircuit, label: 'Training', id: 'training' },
          ].map(({ icon: Icon, label, id }) => (
            <button
              key={id}
              onClick={() => {
                setOpenSections((prev) => new Set([...prev, id]));
                setTimeout(() => {
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
              {[
                { icon: Link2, color: 'bg-violet-500/15 text-violet-400', step: 'Connect your database', detail: 'Schema → Database Connection → paste connection string → Save' },
                { icon: RefreshCw, color: 'bg-primary/15 text-primary', step: 'Sync the schema', detail: 'Schema → Sync Live Schema → Refresh Schema from Live DB' },
                { icon: Send, color: 'bg-cyan-500/15 text-cyan-400', step: 'Ask a question', detail: 'Query Studio → type in plain English → Enter' },
                { icon: Play, color: 'bg-primary/15 text-primary', step: 'Execute & explore', detail: 'Toggle "Execute query" on → view live results + charts' },
                { icon: Bookmark, color: 'bg-amber-500/15 text-amber-400', step: 'Save useful queries', detail: 'Click the bookmark icon → access from Saved Queries' },
                { icon: FileJson, color: 'bg-violet-500/15 text-violet-400', step: 'Train a custom model', detail: 'Training → Download JSONL → fine-tune anywhere for free' },
              ].map(({ icon: Icon, color, step, detail }, i) => (
                <li key={step} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    {i < 5 && <div className="mt-1 w-px flex-1 bg-border" />}
                  </div>
                  <div className="pb-3 pt-1">
                    <p className="text-sm font-semibold text-foreground">{step}</p>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{detail}</p>
                  </div>
                </li>
              ))}
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
  );
}
