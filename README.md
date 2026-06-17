# NL2SQL — Frontend

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
- **Session management** — Named chat sessions with full message history, create / rename / delete
- **SQL versioning** — Each query can be edited and re-run; all versions are kept and diffable
- **Analytics dashboard** — Token usage, success rates, popular tables, intent distribution, failure patterns
- **Training data pipeline** — Collect feedback, export fine-tuning JSONL files, start and monitor OpenAI fine-tune jobs from the UI
- **BYOK (Bring Your Own Key)** — Users can supply their own LLM API keys; server keys are the fallback
- **Authentication** — Email / password + Google OAuth, OTP email verification, password reset
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
| Container | Docker + Nginx | alpine |

---

## Architecture Overview

```
Browser
  └── React SPA (Vite)
        ├── AuthContext  ──── JWT + Google OAuth
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

- **Node.js 20+** and **npm 10+**
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
│   └── client.ts          # Axios instance, all typed API functions, SSE stream helper
├── components/
│   ├── ui/                # Primitive UI components (buttons, inputs, modals)
│   ├── ChatWindow.tsx      # Chat message list + streaming UI
│   ├── QueryInput.tsx      # Prompt text-area + submit controls
│   ├── ResultTable.tsx     # Paginated, sortable result table
│   ├── DataChart.tsx       # Auto-chart (bar / line / pie / scatter)
│   ├── SchemaGraph.tsx     # React Flow schema visualiser
│   ├── SqlPreview.tsx      # Syntax-highlighted SQL with copy button
│   ├── VersionedSQLDisplay.tsx  # SQL version history switcher
│   ├── FeedbackPanel.tsx   # Thumbs-up / down + correction form
│   ├── Layout.tsx          # Sidebar + top-nav shell
│   ├── DatabaseSelector.tsx
│   ├── ModelSwitcher.tsx
│   └── ...
├── context/
│   ├── AuthContext.tsx     # Global auth state, axios interceptor, OAuth
│   └── ThemeContext.tsx    # Light / dark theme
├── features/
│   ├── settings/          # Settings page sub-panels (LLM, database, BYOK, account)
│   └── usage/             # Usage stats widgets
├── hooks/
│   ├── useChat.ts          # Session + message state, stream orchestration
│   ├── useSchema.ts        # Schema fetch, refresh, visualise
│   └── useSettings.ts      # User preferences, BYOK, instructions
├── pages/
│   ├── AuthPage.tsx        # Login / register / OTP / password reset
│   ├── QueryPage.tsx       # Main chat interface
│   ├── SchemaPage.tsx      # Schema upload + graph view
│   ├── HistoryPage.tsx     # Query history log
│   ├── AnalyticsPage.tsx   # Usage analytics dashboard
│   ├── SavedQueriesPage.tsx
│   ├── TrainingPage.tsx    # Fine-tuning data management
│   └── SettingsPage.tsx
├── store/                  # Any Zustand / global state (if used)
├── types/
│   ├── query.types.ts
│   └── schema.types.ts
└── utils/
```

---

## Key Pages & Capabilities

### Query Page (/)

The main interface. Type a natural-language question, watch the SQL stream in real-time, then see the result table and an auto-suggested chart. Each response includes:

- Generated SQL with one-click copy
- Validation status and errors
- Execution results (table + chart)
- Follow-up question suggestions
- Thumbs-up / thumbs-down feedback
- SQL version history

### Schema Page (/schema)

Upload a SQL DDL file or refresh the schema from the live database. The interactive React Flow graph shows every table, its columns, and foreign-key relationships.

### History Page (/history)

Full, paginated query history with search. Export to CSV or JSON. Clear with a confirmation prompt.

### Analytics Page (/analytics)

Token consumption over time, query success / failure rates, most-used tables, intent distribution (SELECT vs aggregation vs JOIN, etc.), and failure pattern analysis.

### Training Page (/training)

View collected feedback records, export a fine-tuning JSONL file, start an OpenAI fine-tune job, and monitor job progress — all without leaving the UI.

### Settings Page (/settings)

Switch LLM provider and model, change the database connection string, manage per-user API keys (BYOK), set a custom instruction prompt, control data retention, and manage active auth sessions.

---

## Docker

A multi-stage Dockerfile builds the React app and serves it with Nginx:

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
