# Frontend UX Audit — Vectrix (NL2SQL)

**Method:** Combined technical audit + design critique. Grounded in direct source review (`Layout.tsx`, `index.css` theme tokens, `QueryPage.tsx`, `ChatWindow.tsx`, `FRONTEND_GUIDE.md`, `FRONTEND_3D_UI_UX_SPEC.md`) plus three isolated research passes (onboarding/settings/command-palette/help; mobile/responsive across 7 dense pages; accessibility contrast math + error/empty/loading-state consistency) and one deterministic scan (`detect.mjs` over `frontend/src`, 4 findings — the app is clean of typical AI-slop patterns). No live browser session was available this run, so all findings are static-code-grounded with file:line citations, not click-tested — treat severities as verified-in-code, not verified-in-browser.

**Scope:** Frontend only (`frontend/src/**`). Nothing here proposes or requires a backend/API change — every recommendation below is a frontend component, layout, token, or copy change. Where a finding sounds like it needs new data, it doesn't: it's about how existing data is presented.

---

## Executive Summary

| Score | Result | Band |
|---|---|---|
| **Audit Health Score** (technical: a11y, perf, theming, responsive, integrity) | **13/20** | Acceptable — significant work needed in specific dimensions |
| **Design Health Score** (Nielsen's 10 heuristics) | **24/40 (60%)** | Acceptable — solid foundation, real gaps in consistency & error recovery |

**The one-sentence verdict:** this is an architecturally excellent app (clean state management, real code-splitting, a genuine 4-theme design-token system, near-zero AI-slop) whose *engineering* quality is well ahead of its *UX polish and consistency* — the lag isn't "the frontend looks bad," it's "five different people each built a correct-but-different empty state, and nobody went back to unify them."

**The single biggest opportunity:** `frontend/FRONTEND_3D_UI_UX_SPEC.md` is a 277-line, genuinely well-considered design evolution spec — color system, typography, motion, a 5-layer depth model, and its own accessibility rules (§13) that would directly fix several issues found below — and its own header says it plainly: *"Status: Design specification only — no implementation, no code changes."* **0% of it is shipped.** Before inventing a new direction, the team should decide whether to execute the one it already wrote down.

---

## Audit Health Score

| # | Dimension | Score | Key Finding |
|---|-----------|-------|-------------|
| 1 | Accessibility | **2/4** | Destructive/primary buttons fail WCAG AA contrast in 2 of 4 themes; every inline form error is silent to screen readers app-wide (no `aria-live` outside the toast system) |
| 2 | Performance | **3/4** | Real route + component code-splitting, custom table virtualization, selective memoization — no systemic issues, `React.memo` simply unused anywhere |
| 3 | Theming | **3/4** | Excellent 4-theme CSS-variable system with real product identity — docked only for the contrast failures above and 2 detector-flagged gradient-text rules |
| 4 | Responsive Design | **2/4** | Most pages are genuinely mobile-first (Schema, Dashboards, ResultTable, DataChart); Settings modal has **zero** responsive breakpoints; touch targets under 44px are the norm, not the exception |
| 5 | Implementation Integrity | **3/4** | Only 4 detector hits across the whole codebase; real, distinctive brand identity (4 named themes incl. a "claude" theme) — docked for one off-brand violet "AI" badge |
| **Total** | | **13/20** | **Acceptable** |

## Design Health Score (Nielsen's 10 Heuristics — Operate mode)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | `thinkingSteps` checklist + optimistic UI are genuinely good; 3 different loading treatments coexist even within one page |
| 2 | Match System / Real World | 2 | RAG settings expose "HyDE," "adaptive top-k," "parent-child chunking" ungated to every user, next to "Appearance" |
| 3 | User Control and Freedom | 2 | Onboarding checklist dismiss is permanent with no undo/resurface path |
| 4 | Consistency and Standards | 2 | General/Appearance duplicate the same two controls verbatim; 5 different empty-state "tiers"; 3 loading-state treatments |
| 5 | Error Prevention | 3 | Consistent type-to-confirm destructive pattern, pre-submit validation, test-before-save connections |
| 6 | Recognition Rather Than Recall | 3 | Icon buttons mostly labeled; RAG jargon requires the user to already know what they're toggling |
| 7 | Flexibility and Efficiency | 3 | Command palette + real keyboard shortcuts, but the palette itself is mostly a page-jumper (2 real actions) |
| 8 | Aesthetic and Minimalist Design | 2 | HomePage first paint: ~6 content blocks, 10+ interactive targets, no single dominant CTA |
| 9 | Error Recovery | 2 | Core chat flow has excellent persistent retry; every CRUD page (Schedules/Metrics/Dashboards) relies solely on an 8s auto-dismissing toast |
| 10 | Help and Documentation | 2 | HelpPage content is genuinely excellent — and absent from both primary and secondary nav |
| **Total** | | **24/40** | **Acceptable (60%)** |

---

## Priority Issues

### P1 — Major (fix before the next real UX pass)

1. **Destructive/primary buttons fail WCAG AA contrast, theme-dependently.** White text on `--destructive`/`--primary` computes to 3.39–3.90:1 in the `light`, `claude`, `dark`, and `noir` themes against a 4.5:1 requirement (`index.css` theme blocks at lines 12, 385, 428, 471). Since `Button` is the shared primitive for every delete confirmation and every primary CTA app-wide, this isn't one bad button — it's a token-level problem that silently varies by which theme is active.
   → **Fix:** `/impeccable audit` already scoped this; feed it to `/impeccable harden` or `/impeccable colorize` to re-tune the on-accent foreground token per theme (darken the accent slightly, or use a near-black foreground on the lighter themes) — an `index.css` variable change only.

2. **No inline form error is exposed to screen readers, anywhere.** A codebase-wide check for `aria-live`/`role="alert"` returns only `toast.tsx`. Every inline validation message (`AuthPage.tsx:234-246`, `ConnectionsManager.tsx:190,258,292`, Metrics/Schedules create-forms) is silent DOM text with no announcement.
   → **Fix:** `/impeccable harden` — add `role="alert"` (or a shared `aria-live="polite"` wrapper) to the one or two shared error-text components these forms already reuse.

3. **Settings modal has zero responsive breakpoints.** Full read of `SettingsModal.tsx` confirms no `sm:`/`md:`/`lg:` anywhere. The fixed 160px tab rail (`SettingsModal.tsx:98`) plus `px-6 py-5` content padding (`:116`) leaves roughly **135px** of usable width for every settings panel at a 375px phone viewport — this is math, not speculation, and it's independent of what's inside each of the 10 tabs.
   → **Fix:** `/impeccable adapt` — collapse the tab rail into a horizontal scroll-pill row (or a `<select>`) below `md`.

4. **Three inconsistent form-labeling patterns, one of which has no label at all.** `AuthPage`/`ConnectionsManager` correctly pair `<Label htmlFor>` with `id` and `required`; `TemplatesPage.tsx:66-82` has a visible `Label` with no `htmlFor`/`id` pairing; `SchedulesPage.tsx:183-193` and `MetricsPage.tsx:298-313` have **no label at all**, only `placeholder` text, which WCAG 1.3.1/3.3.2 do not accept as a label substitute (it also disappears once the user types).
   → **Fix:** `/impeccable harden` — this is a mechanical, low-risk pass: add `id`/`htmlFor` pairs and `aria-required` to the ~4 forms that lack them.

5. **General and Appearance settings tabs duplicate the exact same two controls.** `General.tsx:152-174` and `Appearance.tsx:82-106` both render "Font Size" and "UI Density" with identical copy, writing the same `font_size`/`ui_density` fields. A user who sets one and later opens the other tab has no way to know they already set this.
   → **Fix:** `/impeccable distill` — remove the duplicate from one tab (Appearance is the more natural home; General should own account-level, not visual, settings).

6. **`TemplatesPage`'s row expand/collapse is mouse-only.** The clickable header (`TemplatesPage.tsx:234-236`) is a plain `<div onClick>` with no `role="button"`, `tabIndex`, or `onKeyDown` — a keyboard-only user can Tab to the nested action buttons but has no way to open the row itself to see the SQL.
   → **Fix:** `/impeccable harden` — swap the `<div>` for a real `<button>`, or add `role="button" tabIndex={0}` + Enter/Space handling.

7. **CRUD mutations across Schedules/Metrics/Dashboards have no persistent failure trace.** Every `onError` in these three pages does only `toast(...)`, which auto-dismisses after 8s (`toast.tsx:9,55`). `ConnectionsManager.tsx:190` already does this *correctly* (a durable inline error alongside the toast) — the other three pages should copy that pattern, not invent a new one.
   → **Fix:** `/impeccable polish` — port `ConnectionsManager`'s inline-error pattern into the three CRUD pages.

8. **Google login doesn't degrade when unconfigured.** `App.tsx:29` casts a possibly-`undefined` `VITE_GOOGLE_CLIENT_ID` straight into `GoogleOAuthProvider`, and `AuthPage.tsx:399-407` renders the `GoogleLogin` button unconditionally — a deployment without the env var shows a broken/erroring button with the "or continue with" divider still promising an option that silently fails.
   → **Fix:** `/impeccable harden` — gate the whole Google block on `Boolean(GOOGLE_CLIENT_ID)`.

### P2 — Minor (real, but a workaround exists)

9. **Five different empty-state visual patterns** for the same "list is empty" situation — a full illustrated "hero" pattern (SavedQueries/Dashboards/Metrics/Schedules), a Card+`<h3>` variant (History), a bare dashed box (Templates), and a single line of gray text with no affordance at all (Schema pinned tables, Schedule history, Training jobs, Analytics, Security sessions, Home). No shared `<EmptyState>` component exists.
10. **Three different loading-state treatments**, sometimes on the same page — `SchemaPage.tsx` alone mixes shimmer-`Skeleton` (correct, used elsewhere), ad hoc `animate-pulse` divs (:138, :344), and a bare `Loader2` + text row (:640-644).
11. **`QueryBuilder`'s responsive breakpoints read the wrong axis.** It uses viewport-width `sm:` classes (`QueryBuilder.tsx:594,675`) while permanently confined to a 50%-width panel next to chat — at a real tablet viewport (768-834px, which *is* `≥sm`), four form controls get forced into a row inside a ~400px-wide panel, squeezing worse than either the "mobile" or "desktop" design intent.
12. **Instructions vs. Glossary settings overlap conceptually** enough that the app's own `HelpPage.tsx:386-389` needs a dedicated FAQ entry to explain the difference — evidence from the product's own copy that this is a real point of confusion, not just an audit opinion.
13. **RAG settings sit as a flat, ungated tab** next to Appearance, exposing "HyDE," "adaptive top-k," and per-query LLM-call cost implications (buried in a tooltip, `RagSettings.tsx:167`) to every user regardless of technical background.
14. **Touch targets under 44×44px are the norm across the app**, not an isolated slip: `ResultTable` pagination (32px) and export buttons (28px), `DataChart` toolbar icons (28×26px), `SchemaPage` pin/explain buttons (22–28px), `SettingsModal` tabs (~36-38px).
15. **Onboarding checklist's dismiss is permanent with no undo.** `OnboardingChecklist.tsx:42,67` — a mis-tap on the small (`h-3 w-3`) close icon loses onboarding guidance forever, with no re-enable path found in Settings.
16. **Dropdown menus never return focus to their trigger on close**, and have no arrow-key roving-tabindex among items — affects `ItemActionsMenu`, `DatabaseSelector`, and `ThemeSwitcher` identically since all three share `dropdown-menu.tsx`.
17. **Input/select border contrast is under 3:1 in all four themes** (systemic token choice, not a per-theme bug) — unfocused form fields are hard to visually locate everywhere, not just in one theme.
18. **HelpPage is absent from both primary and secondary navigation** — its only entry points are the avatar dropdown and the command palette, despite containing the single clearest "what do I do first" content in the app (its own "Typical Workflow" walkthrough, `HelpPage.tsx:606-632`).

### P3 — Polish

19. Angled 10-category X-axis labels on the Analytics "Popular Queries" chart overlap at phone widths (data is still reachable via tooltip).
20. The Command Palette's header trigger is `hidden` below the `sm` breakpoint (`Layout.tsx:734`) — narrow-viewport mouse users have no visible way to discover Ctrl+K exists at all (the Home page's search bar is the only surviving entry point on those widths).
21. One off-brand violet gradient badge on AI-generated content (`ChatWindow.tsx:158,170`) sits against an otherwise disciplined emerald/teal palette — flagged by the deterministic detector as a common "AI tell."
22. Several `cursor-pointer` stat cards on Analytics (`AnalyticsPage.tsx:316,416-424`) have no `onClick` at all — a dead affordance that primes a click nothing responds to.
23. Settings panels split between manual "Save Changes" + a 2-second "Saved!" confirmation (General, Appearance, SqlStyle, RAG) and silent instant auto-save with no confirmation (Notifications, Glossary) — pick one pattern.

