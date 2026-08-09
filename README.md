# Vectrix — Frontend

> Where natural language meets your schema.

A production-grade chat interface that turns plain-English questions into SQL queries, live result tables, and automatic charts — no SQL knowledge required. Powered by a RAG-based backend, it understands your database schema and returns validated, executable SQL in seconds.

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
- [Running the App](#running-the-app)
- [Project Structure](#project-structure)
- [Key Pages & Capabilities](#key-pages--capabilities)
- [Docker](#docker)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- **Natural Language to SQL** — Ask questions in plain English; the backend translates them to dialect-aware SQL (PostgreSQL, MySQL, SQLite, etc.)
- **Streaming responses** — Server-Sent Events (SSE) stream partial results as the model generates them
- **Live execution** — Run the generated SQL directly against your connected database
- **Auto-charts** — The backend suggests a chart type; Recharts renders bar, line, pie, and scatter visualisations automatically
- **Schema visualiser** — Interactive React Flow graph of your database tables and foreign-key relationships
- **Query history** — Full paginated log of past queries; export to CSV or JSON
- **Saved queries** — Star and bookmark frequently used prompts; re-run them in one click
- **Query templates** — Create, manage, and render parameterized NL + SQL templates with `{{placeholder}}` variables
- **Glossary settings** — Manage your business dictionary; terms are automatically injected into query prompts by the backend
- **Session management** — Named chat sessions with full message history, create / rename / delete
- **Multi-turn conversation** — Follow-up questions resolve against prior turns in the same chat session
- **SQL versioning** — Each query can be edited and re-run; all versions are kept and diffable
- **Multiple database connections** — Add, switch, and manage several target databases per user (BYOD)
- **Dashboards** — Save query results as widgets on a dashboard; chart type is auto-recommended and editable
- **Scheduled queries** — Set up recurring NL questions with cron-style scheduling and email alerts on completion/failure
- **Metrics catalog** — Browse and manage certified business metrics reused across queries
- **Export & share** — Export results as CSV/JSON/SQL/PDF, or generate a revocable public share link (with copy/email/Slack)
- **Analytics dashboard** — Token usage, success rates, popular tables, intent distribution, failure patterns
- **Training data pipeline** — Collect feedback, export fine-tuning JSONL files, start and monitor OpenAI fine-tune jobs from the UI
- **BYOK (Bring Your Own Key)** — Users can supply their own LLM API keys; server keys are the fallback
- **Authentication** — Email / password + Google OAuth, OTP email verification, password reset, active-session management
- **Onboarding checklist** — Collapsible progress tracker guiding new users through key setup steps
- **Command palette** — `Ctrl/Cmd+K` fuzzy navigator to jump to any page or action
- **Help & documentation page** — In-app FAQ, keyboard shortcuts, and feature guides
- **Notification preferences** — Email digest, in-app alerts, and marketing opt-in toggles
- **Appearance settings** — Theme, display density, and UI customisation options
- **Light / dark theme** — System-default aware, persisted to `localStorage`

---

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Framework | React | 19 |
| Language | TypeScript | 6 |
| Build tool | Vite | 8 |
| Styling | Tailwind CSS | 4 |
| Routing | React Router | 7 |
| Data fetching | TanStack Query + Axios | 5 / 1 |
| Auth | JWT + `@react-oauth/google` | — |
| Charts | Recharts | 2 |
| Schema graph | @xyflow/react | 12 |
| Icons | lucide-react | — |
| Container | Docker + Nginx | node:22-alpine / nginx:1.27-alpine |

---

## Architecture Overview

```
Browser
  └── React SPA (Vite)
        ├── AuthContext  ──── JWT + Google OAuth + tokenStore
        ├── TanStack Query ── cached server state
        ├── Axios client ──── /api/v1/*  (proxied to backend)
        └── SSE stream ────── /api/v1/query/stream (fetch API)

Nginx (production)
  ├── /auth/*  ──► FastAPI backend
  ├── /api/*   ──► FastAPI backend  (proxy_buffering off for SSE)
  └── /*       ──► index.html       (SPA catch-all)
```

In development, Vite's built-in proxy forwards `/api` and `/health` to `http://localhost:8000`.

---

## Getting Started

### Prerequisites

- **Node.js 22+** and **npm 10+**
- The [NL2SQL backend](../backend) running on `http://localhost:8000`

### Installation

```bash
git clone https://github.com/nikhil-sharma-devx/Nl2SQL-Frontend.git
cd Nl2SQL-Frontend
npm install
```

### Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | Production only | Fully-qualified backend URL, e.g. `https://api.yourdomain.com`. Leave empty in local dev — the Vite proxy handles it. |
| `VITE_GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Client ID. Enables the **Sign in with Google** button. Omit to disable Google login. |

> **Never commit `.env.local`.** It is in `.gitignore`.

---

## Running the App

```bash
# Development server with HMR
npm run dev          # → http://localhost:3000

# Production build
npm run build        # outputs to dist/

# Preview the production build locally
npm run preview      # → http://localhost:4173
```

---

## Project Structure

```
src/
├── api/
│   └── client.ts               # Axios instance, all typed API functions, SSE stream helper
├── auth/
│   └── tokenStore.ts           # JWT access/refresh token storage and rotation helpers
├── components/
│   ├── ui/                     # Primitive UI components (buttons, inputs, modals)
│   ├── ChatWindow.tsx          # Chat message list + streaming UI
│   ├── QueryInput.tsx          # Prompt text-area + submit controls
│   ├── ResultTable.tsx         # Paginated, sortable result table
│   ├── DataChart.tsx           # Auto-chart (bar / line / pie / scatter)
│   ├── SchemaGraph.tsx         # React Flow schema visualiser
│   ├── SqlPreview.tsx          # Syntax-highlighted SQL with copy button
│   ├── VersionedSQLDisplay.tsx # SQL version history switcher
│   ├── FeedbackPanel.tsx       # Thumbs-up / down + correction form
│   ├── OnboardingChecklist.tsx # Collapsible onboarding progress widget
│   ├── ExportShareControls.tsx # Export (CSV/JSON/SQL/PDF) + share link controls
│   ├── AddToDashboardModal.tsx # Save a result as a dashboard widget
│   ├── DatabaseSelector.tsx    # Switch the active database connection
│   ├── CommandPalette.tsx      # Ctrl/Cmd+K fuzzy navigator
│   ├── SettingsModal.tsx       # Tabbed settings surface (opened from the sidebar)
│   └── Layout.tsx              # Sidebar + top-nav shell
├── context/
│   ├── AuthContext.tsx         # Global auth state, axios interceptor, OAuth
│   ├── ConnectionContext.tsx   # Active database connection + switch/invalidate
│   ├── CommandPaletteContext.tsx  # Command palette open/close state
│   └── ThemeContext.tsx        # Light / dark theme
├── features/
│   └── settings/
│       ├── General.tsx         # LLM provider/model, custom instructions
│       ├── Appearance.tsx      # Theme, density, and display preferences
│       ├── GlossarySettings.tsx  # Business dictionary CRUD UI
│       ├── RagSettings.tsx     # RAG pipeline feature flags (runtime-adjustable)
│       ├── SqlStyle.tsx        # SQL formatting preferences
│       ├── Instructions.tsx    # Custom instruction prompt editor
│       ├── Notifications.tsx   # Email digest and in-app alert toggles
│       ├── DataPrivacy.tsx     # Data retention and privacy controls
│       └── Security.tsx        # Password change and active sessions
├── hooks/
│   ├── useChat.ts              # Session + message state, stream orchestration
│   ├── useSchema.ts            # Schema fetch, refresh, visualise
│   └── useSettings.ts         # User preferences, BYOK, instructions
├── pages/
│   ├── AuthPage.tsx            # Login / register / OTP / password reset
│   ├── HomePage.tsx            # Workspace landing page — stats, recent activity, quick actions
│   ├── QueryPage.tsx           # Main chat interface
│   ├── SchemaPage.tsx          # Schema catalog: connections, sync, upload, graph view
│   ├── HistoryPage.tsx         # Query history log
│   ├── AnalyticsPage.tsx       # Usage analytics dashboard
│   ├── SavedQueriesPage.tsx    # Bookmarked queries
│   ├── DashboardsPage.tsx      # Saved dashboards with auto-charted widgets
│   ├── SchedulesPage.tsx       # Scheduled queries & alerts
│   ├── MetricsPage.tsx         # Certified metrics catalog
│   ├── TemplatesPage.tsx       # Query template CRUD + render playground
│   ├── TrainingPage.tsx        # Fine-tuning data management
│   ├── SharedQueryView.tsx     # Public, token-authed view of a shared query (/shared/:token)
│   └── HelpPage.tsx            # In-app FAQ, keyboard shortcuts, feature guides
├── syntax-highlighter.d.ts     # Type declarations for react-syntax-highlighter
└── main.tsx                    # App entry point, router, query client
```

---

## Key Pages & Capabilities

### Home Page (/)

Workspace landing page built entirely from data the app already exposes — quick stats (queries today, connections, active schedules, dashboards), recent chat activity, quick-action buttons, and a "continue working" section. No dedicated backend endpoint; it composes existing queries.

### Query Page (/query)

The main interface. Type a natural-language question, watch the SQL stream in real-time, then see the result table and an auto-suggested chart. Each response includes:

- Generated SQL with one-click copy
- Validation status and errors
- Execution results (table + chart)
- Follow-up question suggestions (multi-turn — resolves against prior turns in the session)
- Thumbs-up / thumbs-down feedback, with an inline correction flow
- SQL version history
- Export (CSV/JSON/SQL/PDF) and share-link controls
- "Add to dashboard" to save the result as a widget

### Schema Page (/schema)

Manage database connections (add/switch/test/delete), sync the catalog from the live DB or upload a schema JSON, and browse the interactive React Flow graph of every table, its columns, and foreign-key relationships.

### Dashboards Page (/dashboards)

Saved dashboards made of query-result widgets, each with an auto-recommended chart type. Duplicate, rename, or delete dashboards; add new widgets from any query result.

### Schedules Page (/schedules)

Create recurring NL queries on a cron-style schedule, with email alerts on completion or failure. Pause, resume, or run a schedule immediately.

### Metrics Page (/metrics)

Browse and manage the certified metrics catalog for the active connection — reusable, governed business metrics injected into the SQL-generation prompt.

### Templates Page (/templates)

Create and manage parameterized query templates. Each template has a natural-language description and a SQL pattern with `{{placeholder}}` variables. The render playground lets you substitute values and preview the result before running.

### History Page (/history)

Full, paginated query history with search. Export to CSV or JSON. Clear with a confirmation prompt.

### Analytics Page (/analytics)

Token consumption over time, query success / failure rates, most-used tables, intent distribution (SELECT vs aggregation vs JOIN, etc.), and failure pattern analysis.

### Training Page (/training)

View collected feedback records, export a fine-tuning JSONL file, start an OpenAI fine-tune job, and monitor job progress — all without leaving the UI.

### Settings (modal, opened from the sidebar)

A tabbed settings surface rather than a dedicated page (so it's reachable from anywhere without losing your place):

| Tab | Description |
|---|---|
| **General** | LLM provider / model, custom instruction prompt |
| **Appearance** | Theme (light / dark / system), display density, UI preferences |
| **Glossary** | Manage business dictionary terms injected into query prompts |
| **RAG** | Runtime-adjustable RAG pipeline feature flags |
| **SQL Style** | SQL formatting preferences |
| **Notifications** | Email digest, in-app alerts, marketing opt-in toggles |
| **Security** | Password change, active session management |
| **Data & Privacy** | Data retention settings, account deletion |
| **API Keys (BYOK)** | Per-provider API key management |
| **Usage** | Token/query usage summary |

### Help Page (/help)

In-app documentation including an FAQ, keyboard shortcut reference, and feature-by-feature guides — no external docs link needed.

### Command Palette (Ctrl/Cmd+K)

Fuzzy-searchable overlay to jump straight to any page or run a high-frequency action, without leaving the keyboard.

### Onboarding Checklist

A collapsible widget (visible until all steps are complete) that tracks seven setup milestones: connecting a database, running a first query, saving a query, pinning a table, adding custom instructions, adding a glossary term, and exploring templates.

---

## Docker

A multi-stage Dockerfile builds the React app with Node 22 and serves it with Nginx:

```bash
# Build the image
docker build -t nl2sql-frontend .

# Run (expects the backend reachable at http://backend:8000 in the same network)
docker run -p 80:80 nl2sql-frontend
```

The Nginx config (`nginx.conf`) proxies `/api/*` and `/auth/*` to the backend and serves the SPA with a catch-all `try_files` rule. SSE streaming is supported via `proxy_buffering off`.

For a full stack with docker-compose, point the backend service name to `backend` (the default in `nginx.conf`) or override `NGINX_BACKEND_HOST`.

---

## Deployment

### Vercel (recommended for the frontend)

`vercel.json` is already configured with a catch-all rewrite rule for SPA routing:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Set `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID` as Environment Variables in the Vercel project dashboard.

### Any static host (S3, Cloudflare Pages, etc.)

```bash
npm run build
# Upload dist/ and configure your host to serve index.html for all routes
```

---

## Contributing

This project is maintained by [@nikhil-sharma-devx](https://github.com/nikhil-sharma-devx).

---

## License

MIT — see [LICENSE](LICENSE) for details.
