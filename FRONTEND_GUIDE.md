# The NL-to-SQL Frontend Guide

> A complete, beginner-to-advanced walkthrough of `frontend/` — the React application that lets a person type a question in plain English and see it turned into SQL, results, and charts.

**Who this is for:** Read top to bottom if you've never touched this codebase (or never touched a React SPA at all). Jump to a numbered section if you already know the basics and need to look something up. Every claim in this guide is grounded in the actual source under `frontend/src/` — where something is planned but not yet built, or where the author had to make a reasonable inference instead of reading it directly, it's explicitly labeled **Inferred**.

**What this app is, in one paragraph:** it's a single-page React application that acts as a chat interface to a natural-language-to-SQL backend. A user asks a question ("top 5 customers by revenue last quarter"), the frontend streams that question to a FastAPI backend, and renders back the generated SQL, a result table, and an auto-suggested chart — plus a full set of surrounding tools: schema exploration, saved queries, dashboards, scheduled alerts, a certified-metrics catalog, query templates, and usage analytics.

## Table of Contents

- [Getting Started: Running This Frontend Locally](#getting-started-running-this-frontend-locally)

1. [Frontend Overview](#1-frontend-overview)
2. [Folder Structure](#2-folder-structure)
3. [React Fundamentals Used in This Project](#3-react-fundamentals-used-in-this-project)
4. [Application Flow](#4-application-flow)
5. [Routing](#5-routing)
6. [Component Architecture](#6-component-architecture)
7. [Styling System](#7-styling-system)
8. [API Communication](#8-api-communication)
9. [Authentication Flow](#9-authentication-flow)
10. [State Management](#10-state-management)
11. [SQL Query Interface](#11-sql-query-interface)
12. [Dashboard Pages](#12-dashboard-pages)
13. [Multi-Database Connections](#13-multi-database-connections)
14. [Error Handling](#14-error-handling)
15. [Performance](#15-performance)
16. [Responsive Design](#16-responsive-design)
17. [Accessibility](#17-accessibility)
18. [Build & Deployment](#18-build--deployment)
19. [Testing](#19-testing)
20. [How to Add a New Page](#20-how-to-add-a-new-page)
21. [How to Add a New Component](#21-how-to-add-a-new-component)
22. [How Frontend Connects to Backend](#22-how-frontend-connects-to-backend)
23. [Frontend Interview Questions](#23-frontend-interview-questions)
24. [Troubleshooting & FAQ](#24-troubleshooting--faq)
25. [Glossary](#25-glossary)
26. [Architecture Summary](#26-architecture-summary)
27. [Learning Roadmap](#27-learning-roadmap)

---

## Getting Started: Running This Frontend Locally

A concrete, in-order walkthrough for someone who has just cloned the repo and has never run this project before. Every step below is grounded in the actual `package.json` scripts and config files, not generic React advice.

1. **Prerequisites.** Node — this repo doesn't pin an `engines` field in `frontend/package.json`, but `Dockerfile`'s builder stage uses `node:22-alpine`, so Node 22 is the safest match for local dev. You also need `npm` (the lockfile is `package-lock.json`-style, i.e. npm, not yarn/pnpm).
2. **Install dependencies:**

   ```bash
   cd frontend
   npm install
   ```

3. **Create your local env file.** `frontend/.gitignore:2-6` explicitly ignores `.env`, `.env.local`, `.env.production`, and `.env.*.local`, but keeps `.env.example` tracked — so copy it:

   ```bash
   cp .env.example .env
   ```

   `.env.example` documents exactly two variables (see the reference table below). For pure local dev you can usually leave both blank — see the table for what each one actually controls.
4. **Have the backend running.** This frontend never talks to a database directly (§1) — it only talks to the FastAPI backend over HTTP/SSE. Start the backend (see `backend/BACKEND_GUIDE.md`) so it's listening on `http://127.0.0.1:8000`, which is the exact host:port `frontend/vite.config.ts:16-18` proxies `/api`, `/health`, and `/ready` to.
5. **Start the dev server:**

   ```bash
   npm run dev
   ```

   This runs `vite` (`package.json:7`) and serves the app at **`http://localhost:3000`** (`vite.config.ts:14`, `server.port: 3000`). Open that URL, register or log in (§9), and ask a question on `/query` — watch the Network tab to see the SSE stream described in §4/§11.
6. **Regenerate the typed API contract when the backend changes.** `npm run gen:api` (`package.json:12`) runs `openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.d.ts` — it requires the backend to be running locally (step 4) because it fetches the live OpenAPI schema over HTTP and writes the result into `frontend/src/api/schema.d.ts`. Run this any time a backend endpoint's request/response shape changes; skipping it is the single most common source of "the types don't match reality" bugs (see §24).
7. **Run the tests:**

   ```bash
   npm run test        # vitest run — one pass, CI mode
   npm run test:watch  # vitest — interactive
   ```

   See §19 for what's actually tested (and what isn't).
8. **Build and sanity-check a production bundle:**

   ```bash
   npm run build    # tsc && vite build -> dist/
   npm run preview  # serves dist/ locally
   ```

   See §18 for the full build/deploy story, including a gotcha with `npm run preview` and the API proxy (§24).

### Environment variable reference

| Variable | Required? | Read at | Effect if unset |
|---|---|---|---|
| `VITE_API_BASE_URL` | Optional in dev, **required in production** | `api/client.ts:221` (axios `baseURL`), `context/AuthContext.tsx:86` (raw `axios` calls for login/refresh/me) | Falls back to `''`, so requests go to relative `/api/v1/...`. In dev this works *only* because `vite.config.ts`'s proxy forwards `/api` to `127.0.0.1:8000`; in a production deploy with no equivalent reverse proxy, every API call 404s. |
| `VITE_GOOGLE_CLIENT_ID` | Optional | `App.tsx:29` (`GOOGLE_CLIENT_ID`, passed to `GoogleOAuthProvider`) | Per `.env.example`'s own comment, "Leave empty to disable Google login button" — the button still renders (`AuthPage.tsx:399`, `GoogleLogin`) but clicking it fails, since `@react-oauth/google` needs a real client ID to talk to Google. |

Only variables prefixed `VITE_` are ever exposed to client code via `import.meta.env` — this is a Vite convention (see §18's "Common mistakes").

**Common mistakes**
- Running `npm run gen:api` without the backend running locally — the command fetches a *live* OpenAPI schema over HTTP; it isn't a static file, so it fails outright with no backend at `127.0.0.1:8000`.
- Expecting `npm run dev` to work with zero backend at all — the UI will render, but every data-fetching page will show a permanent loading/error state, and login will never succeed.
- Assuming `.env` is committed or shared — it's gitignored (`.gitignore:2`); every developer creates their own from `.env.example`.

**What a beginner should remember**
There are exactly two moving parts to get running: `npm install && npm run dev` for the frontend, and a running backend for it to talk to. Everything else (env vars, `gen:api`, tests, build) is secondary to that core loop.

---

## 1. Frontend Overview

A "frontend" is the part of an application that runs inside the user's browser: it draws pixels, reacts to clicks and keystrokes, and talks to a server ("backend") over HTTP to fetch or save data. Everything a user directly sees and touches in this project — the chat window, the sidebar, the schema graph, the dashboards — is frontend code living in `frontend/src`.

This project's frontend is a **React 19 + TypeScript** single-page application (SPA), built and served in development by **Vite 8**. A few concrete reasons these tools were chosen, grounded in what the repo actually contains:

- **React** because the UI is a tree of small, reusable, stateful pieces (a chat bubble, a sidebar nav item, a settings modal) that need to re-render automatically when data changes — e.g. `frontend/src/hooks/useChat.ts` holds chat state in React state and every component that reads it re-renders when a new message arrives.
- **Vite over Create React App (CRA):** CRA is unmaintained and slow (it bundles your entire app before you can see a single change). Vite serves source files over native ES modules during development and only compiles what the browser asks for, so `npm run dev` starts almost instantly. The project's `frontend/vite.config.ts:6-7` wires two plugins — `@vitejs/plugin-react` (JSX/Fast Refresh) and `@tailwindcss/vite` (the Tailwind v4 build integration) — plus a dev proxy so `/api`, `/health`, and `/ready` are forwarded to the FastAPI backend at `http://127.0.0.1:8000` (`frontend/vite.config.ts:13-19`), which is why the frontend can call relative paths like `/api/v1/...` without CORS pain in dev.
- **TypeScript** because the backend contract (request/response shapes for every endpoint) is auto-generated into `frontend/src/api/schema.d.ts` via `openapi-typescript` (`frontend/package.json:12`), and the whole app leans on that generated typing to catch mismatches at compile time rather than at runtime in production.
- **Tailwind CSS v4** for styling — utility classes directly in JSX instead of hand-written CSS files, configured entirely through `@tailwindcss/vite` and CSS-native `@theme`/`@custom-variant` blocks in `frontend/src/index.css` (no `tailwind.config.js` exists in this repo — see §7).
- **TanStack Query, axios, react-router-dom v7, recharts, @xyflow/react, react-syntax-highlighter, jwt-decode, @react-oauth/google** — all declared in `frontend/package.json:21-37` — respectively handle server-state caching, HTTP calls, client-side routing, charts, the interactive schema graph, SQL syntax highlighting, JWT parsing, and Google OAuth.

**This app's job, concretely:** it is a chat-like interface where a user types a question in plain English (e.g. "top 5 customers by revenue last quarter"), the frontend streams that question to the backend over Server-Sent Events, and renders back the generated SQL, a result table, and an auto-suggested chart — all while also offering schema exploration (`SchemaPage`), saved queries, dashboards, scheduled alerts, a metrics catalog, and analytics. `frontend/src/main.tsx` and `frontend/src/App.tsx` are where this whole app is bootstrapped (see §4).

**Common mistakes:** Beginners often assume "frontend" means "just the visual design." In this codebase the frontend also owns real logic: token refresh (`frontend/src/api/client.ts:284-292`), SSE stream parsing (`frontend/src/api/client.ts:417-486`), and multi-turn chat state (`frontend/src/hooks/useChat.ts`). Treating it as "just styling" will make you miss where bugs actually live.

**What a beginner should remember:** The frontend never talks to a database directly — it only ever calls the FastAPI backend's HTTP/SSE endpoints through `apiClient` (`frontend/src/api/client.ts`). If a feature needs new data, it needs a backend endpoint first, then a typed client function, then UI that calls it.

---

## 2. Folder Structure

All application source lives under `frontend/src`. Below is a folder-by-folder walkthrough, each with a concrete example file from this repo.

```
frontend/src/
├── api/          → HTTP client + generated types (the contract with the backend)
├── auth/         → low-level token persistence (no React, just localStorage)
├── components/   → reusable UI building blocks (both design-system primitives and feature widgets)
│   └── ui/       → shadcn-style low-level primitives (Button, Card, Dialog, …)
├── context/       → React Context providers for cross-cutting global state
├── features/      → larger, self-contained feature panels grouped by domain
├── hooks/         → reusable stateful logic extracted out of components
├── lib/           → small framework-adjacent utilities (query client, cva shim, cn helper)
├── pages/         → one file per route, composed from components/hooks
├── types/         → hand-written TypeScript interfaces for domain concepts
└── utils/         → pure, non-React helper functions (e.g. chart heuristics)
```

- **`api/`** — `frontend/src/api/client.ts` is the single axios instance every request goes through, and `frontend/src/api/schema.d.ts` is the auto-generated (`npm run gen:api`) TypeScript mirror of the backend's OpenAPI schema. New backend-calling code belongs here as an exported function (e.g. `getSchedules`, `createDashboard`) — never call `axios` directly from a component.
- **`auth/`** — `frontend/src/auth/tokenStore.ts` is deliberately framework-free: it only reads/writes `localStorage` keys (`nl2sql_token`, `nl2sql_refresh_token`). It exists separately from `context/AuthContext.tsx` so that non-React code (the axios interceptor, the raw `fetch`-based SSE client) can read/write tokens without importing React.
- **`components/`** — general-purpose, often feature-specific widgets that are used by more than one page or are complex enough to deserve their own file, e.g. `frontend/src/components/ChatWindow.tsx` (renders the whole chat thread) or `frontend/src/components/Layout.tsx` (the app shell/sidebar). Anything here can import hooks and API functions.
- **`components/ui/`** — the shadcn-style design-system layer: dumb, presentation-only primitives with no business logic and no API calls, e.g. `frontend/src/components/ui/button.tsx`. These are configured via `frontend/components.json` (style: "new-york", aliases into `@/components/ui`, etc.) and use the local `cva` shim (`frontend/src/lib/cva.ts`) for variant classes.
- **`context/`** — global state that many unrelated components need, implemented as React Context + Provider pairs, e.g. `frontend/src/context/AuthContext.tsx` (who is logged in) or `frontend/src/context/ThemeContext.tsx` (which color theme is active). See §10 for why each context exists.
- **`features/`** — larger domain-scoped panels that bundle several sub-views, e.g. `frontend/src/features/settings/*.tsx` (Appearance, SqlStyle, Notifications, RagSettings, etc. — each a tab inside `SettingsModal`) and `frontend/src/features/connections/ConnectionsManager.tsx`. Use this folder when a feature has multiple internal sub-components that don't need to be reused elsewhere.
- **`hooks/`** — custom hooks that extract stateful logic out of components so components stay close to pure rendering, e.g. `frontend/src/hooks/useChat.ts` (all chat/session/streaming state) or `frontend/src/hooks/useSettings.ts` (settings fetch + patch via TanStack Query).
- **`lib/`** — small, App-wide singletons/utilities that aren't React hooks or pure business logic, e.g. `frontend/src/lib/queryClient.ts` (the one `QueryClient` instance) and `frontend/src/lib/cva.ts` (a dependency-free reimplementation of `class-variance-authority`, because — per its own comment — "the registry build ... is not installable in this environment").
- **`pages/`** — exactly one file per route, wired up in `App.tsx`; a page's job is to compose hooks + components, not to contain deep business logic itself, e.g. `frontend/src/pages/QueryPage.tsx`, which is explicitly commented as "a thin composition layer over the `useChat` hook."
- **`types/`** — hand-written interfaces for domain concepts that aren't (yet) 1:1 with a generated schema type, e.g. `frontend/src/types/query.types.ts` (`ChatMessage`, `StreamEvent`) and `frontend/src/types/schema.types.ts` (`ColumnInfo`, `TableInfo`).
- **`utils/`** — pure functions with no React and no side effects, unit-testable in isolation, e.g. `frontend/src/utils/chart.ts` (there's a matching `chart.test.ts`) which guesses a chart config from raw query result rows.

**Common mistakes:** Putting API-calling logic inside a `components/ui/*` primitive, or putting a reusable UI primitive inside `features/`. The separation exists specifically so the `ui/` layer stays swappable/theme-only and the `features/` layer stays business-logic-heavy.

**What a beginner should remember:** If you're looking for "how does X talk to the backend," start in `api/client.ts`. If you're looking for "where does X's state live," start in `hooks/` or `context/`. If you're looking for "how does X look," start in `components/ui/`.

---

## 3. React Fundamentals Used in This Project

This section teaches core React concepts by pointing at real, working code in this repository. If you've never used React before, read the mental model below first — everything else in this section (and this guide) builds on it.

### The core mental model: components are functions that re-render

A React component is just a JavaScript function that returns a description of UI (JSX). React's whole job is: call that function, get back a description of what the screen should look like, and update the real DOM to match. The word **"re-render"**, used constantly in this guide, means exactly this: React calls your component function *again* (because some piece of state it depends on changed), gets a new UI description, and efficiently patches only the parts of the real DOM that actually differ — it does not throw away and rebuild the whole page. Think of it like a slide-deck presenter re-reading their notes after every audience question and only redrawing the parts of the slide that changed, instead of erasing and redrawing the whole whiteboard. This "compute the new description, diff it against the old one, patch only what changed" step is called **reconciliation**, and it's why React code is written as "describe what the UI should look like *given the current state*" rather than "manually mutate the DOM when something happens" (which is how you'd do it with plain JavaScript/jQuery). The two things that can *cause* a re-render in this codebase are: a component's own `useState` changing, or a Context/TanStack Query value it reads changing. Nothing else — not a "for" loop, not `console.log`, not mutating a plain JS variable — makes React re-render, which is precisely why the hooks below (`useState`, `useEffect`, etc.) exist: they're the vocabulary for plugging into this render cycle correctly.

### `useState` — component-local state

**The problem it solves:** a plain JavaScript variable (`let count = 0`) can change, but changing it does **not** make React call your component function again — the screen simply won't update, because React has no way of knowing the variable changed. `useState` gives you a variable *and* a setter function, and calling that setter is how you tell React "this value changed, please re-render me with the new value." That's the entire reason `useState` exists instead of just using ordinary variables inside a component.

Used everywhere a value only matters to one component. Example, `frontend/src/context/ThemeContext.tsx:47-50`:

```tsx
const [theme, setThemeState] = useState<ThemeId>(() => {
  const stored = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) as ThemeId | null;
  return stored && THEMES.some((t) => t.id === stored) ? stored : 'dark';
});
```
Note the **lazy initializer** (a function passed to `useState`, not a plain value) — this runs only once on mount, which matters here because `localStorage.getItem` is a side effect you don't want to re-run on every render. (If you passed a plain value like `useState(localStorage.getItem(STORAGE_KEY))` instead, that expression would actually be *evaluated on every single render* — wastefully re-reading `localStorage` each time — even though `useState` only *uses* the result on the very first render. The function form defers the work so it only ever runs once.)

### `useEffect` — synchronizing with the outside world

**The problem it solves:** rendering (calling your component function and returning JSX) is supposed to be a "pure" description of the UI — no side effects, because React may call it multiple times, at unpredictable moments, for its own bookkeeping reasons. But real apps need to do things that *aren't* just "describe the UI": attach a keyboard listener, make a network call, start a timer, sync with `localStorage`. `useEffect` is the escape hatch for exactly that category of work — it runs *after* React has painted the DOM to match the latest render, as a deliberate side step outside the render itself.

**Why the dependency array matters (and what happens if you get it wrong):** the array at the end (`[isAuthenticated]` below) tells React "only re-run this effect if one of these values changed since last time." Omit the array entirely and the effect runs after *every single render* — no exceptions. This becomes a real, concrete bug the moment the effect itself calls a state setter: render → effect runs → effect calls `setSomething()` → that state change triggers a re-render → effect runs again (no array = no skipping) → calls `setSomething()` again → forever. That's the "infinite loop" beginners hit, and it's not a rare edge case — it's the default outcome of writing `useEffect(() => { setX(...) })` with nothing after the function. Passing `[]` means "run once, after the first render, never again" (used for one-time setup like an initial data fetch). Passing `[isAuthenticated]` means "run again only when `isAuthenticated` specifically changes" — which is what lets an effect stay in sync with one piece of state without re-running on every unrelated re-render.

Example, `frontend/src/context/CommandPaletteContext.tsx:25-35`, which attaches a global `Ctrl+K` keyboard listener and cleans it up:

```tsx
useEffect(() => {
  if (!isAuthenticated) return;
  const onKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setOpen((v) => !v);
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [isAuthenticated]);
```
The returned function is the **cleanup** — React calls it before the effect re-runs or the component unmounts, which is why the listener doesn't pile up duplicates. Concretely, without this cleanup: every time `isAuthenticated` flips (e.g. login → logout → login again within the same page load), a *second* `keydown` listener would be attached on top of the first, so pressing `Ctrl+K` would eventually toggle the palette open-then-immediately-closed (two listeners both firing `setOpen((v) => !v)` on the same keystroke) — a real, observable bug, not a theoretical one.

### `useMemo` — avoiding recomputation

**The general idea:** every re-render re-runs your entire component function from top to bottom, including any calculation you wrote inline (`array.filter(...)`, `array.sort(...)`, etc.) — even if none of the inputs to that calculation actually changed. `useMemo(fn, deps)` caches the *result* of `fn` and only re-computes it when one of the values in `deps` has changed since the last render; otherwise it hands back the previously cached value instantly. It's a targeted trade: spend a little memory holding onto the old result, in exchange for skipping a computation that would otherwise re-run needlessly on every render.

`frontend/src/components/Layout.tsx:292-298` recomputes the filtered session list only when the search text or session list actually changes, not on every keystroke-unrelated re-render (e.g. the sidebar re-rendering because the health-check poll ticked):

```tsx
const filteredSessions = useMemo(
  () =>
    chatSearch.trim()
      ? allSessions.filter((s) => (s.title ?? '').toLowerCase().includes(chatSearch.toLowerCase()))
      : allSessions,
  [allSessions, chatSearch],
);
```
Without `useMemo` here, this exact `.filter()` call would still *work* correctly — `useMemo` doesn't change behavior, only performance — but it would re-scan the entire session list on every re-render of `Layout` (which happens often, since `Layout` also polls `['health']` and `['sessions','recent']` every 30s, §10), not just when the user actually typed something.

### `useCallback` — stable function identities

**The problem it solves:** every time a component re-renders, any function defined inside it (`const handleClick = () => {...}`) is a **brand new function object**, even if its code is identical to the previous render's version. That matters because React (and hooks like `useEffect`/`useMemo`) compare dependencies by reference (`===`), not by "does this look the same" — so a freshly-created function passed as a dependency looks *different* every time, defeating memoization or re-triggering effects that shouldn't re-run. `useCallback(fn, deps)` returns the *same* function reference across renders as long as `deps` haven't changed, solving exactly that comparison problem.

`frontend/src/context/AuthContext.tsx:111-119` wraps `setToken` in `useCallback` so it has a stable reference across renders — important because it's a dependency of other `useCallback`s (`applyAuthResponse`, `login`, etc.) and is stored in the context value that many components consume. If `setToken` were a plain function (no `useCallback`), every render of `AuthProvider` would hand every context consumer a *new* `setToken` reference, which would make any `useEffect` elsewhere in the app that lists it as a dependency re-run on every single `AuthProvider` render — even when nothing about auth actually changed:

```tsx
const setToken = useCallback((t: string | null) => {
  setTokenState(t);
  storeSetToken(t);
  if (t) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${t}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}, []);
```

### Refs — mutable values that don't trigger re-renders, and DOM access

**The problem they solve:** sometimes you need a mutable "box" that survives across re-renders, but you *specifically don't want* changing it to trigger a re-render (unlike `useState`, whose entire purpose is to trigger one). `useRef` gives you exactly that: a plain `{ current: ... }` object that React keeps stable across renders but never watches for changes. Two uses appear side by side in `frontend/src/hooks/useChat.ts:88-100`: an `AbortController` ref (so aborting a stream doesn't need a re-render — the abort controller itself isn't something the UI displays, it's plumbing) and a "stale closure" guard ref that mirrors state into a ref so async callbacks always see the latest value:

```tsx
const abortControllerRef = useRef<AbortController | null>(null);
...
const currentSessionRef = useRef(currentSession);
useEffect(() => {
  currentSessionRef.current = currentSession;
}, [currentSession]);
```
The "stale closure" problem this second ref solves is genuinely subtle and worth understanding: a `useState` value captured inside an `async` callback (e.g. an SSE `onChunk` handler that keeps firing over several seconds) is frozen at whatever it was *when that callback was created* — even if the component re-renders with a newer value in the meantime, the already-running callback still sees the old one, because JavaScript closures capture variables by their value at creation time, not "live." Reading `currentSessionRef.current` instead of `currentSession` directly inside a long-running callback sidesteps this, because `.current` is read fresh at the moment it's accessed, not captured at closure-creation time. `frontend/src/hooks/useMagneticHover.ts:12` shows the other classic ref use — direct DOM access — grabbing the actual button element to apply a CSS transform on mouse movement outside of React's render cycle (there's no React state involved at all here; it's imperative DOM manipulation for a micro-interaction that doesn't need to be part of the render output).

### Conditional rendering

`frontend/src/App.tsx:47-50` shows the idiomatic ternary/early-return pattern for gating UI on async state:

```tsx
if (isBootstrapping) return <RouteFallback />;
if (isAuthenticated) return <>{children}</>;
const redirect = encodeURIComponent(location.pathname + location.search);
return <Navigate to={`/auth?redirect=${redirect}`} replace />;
```
This is just a JavaScript function returning early — there's no special React syntax for "conditional rendering." Since a component is a function, any plain `if`/ternary/`&&` that decides *what JSX to return* is a valid way to render conditionally; React doesn't need (or have) a dedicated `<If>` construct.

### Rendering lists (with keys)

When you render an array of elements (`array.map(item => <Row .../>)`), React needs a stable way to answer "which of these items on the *new* render corresponds to which item on the *old* render" — that's what `key` is for. Without it, React's default fallback is positional matching (item at index 2 is "the same" as whatever was at index 2 before), which silently breaks the moment the list reorders, has an item removed from the middle, or gets items prepended — React can end up reusing the wrong DOM node for the wrong data (visible as: form inputs showing the wrong value, animations playing on the wrong row, or state "sticking" to the wrong list item after a reorder). A stable, unique `key` (an ID, not an array index) tells React the true identity of each item across renders, so it can correctly keep, move, or discard DOM nodes instead of guessing by position.

`frontend/src/components/Layout.tsx:454-490` maps over the nav item array, using the (unique) `label` as the React `key` so React can correctly diff the list across re-renders:

```tsx
{primaryNavItems.map(({ to, end, icon: Icon, label }) => (
  <NavLink key={label} to={to} end={end} ...>
```
`label` works here specifically because `primaryNavItems` is a small, static, never-reordered array defined once in the module (`Layout.tsx:55-71`) — for a *dynamic* list (session history, dashboard widgets), this codebase correctly switches to a real server-assigned ID (`session.id`, `widget_id`) instead, because a label or array index would not survive a reorder or deletion.

### Forms and controlled components

Every input in `AuthPage` is a **controlled component** — its value comes from React state and every keystroke updates that state via `onChange`, so React state is always the single source of truth. Contrast this with an **uncontrolled** input (no `value` prop, no `onChange`) — the browser's own DOM manages the input's value internally, and React only reads it on demand (e.g. via a ref) rather than tracking every keystroke. This codebase consistently chooses "controlled" so that a component's `useState` is *always* an accurate, real-time mirror of what's on screen — which matters here specifically because the same typed value often needs to be validated, cleared, or read by other logic (autocomplete suggestions in `QueryInput`, §11) *before* form submission, not just at the moment "Submit" is clicked. `frontend/src/pages/AuthPage.tsx:272-282`:

```tsx
<Input
  id="auth-email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  required
/>
```

### Event handling

`frontend/src/pages/AuthPage.tsx:79-81` shows a form submit handler that calls `e.preventDefault()` (so the browser doesn't do a full-page reload/navigation) before running the app's own async submit logic — the standard pattern for every form in this app. This matters because a native HTML `<form>`'s default behavior on submit is to navigate the browser to the form's `action` URL (or reload the current page if none is set) — which would blow away the entire React app and its in-memory state. `preventDefault()` cancels that native browser behavior so the submit event becomes purely a signal for *your* JavaScript handler to act on, with the SPA never actually navigating away.

**Common mistakes:** Forgetting the dependency array on `useEffect`/`useCallback`/`useMemo` (causing infinite loops or stale data — see the concrete walkthrough above), or using an array index as a list `key` when the list can reorder (session lists here correctly key by `session.id`/`label`, not index).

**What a beginner should remember:** State (`useState`) is for values that change and should trigger a re-render; refs (`useRef`) are for values that change but should *not* trigger a re-render, or for reaching into the DOM. `useEffect` is the escape hatch for anything outside React's own render/state model. If you remember nothing else from this section: **a component only re-renders because its own state changed, or because a Context/query value it reads changed** — everything else here is vocabulary for working correctly within that one rule.

---

## 4. Application Flow

The path from opening the browser tab to seeing data on screen. Before the diagram, it's worth being explicit about *why* this flow is shaped the way it is, since the sequence of steps below is really answering three separate design questions: "how do we avoid flashing a login screen at a user who's still logged in," "how do we show progress during a multi-second SQL-generation pipeline instead of a frozen spinner," and "how do we make the chat feel instant despite a real network round trip." Keep those three questions in mind while reading the steps — they're revisited in depth in §9 and §11.

```mermaid
sequenceDiagram
    participant Browser
    participant main.tsx
    participant ThemeProvider
    participant QueryClientProvider
    participant App
    participant AuthProvider
    participant Router as BrowserRouter/Routes
    participant Layout
    participant Page as e.g. QueryPage
    participant useChat
    participant apiClient
    participant Backend as FastAPI backend

    Browser->>main.tsx: load index.html, execute main.tsx
    main.tsx->>ThemeProvider: mount (applies data-theme to <html>)
    main.tsx->>QueryClientProvider: mount (shared TanStack Query cache)
    QueryClientProvider->>App: render
    App->>AuthProvider: mount (restore token from localStorage, validate/refresh)
    AuthProvider->>Router: render once isBootstrapping settles
    Router->>Layout: match "/" (ProtectedRoute passes if authenticated)
    Layout->>Page: render matched child route via <Outlet/>
    Page->>useChat: call hook, get {question, sendMessage, messages, ...}
    Browser->>Page: user types question, clicks Send
    Page->>useChat: sendMessage(dialect, execute)
    useChat->>apiClient: streamQuery() -> fetch('/api/v1/query/stream')
    apiClient->>Backend: POST with JWT Authorization header
    Backend-->>apiClient: Server-Sent Events (stage updates, then complete)
    apiClient-->>useChat: onChunk() callbacks update thinkingSteps/messages
    useChat-->>Page: new state -> re-render
    Page-->>Browser: SQL + result table + chart appear
```

Step by step, grounded in code:

1. **Bootstrap** — `frontend/src/main.tsx:43-53` calls `createRoot(...).render(...)`, wrapping the app in `StrictMode`, a hand-rolled class-based `ErrorBoundary` (`main.tsx:14-41`), `ThemeProvider`, `QueryClientProvider`, and finally `<App />`.
2. **App shell** — `frontend/src/App.tsx:97-113` wraps everything in `GoogleOAuthProvider` (needs the OAuth client ID from `import.meta.env.VITE_GOOGLE_CLIENT_ID`), then `AuthProvider`, then `ConnectionProvider`, then `BrowserRouter`, then `CommandPaletteProvider`, and renders `AppRoutes`, the global `CommandPalette`, and `Toaster`. Provider order matters: `ConnectionProvider` needs `useAuth()` from `AuthProvider` above it; `CommandPaletteProvider` needs the router context from `BrowserRouter`.
3. **Route gating** — `AppRoutes` (`App.tsx:53-95`) blocks rendering behind `isBootstrapping` (session restore in flight) and wraps the protected route tree in `<ProtectedRoute>`, which redirects to `/auth` if not authenticated (§5, §9).
4. **Layout + page** — once a protected route matches, `Layout` (`frontend/src/components/Layout.tsx`) renders the sidebar/header/chrome and an `<Outlet />` for the actual page component (lazy-loaded, see §5).
5. **Hook-driven data fetch** — a page like `QueryPage` calls `useChat()` (`frontend/src/hooks/useChat.ts:70`), which owns all the mutation/session state and exposes `sendMessage`.
6. **Network call** — `sendMessage` triggers a TanStack Query `useMutation` whose `mutationFn` calls `streamQuery` (`frontend/src/api/client.ts:417-486`), which does a raw `fetch` (not axios, because axios doesn't support reading a streaming response body the same way) to `/api/v1/query/stream`, manually parsing Server-Sent Event (`data: ...`) lines out of the response stream.
7. **Streamed UI updates** — each parsed SSE chunk is passed to an `onChunk` callback that pushes a `ThinkingStep` (`useChat.ts:102-112`) so the UI can show "Retrieving relevant schema" → "Generating SQL" → etc. live, before the final `data` payload arrives.
8. **Render** — state updates in `useChat` cause `QueryPage` → `ChatWindow` to re-render with the new message, SQL preview, result table, and (lazily-loaded) chart.

### Why streaming instead of one big request-response cycle

A normal `POST` request is a single round trip: the browser sends a request and waits — showing, at best, one generic spinner — until the server sends back one complete response, however long that takes. Turning a question into SQL here involves several distinct, sequential steps on the backend (retrieving relevant schema context, generating SQL, validating it, optionally executing it) that can *individually* take a noticeable fraction of a second to a few seconds. If the frontend only found out about the *final* result, a real multi-second pipeline would look identical, from the user's point of view, to a frozen page — there'd be no way to tell "it's still working" from "it's stuck." Server-Sent Events (SSE) solve this by letting the server push multiple small messages over one still-open HTTP connection as its own pipeline stages complete, rather than the client having to ask "are you done yet?" repeatedly (that alternative — **polling** — would mean the client re-requesting status every N milliseconds, adding latency, load, and complexity for a strictly worse experience here). SSE is a good fit specifically because the communication is one-directional and predictable: the server pushes progress, the client never needs to talk back mid-stream (contrast with a chat app where *either side* might send a message at any time — that asymmetry is what would justify the extra complexity of a full two-way WebSocket connection instead).

### Why `thinkingSteps` exist as their own UI concept, not just a boolean "loading" flag

A single `isLoading: true/false` flag can only ever render one of two states: spinner, or not-spinner. `thinkingSteps` (`useChat.ts:102-112`) is a growing array — each SSE chunk with a `stage` field appends one more entry — specifically so the UI can render a *checklist* that fills in over time ("Retrieving schema" ✓ → "Generating SQL" ✓ → "Validating SQL" ⏳), turning an opaque multi-second wait into a visibly-progressing sequence of concrete steps. This is a deliberate perceived-performance technique: the *actual* wall-clock time to get an answer is identical whether you show one spinner or a five-step checklist, but showing the checklist gives the user real information ("it's past schema retrieval, now generating SQL") instead of nothing, which measurably reduces how long a wait *feels* — the same principle behind progress bars on file uploads or "step 2 of 4" wizards elsewhere on the web.

### Why the pending-question bubble is optimistic

The moment a user hits Send, `useChat.ts` immediately pushes their question into the visible message list (`setPendingQuestion`, §11) *before* the network request has even started, let alone completed. This is called an **optimistic update**: rendering the result of an action as if it already succeeded, ahead of server confirmation. The alternative — waiting for the backend to acknowledge the question before showing it in the chat — would mean every message the user types sits invisible for however long the round trip takes, which reads as unresponsive even though the app is working correctly. Optimistic UI is safe to use here because the "action" (a user's own question appearing in their own chat) can't meaningfully fail in a way that needs to be undone — worst case, the AI's *reply* fails or errors, but the user's own question staying on screen is still accurate.

**Common mistakes:** Assuming a normal REST request/response is what powers the chat — the primary query path is SSE-streamed, not a single `POST`/`response` round trip (though `postQuery`, a plain non-streaming POST, also exists in `client.ts:412-415` and is used elsewhere, e.g. saved-query "run").

**What a beginner should remember:** Nothing renders "for real" until `AuthProvider` finishes its bootstrap effect (`isBootstrapping` becomes `false`) — that's an intentional gate to avoid flashing the login page for a user whose session is merely refreshing. And the three techniques in this section — SSE streaming, a stepwise `thinkingSteps` checklist, and optimistic UI — all exist for the same underlying reason: a multi-second backend pipeline needs to *feel* fast and transparent even though it can't actually *be* instantaneous.

---

## 5. Routing

In a traditional multi-page website, navigating to a new URL means the browser throws away the current page entirely and asks the server for a brand new HTML document — a full reload, with a visible flash and the JS engine's whole in-memory state wiped. A **client-side router** like `react-router-dom` intercepts navigation (clicking a `<Link>`, calling `navigate(...)`) and instead just swaps which React component is rendered for the current URL, without ever asking the server for a new page — the URL bar changes, the back/forward buttons work, but the actual browser page never reloads. This is what makes the "S" in SPA (Single-Page Application, §22) literally true: there is only ever one real page load.

Routing uses **react-router-dom v7** (`BrowserRouter`/`Routes`/`Route`), configured entirely in `frontend/src/App.tsx`. Every page is **lazy-loaded** (`App.tsx:14-27`, `const HomePage = lazy(() => import('./pages/HomePage'))`, etc.). Normally, a bundler like Vite would compile *every* page's code into one giant JavaScript file the browser has to download before anything can run — the more pages and dependencies you add, the larger that one file gets, even for a user who only ever visits `/query` and never touches `/training`. `lazy()` + `import()` tells the bundler "don't put this page's code in the main bundle at all — instead, split it into its own separate file, and only fetch that file over the network the first time this specific route is actually visited." Concretely here, that's specifically so heavy dependencies — React Flow (schema graph), recharts, the syntax highlighter — are excluded from the initial JS bundle and only downloaded when a user actually visits a page that needs them, per the comment at `App.tsx:11-13`. See §15 for the fuller performance story.

| Path | Component | Protected? | Purpose |
|---|---|---|---|
| `/auth` | `AuthPage` | Public (redirects to `/` if already authenticated) | Login, register, email OTP verification, forgot/reset password, Google sign-in |
| `/shared/:token` | `SharedQueryView` | Public (token-authed, no login) | View a snapshot of a shared query result via a link |
| `/` (index) | `HomePage` | Protected | Workspace landing page: usage stats, recent activity, quick actions |
| `/query` | `QueryPage` | Protected | Main chat interface — ask questions, see SQL + results |
| `/schema` | `SchemaPage` | Protected | Connections, schema ingestion/sync, table catalog |
| `/history` | `HistoryPage` | Protected | Past sessions/conversations |
| `/analytics` | `AnalyticsPage` | Protected | Usage, accuracy, latency, cache stats charts |
| `/saved` | `SavedQueriesPage` | Protected | Bookmarked SQL queries |
| `/dashboards` | `DashboardsPage` | Protected | Auto-charted dashboard widgets |
| `/schedules` | `SchedulesPage` | Protected | Recurring scheduled queries + alert notifications |
| `/metrics` | `MetricsPage` | Protected | Governed/certified metrics catalog |
| `/templates` | `TemplatesPage` | Protected | Parameterized query templates |
| `/training` | `TrainingPage` | Protected | Fine-tuning data export / job management |
| `/settings` | *(redirect)* | Protected | Deep-link only: `Navigate to="/" state={{ openSettings: true }}` — settings is a modal, not a page (`App.tsx:87`) |
| `/help` | `HelpPage` | Protected | Documentation, shortcuts, FAQ |
| `*` (catch-all) | *(redirect to `/`)* | — | Any unknown path bounces home |

All protected routes are nested under one parent `<Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>` (`App.tsx:67-89`) — so `Layout`'s sidebar/header only mounts once, and each child route swaps only the `<Outlet />` content.

**How protection works** (`App.tsx:42-51`):

```tsx
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();
  if (isBootstrapping) return <RouteFallback />;
  if (isAuthenticated) return <>{children}</>;
  const redirect = encodeURIComponent(location.pathname + location.search);
  return <Navigate to={`/auth?redirect=${redirect}`} replace />;
}
```
It reads `isAuthenticated`/`isBootstrapping` from `AuthContext` (§9), and — crucially — preserves the originally-requested path as a `?redirect=` query param so `AuthPage` can send the user back to where they meant to go after logging in (`AuthPage.tsx:48-51`: it only ever accepts an in-app-relative redirect, never an absolute URL, to avoid open-redirect vulnerabilities).

**Common mistakes:** Adding a new page but forgetting to add it both to the lazy-import list *and* the `<Routes>` tree — both are required, and the app won't error loudly if you only do one incompletely (you'd get a broken import or an unreachable route). Also: putting a new protected page's `<Route>` outside the `/` parent route means it silently skips the auth check.

**What a beginner should remember:** `/settings` is not a real page — it is a compatibility redirect that opens a modal. If you're looking for the settings UI, look at `SettingsModal.tsx` and `features/settings/*`, not `pages/`.

---

## 6. Component Architecture

Components in this codebase are layered into three tiers, from least to most business-aware. Think of it like a Lego set: `ui/` primitives are the individual bricks (generic, reusable, no opinion about what you're building), tier-2 components are pre-assembled sub-structures built from those bricks (a cockpit, a wing — still reusable, but now specific to "vehicle"), and pages are the finished model built by arranging those sub-structures (one particular car, built from the same brick set another model could reuse). The value of keeping these tiers separate is the same as with real Lego: you can redesign what "cockpit" looks like without touching the bricks it's made of, and without the finished model needing to change at all.

```mermaid
flowchart TD
    A["components/ui/* — dumb primitives\n(Button, Card, Dialog, Badge, Input, Tabs...)"] --> B["components/*, features/* — feature components\n(ChatWindow, SqlPreview, Layout, ConnectionsManager...)"]
    B --> C["pages/* — route-level composition\n(QueryPage, HomePage, SchemaPage...)"]
    C --> D["App.tsx — routing + global providers"]
```

**Tier 1 — `components/ui/` primitives.** These know nothing about the domain (queries, schemas, auth). They take generic props (`variant`, `size`, `className`) and render styled HTML. Example: `frontend/src/components/ui/button.tsx` defines `buttonVariants` via the local `cva()` helper (§7) with `variant` options (`default`, `secondary`, `outline`, `ghost`, `destructive`, `link`) and `size` options (`default`, `sm`, `lg`, `icon`), then a thin `Button` wrapper (`ui/button.tsx:36-40`) that merges variant classes with any custom `className` via `cn()`. Because these primitives are reused everywhere, changing `buttonVariants` once restyles every button in the app consistently — this is the entire point of having a design-system layer.

**Tier 2 — feature components.** These compose `ui/` primitives and add real behavior/data. Example: `frontend/src/components/ChatWindow.tsx` imports `Badge`, `Button` from `ui/`, plus `SqlPreview`, `ResultTable`, `FeedbackPanel`, `AddToDashboardModal`, and a lazily-loaded `DataChart` — it renders the full message thread with all its interactive affordances (bookmark, regenerate, edit, add-to-dashboard). Another example: `frontend/src/components/Layout.tsx` composes `NavLink`s, modals (`ProfileModal`, `UsageModal`, `SettingsModal`), and two TanStack Query subscriptions (sessions list, health check) into the persistent app shell.

**Tier 3 — pages.** A page's job is orchestration, not implementation. `frontend/src/pages/QueryPage.tsx:1-5` states this explicitly in its own header comment: *"Thin composition layer over the `useChat` hook + extracted components."* It calls `useChat()` and `useSettings()`, holds a couple of page-local UI toggles (`showGraph`, `showQueryBuilder`), and renders `ChatWindow` + `QueryInput` + optionally `QueryBuilder`/`SchemaGraph` — all the actual logic lives in the hook and the tier-2 components.

**Why this layering matters:** it lets you change *how something looks* (tier 1) without touching *what it does* (tier 2/3), and change *page composition* without duplicating widget logic. It also enables route-level code-splitting cleanly — a page only imports the tier-2 components it needs, so lazy-loading a page (§5) transitively lazy-loads its heavy dependencies too (e.g. `QueryPage.tsx:16` lazily imports `SchemaGraph` only when the graph panel is toggled open, and `ChatWindow.tsx:36` lazily imports `DataChart` only if a message actually has a chart).

**Common mistakes:** Writing business logic (API calls, complex state machines) directly inside a `ui/` primitive — this breaks reusability and makes the primitive impossible to reason about in isolation. Also: skipping tier 2 and putting all of a page's logic directly in the page file, which this codebase's own comments (`QueryPage.tsx`) explicitly warn against by describing itself as "thin."

**What a beginner should remember:** If you're extending an existing feature, look for it in tier 2 (`components/` or `features/`) — that's almost always where the real logic lives, not in `pages/`.

---

## 7. Styling System

This project uses **Tailwind CSS v4** through the **`@tailwindcss/vite`** plugin (`frontend/vite.config.ts:4,7`) — there is **no `tailwind.config.js`** anywhere in the repo (`frontend/components.json:7` even has an empty `"config": ""` for its shadcn `tailwind.config` field, confirming Tailwind v4's CSS-native configuration approach is in use). All configuration instead lives directly in `frontend/src/index.css` using Tailwind v4's new `@import "tailwindcss"`, `@theme inline`, and `@custom-variant` directives (`index.css:1,8,60`).

### What a CSS custom property actually is, and why it's the key to theming

If you've never seen `--background: #0a0c11;` before: a **CSS custom property** (informally "CSS variable") is a named value you define once, anywhere in a stylesheet, and then reference elsewhere with `var(--background)`. The crucial property that makes it useful for theming is that the browser resolves `var(--background)` **at the point in the DOM tree where it's used**, by looking at the *nearest* ancestor element that redefines that variable — not at the point where the variable was first declared. That means the exact same `background-color: var(--background)` rule can paint a different color depending on which ancestor element (and which variable block that ancestor matches) is in effect, with zero changes to the rule itself. This is fundamentally different from a plain CSS value like `background-color: #0a0c11` (baked in permanently) or from a build-time constant in a CSS preprocessor (resolved once, at compile time, and frozen into the output forever) — a custom property is resolved live, in the browser, every time the page's styles are recalculated, which is exactly what lets a theme switch happen instantly without reloading any CSS file.

**Design tokens as CSS variables.** Every color, radius, and font in the app is a CSS variable defined once and mapped into Tailwind's theme:

```css
/* index.css:10-41 (dark theme, the default) */
:root, .dark, [data-theme="dark"] {
  --background: #0a0c11;
  --foreground: #e4e9f1;
  --primary: #10b981;
  ...
  --radius: 0.85rem;
}
@theme inline {
  --color-background: var(--background);
  --color-primary: var(--primary);
  ...
  --font-display: "Space Grotesk", "Inter", sans-serif;
  --radius-lg: var(--radius);
}
```
The `@theme inline` block is Tailwind v4's bridge: it tells Tailwind "generate utility classes (`bg-background`, `text-primary`, etc.) whose values point at these CSS variables," rather than Tailwind baking in fixed colors at build time the way a `tailwind.config.js` color palette would in v3. Because of that, a component can just write `bg-primary text-primary-foreground` (Tailwind utility classes) and the actual color is resolved from whichever theme's variable block is currently active on `<html>` at the moment the browser paints — the utility class itself never needs to know which theme is active; it only ever says "use whatever `--primary` currently resolves to here."

**Dark mode / multi-theme approach.** This app supports **four full themes**, not just light/dark: `dark`, `light`, `noir`, and `claude` (`frontend/src/context/ThemeContext.tsx:11,21-26`). The mechanism is: `index.css` defines several *complete* variable blocks (one per theme, each redefining `--background`, `--primary`, etc. with different values), each scoped to a different CSS selector (`:root`/`.dark`/`[data-theme="dark"]` for the dark theme, other attribute-selector blocks for `light`/`noir`/`claude`, `index.css:385-512`). Only *one* of those selectors ever matches `<html>` at a time — whichever `data-theme` attribute is currently set — so only one variable block is ever "active," and every `var(--background)` reference throughout the entire app's CSS resolves against that one active block simultaneously. This is the mechanism, in full: `ThemeProvider` sets a `data-theme="<id>"` attribute on `<html>` and toggles the `.dark` class + native `color-scheme` (`ThemeContext.tsx:30-36`). Switching themes is therefore a single DOM attribute write — not a stylesheet swap, not a re-render of every styled component — which is why it's instantaneous: the browser simply re-resolves which selector block matches `<html>` and repaints. The `@custom-variant dark (&:is(.dark *))` at `index.css:8` is what lets Tailwind's `dark:` utility prefix work against this class-based (not `prefers-color-scheme`-based) dark mode — i.e. `dark:text-white` means "apply this when an ancestor has the `.dark` class," not "apply this when the OS is set to dark mode." Theme choice persists to `localStorage` (`ThemeContext.tsx:54-58`).

**Density and font-size tokens.** Two more `data-*` attributes are set on `<html>` by `Layout` (`Layout.tsx:136-140`) from user settings: `data-font-size` (`small`/`medium`/`large`) directly sets the root `font-size` in px (`index.css:543-545`), and `data-density` (`compact`/`comfortable`/`spacious`) overrides Tailwind v4's `--spacing` variable (`index.css:553-555`) — since Tailwind v4 spacing utilities (`p-*`, `gap-*`, etc.) are all `calc(N * var(--spacing))`, overriding one variable rescales the *entire* app's spacing at once.

**Component variant styling.** Because the real `class-variance-authority` package couldn't be installed in this environment, `frontend/src/lib/cva.ts` reimplements its `cva()`/`VariantProps` API from scratch on top of `clsx`. Every `components/ui/*` primitive (`button.tsx`, `badge.tsx`, etc.) uses this local shim exactly like the real library, so the authoring pattern (`variants`, `defaultVariants`, `compoundVariants`) will be immediately familiar to anyone who's used shadcn/ui elsewhere.

**Utility classes beyond Tailwind's defaults.** `index.css` also hand-writes a set of bespoke utility classes for the app's "precision data instrument" aesthetic — `.glass-card`/`.glass-panel` (backdrop blur + inset highlight), `.holo-border` (an animated gradient ring used only to mark AI-generated content, per its own comment at `index.css:256-259`), `.card-lift` (hover elevation), and reduced-motion overrides (`index.css:370-378`) that respect `prefers-reduced-motion`.

**Inferred/Planned:** `frontend/FRONTEND_3D_UI_UX_SPEC.md` is a forward-looking design document (its own header states: *"Status: Design specification only — no implementation, no code changes"*) proposing a more cinematic "3D/glassmorphism" evolution of the current look (deeper depth layering, more pronounced holographic accents, a companion static HTML preview file). None of it is implemented yet — the current app already has some of the *seeds* of this direction (glass panels, glow utilities, holo-border) but the full spec is aspirational, not current behavior.

**Common mistakes:** Adding a `tailwind.config.js` expecting it to be picked up — this project deliberately uses Tailwind v4's CSS-native config, so theme edits belong in `index.css`, not a JS config file. Also, hardcoding a hex color in a component instead of using an existing CSS variable/Tailwind token breaks multi-theme support silently (the color simply won't change when the user switches themes).

**What a beginner should remember:** Every visual value (color, radius, spacing scale) is a variable in `index.css`, resolved per active theme via `data-theme` on `<html>`. Never hardcode colors in components — use the `--color-*` Tailwind tokens.

---

## 8. API Communication

All backend communication funnels through **one axios instance**, `apiClient`, created in `frontend/src/api/client.ts:220-225`:

```ts
const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
});
```

**What an interceptor actually is:** axios lets you register a function that runs on *every* request before it leaves the browser, and another that runs on *every* response (success or failure) before your own `.then()`/`await` code ever sees it — like a checkpoint every call passes through automatically, rather than something you'd have to remember to call yourself at every call site. That's the entire reason this app can guarantee "every request gets an auth header" and "every failed request gets normalized/toasted" without a single page or component needing to opt in — the guarantee lives in one place, applied uniformly, rather than being copy-pasted (and inevitably forgotten somewhere) at every call site.

**Request interceptor** (`client.ts:228-235`) attaches the JWT to every outgoing request automatically:
```ts
apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});
```

**Response interceptor** (`client.ts:340-377`) is where the interesting behavior lives:
- On a `401`, it transparently tries a **single-flight token refresh** (`refreshAccessToken`, `client.ts:284-292` — concurrent 401s share one in-flight refresh call via a module-level `refreshPromise`, so simultaneous failed requests don't each mint their own new token pair) and retries the original request exactly once (`original._retry` guards against infinite retry loops). If refresh fails, `forceReauth()` (`client.ts:243-253`) clears local storage and hard-navigates to `/auth`.
- On any other error, it converts the raw axios error into a typed `ApiError` (`client.ts:19-39`, carrying `code`, `status`, `requestId`, `retryAfter` — mirroring the backend's error envelope) and shows a toast via `notifyApiError` (`client.ts:327-338`), skipping toasts for 401s since those are handled by the redirect instead.

**Walking through the concrete race condition "single-flight" prevents:** imagine a page fires three requests back-to-back (e.g. `HomePage` loading its usage stats, recent activity, and health check nearly simultaneously, §12) and the access token happens to have expired a moment earlier. All three requests come back `401` within milliseconds of each other. Without any coordination, each of those three failed requests would independently call `POST /auth/refresh` with the *same* (now-used-once) refresh token — three simultaneous refresh calls. Depending on the backend's refresh-token rotation policy (this app's backend does rotate the refresh token on every use, per §9), the *second and third* refresh calls could easily race against the first: by the time they reach the server, the refresh token they're presenting may already have been invalidated by the first call's rotation, causing them to fail with their own error even though the user's session is, in reality, perfectly fine. **Single-flight** fixes this by having the *first* 401 kick off the refresh and store the resulting (still-pending) promise in a shared, module-level variable; the second and third 401s check that variable, see a refresh is already in progress, and simply `await` the *same* promise instead of starting their own — so only one refresh call is ever made no matter how many requests failed at once, and all three original requests retry with whichever single new token pair comes back.

**Types come from the generated schema.** `frontend/src/api/schema.d.ts` is produced by `npm run gen:api` (`package.json:12`: `openapi-typescript http://127.0.0.1:8000/openapi.json -o src/api/schema.d.ts`) — it must be regenerated (with the backend running) whenever backend request/response shapes change. `client.ts:13` derives a local `Schemas` alias (`type Schemas = components['schemas']`) and every typed export re-exports from it, e.g. `client.ts:81,50`:
```ts
export type ExplainResponse = Schemas['ExplainResponse'];
export type QueryResponse = Schemas['QueryResponse'] & {
  needs_clarification?: boolean; // not yet in the generated schema
  clarification_prompt?: string | null;
};
```
This intersection-type pattern (real generated type `&` a few hand-added optional fields) shows up repeatedly — it lets the frontend adopt a new backend field *before* someone remembers to re-run `gen:api`, without breaking type safety.

**A real request, end to end** — `getSchemaStatus` (`client.ts:539-542`):
```ts
export const getSchemaStatus = async (): Promise<SchemaStatusResponse> => {
  const response = await apiClient.get<SchemaStatusResponse>('/schema/status');
  return response.data;
};
```
consumed by `frontend/src/hooks/useSchema.ts:19-24` via TanStack Query:
```ts
const { data, isLoading, error, refetch } = useQuery<SchemaStatusResponse>({
  queryKey: ['schemaStatus'],
  queryFn: getSchemaStatus,
  staleTime: 30_000,
});
```
Any component calling `useSchema()` gets `isLoading`/`error` for free — this is the app's standard loading/error pattern: **TanStack Query owns the request lifecycle**, components just render `isLoading ? <Skeleton/> : error ? <ErrorState/> : <Data/>`.

**Streaming is the one exception.** `streamQuery` (`client.ts:417-486`) uses the raw browser `fetch` API instead of axios, because it needs to read the response body as an incrementally-decoded stream of Server-Sent Event frames (`data: {...}\n\n`) rather than waiting for a single complete JSON body — axios doesn't expose a streaming `ReadableStream` reader the same way. It manually re-implements auth-header attachment and 401 handling (`client.ts:422-437`) since it bypasses the axios interceptors entirely.

**Common mistakes:** Calling `axios.get(...)` directly from a component instead of adding a typed function to `client.ts` — this bypasses the auth header, the 401-refresh logic, and the error-toast handling all at once. Also: forgetting to re-run `npm run gen:api` after a backend schema change, leading to `schema.d.ts` silently drifting from reality (mitigated in a few places by the hand-added intersection types, but not everywhere).

**What a beginner should remember:** Never import `axios` directly in a component — always add/reuse a function in `api/client.ts` and call that. It's the only place that knows about auth headers, refresh, and error toasts.

---

## 9. Authentication Flow

**The core idea a JWT solves:** HTTP is stateless — the server doesn't inherently remember who you are between one request and the next, so every request needs to somehow prove "I am this logged-in user" on its own. A **JWT (JSON Web Token)** is the backend's answer: after you log in with a password once, the server hands back a signed blob of data (containing your user ID, an expiry time, etc.) that the *frontend* then attaches to every subsequent request instead of re-sending a password. The server can verify the signature cheaply, without a database lookup, to confirm the token hasn't been tampered with and hasn't expired. The frontend's whole job in this section is: store that token somewhere it survives a page reload, attach it to every request, and gracefully replace it once it expires — without ever making the user type their password again mid-session.

**Why two tokens (access + refresh) instead of one:** a single long-lived token would be convenient (never needs refreshing) but dangerous (if it ever leaked — an XSS bug, a compromised browser extension — an attacker could use it for as long as it remains valid, which could be weeks or months). A single *short*-lived token would be safer but would force the user to re-login every few minutes as it expires. This app's actual approach, like most modern web auth, splits the difference: a short-lived **access token** is what's actually attached to API requests and does the real authorizing — deliberately short-lived so a leaked one is only dangerous for a brief window — and a longer-lived **refresh token** is used *only* to mint a new access token when the old one expires, without involving the user. Think of it like a venue wristband (access token) that expires at midnight, versus the ticket stub (refresh token) you can exchange at the booth for a fresh wristband without buying a new ticket — the wristband alone gets you into the venue quickly on every check, but if you lose it, it's only good until midnight anyway; the stub is worth more if stolen, so it's exchanged less often and more carefully.

Authentication state lives in `frontend/src/context/AuthContext.tsx`, and is deliberately decoupled from the low-level token persistence in `frontend/src/auth/tokenStore.ts` (plain `localStorage` get/set for `nl2sql_token` and `nl2sql_refresh_token`, with no React dependency — `tokenStore.ts:9-10`).

```mermaid
sequenceDiagram
    participant User
    participant AuthPage
    participant AuthContext
    participant tokenStore
    participant apiClient
    participant Backend

    User->>AuthPage: submit email+password
    AuthPage->>AuthContext: login(email, password)
    AuthContext->>Backend: POST /api/v1/auth/login
    Backend-->>AuthContext: {access_token, refresh_token, user}
    AuthContext->>AuthContext: queryClient.clear()  (wipe prior account's cache)
    AuthContext->>tokenStore: setToken(access) / setRefreshToken(refresh)
    AuthContext->>apiClient: axios.defaults header = Bearer access
    AuthContext-->>AuthPage: resolved promise
    AuthPage->>User: navigate(redirectTo)

    Note over AuthContext: Later — access token expires (401 on any request)
    apiClient->>Backend: original request -> 401
    apiClient->>Backend: POST /auth/refresh (refresh_token)
    Backend-->>apiClient: new {access_token, refresh_token}
    apiClient->>tokenStore: persist new tokens
    apiClient->>Backend: retry original request with new token

    User->>AuthContext: click "Sign out"
    AuthContext->>Backend: POST /auth/logout (revokes session server-side)
    AuthContext->>tokenStore: clear both tokens
    AuthContext->>AuthContext: queryClient.clear()
    AuthContext-->>User: navigate('/auth')
```

**Login/register/OTP/Google — all in `AuthContext`:** `login` (`AuthContext.tsx:199-211`), `register` (`213-225`, note it does *not* call `applyAuthResponse` because registration returns a 202 with no token, per the comment), `verifyOTP` (`227-236`), `resendOTP` (`238-245`), and `googleLogin` (`247-256`) all follow the same shape: call the backend, and on success call `applyAuthResponse` which sets the access token, persists the refresh token, and sets the `user` object. Every one of these that establishes a *new* session also calls `queryClient.clear()` first (`AuthContext.tsx:206,231,251`) — the comment explains why: to wipe any cached chats/dashboards/schedules/metrics/templates left over from a *previous* account signed into the same browser tab.

**Token storage:** the access token and the OTP/refresh token are both plain `localStorage` entries (`tokenStore.ts:9-10`). Non-sensitive profile info (`user`) is separately persisted under `nl2sql_user` directly inside `AuthContext.tsx:189-195`, purely so a page refresh can restore `user` instantly without waiting on a network round-trip.

**Session restore on page load (bootstrap):** `AuthContext.tsx:106-108` initializes `isBootstrapping` to `true` if *either* an access or refresh token exists in storage. The mount effect (`AuthContext.tsx:140-186`) then: (1) if a non-expired access token exists, calls `GET /auth/me` to validate it and hydrate `user`; if that 401s, falls back to (2) exchanging the refresh token for a new pair via `POST /auth/refresh`; if there's no valid access token to start with but a refresh token exists, it goes straight to (2). Only if both fail does it clear state. `App.tsx` gates the entire router behind `isBootstrapping` (§4, §5) specifically so a user with a merely-expired-but-refreshable access token is never flashed the login screen.

**Client-side expiry check (no signature verification):** `AuthContext.tsx:60-68`, `isTokenExpired` manually base64-decodes the JWT payload (`JSON.parse(atob(token.split('.')[1]))`) and compares its `exp` claim (seconds) against `Date.now()` (ms) — this is purely a client-side optimization to avoid firing a doomed request; the comment is explicit that "server does that" (signature verification) — the frontend never trusts this check for security, only for UX.

**Silent token refresh on 401 (interceptor-driven, not context-driven):** this happens in `api/client.ts`, not `AuthContext` — see §8's response-interceptor description. It's a **single-flight** refresh (`client.ts:260,284-292`) shared across every concurrent request that hits a 401 at the same moment.

**Logout:** `AuthContext.tsx:258-272` — calls `POST /auth/logout` (revokes the session server-side by its JWT `sid`, which the comment notes also hard-revokes any refresh tokens bound to that session), then unconditionally clears local token/user state and the entire TanStack Query cache, regardless of whether the server call succeeded (`catch { /* ignore */ }` — you always get logged out locally even if the network call fails).

**Protected routes:** covered in §5 — `ProtectedRoute` reads `isAuthenticated`/`isBootstrapping` from `useAuth()` and redirects to `/auth?redirect=<path>` when not authenticated.

**Common mistakes:** Reading the token straight from `localStorage` in a new component instead of going through `tokenStore.getToken()`/`useAuth()` — that bypasses the abstraction and makes future storage changes (e.g. moving to httpOnly cookies) harder. Also: forgetting that `login`/`register`/`googleLogin` clear the entire query cache — if you're debugging "why did my data disappear after switching accounts," this is by design, not a bug.

**What a beginner should remember:** There are *two* tokens (short-lived access token + long-lived refresh token), and *two* separate refresh mechanisms exist for a reason — one runs once at app bootstrap (`AuthContext`'s mount effect) to restore a session on page load, the other runs reactively on any 401 during normal use (`api/client.ts`'s response interceptor).

---

## 10. State Management

This app deliberately uses **four different state mechanisms**, each for a different kind of data, rather than one global store for everything. Before the breakdown, it's worth understanding the one distinction that drives almost every choice below: **"client state" vs. "server state."** Client state is data that only ever exists in the browser and that only *this* app's UI cares about — is a dropdown open, is the sidebar collapsed. Server state is data that has a canonical copy living on the backend/database, which the frontend is merely caching a temporary, possibly-stale *copy* of — a chat session, a schema table list, a saved dashboard. These two categories behave completely differently: client state is always accurate the instant you set it (there's no "server" to disagree with you), while server state can go stale the moment another tab, another user, or a background job changes the same record — it needs fetching, caching, re-fetching, and reconciling in a way plain component state was never designed to do.

| Mechanism | Used for | Example |
|---|---|---|
| Local component state (`useState`) | UI-only state that no other component needs | `Layout.tsx`'s `collapsed`, `mobileOpen`, `userMenuOpen` (`Layout.tsx:143-155`) |
| React Context | Cross-cutting global state needed by many unrelated components | `AuthContext`, `ThemeContext`, `ConnectionContext`, `CommandPaletteContext` |
| TanStack Query (`useQuery`/`useMutation`) | Server state — anything that lives in the backend/database | sessions list, schema status, settings, connections, dashboards |
| `localStorage` (directly, or via `tokenStore.ts`) | State that must survive a full page reload | JWT tokens, theme choice, sidebar width preference |

**Why local state:** Things like "is the mobile sidebar open" (`Layout.tsx:148`) or "which nav-menu popover is open" (`Layout.tsx:150-153`) have exactly one consumer — the component that renders them — so lifting them into Context or a global store would add indirection for zero benefit.

**What actually goes wrong if you put server data in `useState` instead of TanStack Query** — this is worth walking through concretely, because it's the single most common way a beginner would "reinvent" this app's plumbing badly: imagine fetching the sessions list with a hand-rolled `useState` + `useEffect(() => { fetch(...).then(setSessions) }, [])` instead of `useQuery`. You'd immediately need to hand-write, and keep correct, everything TanStack Query already solved: a `isLoading` flag (set before the fetch, cleared after — easy to forget on the error path), an `error` state, logic to avoid re-fetching if another component elsewhere *also* wants the sessions list (without a shared cache, two components each doing their own `useEffect` fetch means two redundant network calls for the same data), and — the part that actually bites hardest in practice — a way to make the sessions list refresh after a *mutation* happens somewhere else (e.g. deleting a session on the History page, §12, should make the sidebar's session list — a completely different component, mounted from `Layout.tsx` — update too). With `useState`, that last one requires manually threading a callback or an event bus between two unrelated components. With TanStack Query, both components simply `useQuery({queryKey: ['sessions', ...]})` against the *same* cache, and one `queryClient.invalidateQueries({queryKey: ['sessions']})` call from the delete mutation refreshes every component subscribed to that key, anywhere in the tree, with no direct coupling between them at all. That's not a minor convenience — it's the difference between "two independent, potentially-inconsistent copies of the same server data" and "one cache, many consumers, always in sync."

**Why Context, and why four separate contexts instead of one:** the tempting shortcut for a beginner is "just put everything in one big global Context (or a single Redux-style store) and read whatever you need from anywhere." The concrete cost of doing that: every component that reads *anything* from that one Context re-renders whenever *any* value inside it changes — because React Context has no concept of "I only care about this one field," a Context Provider re-rendering re-renders every consumer, full stop. If `AuthContext`, `ThemeContext`, `ConnectionContext`, and `CommandPaletteContext` were merged into one `AppContext`, then toggling the command palette open (§10's `CommandPaletteContext`) would re-render every component that reads *any* app-wide value — including ones that only care about the current theme or the logged-in user and have nothing to do with the palette. Splitting into four narrow contexts means a change to "is the palette open" only re-renders palette consumers, a theme switch only re-renders theme consumers, and so on — each concern's changes are contained to its own subscriber list.
- **`AuthContext`** — *who* is logged in, needed by `ProtectedRoute`, `Layout` (to show the user's name), `ConnectionContext` (connections are per-user), and every page that gates on `isAuthenticated`. It also owns the axios `Authorization` header side effect (§8/§9).
- **`ThemeContext`** — *how* the app looks, needed by `ThemeSwitcher` and, indirectly, by nothing else in JS — it works by mutating a DOM attribute (`data-theme`) that CSS reads, so most consumers don't even need to `useTheme()`; only the settings/switcher UI does.
- **`ConnectionContext`** — *which database* is active, needed by `Layout`'s header (shows connection status), the Schema page, and any page whose data is connection-scoped. Its own header comment explains why switching triggers cache invalidation: "the schema, schema graph, chat, SQL preview and RAG all target the new database on their next request — so on switch we invalidate the schema-related query keys" (`ConnectionContext.tsx:5-8`).
- **`CommandPaletteContext`** — *is the Ctrl+K palette open*, needed by the header's search button, `HomePage`'s search bar, and the palette component itself — all without prop-drilling through `Layout`. Its own comment states this exact rationale (`CommandPaletteContext.tsx:1-9`).

Each context is deliberately narrow — this project avoids one giant "app state" context, which would cause every consumer to re-render on *any* unrelated state change (a classic Context anti-pattern).

**Why TanStack Query for server state, instead of just `useState` + `useEffect`:** server data (sessions, schema, settings, connections, dashboards, metrics...) needs caching, de-duplication of concurrent identical requests, background refetching, and cache invalidation on mutation — TanStack Query provides all of this out of the box. `frontend/src/lib/queryClient.ts` creates exactly **one** `QueryClient` for the whole app (`staleTime: 5 minutes`, `retry: 1` — `queryClient.ts:9-16`), shared between `main.tsx`'s `<QueryClientProvider>` and `AuthContext`'s `login`/`logout`/`register` (which call `queryClient.clear()`, §9) — the comment at `queryClient.ts:3-8` spells out exactly why sharing this instance matters: so a previous account's cached data never bleeds into the next account's session in the same tab.

Concrete example of the query/mutation/invalidate pattern, `frontend/src/context/ConnectionContext.tsx:64-96`:
```ts
const invalidateConnectionScoped = useCallback(() => {
  queryClient.invalidateQueries({ queryKey: ['connections'] });
  queryClient.invalidateQueries({ queryKey: ['schema-tables'] });
  queryClient.invalidateQueries({ queryKey: ['schemaStatus'] });
  queryClient.invalidateQueries({ queryKey: ['databaseConfig'] });
  localStorage.removeItem(SCHEMA_GRAPH_CACHE_KEY);
}, [queryClient]);

const selectMut = useMutation({
  mutationFn: (id: string) => selectConnection(id),
  onSuccess: () => invalidateConnectionScoped(),
});
```
Selecting a connection mutates server state, and `onSuccess` invalidates every query key whose data depends on "which connection is active" — those queries then automatically refetch on their next render, no manual state syncing required.

**Why `localStorage` directly:** a small, deliberate set of values need to survive a full browser reload *before* React (or even the Context providers) have mounted — the JWT tokens (read synchronously in `AuthContext`'s `useState` initializer, `AuthContext.tsx:92`) and the theme id (read synchronously in `ThemeContext`'s `useState` initializer, `ThemeContext.tsx:47-50`) are the two most important examples, because both need to be applied before the first paint to avoid a flash of the wrong theme or an unnecessary bounce to `/auth`.

**Common mistakes:** Storing server data (e.g. the sessions list) in `useState` + a manual `useEffect` fetch instead of `useQuery` — this reinvents caching/loading/error state badly and won't automatically revalidate after a related mutation. Also: adding a new global concern as a fifth top-level Context without checking whether it truly needs to be global — most new state should start as local `useState` or a `useQuery` call, and only get promoted to Context if multiple unrelated components genuinely need it.

**What a beginner should remember:** Ask "does this value come from the server?" — if yes, it belongs in TanStack Query (`useQuery`/`useMutation`), not `useState`. Ask "does more than one unrelated part of the tree need this?" — if yes and it's client-only state, it belongs in a Context; if no, keep it local.

## 11. SQL Query Interface

The chat interface is the heart of the app. It lives at `frontend/src/pages/QueryPage.tsx` and is deliberately a "thin composition layer" (the file's own doc comment, `QueryPage.tsx:1-5`) — almost all state and network logic is pulled out into the `useChat` hook, and the page just wires props between `QueryInput`, `ChatWindow`, and two optional side panels (`SchemaGraph`, `QueryBuilder`).

**Why pull all this into a custom hook instead of just writing it inside `QueryPage`?** A **custom hook** (any function whose name starts with `use` and that itself calls other hooks like `useState`/`useEffect` inside it) is React's mechanism for extracting *stateful* logic into something reusable and independently reasoned-about — it's the hook equivalent of pulling a big function's body out into a well-named helper, except a plain helper function couldn't hold its own `useState`/`useRef` across renders the way a hook can. Concretely here: `useChat` alone owns roughly a dozen pieces of interrelated state (current session, pending question, thinking steps, validation errors, rate-limit state, abort controller) and the logic that keeps them consistent. If all of that lived directly inside `QueryPage`'s function body, the page component would be enormous, hard to read top-to-bottom, and impossible to reuse if a second page ever needed the same chat behavior (there isn't one today, but the separation is what would make that possible without a copy-paste). Splitting it into `useChat` means `QueryPage` only has to answer "what do I render," while `useChat` only has to answer "what is the current state of a chat conversation, and how does it change" — two much simpler questions than one combined one.

### The pieces and how they connect

```mermaid
sequenceDiagram
    participant U as User
    participant QI as QueryInput.tsx
    participant UC as useChat.ts
    participant API as api/client.ts (streamQuery)
    participant BE as FastAPI /query/stream
    participant CW as ChatWindow.tsx
    participant SP as SqlPreview.tsx
    participant RT as ResultTable.tsx
    participant DC as DataChart.tsx

    U->>QI: types question, presses Enter/Ctrl+Enter
    QI->>UC: onSubmit(dialect, execute)
    UC->>UC: submitQuery() validates length, sets pendingQuestion
    UC->>API: streamQuery({question, dialect, execute, session_id}, onChunk)
    API->>BE: fetch POST /api/v1/query/stream (SSE-style chunks)
    BE-->>API: chunk {stage: "retrieving_schema"} ...
    API-->>UC: onChunk() -> pushStep() updates thinkingSteps
    BE-->>API: chunk {status:"complete", data: QueryResponse}
    API-->>UC: finalData resolved
    UC->>UC: append ChatMessage to currentSession
    UC->>CW: messages, isLoading, thinkingSteps
    CW->>SP: response (SQL, validity, tokens)
    SP->>SP: VersionedSQLDisplay renders syntax-highlighted SQL
    CW->>DC: execution_result rows (if chartable)
    CW->>RT: execution_result rows (table)
```

### 1. Typing and submitting a question

`QueryInput.tsx` is a controlled textarea. It auto-grows (`QueryInput.tsx:58-63`), debounce-free autocompletion via `getSuggestions()` from `utils/autocomplete.ts` (schema-aware suggestions fetched once via `getVisualizeSchema()`), and handles keyboard semantics itself: `Enter` or `Ctrl+Enter` submits, `Shift+Enter` inserts a newline, arrow keys move through the suggestion listbox (`QueryInput.tsx:110-138`). Submission calls the `onSubmit(dialect, execute)` prop, which `QueryPage` wires straight to `sendMessage` from `useChat`.

```tsx
// frontend/src/components/QueryInput.tsx:140-144
const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  setShowSuggestions(false);
  onSubmit(dialect, execute);
};
```

### 2. `useChat` — the state machine

`useChat.ts` owns: the current session (`SessionDetail`), the optimistic `pendingQuestion` bubble, a `thinkingSteps` array driving the "Thinking…" panel, validation/rate-limit error state, and an `AbortController` for cancellation.

Submission flow (`useChat.ts:242-280`):
1. Trim + length-validate (3–2000 chars) — client-side guard before any network call.
2. Optimistically push the question into the UI (`setPendingQuestion`) and clear the input.
3. Lazily create a session via `createSession()` if none exists yet (`getOrCreateSession`, `useChat.ts:223-237`).
4. Call `queryMutation.mutate(...)`, a TanStack Query mutation whose `mutationFn` calls `streamQuery(vars, onChunk, signal)`.

`streamQuery` (in `api/client.ts`) uses the raw `fetch` Streams API — not axios — because axios doesn't support incremental SSE-style bodies well. Each chunk updates `thinkingSteps` via `pushStep()`, mapping backend pipeline stages (`retrieving_schema`, `generating_sql`, `validating_sql`, `executing_sql`, …) to human labels through the `STAGE_LABELS` table (`useChat.ts:30-38`). When a `{status:"complete", data}` chunk arrives, that `data` becomes the final `QueryResponse` appended to the session's message list.

Corrections and regeneration reuse the exact same `submitQuery` path: `sendCorrection` sets `is_correction: true` on the request so the backend rewrites the previous turn instead of starting fresh (`useChat.ts:287-291`); `regenerateMessage` re-submits an earlier question verbatim (`useChat.ts:296-303`).

**Why an `AbortController` matters here, concretely:** imagine a user submits a question, the SSE stream is still mid-flight (schema retrieval and SQL generation can genuinely take several seconds), and — impatient or having changed their mind — they submit a *second* question before the first has finished. Without cancellation, both requests would keep streaming in the background, and whichever one's `{status:"complete"}` chunk happens to arrive *last* would overwrite `useChat`'s state, which could easily be the *first*, now-stale question's answer landing after the second one's — visibly wrong behavior where the chat shows an answer to a question the user no longer cares about. `useChat.ts:117-119` prevents this by aborting any in-flight stream's `AbortController` before starting a new one, so only the newest request can ever resolve. The same `AbortController` also backs the visible "Stop" button (`abortQuery()`, §22) — letting a user deliberately cancel a slow-running query rather than being stuck waiting for a response they no longer want, which also means the backend can stop doing wasted work in mid-pipeline once the client hangs up.

### 3. Rendering the thread — `ChatWindow`

`ChatWindow.tsx` maps over `messages` and renders each turn as a user bubble + AI bubble pair. Inside the AI bubble it composes, in order: clarification prompt (if `needs_clarification`), assistant message text, `SqlPreview`, validation errors, "Tables Used" badges, an auto-chart (see below), `ResultTable`, follow-up question chips, and the feedback/save/dashboard action row (`ChatWindow.tsx:153-322`).

The loading state is not a single spinner — it's a live checklist. `thinkingSteps` drives an ordered list where every completed stage shows a green check and the active one spins (`ChatWindow.tsx:367-389`), which is what makes multi-second SQL generation feel transparent instead of frozen.

### 4. Showing the generated SQL — `SqlPreview` + `VersionedSQLDisplay`

`SqlPreview.tsx` wraps a lazily-loaded `VersionedSQLDisplay` (`SqlPreview.tsx:13`, `react-syntax-highlighter` is heavy so it's only pulled into the bundle when a SQL block actually renders). It seeds a single "version 1 / original" entry and, if the message has a real (persisted) `messageId`, fetches any previously-saved edited versions via `getSQLVersions()` (`SqlPreview.tsx:47-73`) — this is what lets a user step back/forward through edits with `VersionedSQLDisplay`'s `‹ v2/3 ›` control.

Action buttons on `SqlPreview` call real endpoints: Copy (clipboard), Explain (`explainSQL`), Get Suggestions (`getSuggestions`), Preview Cost (`previewSQL` — EXPLAIN-based row/cost estimate with warnings), plus `ExportShareControls` for CSV/JSON/SQL/PDF export and secure share links (`SqlPreview.tsx:172-230`).

`VersionedSQLDisplay.tsx` itself supports inline editing: click "Edit" → textarea replaces the highlighter → "Re-Run" calls `executeSQL()` directly and appends a new version with its own results (`VersionedSQLDisplay.tsx:63-73`), which is how a user can hand-tweak a WHERE clause without re-asking the whole question in English. The versioning model is conceptually the same idea as "track changes" or a document's version history — every edit is *appended* as a new numbered version rather than overwriting the previous one in place, so the AI's original SQL is never silently lost even after a user has manually tweaked it three times; the `‹ v2/3 ›` control is just a way to step through that append-only history.

### 5. Showing results — `ResultTable`

`ResultTable.tsx` is a self-contained paginated/sortable table. It computes numeric columns for right-alignment (`ResultTable.tsx:94-109`), supports CSV and "Excel" (HTML table saved with an `.xls` MIME type — no library) export (`ResultTable.tsx:126-166`), and click-to-copy on any cell with a 1-second "Copied" affordance (`ResultTable.tsx:205-212`). Above 100 rows on a single page it switches into a windowed rendering mode (see §15 Performance) rather than rendering every `<tr>`.

### 6. Auto-charting — `DataChart`

`ChatWindow` decides whether to render a chart at all: it prefers the LLM's own `suggested_chart` from the response, and falls back to `guessChartConfig()` (a pure heuristic in `utils/chart.ts`) when the model didn't suggest one or the SQL was run manually (`ChatWindow.tsx:248-268`). This ordering is deliberate: the LLM had access to the *original question's intent* ("show me revenue **trend**" implies a line chart in a way raw column names alone don't), which a purely structural heuristic looking only at the result's column names/types can't infer — so the LLM's suggestion is trusted first when available, and the heuristic exists purely as a fallback for the cases where there's no LLM opinion to consult at all (a manually-run/edited SQL query never asked the LLM anything, so there's nothing to prefer). `DataChart.tsx` itself is lazy-loaded (`ChatWindow.tsx:36`, recharts is heavy) and supports bar/line/pie/scatter/histogram/KPI/table toggles, a PNG export that resolves CSS variables into concrete colors before rasterizing the SVG (`DataChart.tsx:71-108` — necessary because a rasterized PNG can't reference a live CSS variable the way the on-screen SVG can; the export step has to "bake in" whatever color the variable currently resolves to), and a legend toggle.

**Common mistakes**
- Assuming `postQuery` (plain POST) is what powers the chat UI — the live chat path always goes through `streamQuery`'s fetch-based SSE reader; `postQuery` exists in `client.ts` but isn't wired into `useChat`.
- Forgetting that `messageId > 2_147_483_647` guards optimistic messages (`SqlPreview.tsx:52`) — a `Date.now()`-based client id will overflow Postgres's 32-bit `int`, so version history fetches are skipped for not-yet-persisted messages.
- Wiring a new "regenerate" action straight to `postQuery`/`streamQuery` instead of through `submitQuery` — you'd lose validation, optimistic UI, and abort-handling for free.

**What a beginner should remember**
`useChat` is the single source of truth for the chat page; every button in `ChatWindow`/`QueryInput` is really just calling one of its exposed functions (`sendMessage`, `sendCorrection`, `editMessage`, `regenerateMessage`, `abortQuery`). If you need new chat behavior, add it to the hook first, then expose it as a prop.

---

## 12. Dashboard Pages

Beyond the chat, the app has eight dedicated pages for exploring, governing, and automating queries. All of them follow the same pattern: TanStack Query for data fetching/caching, optimistic or invalidate-on-success mutations, and shadcn-style primitives (`Card`, `Badge`, `Skeleton`, `ItemActionsMenu`) for a consistent look. This uniformity is a deliberate payoff of the state-management choices in §10: because every page treats its data as *server state* owned by TanStack Query rather than hand-rolled `useState`, the "list + create + mutate + resync" shape repeats almost identically across all eight pages — once you've internalized that one shape, reading a ninth similar page later is mostly just learning its domain fields, not its plumbing.

| Page | File | Purpose | Key components |
|---|---|---|---|
| Analytics | `AnalyticsPage.tsx` | Query performance/cache/failure dashboards | `recharts` (Bar/Pie), toggleable chart picker |
| Dashboards | `DashboardsPage.tsx` | Compose saved results into live, refreshable widget grids | `DataChart`, `ItemActionsMenu` |
| History | `HistoryPage.tsx` | Browse/replay past chat sessions | `SyntaxHighlighter`, optimistic delete |
| Saved Queries | `SavedQueriesPage.tsx` | Bookmarked NL+SQL pairs, one-click re-run | `ResultTable` |
| Schedules | `SchedulesPage.tsx` | Cron-like recurring queries + email alerts | `HistoryPanel` sub-component |
| Schema | `SchemaPage.tsx` | Connections, live sync, table catalog, pinning | `ConnectionsManager`, `SchemaExplanationDialog` |
| Metrics | `MetricsPage.tsx` | Certified/governed business metric definitions | Inline SQL preview |
| Templates | `TemplatesPage.tsx` | Parameterized `{{placeholder}}` SQL patterns | `RenderPanel` sub-component |

### Analytics (`AnalyticsPage.tsx`)

Fetches eight parallel datasets on mount and every 30s (`AnalyticsPage.tsx:107-141`): summary stats, popular queries, table usage, failure patterns, intent distribution, prompt-version success rates, cache-layer hit rates, and pipeline latency breakdown. A "Charts" dropdown (`visibleCharts: Set<ChartId>`) lets the user hide/show any of nine chart panels independently (`AnalyticsPage.tsx:79-105`), and "Reset Analytics" requires a two-step confirm before calling `analyticsAPI.resetAnalytics()`.

### Dashboards (`DashboardsPage.tsx`)

Two views in one component: a list view (create/duplicate/delete dashboards) and a `DashboardDetail` view. Each widget stores its own SQL and chart config; "Refresh" calls `refreshDashboard(dashboardId)` which re-executes every widget's query server-side and returns fresh rows keyed by `widget_id` (`DashboardsPage.tsx:64-77`). Widgets can have their chart type changed inline via a `<select>` (`DashboardsPage.tsx:174-181`) and use `recommendChart()`/`columnsFromRow()` from `utils/chart.ts` to pick sensible axes when the stored config is incomplete (`widgetChartConfig`, `DashboardsPage.tsx:32-46`). Getting a query result *onto* a dashboard happens from the chat itself via `AddToDashboardModal` (see §11's "Dashboard" button in `ChatWindow`).

### History (`HistoryPage.tsx`)

Lists sessions grouped implicitly by recency (the sidebar in `Layout.tsx` does the actual Today/Yesterday/7d/30d bucketing — see §16). Clicking a session loads full detail via `getSession()` and lets the user expand any message to see its SQL (syntax highlighted, theme-aware — `atomDark` vs `oneLight`), tables used, validation errors, and a 5-row results preview. Delete-all and delete-one both use TanStack Query v5 optimistic updates: snapshot every cached `['sessions', …]` query, patch it immediately, and roll back on error (`HistoryPage.tsx:72-120`) — this is why a delete feels instant even before the server confirms.

### Saved Queries (`SavedQueriesPage.tsx`)

A bookmarked-query library with search/starred filtering and pagination (20/page). "Run" (`handleRun`) increments a server-side run counter then calls `executeSQL()` directly and renders the result through the same `ResultTable` component used in chat, via a small `toQueryResponse()` adapter that reshapes an `ExecuteResponse` into a `QueryResponse` shape (`SavedQueriesPage.tsx:33-48`).

### Schedules (`SchedulesPage.tsx`)

Each schedule is a natural-language question (`nl_prompt`) plus a natural-language cadence (`schedule_text`, e.g. "every morning") tied to a specific connection. `statusBadge()` derives Paused/Failing/Healthy/Pending from `is_paused` and `last_status` (`SchedulesPage.tsx:42-49`). Expanding a row lazily mounts `HistoryPanel`, which queries `getScheduleHistory()` only once expanded (`SchedulesPage.tsx:51-87`) — a simple but effective load-on-demand pattern.

### Schema (`SchemaPage.tsx`)

The densest page: it composes `ConnectionsManager` (multi-connection CRUD — see §13), a "Sync Live Schema" action that reflects the active DB into the vector store, a `SchemaTablesSection` catalog browser (expand a table to see columns/PK/FK, pin/unpin, ask the AI to "Explain" a table or column via `SchemaExplanationDialog`, edit a free-text description), a drag-and-drop JSON schema uploader, and a `PinnedTablesSection` for retrieval hints. `SchemaTablesSection` auto-refetches every 60s (`refetchInterval: 60_000`, `SchemaPage.tsx:215-217`) so a newly-created table shows up without a manual refresh, flagged with a "New" badge until `markTablesSeen()` is called on expand.

### Metrics (`MetricsPage.tsx`)

A governed "semantic layer": each `Metric` has a name, SQL definition, tags, and a `certified` flag. Certification is blocked while `validation_errors` is non-empty (`MetricsPage.tsx:196`). "Preview" runs the SQL definition via `previewMetric()` and shows row count or an estimate without mutating anything.

### Templates (`TemplatesPage.tsx`)

Parameterized SQL: a template stores a `template_nl` and `template_sql` string containing `{{placeholder}}` tokens. `extractPlaceholders()` is a small regex helper (`TemplatesPage.tsx:122-125`) shared between the card and the `RenderPanel`, which lets a user fill in each placeholder's value and calls `renderTemplate(template.id, values)` to get back the substituted NL/SQL text — rendering does **not** execute the SQL; that's a deliberate design choice documented in the page's own FAQ copy (see `HelpPage.tsx:298-300`).

**Common mistakes**
- Building a new list page and hand-rolling optimistic delete instead of copying the `onMutate/onError/onSettled` triple from `HistoryPage.tsx` or `TemplatesPage.tsx` — the snapshot-all-matching-queries pattern (`getQueriesData({queryKey:['x']})`) is what keeps every open list in sync.
- Forgetting `refetchInterval`/`staleTime` and re-fetching on every render — most of these pages set an explicit `staleTime` (e.g. `SchemaTablesSection`'s 60s poll) precisely to avoid hammering the backend.

**What a beginner should remember**
Every one of these pages is "TanStack Query for reads + mutations for writes + `queryClient.invalidateQueries` to resync." Once you've read one page's mutation block, you've effectively read all of them — the differences are in the domain fields, not the plumbing.

---

## 13. Multi-Database Connections

This app is **BYOD (bring your own database)**: a signed-in user can register several database connections and switch which one is "active" at any time, without logging out or reloading. This is a core feature, not a side panel, so it gets its own section rather than being folded into §12 or §10.

### The three pieces

- **`ConnectionContext.tsx`** (`frontend/src/context/ConnectionContext.tsx`) — the state layer. It fetches the list of connections (`useQuery({queryKey: ['connections'], queryFn: listConnections})`, `ConnectionContext.tsx:52-62`), derives `activeConnection` as `connections.find(c => c.is_default)` (`ConnectionContext.tsx:107-110`), and exposes `create`/`update`/`remove`/`test`/`select` as `mutateAsync`-wrapped functions.
- **`ConnectionsManager.tsx`** (`frontend/src/features/connections/ConnectionsManager.tsx`) — the full CRUD UI, rendered inside `SchemaPage`. Its own header comment states the contract plainly: *"Lets the user add, rename, test, delete, and switch the active connection... switching here immediately re-scopes the schema, graph, chat and RAG"* (`ConnectionsManager.tsx:1-9`).
- **`DatabaseSelector.tsx`** (`frontend/src/components/DatabaseSelector.tsx`) — a lightweight dropdown switcher shown in the query toolbar, for quickly hopping between *already-created* connections without leaving the chat page. It renders `null` entirely if the user has zero connections (`DatabaseSelector.tsx:26-28`) and reuses the exact same `useConnections()`/`select()` call as `ConnectionsManager` — it's a second UI surface over the same context, not a separate state machine.

### The data shape

`Connection` (`frontend/src/api/client.ts:148-157`, explicitly commented `// TODO: replace with Schemas['ConnectionOut'] after npm run gen:api` — a live example of the hand-written-type pattern from §8):
```ts
export interface Connection {
  connection_id: string;
  name: string;
  db_type: string;
  is_default: boolean;   // this is the "active" connection
  has_dsn: boolean;       // false = falls back to the platform's own DB
  url_preview: string | null; // redacted preview, never the raw connection string
  created_at: string;
  updated_at: string;
}
```
When `has_dsn` is `false`, `ConnectionsManager` shows a "Server default" badge instead of a connection string (`ConnectionsManager.tsx:92,95`) — meaning that row has no `database_url` of its own and queries against it hit whatever database the backend itself is configured with.

### CRUD, grounded in `ConnectionsManager.tsx`

- **Create** (`AddConnectionForm`, `ConnectionsManager.tsx:195-268`) — takes a display `name` and a `database_url` (masked as `type="password"`), calls `create()`, and its own copy states *"Validated and connection-tested before it's saved. Stored encrypted at rest"* (`ConnectionsManager.tsx:254-256`) — i.e. the backend tests connectivity and encrypts the DSN before persisting it, not just accepting an arbitrary string.
- **Test** (`handleTest`, `ConnectionsManager.tsx:48-55`) — an ad-hoc connectivity check (`test(conn.connection_id)`) independent of switching; only shown when `conn.has_dsn` is true (you can't "test" the server-default fallback).
- **Update** (`handleSave`, `ConnectionsManager.tsx:63-75`) — a partial update: `name`/`database_url` are only sent if actually changed (`undefined` otherwise), so renaming a connection doesn't require re-entering its connection string.
- **Delete** (`handleDelete`, `ConnectionsManager.tsx:57-61`) — gated behind a two-step inline confirm (`confirmDelete` state) whose own copy warns *"Its schema index is removed too"* (`ConnectionsManager.tsx:170`) — deleting a connection isn't just removing a row, it also drops that connection's ingested schema/vector data.
- **Select** (`handleSelect`, `ConnectionsManager.tsx:46`, and the entire body of `DatabaseSelector.tsx:30-40`) — switches which connection is active.

### The switch flow — why selecting a connection invalidates half the app's cache

```mermaid
sequenceDiagram
    participant User
    participant DS as DatabaseSelector.tsx
    participant CC as ConnectionContext
    participant API as api/client.ts
    participant BE as Backend
    participant QC as TanStack QueryClient

    User->>DS: pick a different connection
    DS->>CC: select(connection_id)
    CC->>API: selectConnection(id) -> POST /connections/{id}/select
    API->>BE: mark this connection as the user's active/default one
    BE-->>API: updated Connection (is_default: true)
    API-->>CC: mutation onSuccess
    CC->>QC: invalidateQueries(['connections'], ['schema-tables'], ['schemaStatus'], ['databaseConfig'])
    CC->>CC: localStorage.removeItem('nl2sql_schema_graph_cache')
    QC-->>User: Schema page, SchemaGraph, next chat request all target the new database
```
`ConnectionContext.tsx:64-75`'s `invalidateConnectionScoped` is the mechanism, and its own header comment spells out exactly why it exists: *"the schema, schema graph, chat, SQL preview and RAG all target the new database on their next request — so on switch we invalidate the schema-related query keys"* (`ConnectionContext.tsx:5-8`). The `localStorage.removeItem` call is specifically there so `SchemaGraph`'s persisted layout cache never shows a *different* connection's tables after a switch.

Note there is no special handling in `streamQuery`/`useChat` itself for "which connection" — the backend resolves the active connection server-side per request (it's whichever one is currently `is_default` for that user), so the frontend doesn't need to thread a `connection_id` through every chat message; it only matters at the moment of switching, when the *cache* needs to catch up.

**Common mistakes**
- Assuming `DatabaseSelector` and `ConnectionsManager` are two independent connection systems — they're two UI surfaces over the exact same `ConnectionContext`; a change in one is instantly reflected in the other because both read `connections`/`activeConnection` from the same `useQuery` cache entry.
- Forgetting that deleting a connection also deletes its ingested schema — `ConnectionsManager.tsx:170`'s confirm copy exists specifically so this isn't a surprise.
- Not realizing `has_dsn: false` is a valid, supported state ("Server default") rather than a broken connection — it means "no dedicated DSN, falls back to the platform DB," not an error.

**What a beginner should remember**
Exactly one connection is ever "active" (`is_default`) at a time, resolved server-side. Switching is a mutation (`POST /connections/{id}/select`) followed by cache invalidation, not a client-only toggle — every connection-scoped query (schema, schema graph, RAG) is deliberately forced to refetch rather than trusting stale cached data from the previous database.

---

## 14. Error Handling

Error handling in this app is centralized, not scattered — almost every network-facing surface funnels through the same three primitives: the axios response interceptor in `api/client.ts`, the `handleApiError()` string-extraction helper, and the dependency-free toast system in `components/ui/toast.tsx`. The reason different HTTP status codes (401 vs. 429 vs. everything else) get genuinely different treatment below, rather than one generic "something went wrong" message, is that they mean different things to the *user*, not just to the code: a 401 means "your session needs a quiet refresh, this isn't really your fault or problem," a 429 means "you're going too fast, and here's concretely when to try again," and a validation failure means "you need to change what you asked for." Collapsing all three into one generic error toast would be technically simpler but would actively mislead the user about what happened and what to do next — which is why this section is organized by *category of failure*, not by where in the code the error was caught.

### Network & server errors (axios interceptor)

`apiClient.interceptors.response.use(...)` (`client.ts:340-377`) is the single place that classifies every failed request:

```ts
// frontend/src/api/client.ts:326-338
const notifyApiError = (err: ApiError): void => {
  if (err.status === 401) return;
  const title =
    err.status === 429
      ? `Slow down — rate limit hit${err.retryAfter ? `, retry in ${err.retryAfter}s` : ''}`
      : err.message;
  toast({ title, description: err.requestId ? `Reference: ${err.requestId}` : undefined, variant: 'error' });
};
```

- **401 (auth)**: never shown as a toast. Instead, a single-flight refresh (`refreshAccessToken()`, `client.ts:256-292`) transparently retries the original request once with a new token; if refresh also fails, `forceReauth()` clears local storage and hard-navigates to `/auth` (`client.ts:243-253`). This is why a user is quietly bounced to login on session expiry instead of seeing a scary error toast.
- **429 (rate limit)**: surfaced with a friendly "Slow down…, retry in Ns" toast, and in the chat flow specifically, `useChat.ts:200-219` builds a dedicated `rateLimitError` object (message + `retryAfter` + the last question/execute flags) so `ChatWindow` can render a **Retry Now** button instead of a generic error bubble (`ChatWindow.tsx:394-411`).
- **All other 4xx/5xx**: converted into a typed `ApiError` (`toApiError()`, `client.ts:307-324`) carrying `message`, `code`, `status`, and a backend-supplied `request_id` for support correlation, then both toasted centrally *and* re-thrown so the calling component can still render inline feedback.
- **Network errors** (no `response` at all — e.g. backend down) fall back to `error.message || 'Network error occurred'` (`client.ts:315-317`).

### Validation errors

Client-side validation happens *before* any request goes out. `useChat.ts:246-253` rejects a question under 3 or over 2000 characters with `setValidationError(...)`, which `QueryInput` renders inline under the textarea with a red border and an `AlertCircle` icon (`QueryInput.tsx:210-215`) and clears automatically as soon as the user edits the text again (`onClearValidationError`, `QueryInput.tsx:90`). Server-side SQL validation errors are different: they arrive as part of a *successful* HTTP response (`response.is_valid === false`, `response.validation_errors: string[]`) and are rendered as a persistent list inside the AI bubble (`ChatWindow.tsx:212-227`), not as a toast — because they're a property of that specific answer, not a request failure.

### Auth errors (401/403)

- **401** is handled globally as described above (refresh-or-reauth) — no page needs its own 401 handling.
- **403** and other authorization failures flow through the generic `ApiError` path and surface via `handleApiError()` at the call site — e.g. `AuthPage.tsx:114-124` inspects the raw error message for `'Unverified email'` and switches the UI into OTP-verification mode instead of just showing an error string.

### Server/execution errors in the UI

`ResultTable.tsx:44-56` renders `execution_error` (a failed SQL run) as a dedicated red panel distinct from "no error, zero rows" (`ResultTable.tsx:61-68`) — the two are visually different so a user never confuses "your query is broken" with "your query is fine but matched nothing." Pages that call mutations directly show errors either via `toast({title: handleApiError(e), variant:'error'})` (the dominant pattern — see `SchedulesPage.tsx`, `MetricsPage.tsx`, `DashboardsPage.tsx`) or via inline `<p className="text-destructive">` text for form-level validation (`ConnectionsManager.tsx`'s `error` state per row, `TemplatesPage.tsx`'s `RenderPanel`).

### The toast system itself

`components/ui/toast.tsx` is intentionally dependency-free: a module-level `toasts` array plus a `Set<Listener>` (pub/sub), not a context provider. `toast()` de-duplicates identical back-to-back toasts (`toast.tsx:57-59`), caps the visible stack at 4, and auto-dismisses after 5s (8s for errors). Crucially, it respects the user's "In-App Notifications" preference for everything *except* errors (`toast.tsx:46-48`) — errors are never silently suppressed, only informational/success toasts are.

**Common mistakes**
- Catching an axios error and calling `error.message` directly instead of `handleApiError(error)` — you'll get a generic "Request failed with status code 400" instead of the backend's actual `detail` string.
- Adding a new mutation without an `onError` handler — because the interceptor already toasts most errors, this is *often* fine, but 401s are deliberately excluded from that global toast, so an un-handled 401 on a component that doesn't expect the redirect can leave stale local state.
- Confusing `validationError` (client-side, pre-request) with `validation_errors` (server-side, inside a successful response) in `useChat`/`ChatWindow` — they're different fields with different lifecycles.

**What a beginner should remember**
You almost never need to write your own error-toasting code — the axios interceptor already does it for any request through `apiClient`. Your job in a new component is usually just: `onError: (e) => toast({ title: handleApiError(e), variant: 'error' })`, and let the interceptor's global toast be the fallback for anything you don't explicitly handle.

---

## 15. Performance

The unifying theme across every technique in this section is a single idea: **the fastest code is code that never has to run (or download) at all.** Before a browser can show anything, it has to download the JavaScript bundle, parse it, and execute it — all three of those scale with how much code is in the bundle, regardless of whether the user ever actually uses most of it. Every technique below is a different application of "don't download it / don't compute it / don't render it until it's actually needed," rather than making any individual piece of code run faster per se.

### Route-level code splitting (confirmed)

Every page is lazy-loaded in `App.tsx:14-27` via `React.lazy(() => import('./pages/...'))`, wrapped in one `<Suspense fallback={<RouteFallback />}>` around the whole `<Routes>` tree (`App.tsx:57-94`). This keeps heavy per-page dependencies (React Flow, recharts, syntax highlighter) out of the initial JS bundle entirely — a first-time visitor to `/query` never downloads the Analytics or Training page's code. `Suspense` is the piece that makes this safe to do at all: it's a wrapper that catches "this lazy component's code is still being fetched" and shows a fallback (`RouteFallback`, a spinner) instead of the page just being blank or throwing an error while the network request for that page's JS chunk is still in flight.

### Component-level lazy loading (confirmed)

Beyond routes, three specific heavy dependencies are deferred further, down to the *component* that actually needs them:
- `SchemaGraph` (wraps `@xyflow/react`) is lazy-loaded inside `QueryPage.tsx:16` and only mounted when the user clicks "Show Graph."
- `DataChart` (wraps `recharts`) is lazy-loaded inside `ChatWindow.tsx:36` and only rendered when a message actually has chartable rows.
- `VersionedSQLDisplay` (wraps `react-syntax-highlighter`) is lazy-loaded inside `SqlPreview.tsx:13`.

Each has an explicit code comment calling out *why*: "recharts is heavy — load it only when a message actually has a chart" (`ChatWindow.tsx:35`), "React Flow is heavy — load it only when the schema graph panel opens" (`QueryPage.tsx:15`).

### Memoization (confirmed, selective)

`useMemo` is used where a derived value is genuinely expensive or referentially important for a dependency array — not everywhere:
- `ResultTable.tsx:72-90` memoizes the sorted row array and, separately, the set of numeric columns (`ResultTable.tsx:94-109`), so re-sorting or re-rendering doesn't re-scan every row on every keystroke elsewhere on the page.
- `SchemaPage.tsx`'s `SchemaTablesSection` memoizes `favByName` (a `Map` built from the favorites list) and the search-filtered table list (`SchemaPage.tsx:224-228, 280-288`).
- `HomePage.tsx` memoizes `activity` (merged/sorted timeline from three different queries) and `insights` (derived warnings) so they don't recompute on every unrelated re-render (`HomePage.tsx:157-243`).
- `Layout.tsx` memoizes `filteredSessions` and `sessionGroups` (`Layout.tsx:292-300`) so typing in the sidebar's chat-search box doesn't re-bucket all sessions by date on every keystroke unless the input actually changed.

`useCallback` shows up for handlers passed down as stable references or into `useEffect` dependency arrays — e.g. `SchemaPage.tsx:523-544`'s drag-and-drop handlers, and `TrainingPage.tsx:77-97`'s `fetchStats`/`fetchJobs`.

**Not currently implemented**: there is no global memoization strategy (`React.memo` is not used on any component in the files reviewed), no `react-window`/`react-virtualized` dependency in `package.json`, and no request-level debouncing on the autocomplete input (`getSuggestions()` runs synchronously on every keystroke in `QueryInput.tsx:88-101` against an already-loaded in-memory schema, so this is cheap rather than debounced).

### Virtualization (confirmed, table-only, dependency-free)

**The problem virtualization solves:** every row rendered in an HTML table is a handful of real DOM nodes (a `<tr>` plus one `<td>` per column) that the browser has to create, lay out, and keep in memory — and unlike a plain array in JavaScript, DOM nodes are comparatively expensive to create and update at scale. Render 10,000 rows × 5 columns and you've asked the browser to manage 50,000+ live DOM nodes simultaneously, the overwhelming majority of which are scrolled off-screen and invisible at any given moment — pure waste. **Virtualization ("windowing")** exploits the fact that a user can only ever *see* a small slice of a long list at once: instead of rendering every row, it renders only the rows currently within (or just outside) the visible scroll area, and swaps which rows are actually in the DOM as the user scrolls — a handful of real rows standing in for however many thousands logically exist, with invisible padding elements holding the scrollbar's size steady so the scroll experience still feels like a normal, complete list.

`ResultTable.tsx` implements its own lightweight windowing rather than pulling in a virtualization library. Above `VIRTUALIZE_THRESHOLD = 100` rows on a single page, it switches into a mode that only renders the rows within the visible scroll window plus an 8-row overscan, using padding `<tr>` elements to preserve scrollbar height (`ResultTable.tsx:9-14, 192-201`):

```ts
// frontend/src/components/ResultTable.tsx:193-201
const virtualize = paginatedData.length > VIRTUALIZE_THRESHOLD;
const visibleCount = Math.ceil(VIRTUAL_VIEWPORT / ROW_HEIGHT);
const startRow = virtualize ? Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN) : 0;
const endRow = virtualize ? Math.min(paginatedData.length, startRow + visibleCount + OVERSCAN * 2) : paginatedData.length;
```

A small "virtualized" badge is shown next to the row count so this isn't invisible behavior (`ResultTable.tsx:253-257`). This only kicks in when "Rows per page" is set to "All" and the result set is large — the default page size of 10 never triggers it.

### Streaming instead of one big request

The chat's `streamQuery()` (see §11, §22) delivers incremental pipeline-stage updates over a fetch `ReadableStream` rather than waiting for one large JSON response — this is a UX/perceived-performance win more than a raw throughput one, since the user sees "Retrieving schema… → Generating SQL… → Executing…" instead of a static spinner for the same total wall-clock time.

**Common mistakes**
- Adding a new heavy chart/graph library and importing it eagerly at the top of a page component — follow the existing pattern (`lazy()` + `Suspense`) so it doesn't bloat every route's initial bundle.
- Assuming `ResultTable` virtualizes by default — it only activates above 100 rows *on the current page*, so a 500-row result paginated at 10/page never virtualizes; only "All" with >100 rows does.
- Wrapping every child component in `React.memo` "for performance" — this codebase doesn't do that, and doing it inconsistently without profiling first tends to add complexity without measurable benefit here.

**What a beginner should remember**
This app's performance strategy is mostly about *not loading things you don't need yet* (route + component lazy-loading) rather than exotic render optimization. If you're adding a new page or a new heavy widget, the first question is "does this need `lazy()`?", not "does this need `useMemo()`?".

---

## 16. Responsive Design

The app is a fixed-sidebar, single-page dashboard layout (`Layout.tsx`), and responsiveness is handled almost entirely with Tailwind's `sm:`/`md:`/`lg:` breakpoint prefixes rather than separate mobile components. The underlying idea behind a breakpoint prefix like `md:static` is "apply this utility class only when the viewport is at least this wide" — so a single element can carry two (or more) conflicting-looking utility classes (e.g. `fixed` and `md:static`) where only one is ever actually in effect at a time, depending on screen width. This is what lets one JSX tree serve both mobile and desktop without a separate `MobileLayout`/`DesktopLayout` component pair to keep in sync.

### Sidebar: overlay on mobile, static + resizable on desktop

`Layout.tsx:319-339` computes the sidebar's on-screen behavior from three independent states — `collapsed` (icon-only), `sidebarWidth` (200–420px, desktop drag-resize via `startResize`, `Layout.tsx:239-258`), and `mobileOpen` (slide-in overlay):

```tsx
// frontend/src/components/Layout.tsx:330-339
<aside
  style={{ width: computedWidth, minWidth: computedWidth }}
  className={cn(
    'fixed inset-y-0 left-0 z-40 flex h-screen flex-col ...',
    'md:static',
    mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    !isResizing ? 'transition-[transform,width] duration-300 ease-in-out' : 'transition-none',
  )}
>
```

Below the `md` breakpoint the sidebar is `fixed` and translated fully off-screen unless `mobileOpen` is true, at which point a `fixed inset-0 z-30` backdrop (`Layout.tsx:320-327`) darkens the rest of the app and a hamburger button in the header (`Menu` icon, `md:hidden`) toggles it. At `md:` and above, the sidebar becomes `md:static` and part of the normal flex flow — no overlay, no backdrop, just a real column with an in-page resize handle (`hidden md:block`, `Layout.tsx:684-691`).

### Grid layouts

Nearly every list/card page uses the same escalating-column pattern: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (dashboards list, `DashboardsPage.tsx:311, 323`), `sm:grid-cols-2 lg:grid-cols-4` (analytics stat cards, `AnalyticsPage.tsx:175, 314`; training stat cards, `TrainingPage.tsx:226`), or `sm:grid-cols-3 lg:grid-cols-5` (home page quick stats, `HomePage.tsx:282`). This is a deliberate, repeated convention rather than one-off styling.

### Header and content collapsing

`Layout.tsx`'s top header hides secondary text below `sm:` (`hidden truncate ... sm:block`, `Layout.tsx:727`) and hides the "Connected/Offline" label text the same way (`Layout.tsx:753`) while keeping the status dot always visible — the pattern is "keep the icon, drop the label" rather than hiding entire features on small screens.

### Chat + side-panel split

`QueryPage.tsx:91-92` toggles between a full-width chat (`w-full`) and a 50/50 split (`w-1/2` for both the chat and the schema graph / query builder panel) once `showGraph` or `showQueryBuilder` is true — there is no distinct mobile layout for this split; on a narrow viewport the two 50%-width panels simply become cramped rather than stacking, which is a real gap (see Common mistakes below).

**Common mistakes**
- Assuming the graph/query-builder split panels in `QueryPage.tsx` are mobile-aware — they use a fixed `flex-row`/`w-1/2` layout with no `sm:`/`md:` fallback to stack vertically on narrow screens; testing this feature only at desktop width will miss that gap.
- Hardcoding pixel widths instead of following the `MIN_W`/`MAX_W`/`DEFAULT_W` constants pattern (`Layout.tsx:125-128`) when adding new resizable panels.
- Forgetting the `md:hidden` / `hidden md:flex` pairing that this codebase uses everywhere to swap mobile vs. desktop controls (e.g. the mobile hamburger vs. the desktop collapse button, `Layout.tsx:703-721`) — omitting one half means both or neither render.

**What a beginner should remember**
There's no separate "mobile" component tree here — one JSX tree, styled with responsive Tailwind classes, and `md:` is the app's primary mobile/desktop boundary (sidebar behavior, header labels). If you're not sure where the breakpoint should go, grep the file for how a sibling element already does it.

---

## 17. Accessibility

Accessibility support is real but partial — strong in the two places power users touch most (command palette, keyboard shortcuts) and in a handful of components that were clearly built with ARIA in mind, thinner elsewhere. The reason ARIA attributes (`role`, `aria-expanded`, `aria-label`, etc.) matter even though they're invisible on screen: a screen reader doesn't see pixels, it reads the DOM's *semantic* structure — so a visually-obvious "this is a dropdown, it's currently open, here are its options" has to be spelled out explicitly in attributes, or a screen-reader user gets none of that information even though a sighted user gets it for free just by looking at the rendered box.

### Keyboard navigation

- **Command palette** (`CommandPalette.tsx`): full roving-index keyboard control — `ArrowDown`/`ArrowUp` move `activeIndex`, `Enter` runs the highlighted command, `Escape` closes it (`CommandPalette.tsx:125-138`). The active item auto-scrolls into view (`scrollIntoView({block:'nearest'})`, `CommandPalette.tsx:114-116`), and the input auto-focuses on open (`CommandPalette.tsx:101-108`).
- **Shortcut overlay** (`ShortcutOverlay.tsx`): global listener for `?` (Shift+`/`) that explicitly ignores typing targets (`isTypingTarget()`, `ShortcutOverlay.tsx:31-40`) so it never hijacks a text field, and `Escape` closes it.
- **Global shortcuts**: `Ctrl+K`/`Cmd+K` opens the palette, `Alt+N` starts a new chat from anywhere except a text field (`Layout.tsx:223-237`), `Enter`/`Ctrl+Enter` submits a query, `Shift+Enter` inserts a newline (`QueryInput.tsx:134-137`).
- **Query autocomplete** is a real ARIA combobox: the textarea has `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant` pointing at the highlighted option, and the dropdown itself is `role="listbox"` with `role="option"`/`aria-selected` on each item (`QueryInput.tsx:171-179, 184-207`).

### Focus management

Every modal (`SettingsModal`, `UsageModal`, `ProfileModal`, `CommandPalette`, `ShortcutOverlay`) uses a shared `useFocusTrap(open, contentRef)` hook from `components/ui/dialog` and marks its container `role="dialog"`, `aria-modal="true"`, `aria-label="…"`, `tabIndex={-1}` (e.g. `SettingsModal.tsx:73-78`, `UsageModal.tsx:87-92`). This is a consistent, reusable pattern rather than one-off modal code.

### Live regions and status roles

- The toast container is `aria-live="polite"` with `role="status"` (`toast.tsx:98-100`), so screen readers announce new toasts without stealing focus.
- Route-transition loading spinners use `role="status"` with `aria-label="Loading page"` (`App.tsx:33-37`, `Layout.tsx:768-772`).
- Icon-only buttons throughout the app generally carry a `title` attribute (tooltip + accessible name for many assistive technologies) — e.g. every icon button in `ItemActionsMenu.tsx:33`, `SchedulesPage.tsx`'s run/pause buttons, `DashboardsPage.tsx`'s delete/duplicate icons — though `title` is not a full substitute for `aria-label` in all screen readers.
- Explicit `aria-label` appears on functional icon buttons like the "Dismiss" close buttons in `toast.tsx:119`, `AnalyticsPage.tsx:216`, and the sidebar's open/close/expand/collapse buttons (`Layout.tsx:360, 371, 707, 717`).

### Honest gaps

- Most **data tables** (`ResultTable`, `VersionedSQLDisplay`'s results table, `HistoryPage`'s inline results) are plain `<table>` markup without `scope` attributes on `<th>` or a `<caption>` — functional but not fully screen-reader-optimized for large tables.
- **Color-only status signals** exist in a few places — e.g. the health dot in `Layout.tsx:746-751` pairs a color with a text label (`sm:block`, hidden on narrow screens) so on small viewports the signal briefly becomes color-only until the user reads the `title` tooltip.
- **Drag-and-drop file upload** (`SchemaPage.tsx`'s schema uploader) has a hidden `<input type="file">` with a `<label>` (keyboard-operable via click-through), but the drag-over visual state itself (`dragActive`) has no parallel `aria-live` announcement.
- No global "skip to content" link or explicit heading-level (`h1`/`h2`) audit was found across pages; several pages use `<h1>` consistently for the page title (good), but nested section headers are mixed between `<h2>`/`<h3>`/styled `<p>` rather than a strict heading outline.

**Common mistakes**
- Adding a new icon-only button without a `title` or `aria-label` — grep any existing icon button in `ItemActionsMenu.tsx` or the sidebar for the expected pattern before shipping a new one.
- Building a new modal from scratch instead of reusing `useFocusTrap` + the `role="dialog"`/`aria-modal` markup already established by `SettingsModal`/`UsageModal`/`ProfileModal`.
- Assuming `?` always opens the shortcuts overlay — it's suppressed while any input/textarea/select/contenteditable has focus (`isTypingTarget`), which is correct behavior but easy to "rediscover" as a bug if you don't check `ShortcutOverlay.tsx` first.

**What a beginner should remember**
When you need a new interactive overlay (menu, modal, palette), first look at how `CommandPalette.tsx` or `SettingsModal.tsx` does it — focus trap, `role`, `aria-*`, and `Escape`-to-close are already solved problems in this codebase; don't re-derive them.

---

## 18. Build & Deployment

### Local development

`npm run dev` runs `vite` (`package.json:7`) using `vite.config.ts`, which registers the React and Tailwind v4 Vite plugins and proxies `/api`, `/health`, `/ready` to `http://127.0.0.1:8000` (the local FastAPI backend) so the frontend dev server and backend can run on different ports without CORS friction (`vite.config.ts:13-20`). Dev server listens on port `3000`.

### Production build

`npm run build` runs `tsc && vite build` (`package.json:8`) — a full TypeScript typecheck (no emit needed since Vite handles bundling) followed by the Vite production build into `dist/`. `npm run preview` serves that `dist/` build locally via Vite's built-in preview server, useful for a final sanity check before deploying.

### Tests

`npm run test` runs `vitest run` (CI mode, one pass); `npm run test:watch` runs it interactively. See §19 for a full walkthrough of the test setup, what's actually covered, and how to write a new test.

### Docker (multi-stage)

`Dockerfile` builds in two stages:
1. **Builder** (`node:22-alpine`): `npm ci` (lockfile-exact install) then `npm run build` — produces `/app/dist`.
2. **Runtime** (`nginx:1.27-alpine`): copies the custom `nginx.conf` and the built `dist/` output only — no Node.js, no source code, no `node_modules` in the final image.

A `HEALTHCHECK` hits `/health.txt` every 30s (`Dockerfile:27-28`), which `nginx.conf` serves as a static 200 stub (`nginx.conf:40-44`) independent of backend health — this checks "is nginx serving the SPA" not "is the backend reachable."

### Nginx routing

`nginx.conf` does three jobs beyond serving static files:
- **Security headers** on every response (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `nginx.conf:9-13`).
- **Reverse proxying** `/auth/` and `/api/` to `http://backend:8000` (a Docker Compose service name), with `/api/` specifically disabling proxy buffering (`proxy_buffering off`) and setting 120s read/send timeouts — required because the chat's `streamQuery` SSE-style responses and long-running NL-to-SQL generation would otherwise be buffered or timed out (`nginx.conf:57-77`).
- **SPA fallback**: `try_files $uri $uri/ /index.html` (`nginx.conf:80-82`) so client-side routes like `/dashboards` or `/schema` resolve correctly on a hard refresh instead of 404ing.

**A discrepancy worth knowing about:** `nginx.conf:44-52` has a dedicated `location /auth/` block, separate from `/api/`, with a comment stating the router is "mounted at `/auth/`, not under `/api/`." But every actual auth call this frontend makes is prefixed `/api/v1` — `AuthContext.tsx` calls `${API_BASE}/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, and `/auth/google` where `API_BASE = ${VITE_API_BASE_URL}/api/v1` (`AuthContext.tsx:86,147,167,202,216,230,241,250`), and `apiClient.post('/auth/logout')` (`AuthContext.tsx:262`) goes through `apiClient`, whose `baseURL` is also `/api/v1` (`client.ts:221`). So every real auth request actually resolves to `/api/v1/auth/...` and is handled by the `/api/` location block, not `/auth/`. The dedicated `/auth/` block appears to be vestigial for this frontend as currently built — useful to know before "fixing" a perceived auth-routing bug that isn't actually reachable.

### Vercel deployment

`vercel.json` is a second, alternate deployment target: `buildCommand: npm run build`, `outputDirectory: dist`, and two rewrites — `/api/:path*` proxied to a hardcoded AWS backend IP, and a catch-all SPA fallback to `/index.html` (`vercel.json:1-8`). This means the same `dist/` build artifact can be served either behind the project's own nginx/Docker stack or directly from Vercel's edge network, depending on which config is active for a given deploy.

### Environment variables

Vite only exposes environment variables prefixed `VITE_` to client code via `import.meta.env.VITE_*` (a Vite convention, not app-specific code) — confirmed in use at `App.tsx:29` (`VITE_GOOGLE_CLIENT_ID`) and `client.ts:221` (`VITE_API_BASE_URL`, used to build axios's `baseURL`). `.env.example` documents exactly two variables: `VITE_API_BASE_URL` (required in production — "Full URL of your deployed AWS backend") and `VITE_GOOGLE_CLIENT_ID` (optional — omitting it disables the Google login button). The repo's own (gitignored, per `.gitignore:2-6`) `.env` and `.env.production` files confirm the standard Vite convention is in use here too — both define exactly the same two `VITE_API_BASE_URL`/`VITE_GOOGLE_CLIENT_ID` keys as `.env.example`, just with real values for each environment. See "Getting Started" at the top of this guide for the full env-var reference table.

**Common mistakes**
- Forgetting the `VITE_` prefix on a new environment variable — Vite silently omits unprefixed variables from `import.meta.env` in client bundles, which reads as "my env var is undefined in production" with no error.
- Adding a new streaming/SSE endpoint without updating `nginx.conf`'s `proxy_buffering off` block for that path — buffered responses will appear to "hang" until the full response completes, defeating the purpose of streaming.
- Running `vitest` with the app's real `vite.config.ts` (e.g. by merging configs) — the Tailwind plugin isn't needed in tests and was explicitly excluded; re-adding it slows down every test run for no benefit.

**What a beginner should remember**
There are two independent "final destinations" for a build: the Docker/nginx image (used for the docker-compose / AWS EC2 path, given `vercel.json`'s AWS IP) and Vercel's own rewrite-based routing. Both start from the exact same `npm run build` output — you're not maintaining two different builds, just two different ways of serving one `dist/` folder.

---

## 19. Testing

### Tooling

Tests run on **Vitest** with a **jsdom** environment, configured in `frontend/vitest.config.ts` — deliberately *not* a reuse of `vite.config.ts`. The file's own comment explains why: *"Separate from vite.config.ts so the Tailwind plugin (not needed for tests) stays out of the test pipeline"* (`vitest.config.ts:5-6`). It sets `environment: 'jsdom'`, `globals: true` (so `describe`/`it`/`expect` don't need importing in every file — though the repo's test files import them explicitly from `'vitest'` anyway), `include: ['src/**/*.{test,spec}.{ts,tsx}']`, and points `setupFiles` at `src/test/setup.ts`.

`src/test/setup.ts` does two things, and is short enough to read in full:
```ts
// frontend/src/test/setup.ts
import '@testing-library/jest-dom/vitest'
;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
```
It extends Vitest's `expect` with `jest-dom` matchers (`toBeInTheDocument()`, etc.), and flags the global scope as a React `act()` test environment so React doesn't warn about state updates happening outside of `act()`. Its own comment explains a deliberate omission: `@testing-library/react` is **not** imported here, because its required peer `@testing-library/dom` isn't installed — even though `@testing-library/react`, `@testing-library/jest-dom`, and `@testing-library/user-event` are all present in `package.json`'s `devDependencies`. In practice this means the ergonomic `render()`/`screen.getByText()` API most React codebases use for component tests **doesn't work here today**, and component tests fall back to driving `react-dom/client` directly (see below).

### What's actually tested (two files, two different styles)

**Pure-function tests — `utils/chart.test.ts`.** No DOM, no React — just `describe`/`it`/`expect` against `guessChartConfig`, `recommendChart`, and `columnsFromRow` from `utils/chart.ts`. This is the simplest, cheapest kind of test in the app and the one to copy for any new pure function:
```ts
// frontend/src/utils/chart.test.ts:14-20
it('picks the first non-numeric column as X and the first numeric as Y', () => {
  const config = guessChartConfig([
    { category: 'A', revenue: 100, cost: 40 },
    { category: 'B', revenue: 200, cost: 90 },
  ]);
  expect(config).toEqual({ type: 'bar', x_axis: 'category', y_axis: 'revenue' });
});
```
It's also the only place in the codebase where `recommendChart`'s full decision table (map → line → bar → scatter → histogram → kpi → table fallback) is exercised end to end — reading this file top to bottom is a fast way to learn the heuristic without reading `utils/chart.ts` itself.

**Component tests — `components/ResultTable.test.tsx`.** Because `@testing-library/react`'s `render()` isn't usable (see above), this file renders directly via `react-dom/client`:
```ts
// frontend/src/components/ResultTable.test.tsx:1-11 (imports + setup)
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import ResultTable from './ResultTable';
// ...
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
```
Every render is wrapped in `act(() => { root.render(<ResultTable response={...} />); })` so React flushes effects/state updates synchronously before assertions run, and every interaction (a header click to sort, a cell click to copy) is likewise wrapped in `act(...)` rather than using Testing Library's `fireEvent`/`userEvent`. Element lookups are hand-rolled helpers (`headerCells()`, `firstColumnValues()`, `findByExactText()`, `ResultTable.test.tsx:40-56`) using plain `container.querySelectorAll(...)` instead of `screen.getByText(...)`. One more thing worth noticing: jsdom has no `navigator.clipboard` by default, so the clipboard test stubs it manually with `Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn()... } })` (`ResultTable.test.tsx:62-66`) before asserting `expect(navigator.clipboard.writeText).toHaveBeenCalledWith('30')` — a good template for testing any other clipboard-touching component (e.g. `SqlPreview`'s Copy button).

### How to add a new test

- **A new pure function** (in `utils/` or similar) → copy `chart.test.ts`'s shape: plain `describe`/`it`/`expect`, no DOM setup needed.
- **A new component** → copy `ResultTable.test.tsx`'s `beforeEach`/`afterEach` `createRoot` + `act()` scaffolding, and write your own small `querySelector`-based helpers rather than reaching for `screen.getByText` — it isn't wired up in this project today. (If a future contributor adds `@testing-library/dom` to `package.json`, the already-present `@testing-library/react`/`user-event` packages would start working immediately, and `render()`/`screen`/`fireEvent` could replace this pattern — but that migration hasn't happened yet.)
- Name the file `*.test.ts`/`*.test.tsx` next to the file it tests (both existing tests are colocated with their source, not in a separate `__tests__/` tree) — `vitest.config.ts`'s `include` glob picks up anything matching that pattern anywhere under `src/`.

### Running tests

```
npm run test        # vitest run  — single pass, exits with a code, CI-friendly
npm run test:watch  # vitest      — interactive, re-runs on file change
```

### Honest coverage gap

As of this guide, exactly **two** test files exist in the entire frontend: `utils/chart.test.ts` and `components/ResultTable.test.tsx`. There is no test for `useChat.ts`, `useSettings.ts`, `AuthContext.tsx`, `api/client.ts`, or any page component — the chat flow, auth flow, and every dashboard page (§12) are currently untested. There's also no coverage reporting configured (`package.json` has no `--coverage` flag on the `test` script, and no `c8`/`istanbul`/`@vitest/coverage-v8` package is listed in `devDependencies`), so there's no automated signal for how much of the app tests actually exercise.

**Common mistakes**
- Importing `render`/`screen` from `@testing-library/react` in a new test file — it will fail (or behave unexpectedly) because the required peer `@testing-library/dom` isn't installed; follow `ResultTable.test.tsx`'s `createRoot`+`act()` pattern instead.
- Forgetting to wrap a state-changing interaction (a `.click()`, a `root.render(...)`) in `act(...)` — React will warn ("not wrapped in act(...)") and the assertion immediately after may read stale DOM.
- Assuming a passing `npm run test` means a feature is well-tested — with only two test files in the whole app, "tests pass" mostly means "these two specific files' behavior hasn't regressed," not "the app works."

**What a beginner should remember**
This project's test setup is real but intentionally small: Vitest + jsdom, no Testing Library `render()` (a documented, deliberate gap, not an oversight), and only two files under test. If you're adding a new pure function, write a `chart.test.ts`-style test for it — that's the highest-leverage, lowest-friction testing you can do here today.

---

## 20. How to Add a New Page

Walking through this using `MetricsPage.tsx` as the template (it's one of the simpler, self-contained pages — list + create form + per-item card, no sub-detail view).

### Step 1 — Create the page file

Create `frontend/src/pages/YourPage.tsx`. Follow the shape every list page uses:

```tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getYourThings, createYourThing, handleApiError, type YourThing } from '../api/client';
import { toast } from '../components/ui/toast';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

export default function YourPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['your-things'],
    queryFn: () => getYourThings(),
  });

  const createMutation = useMutation({
    mutationFn: (payload: YourThingInput) => createYourThing(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['your-things'] }),
    onError: (e) => toast({ title: handleApiError(e), variant: 'error' }),
  });

  // ...loading / empty / list states, mirroring MetricsPage.tsx or TemplatesPage.tsx
}
```

Add the corresponding typed functions and interfaces to `frontend/src/api/client.ts` (see §22) if they don't exist yet — every page in §12 imports its data functions from there, never calls `apiClient.get(...)` inline except in a couple of legacy spots (`SavedQueriesPage.tsx`, `UsagePanel.tsx`).

### Step 2 — Register the route in `App.tsx`

Add a lazy import next to the others (`App.tsx:14-27`):

```ts
const YourPage = lazy(() => import('./pages/YourPage'));
```

Then add a `<Route>` inside the protected `<Layout />` route block (`App.tsx:75-88`):

```tsx
<Route path="your-page" element={<YourPage />} />
```

It automatically inherits the `<ProtectedRoute>` auth guard and the `<Suspense fallback={<RouteFallback />}>` wrapper — you don't add either yourself.

### Step 3 — Add a nav entry in `Layout.tsx`

Pick primary (`primaryNavItems`, always visible) or secondary (`secondaryNavItems`, tucked behind "More") depending on expected frequency of use (`Layout.tsx:55-71`):

```ts
{ to: '/your-page', end: false, icon: YourIcon, label: 'Your Page' },
```

Also add a title/subtitle entry to `pageMeta` (`Layout.tsx:75-88`) so the header shows something other than the generic fallback:

```ts
'/your-page': { title: 'Your Page', subtitle: 'One-line description' },
```

### Step 4 — Wire it into the command palette (optional but expected)

Add an entry to `COMMANDS` in `CommandPalette.tsx:46-76` so `Ctrl+K` search can jump straight to it — every existing page has one.

### Step 5 — Add an API hook if the page needs shared logic

If multiple components will need the same query (e.g. a `useYourThing()` hook analogous to `useSchema.ts`/`useSettings.ts`), add it under `frontend/src/hooks/`. Simple pages (Metrics, Templates, Schedules) inline their `useQuery`/`useMutation` calls directly in the page instead of extracting a hook — only extract one when logic is genuinely reused (as `useChat`/`useSchema`/`useSettings` are).

**Common mistakes**
- Adding the route but forgetting the nav entry — the page becomes reachable only by typing the URL directly, which is easy to miss in review.
- Skipping `lazy()` and importing the page eagerly — breaks the route-level code-splitting convention (§15) and silently grows every other route's initial bundle.
- Not adding a `pageMeta` entry — the header falls back to the generic `{ title: 'NL-to-SQL', subtitle: 'Query in plain English' }` (`Layout.tsx:311`), which is a visible regression on your new page.

**What a beginner should remember**
A new page touches exactly three files at minimum: the page itself, `App.tsx` (route), and `Layout.tsx` (nav + `pageMeta`). If you only touched one, you probably forgot something.

---

## 21. How to Add a New Component

There are three distinct places a component can live, and the choice isn't arbitrary:

- **`components/ui/`** — generic, app-agnostic primitives styled with `cva` (class-variance-authority-style variant builder from `@/lib/cva`) — `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `badge.tsx`, `toast.tsx`. These have no knowledge of NL2SQL domain concepts.
- **`components/`** (top level) — domain-aware but reusable across multiple pages — `ResultTable.tsx`, `SqlPreview.tsx`, `DataChart.tsx`, `ItemActionsMenu.tsx`, `ConfirmDestructive.tsx`. These know about `QueryResponse`/SQL/charts but aren't tied to one specific page.
- **`features/<feature-name>/`** — a component (or small cluster) that only makes sense in service of one specific feature area, even if it's rendered from multiple places — `features/connections/ConnectionsManager.tsx`, `features/settings/*.tsx`, `features/usage/UsagePanel.tsx`.

### Worked example: adding a new small utility component

Follow `InfoTip.tsx` (the simplest real component in the codebase) as a template for a stateless, prop-driven component:

```tsx
// frontend/src/components/InfoTip.tsx (full file, 13 lines)
export default function InfoTip({ text }: { text: string }) {
  return (
    <span className="group relative ml-1.5 inline-flex items-center align-middle">
      <span className="flex h-4 w-4 ... group-hover:text-primary/70">i</span>
      <span className="pointer-events-none absolute ... opacity-0 group-hover:opacity-100">{text}</span>
    </span>
  );
}
```

Notes worth copying: (1) a single typed props interface inlined in the function signature for a small component — no separate `interface Props` unless there are 3+ props; (2) Tailwind's `group`/`group-hover:` for parent-triggered child styling instead of local `useState` + `onMouseEnter`; (3) `export default` for single-purpose components (multi-export files like `ui/dropdown-menu.tsx` or `ui/dialog.tsx` use named exports instead).

### Worked example: a `cva`-styled variant component

`ui/button.tsx` is the reference for anything that needs multiple visual variants:

```ts
// frontend/src/components/ui/button.tsx:5-29
export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 ...",
  {
    variants: {
      variant: { default: "...", secondary: "...", outline: "...", ghost: "...", destructive: "...", link: "..." },
      size: { default: "h-10 px-4 py-2", sm: "h-8 rounded-md px-3 text-xs", lg: "...", icon: "h-9 w-9" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
```

The component itself is a thin `React.forwardRef` wrapper that merges `buttonVariants({variant, size})` with any caller-supplied `className` via `cn()` (`ui/button.tsx:36-40`). Any new `ui/` primitive needing variants (a new badge type, a new alert style) should follow this exact `cva` + `forwardRef` + `cn()` shape rather than inventing a new styling approach.

### Worked example: a domain component with actions

`ItemActionsMenu.tsx` is a good template for "overflow menu of secondary actions" — it takes a typed `ActionItem[]` prop (`key`, `label`, `icon`, `onClick`, optional `destructive`/`disabled`) and renders them through the existing `DropdownMenu` primitives rather than building a new menu from scratch (`ItemActionsMenu.tsx:10-56`). Every list page (`DashboardsPage`, `SchedulesPage`, `MetricsPage`, `TemplatesPage`) reuses this one component instead of each rolling its own "..." menu.

### Exporting and using it

- Default-export single-purpose components (`export default function X` or `const X = () => {}; export default X`).
- Import with the `@/` alias for anything under `src/` when the relative path would otherwise be noisy (`@/components/ui/button`), or a relative path for same-directory/nearby files (`../components/QueryInput`) — both conventions coexist in this codebase; follow whichever the *file you're editing* already uses.
- Styling is Tailwind utility classes directly in JSX, composed with the `cn()` helper (a `clsx`/`tailwind-merge`-style utility from `@/lib/utils`) whenever a class list needs to be conditional — never a separate `.css`/`.module.css` file per component.

**Common mistakes**
- Putting a page-specific component in `components/` instead of colocating it in the page file (as `AnalyticsPage.tsx`, `SchemaPage.tsx`, and `TemplatesPage.tsx` all do with their `MetricCard`/`SchemaTablesSection`/`TemplateCard`/`RenderPanel` sub-components) — this codebase's convention is: reusable across pages → `components/`; single-page-only → define it inline in that page's file.
- Reaching for a new CSS file or inline `style={{...}}` object for anything Tailwind can express — the entire codebase (with the narrow exception of computed pixel values like `sidebarWidth` or chart SVG export) is Tailwind-only.
- Skipping `cn()` when merging a base class string with a conditional/override class — string concatenation breaks Tailwind's class-merge semantics (e.g. conflicting `px-*` utilities) in ways `cn()`/`tailwind-merge` is specifically designed to avoid.

**What a beginner should remember**
Ask "does this get used on more than one page?" — no → keep it inside that page's `.tsx` file as a local function component; yes but generic → `components/`; yes and it's a whole feature area (settings tab, connections manager) → `features/<name>/`.

---

## 22. How Frontend Connects to Backend

**End-to-end example: submitting a natural-language question.**

```mermaid
sequenceDiagram
    actor User
    participant QI as QueryInput.tsx
    participant UC as useChat.ts
    participant AC as api/client.ts
    participant NG as nginx (proxy_buffering off)
    participant FA as FastAPI /api/v1/query/stream
    participant DB as Postgres / vector store

    User->>QI: click Submit
    QI->>UC: onSubmit(dialect, execute)
    UC->>UC: validate length, setPendingQuestion, getOrCreateSession()
    UC->>AC: streamQuery({question, dialect, execute, session_id}, onChunk, signal)
    AC->>AC: fetch('/api/v1/query/stream', {headers: {Authorization: Bearer <JWT>}})
    AC->>NG: HTTP POST (SSE-style body)
    NG->>FA: proxy_pass, buffering disabled, 120s timeouts
    FA->>DB: retrieve schema context, generate + validate + (optionally) execute SQL
    FA-->>NG: chunked response, one JSON object per line
    NG-->>AC: streamed unbuffered
    AC->>AC: reader.read() loop, decode + split on newlines
    AC->>UC: onChunk({stage:"generating_sql"}) ... onChunk({status:"complete", data})
    UC->>UC: append ChatMessage, invalidate ['sessions','recent']
    UC->>QI: isLoading=false, clears pendingQuestion
```

### 1. The click

`QueryInput.tsx:140-144`'s `handleSubmit` calls the `onSubmit` prop, which `QueryPage.tsx:156` binds to `useChat`'s `sendMessage(dialect, execute)`.

### 2. Client-side prep

`useChat.ts:242-280`'s `submitQuery`: length-validates, optimistically shows the question, ensures a session exists (`getOrCreateSession`, creating one via `createSession()` — a plain `apiClient.post('/sessions')` call — if this is the first message), then calls `queryMutation.mutate({question, dialect, execute, session_id, ...})`.

### 3. The actual network call — `streamQuery`

Unlike every other function in `api/client.ts` (which go through the shared `apiClient` axios instance with its interceptors), `streamQuery` uses the raw `fetch` API directly (`client.ts:417-433`) because it needs to read the response body incrementally as a stream — axios's response transformation doesn't support that. It manually attaches the JWT:

```ts
// frontend/src/api/client.ts:422-433
const token = getToken();
const authHeaders = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
const response = await fetch('/api/v1/query/stream', { method: 'POST', headers: authHeaders, body: JSON.stringify(req), signal });
```

If the response isn't OK, a 401 triggers `forceReauth()` directly (`client.ts:436-438`) — this path bypasses the axios interceptor's refresh-and-retry logic entirely, since `fetch` has no interceptors, so a 401 on the streaming endpoint goes straight to logout rather than a silent token refresh.

### 4. Through nginx (production) or Vite's dev proxy (local)

In production, `nginx.conf:57-77` proxies `/api/` to the `backend` Docker service, with `proxy_buffering off` and a 120s `proxy_read_timeout`/`proxy_send_timeout` specifically so this long-running, streamed response isn't buffered into one lump or killed by a default timeout. In local dev, `vite.config.ts:14-19`'s dev-server proxy does the equivalent job, forwarding `/api` to `http://127.0.0.1:8000`.

### 5. Backend endpoint

The route is `POST /api/v1/query/stream` — this documentation doesn't re-derive the backend's internal pipeline (retrieval → generation → validation → optional execution), but from the frontend's perspective it's a chunked response where each line is a JSON object with either a `stage` field (pipeline progress) or a terminal `{status: "complete", data: QueryResponse}` / `{status: "error", error, type}`.

### 6. Reading the stream back

`streamQuery`'s reader loop (`client.ts:449` onward, not fully shown here) decodes bytes, splits on newlines, `JSON.parse`s each complete line, and calls `onChunk()` for each one. `useChat.ts:123-139` is that `onChunk` callback: it throws (aborting the mutation) on an error chunk, calls `pushStep(chunk.stage, detail)` on a progress chunk, and captures `chunk.data` when `status === 'complete'`.

### 7. UI update

Back in `useChat.ts:152-186`'s `onSuccess`, the new message is appended to `currentSession.messages` immediately (avoiding a race with the backend's own DB commit), the sidebar's `['sessions','recent']` query is invalidated so the new/updated session title appears there too, and — belt-and-suspenders — a background `getSession(sessionId)` re-fetch 300ms later reconciles with the server's real, persisted message IDs. `ChatWindow` re-renders with the new message, and `SqlPreview`/`ResultTable`/`DataChart` render the SQL, rows, and chart respectively (§11).

**Common mistakes**
- Assuming all backend calls go through `apiClient` and therefore get automatic 401-refresh — `streamQuery` (fetch-based) explicitly does not; any other fetch-based call you add will need to handle 401 itself.
- Forgetting that the frontend's `/api/v1` prefix (`client.ts:221`) must match whatever nginx/Vite is proxying — changing one without the other silently 404s every request.
- Not accounting for `AbortController` — `useChat.ts:117-119` aborts any in-flight stream before starting a new one, and `abortQuery()` (bound to the Stop button, `QueryInput.tsx:299-307`) sets `abortedRef.current = true` first so the resulting `AbortError` is treated as an intentional cancel, not a real error (`useChat.ts:193-195`).

**What a beginner should remember**
`api/client.ts` is the *only* file that should know how to talk to the backend — every page/component imports typed functions from it (`getDashboards`, `createSchedule`, `streamQuery`, …) rather than calling `axios`/`fetch` directly. The one recurring exception, `apiClient.get('/saved-queries', ...)` inline in `SavedQueriesPage.tsx`, is a spot where that convention slipped — new code should still add a named function to `client.ts` rather than repeat that pattern.

---

## 23. Frontend Interview Questions

### Beginner

**Q1. Why does `QueryPage.tsx` contain almost no state of its own?**
Because all chat state and network logic live in the `useChat` custom hook (`hooks/useChat.ts`); the page's own doc comment calls it "a thin composition layer over the useChat hook" (`QueryPage.tsx:1-5`). This keeps the page a pure wiring/props layer, which makes it easy to test the logic (the hook) separately from the presentation (the page).

**Q2. What's the difference between `validationError` and `validation_errors` in the chat flow?**
`validationError` (singular, `useChat.ts`) is a client-side, pre-request check (e.g. question too short) shown inline under the input box. `validation_errors` (plural, on `QueryResponse`) is server-side SQL validation feedback that arrives *inside a successful HTTP response* and is rendered persistently in the AI's chat bubble (`ChatWindow.tsx:212-227`) — it describes a property of that answer, not a failed request.

**Q3. Why is `SchemaGraph` wrapped in `lazy()` and `Suspense` instead of imported normally?**
Because it depends on `@xyflow/react`, a heavy library only needed when the user opens the schema-graph panel. Importing it eagerly would bloat the initial bundle for every user, even those who never click "Show Graph" (`QueryPage.tsx:15-16`).

**Q4. How does the sidebar know whether to show icon-only or full nav labels?**
Via the `isIconMode = collapsed && !mobileOpen` computed flag in `Layout.tsx:316` — collapsed desktop state hides labels, but the mobile overlay always shows full labels regardless of the `collapsed` setting, since `mobileOpen` overrides it.

**Q5. Why does `ResultTable` show "No rows returned" differently from an execution error?**
Because they mean different things to a user: `displayError` (a failed SQL execution, `ResultTable.tsx:44-56`) means something broke; an empty `displayResult` array (`ResultTable.tsx:61-68`) means the query ran fine but matched nothing. Conflating them would make a perfectly valid "zero results" query look like a bug.

### Intermediate

**Q6. Why does `streamQuery` use `fetch` instead of the shared `apiClient` axios instance?**
Axios doesn't give convenient incremental access to a streaming response body the way the Fetch API's `ReadableStream` does. Since the chat needs to render pipeline-stage progress *as it happens* (not after the full response completes), `client.ts:417-433` bypasses axios and its interceptors entirely for this one call — which is also why it has to handle 401 manually (`forceReauth()` inline) instead of getting the axios interceptor's refresh-and-retry.

**Q7. Walk through what happens when two requests get a 401 at the same time.**
`refreshAccessToken()` (`client.ts:284-292`) is single-flight: the first 401 kicks off `performTokenRefresh()` and stores the in-flight promise in `refreshPromise`; a second concurrent 401 reuses that same promise instead of starting a second refresh call. Once it settles, the shared slot is cleared (`p.finally(...)`) so a future 401 can trigger a fresh refresh. Without this, two concurrent 401s could mint two token pairs, and one would be invalidated by the other's rotation.

**Q8. Why does `ResultTable` only virtualize above 100 rows, and only sometimes?**
Virtualization (`ResultTable.tsx:9-14, 192-201`) is scoped to the *currently rendered page* of results, not the entire result set. With the default page size of 10, a 10,000-row result never virtualizes because each page only ever has 10 rows. It only activates when a user explicitly selects "All" rows-per-page and the result set exceeds `VIRTUALIZE_THRESHOLD`. This is a deliberate scope-reduction: pagination already keeps typical DOM size small, so virtualization only needs to cover the "show everything" escape hatch.

**Q9. How does the app decide what chart to render for a chat answer, and why is `guessChartConfig` separate from `recommendChart`?**
`ChatWindow.tsx:248-268` prefers the LLM's own `suggested_chart` field on the response; if that's missing or `'none'`, it falls back to `guessChartConfig()` (`utils/chart.ts`), a simple "first numeric column = Y, first non-numeric = X" heuristic. `recommendChart()` is a separate, more sophisticated heuristic (geo → map, temporal+numeric → line, two-numeric → scatter, etc.) used specifically for dashboard widgets (`DashboardsPage.tsx`'s `widgetChartConfig`) where there's no LLM-provided suggestion at all and richer column type metadata (from the schema catalog) is available to reason about.

**Q10. Why does `HistoryPage`'s delete mutation snapshot *every* cached `['sessions', …]` query instead of just the one currently displayed?**
Because the sessions list is cached under multiple query keys simultaneously (e.g. `['sessions', 50]` for the sidebar vs. `['sessions', limit]` for the History page's own paginated view). `queryClient.getQueriesData({queryKey: ['sessions']})` (`HistoryPage.tsx:73-75`) matches *all* of them by prefix, so the optimistic delete patches every visible list at once, not just the page you happen to be looking at — otherwise the sidebar could show a session the History page had already optimistically removed.

**Q11. Why do some pages call `apiClient.get(...)` directly instead of importing a typed function from `client.ts`?**
It's a convention slip, not a deliberate pattern — `SavedQueriesPage.tsx:63-72` and `UsagePanel.tsx:28` both do this. The established convention (used by every other page reviewed) is to add a named, typed function to `api/client.ts` and import that, so the backend contract lives in one place and benefits from the shared axios interceptors, typed responses, and `handleApiError` compatibility.

### Advanced

**Q12. The `SqlPreview` component skips fetching saved SQL versions when `messageId > 2_147_483_647`. Why that specific number, and what would break without the check?**
`2_147_483_647` is `2^31 - 1`, the max value of a signed 32-bit integer — the backend's message primary key is presumably a Postgres `int`/`serial`. Optimistic chat messages are keyed client-side by `Date.now()` (`useChat.ts:163`), a millisecond epoch timestamp that's comfortably larger than that limit. Without the guard (`SqlPreview.tsx:52`), the app would fire a `getSQLVersions(messageId)` request with an out-of-range ID for every not-yet-persisted message, which the backend would either reject or (worse) silently coerce/overflow depending on the driver.

**Q13. Explain the race condition `useChat.ts`'s `onSuccess` handler is working around, and how it's mitigated.**
When a query completes, the frontend needs the new message reflected in `currentSession.messages`, but the backend's DB write (session commit) may not have finished by the time the streaming response signals completion. `useChat.ts:159-186` mitigates this by (1) immediately splicing a locally-constructed message object into state so the UI updates with zero perceived latency, then (2) invalidating the sidebar's `['sessions','recent']` query, and (3) after a fixed 300ms delay, re-fetching the full session from the server and swapping in the "real" version *only if* the message count still matches what's expected — a lightweight compare-and-swap that avoids overwriting fresher local state with a stale server response if the user has since sent another message.

**Q14. Why does the axios response interceptor deliberately exclude 401 from the generic error toast, and what's the failure mode if a future contributor "fixes" that by removing the check?**
401 means the current session is dead — the correct UX is a silent, transparent refresh-and-retry, or (if refresh fails) a redirect to `/auth`. `notifyApiError`'s `if (err.status === 401) return;` (`client.ts:328`) exists so a user never sees a scary "Unauthorized" toast for what is, from their perspective, an invisible token-rotation implementation detail. If that check were removed, every 401 that hits the refresh path (the common case, since most 401s are just an expired short-lived access token) would flash an error toast for a fraction of a second before the retry silently succeeds — a jarring, confusing UX regression for something that isn't actually an error from the user's point of view.

**Q15. Why is `ExportShareControls` rendered from `SqlPreview` rather than from `ResultTable` or `ChatWindow` directly?**
`SqlPreview` already owns the `response: QueryResponse` object that both the SQL text and (via `response.execution_result`) the row data derive from, so it's the natural place to compose the export/share affordance without threading extra props down through `ResultTable` (whose job is purely to *render* rows, not to know about export formats or share-link creation). This also keeps `ResultTable` reusable in contexts where export/share doesn't make sense (e.g. `SharedQueryView.tsx`, the public token-authed page, renders `ResultTable` alone with no `SqlPreview`/export controls at all — a deliberate omission since a shared, read-only snapshot shouldn't offer to create *another* share link recursively).

**Q16. Contrast how `useMemo` is used in `ResultTable.tsx` versus `HomePage.tsx` — what's the underlying rule for when memoization is worth it here?**
In `ResultTable.tsx`, `useMemo` wraps a genuinely expensive operation (sorting/scanning every row, `ResultTable.tsx:72-109`) that would otherwise re-run on every re-render, including re-renders triggered by unrelated state (e.g. the "Copied" cell-highlight timeout). In `HomePage.tsx`, `useMemo` wraps *derived, cross-source aggregation* (`activity`, merging and sorting three independent query results, `HomePage.tsx:157-190`) — the expense here is less about raw CPU cost and more about referential stability: without memoizing, a new `activity` array on every render would be a new prop reference into any child expecting to `useEffect` off it. The underlying rule this codebase follows: memoize when the computation is either non-trivial (row sorting) or when a stable reference genuinely matters downstream (merged/derived lists feeding other hooks) — not reflexively on every derived value.

**Q17. Why does switching the active database connection invalidate `['schema-tables']` and `['schemaStatus']` but not, say, `['sessions']`?**
Because those two query keys' *data* is scoped to whichever database is currently active — a different connection has different tables, so cached schema data from the previous connection would be actively wrong, not just stale. `ConnectionContext.tsx:64-75`'s `invalidateConnectionScoped` only targets query keys whose content depends on the active connection (`connections`, `schema-tables`, `schemaStatus`, `databaseConfig`) plus the `SchemaGraph`'s `localStorage` cache (§13). Chat sessions (`['sessions', ...]`) aren't connection-scoped in the same way — a session's *messages* are historical records of what was already asked and answered, not a live view into the current database, so there's nothing about them that becomes wrong when the active connection changes.

**Q18. `ResultTable.test.tsx` doesn't use `@testing-library/react`'s `render()`/`screen`. Why not, and what does it do instead?**
`@testing-library/react` is listed in `package.json`'s `devDependencies`, but its required peer `@testing-library/dom` isn't installed — `src/test/setup.ts`'s own comment documents this explicitly (§19). So component tests instead mount directly via `react-dom/client`'s `createRoot`, wrap every render/interaction in React's `act()` to flush state updates synchronously, and query the DOM with plain `container.querySelectorAll(...)` helpers instead of `screen.getByText(...)`. It's a deliberate, documented workaround rather than an oversight — if a future contributor adds `@testing-library/dom` to the project, the already-present Testing Library packages would start working without any test needing to change its *assertions*, only its rendering/query boilerplate.

---

## 24. Troubleshooting & FAQ

Realistic failure modes for this specific codebase, each grounded in the code that actually causes them — not generic React advice.

**"TypeScript is complaining about a field that should exist on a response type."**
You (or a teammate) changed something on the backend and forgot `npm run gen:api` (`package.json:12`). `frontend/src/api/schema.d.ts` is a generated snapshot of the backend's `/openapi.json` at the moment you last ran that command — it drifts silently the instant the backend's schema changes and nobody regenerates it. The intersection-type pattern in `client.ts` (`QueryResponse = Schemas['QueryResponse'] & { needs_clarification?: boolean; ... }`, §8) is the codebase's way of surviving *known* drift for a few fields, but it's a patch, not a substitute — regenerate with the backend running: `npm run gen:api`.

**"The app renders a blank screen for a second (or longer) right after I open it, or right after logging in."**
This is very likely the intended `isBootstrapping` gate (§9), not a bug: `AuthContext`'s mount effect (`AuthContext.tsx:140-186`) validates or refreshes the stored token before the router renders anything (`App.tsx:47,55`, `RouteFallback`). If it hangs longer than expected, check that the backend is actually reachable at whatever `VITE_API_BASE_URL` resolves to — a network call that never resolves (backend down, wrong URL) will hold `isBootstrapping` open indefinitely, since there's no timeout on that initial `GET /auth/me`/`POST /auth/refresh` call.

**"CORS error in the browser console" (dev only).**
This almost always means a request bypassed the dev proxy — either something called `http://127.0.0.1:8000/...` directly instead of a relative `/api/...` path (breaking the same-origin illusion `vite.config.ts:15-19`'s proxy provides), or a new endpoint's path doesn't start with `/api`, `/health`, or `/ready` (the only three prefixes the dev proxy forwards, `vite.config.ts:16-18`) — anything else is served by Vite itself and never reaches the backend at all, which usually looks like a 404, not a CORS error, but is worth ruling out first.

**"`npm run preview` can't reach the backend / every API call 404s, even though `npm run dev` worked fine."**
**Inferred** (reasoned from Vite's documented behavior, not confirmed by running it in this environment): Vite's `server.proxy` (used by `vite dev`, configured in `vite.config.ts:15-19`) is a separate setting from `preview.proxy`, and this repo's `vite.config.ts` only defines `server.proxy` — there's no `preview` block. That means `npm run preview` likely serves the static `dist/` build without any dev-time proxy, so relative `/api/v1/...` calls have nothing behind them unless `VITE_API_BASE_URL` is set to a real, reachable backend URL for that preview session.

**"The Google sign-in button doesn't work / errors when clicked."**
`VITE_GOOGLE_CLIENT_ID` is unset or blank. `.env.example` says outright: "Leave empty to disable Google login button." The button still renders (`AuthPage.tsx:399`, `App.tsx` always wraps the app in `GoogleOAuthProvider`, `App.tsx:97-99`) because there's no conditional check around it — it just fails to authenticate against Google without a real client ID.

**"The chat's 'Thinking…' steps never update, or the whole thing seems to hang until one giant response appears."**
The defining feature of `streamQuery` is that it's *unbuffered* end to end (§4, §22) — anything that buffers the response defeats it. In production, check `nginx.conf`'s `/api/` block still has `proxy_buffering off` (`nginx.conf:69-70`) for the exact path being hit; a new streaming endpoint added *outside* that location block won't inherit the setting. In dev, the Vite proxy doesn't buffer by default, so this symptom in dev is more likely a corporate proxy/antivirus/browser extension interfering with the `fetch` `ReadableStream`, or simply the backend pipeline itself being slow (check the Network tab's response timing, not just the UI).

**"The whole app flashes dark for a split second before switching to my chosen theme (light/noir/claude)."**
This is a real, reproducible gap, not a false impression: `index.html` has no inline script that sets `data-theme` before React mounts, and `ThemeContext`'s `applyTheme(...)` call runs inside a `useEffect` (`ThemeContext.tsx:52-59`) — which fires *after* the initial paint, not before it. Meanwhile `index.css`'s default, attribute-less `:root` selector shares its variable block with `.dark`/`[data-theme="dark"]` (`index.css:10-41`, quoted in §7), so before that effect runs, the browser paints the **dark** theme's colors regardless of what the user actually chose. If your chosen theme is `dark`, you'll never notice; `light`/`noir`/`claude` users will see a brief dark flash on every hard reload. Fixing it would mean moving the `data-theme` write into an inline `<script>` in `index.html` (reading the same `nl2sql_theme` `localStorage` key) so it runs before first paint — this guide is documenting the gap, not claiming it's fixed.

**"I'm logged out immediately after logging in, or every request 401s in a loop."**
Check whether the *refresh* token itself is expired/revoked, not just the access token — `refreshAccessToken()`'s single-flight refresh (§8/§9) only helps when the refresh token is still valid; if it's also dead, `forceReauth()` (`client.ts:243-253`) clears storage and hard-navigates to `/auth` on the very first request, which can look like "instant logout" rather than the (correct) session-expired behavior it actually is.

**"nginx.conf has a `/auth/` block, but my auth requests aren't matching it."**
They're not supposed to — see the "discrepancy worth knowing about" note in §18. Every real auth call in this frontend is prefixed `/api/v1` (`AuthContext.tsx`, `client.ts:221`), so it's handled by the `/api/` location block. If you're customizing `nginx.conf` and expect `/auth/` requests to show up in its logs, they won't, because the frontend never sends any.

**"I added a new page and it works when I type the URL, but it's not in the sidebar / command palette."**
Adding a route in `App.tsx` and adding a nav entry in `Layout.tsx` (and a `COMMANDS` entry in `CommandPalette.tsx`) are three separate, manual steps (§20) — none of them implies the others. This is the single most common "it half-works" report for a new page in this codebase.

**What a beginner should remember**
Most of this app's confusing failure modes trace back to one of three root causes: a stale `schema.d.ts` (forgot `gen:api`), the `isBootstrapping` gate doing exactly what it's designed to do (just slower than expected because the backend is unreachable), or a request that bypassed the dev/prod proxy and hit a CORS wall or a 404 instead. Check those three first.

---

## 25. Glossary

| Term | Meaning in this codebase |
|---|---|
| **SPA (Single-Page Application)** | A web app that loads one HTML shell (`frontend/index.html`) and swaps content in-place via JavaScript instead of requesting a new page from the server on every navigation. This whole app is one SPA. |
| **Component** | A JavaScript function that returns UI (JSX). The atoms of a React app — e.g. `Button`, `ChatWindow`, `QueryPage`. |
| **Hook** | A function starting with `use` that lets a component tap into React features (state, lifecycle, context) or into custom reusable logic, e.g. `useChat`, `useState`. |
| **Props** | The inputs a component receives from its parent, similar to function arguments. |
| **State** | Data a component holds that can change over time and triggers a re-render when it does (`useState`). |
| **Context** | React's built-in mechanism for sharing state across many components without manually passing props down through every level (`AuthContext`, `ThemeContext`). |
| **Server state** | Data that actually lives on the backend/database (sessions, schema, dashboards) — as opposed to UI-only state that exists only in the browser. Managed here by TanStack Query. |
| **TanStack Query** | The library (`@tanstack/react-query`) this app uses to fetch, cache, and invalidate server state via `useQuery`/`useMutation`. |
| **JWT (JSON Web Token)** | A signed, self-contained token proving who a user is. This app stores an access JWT and a refresh JWT in `localStorage` via `tokenStore.ts`. |
| **Interceptor** | A function axios runs on every outgoing request or incoming response before your code sees it — used here to attach auth headers and to catch 401s globally (`api/client.ts`). |
| **SSE (Server-Sent Events)** | A one-way streaming protocol over plain HTTP that lets a server push incremental updates to the browser. Powers the chat's live "thinking steps" and streamed SQL generation. |
| **Lazy loading / code splitting** | Deferring the download of a chunk of JavaScript until it's actually needed (`React.lazy` + `import()`), used here per-route and for a few heavy per-component dependencies (recharts, React Flow, the syntax highlighter). |
| **Virtualization / windowing** | Rendering only the rows currently visible in a scrollable list/table instead of every row, to keep large tables fast. `ResultTable.tsx` implements a small hand-rolled version of this above 100 rows. |
| **Design tokens** | Named, reusable design values (a color, a spacing unit, a radius) defined once as CSS variables and referenced everywhere, so a theme change only requires editing one place (`index.css`). |
| **cva (class-variance-authority)** | A pattern/library for defining a component's Tailwind classes as a set of named "variants" (e.g. `variant="destructive"`, `size="sm"`) instead of ad-hoc conditional class strings. This project uses a local dependency-free reimplementation, `lib/cva.ts`. |
| **Optimistic update** | Updating the UI immediately after a user action, before the server has confirmed it, then rolling back if the server call fails — used for deletes in `HistoryPage`/`TemplatesPage`. |
| **OpenAPI schema** | A machine-readable description of every backend endpoint's request/response shape, exposed by FastAPI at `/openapi.json` and turned into `frontend/src/api/schema.d.ts` TypeScript types via `npm run gen:api`. |
| **BYOD (Bring Your Own Database)** | This app's multi-connection model (§13): a user registers one or more of their own database connection strings rather than being limited to a single fixed database. |
| **DSN / connection string** | The URL-shaped string (`postgresql://user:password@host:5432/db`) identifying a specific database to connect to. Stored encrypted, per `ConnectionsManager.tsx`'s own copy (§13); never shown back to the user in full — only as a redacted `url_preview`. |
| **Single-flight (request)** | A pattern where multiple concurrent callers needing the "same" async operation (here, refreshing an expired access token, §8/§9) share one in-flight promise instead of each triggering a duplicate call — prevents two simultaneous 401s from minting two competing token pairs. |
| **jsdom** | A JavaScript implementation of DOM/HTML/browser APIs that runs in Node, used by Vitest (§19) so component tests can render into a fake `document` without an actual browser. |

---

## 26. Architecture Summary

```mermaid
flowchart TD
    subgraph Browser
        M[main.tsx] --> TP[ThemeProvider]
        TP --> QCP[QueryClientProvider]
        QCP --> App[App.tsx]
        App --> GOP[GoogleOAuthProvider]
        GOP --> AP[AuthProvider]
        AP --> CP[ConnectionProvider]
        CP --> BR[BrowserRouter]
        BR --> CPP[CommandPaletteProvider]
        CPP --> Routes[AppRoutes]
        Routes --> Layout
        Layout --> Pages["pages/* (lazy-loaded)"]
        Pages --> FeatComp["components/*, features/*"]
        FeatComp --> UI["components/ui/* primitives"]
    end
    Pages -->|axios / fetch SSE| Client[api/client.ts]
    Client -->|JWT bearer, JSON / SSE| Backend[(FastAPI backend)]
```

This app is a five-layer React SPA:

1. **Bootstrap layer** (`main.tsx`) — mounts React, sets up the error boundary, theme, and the one shared TanStack Query client.
2. **Global providers** (`App.tsx`) — auth, active-connection, routing, and command-palette context, in an order where each provider's dependencies sit above it in the tree.
3. **Shell + routing** (`Layout.tsx`, `App.tsx`'s `<Routes>`) — one persistent sidebar/header shell; only the routed page underneath changes.
4. **Pages → feature components → UI primitives** — a strict one-way composition: pages orchestrate, feature components implement behavior, UI primitives just render styled markup. Business logic never lives in the `ui/` layer.
5. **The API boundary** (`api/client.ts`) — the *only* place that knows about the backend: auth headers, token refresh, error normalization, and the one exception to axios, the raw-`fetch`-based SSE stream reader for chat.

Two ideas run through almost every section of this guide: **"the backend is the source of truth, the frontend just renders and caches it"** (hence TanStack Query everywhere instead of hand-rolled fetch+state), and **"defer anything expensive until it's actually needed"** (route-level and component-level lazy loading, on-demand data fetches like `HistoryPanel`'s schedule history, windowed table rendering).

### Honest gap: org admin, roles, and approvals are backend-only

This app's own project history (outside this guide's scope to re-derive in full) describes a backend "org admin & approvals" feature set — join requests, custom roles, an audit log, and permission-driven navigation. As far as the frontend source under `frontend/src` is concerned, **none of that has a UI today**: `AuthContext.tsx`'s `AuthUser` interface has exactly five fields — `id`, `email`, `full_name`, `auth_provider`, `created_at` (`AuthContext.tsx:34-40`) — with no `role`, `permissions`, or organization field at all. `Layout.tsx`'s `primaryNavItems`/`secondaryNavItems` (`Layout.tsx:55-71`) are static arrays with no permission or role check gating any entry — every authenticated user sees the exact same navigation. A repo-wide search for `role`, `permission`, `audit`, `organization`, `approval`, `invite`, `member`, and `workspace` across `components/`, `features/`, `pages/`, and `context/` turns up nothing resembling this feature (the few incidental hits — e.g. `HelpPage.tsx`'s copy about auditing which metrics are certified, or ARIA `role` attributes — are unrelated). If a backend surface for this exists, this frontend currently has no page, modal, or nav entry that reaches it — a real, verifiable gap rather than an inferred one, worth confirming with the backend team before assuming it's simply "somewhere else in the app."

---

## 27. Learning Roadmap

If you're new to this codebase, work through it in this order:

1. **Get the app running locally** — see "Getting Started" at the top of this guide. `npm install`, `npm run dev`, log in, ask a question in the chat. Watch the Network tab while you do it.
2. **Read `main.tsx` → `App.tsx` → `Layout.tsx`** — this is the entire "skeleton" of the app; everything else hangs off it (§4, §5, §6).
3. **Read `api/client.ts` top to bottom** — every network behavior in the app traces back to this one file (§8, §14, §22).
4. **Read `hooks/useChat.ts`** alongside `pages/QueryPage.tsx` and `components/ChatWindow.tsx` — this is the flagship feature and the clearest example of the hook/component split (§11).
5. **Pick one dashboard page** (Templates or Metrics are the simplest) and trace its `useQuery`/`useMutation` calls back to `api/client.ts` (§12, §20).
6. **Read `context/AuthContext.tsx` and `auth/tokenStore.ts`** together to understand the two-token, two-refresh-path auth model (§9).
7. **Read `context/ConnectionContext.tsx` and `features/connections/ConnectionsManager.tsx`** to understand the multi-database model — a core, easy-to-underestimate feature (§13).
8. **Skim `index.css`'s `@theme`/theme-variable blocks** to understand how styling and multi-theme support actually work (§7).
9. **Skim `utils/chart.test.ts` and `components/ResultTable.test.tsx`** — the entirety of this app's test suite, and a fast way to see the testing conventions in practice (§19).

**Suggested next topics to study**, once comfortable with the above:

- **React Query's cache internals** (query keys, `staleTime` vs `gcTime`, invalidation) — this app leans on it heavily and most bugs in list pages trace back to a query-key mismatch.
- **Server-Sent Events vs WebSockets** — understand why SSE (one-way, HTTP-native, auto-reconnect-friendly) was the right fit for a "server pushes progress, client never pushes back mid-stream" use case like this one.
- **Tailwind v4's CSS-native configuration model** — a genuinely different mental model from v3's `tailwind.config.js`, worth understanding directly from Tailwind's own v4 docs before touching `index.css`.
- **The backend's side of this app** — read `backend/BACKEND_GUIDE.md`, especially §11 (NL-to-SQL Pipeline) and §25 (End-to-End Example), so you can trace a request past `api/client.ts` all the way through the system. If you're chasing the org-admin/roles/approvals gap noted above, that's the place to look for what the backend actually exposes.
- **Accessibility auditing tools** (axe, Lighthouse) — this guide's §17 documents real, honest gaps; running an automated audit against a live instance would be a good concrete follow-up project.
- **Adding `@testing-library/dom`** — would unlock `@testing-library/react`'s `render()`/`screen` API (already-installed peer packages, §19) for future component tests, replacing the hand-rolled `createRoot`+`act()` pattern.