---

## Positive Findings (worth protecting, not just noting)

- **The core query/chat flow is the strongest part of the app.** `thinkingSteps`, optimistic UI, single-flight token refresh, and abort-on-resubmit are genuinely well-designed solutions to real problems, and the only place in the app with a fully persistent, well-designed retry affordance (`ChatWindow.tsx:403-406`).
- **Four real, distinct themes** (dark/light/noir/**claude**) via CSS custom properties, not a generic AI purple-gradient palette — the detector confirms this (4 findings total across the *entire* codebase).
- **`ResultTable`'s self-built windowing** and **`ConnectionsManager`'s durable inline-error pattern** are both better than what most of the rest of the app does — they're the models to copy elsewhere, not exceptions to explain away.
- **Route- and component-level code-splitting is thorough and well-commented** — every lazy import states *why* (recharts/React Flow/syntax-highlighter are deferred with an inline comment explaining the cost being avoided).
- **The "unverified email" auto-recovery** in `AuthPage` (detecting the error string and routing straight to OTP) is a small but real "the system anticipated my mistake" moment.
- **`SchemaPage`, despite being "the densest page,"** is actually one of the best-behaved on mobile — single-column card stacking throughout, with its own overflow containers already correctly handling wide tables and code blocks.

---

## Proposed Frontend Reorganization

All items below are frontend-only — component structure, layout, tokens, copy. Nothing requires a new endpoint, a schema change, or touches `api/client.ts`'s contract with the backend.

1. **Adopt `FRONTEND_3D_UI_UX_SPEC.md` as the north star, in stages, instead of improvising a new direction.** It already prescribes fixes for several findings above by its own written rules: §13 bans mouse-only interactions and mandates visible `:focus-visible` rings (fixes #6, #16); §14 rule 8, "consistency over novelty per page," is exactly the empty-state/loading-state fragmentation problem (#9, #10) stated as a design principle. Executing the existing spec is lower-risk than a fresh redesign because it was already written against this exact codebase's tokens (`--background`, `--primary`, `--border`, `--radius` are explicitly "kept identical," §3).
2. **Add Help to the sidebar nav** (either promoted into `secondaryNavItems` or given its own always-visible icon) — the single cheapest discoverability fix in this whole report, given the content already there.
3. **Collapse Settings from 10 tabs toward ~7:** merge General+Appearance (removing the duplicate Font Size/UI Density controls, #5), fold the "Usage" tab into a link that opens the existing `UsageModal` rather than duplicating its content as an 8th tab, and group Instructions+Glossary under one "AI Context" section with the disambiguating copy from the Help FAQ surfaced inline instead of only in Help.
4. **Move RAG settings behind an explicit "Advanced" affordance** (a collapsed section or a confirmation step) rather than flush alongside Appearance — same information, one click deeper, so a non-technical user isn't invited to toggle HyDE by accident.
5. **Give HomePage one obviously dominant primary action.** Make "New query" visually escalate above the other three quick-action buttons (size, fill, or an accent glow) and consider demoting the 4-column "Continue working" grid below the fold for first-time users with no data yet — cutting first-paint competing targets from ~10 to effectively 1 + progressive disclosure.
6. **Build one shared `<EmptyState>` and standardize on the existing `<Skeleton>` for every loading placeholder** — a pure component-consolidation refactor that resolves #9 and #10 app-wide from two PRs, not fourteen.
7. **Fix the two responsive bugs that are structural, not cosmetic:** stack `QueryPage`'s chat+graph/builder split vertically below `md` (#currently flagged repeatedly across sources), and make `QueryBuilder`'s internal breakpoints container-aware (container query or measured width) instead of viewport-relative, since it never occupies the full viewport when open.
8. **One design-token pass on-accent contrast**, applied once in `index.css`, fixes the P1 contrast failures (#1) and the border-contrast issue (#17) across all four themes simultaneously — this is the highest-leverage single fix in the report because it's one file, no component changes, and it clears a WCAG AA failure that currently affects every delete button and every primary CTA in two of the four themes.

---

## Recommended Actions

In priority order — P1s first, then the consistency/IA work, then polish:

1. **[P1] `/impeccable harden`** — screen-reader announcements for inline form errors (#2), missing labels on Schedules/Metrics/Templates forms (#4), TemplatesPage keyboard-only expand fix (#6), Google-login graceful degradation (#8).
2. **[P1] `/impeccable colorize`** (or `harden`) — fix destructive/primary button contrast per theme (#1) and input/select border contrast (#17) in one `index.css` pass.
3. **[P1] `/impeccable adapt`** — give `SettingsModal` real breakpoints (#3) and fix `QueryBuilder`'s container-relative breakpoints (#11).
4. **[P1] `/impeccable distill`** — remove the General/Appearance duplicate controls (#5).
5. **[P2] `/impeccable polish`** — port `ConnectionsManager`'s persistent inline-error pattern into Schedules/Metrics/Dashboards (#7); unify empty-state and loading-state components app-wide (#9, #10); standardize the settings save-confirmation pattern (#23).
6. **[P2] `/impeccable clarify`** — disambiguate Instructions vs. Glossary in-UI (#12), gate RAG settings behind an "Advanced" affordance with plainer lead-in copy (#13).
7. **[P3] `/impeccable typeset`/`/impeccable layout`** — Analytics chart-label overlap (#19), dead `cursor-pointer` affordances (#22).
8. **[Strategic] `/impeccable shape`** — scope how much of `FRONTEND_3D_UI_UX_SPEC.md` to execute and in what order, once the above is settled; its own accessibility rules (§13) should be treated as a requirement, not aspirational copy, if adopted.
9. **`/impeccable polish`** as the final pass once the above land.

You can ask me to run these one at a time, all at once, or in any order you prefer.

Re-run `/impeccable audit` and `/impeccable critique` after fixes to see the scores above improve.
