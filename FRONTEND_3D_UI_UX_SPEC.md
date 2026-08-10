# NL‑to‑SQL — Premium 3D UI/UX Design System

**Status:** Design specification only — no implementation, no code changes.
**Companion file:** `frontend/3d-ui-preview.html` (static, framework-free visual preview of every existing page in this direction)
**Reference inspiration:** [Trionn](https://trionn.com/?ref=landing.love), Linear, Framer, Stripe, Vercel, Apple product pages
**Existing brand seed:** current app already uses a dark base (`#0a0c11`), emerald primary (`#10b981`) and a glassy sidebar (`bg-card/88 backdrop-blur-2xl`). This spec **extends that DNA** into a cinematic, spatial, premium-AI aesthetic rather than replacing it — so the transition feels like a maturation, not a rebrand.

---

## 1. Vision

### Design philosophy
NL‑to‑SQL is not a form with a text box — it is an **AI copilot that turns language into structured truth**. The interface should feel like looking *into* a live system: layered glass panels floating in depth, data glowing softly beneath the surface, structure emerging from ambiguity. Every screen should read as **"a control room for your data, designed like a spaceship cockpit, built by people obsessed with typography."**

The philosophy in one line: **quiet confidence over decoration.** 3D, glow, and motion exist to communicate *depth of capability and precision*, not to perform. Every effect must justify itself — depth signals hierarchy, glow signals liveness/AI activity, motion signals causality (this action produced that result).

### Emotional tone
- **Calm intelligence** — a still, dark canvas that never competes with the user's data.
- **Precision** — hairline borders, exact alignment, monospace for anything literal (SQL, tokens, timestamps).
- **Quiet awe** — the kind of "oh, that's nice" reaction Linear/Stripe/Apple pages produce: understated until you interact, then it responds with life.
- **Trust** — glass and depth imply structure and containment, never chaos. Nothing should feel gimmicky or like a game.

### Brand personality
Think **"Bloomberg terminal raised by Apple design and mentored by an AI research lab."** Serious enough for an enterprise data team, beautiful enough that a founder demos it on stage. Emerald remains the signature accent (continuity with the existing product), extended with a cool violet/cyan spectrum reserved for "AI is thinking" moments — so the palette differentiates *human-authored UI* from *AI-generated response* at a glance.

### Target user perception
A data analyst, BI lead, or founder should look at the product for five seconds and think: *"This was built by people who care about craft, and I can trust the answers it gives me."** The 3D/glass language exists to earn trust through visible engineering quality — not to distract from the seriousness of querying production data.

---

## 2. Visual Direction

- **Premium AI aesthetic** — deep space-black canvas, restrained neon, generous negative space. Nothing is fully opaque; every surface hints at what's behind it.
- **3D depth** — a strict five-layer z-model (see §9) so elements never float arbitrarily; depth always encodes hierarchy (background → ambient → base surface → elevated glass → active/focused).
- **Glassmorphism** — frosted panels (`blur(20–28px)`, 4–10% white fill) over an animated gradient-mesh backdrop, with a 1px inner highlight border to sell "edge-lit glass."
- **Soft shadows** — large, soft, low-opacity shadows (never harsh drop shadows); shadow color inherits from the nearest accent (emerald glow under primary actions, neutral black glow under structural panels).
- **Ambient glow** — a single soft emerald/teal glow source implied per screen (as if a monitor is lighting the room), reinforced by the existing `.glow-primary` pattern already in the codebase.
- **Gradient lighting** — diagonal (135°) gradients on hero surfaces and primary buttons only; flat elsewhere. Gradients always move emerald → teal → (occasionally) violet, never arbitrary hues.
- **Spatial layering** — cards overlap their grid slightly on hover (4–8px lift + shadow growth) to imply a stack of physical panels.
- **Noise textures** — a 2–3% opacity fractal-noise overlay across the whole canvas to kill flat digital banding on gradients and give the "expensive material" feel Framer/Apple pages have.
- **Metallic surfaces** — reserved for icon containers and orb cores: a subtle brushed-metal gradient (`linear-gradient` + faint specular highlight) rather than literal chrome — keeps it premium, not toy-like.
- **Floating cards** — feature/summary cards sit slightly above the grid baseline with a resting shadow, and lift further on hover/scroll-in.
- **Holographic accents** — thin gradient borders (emerald→teal→violet at low opacity) used *only* on AI-generated content (SQL output, AI chat bubbles, insight callouts) to visually mark "the model made this."

---

## 3. Color System

Extends the current CSS variables (`--background: #0a0c11`, `--card: #11141b`, `--primary: #10b981`, `--border: #232936`) — do not replace them, layer on top.

| Token | Hex | Usage |
|---|---|---|
| `--bg-base` | `#05070A` | Root canvas, deepest layer |
| `--bg-elevated` | `#0A0C11` | Existing app background (kept identical) |
| `--surface-1` | `#11141B` | Existing card surface (kept identical) |
| `--surface-2` | `#161A22` | Secondary/nested surface |
| `--surface-glass` | `rgba(255,255,255,0.045)` | Glass panel fill |
| `--surface-glass-strong` | `rgba(255,255,255,0.08)` | Glass panel fill, hover/active |
| `--border-hairline` | `#232936` | Existing border (kept identical) |
| `--border-glow` | `rgba(16,185,129,0.35)` | Focus/active borders |
| `--text-primary` | `#E4E9F1` | Existing foreground (kept identical) |
| `--text-secondary` | `#9AA4B2` | Body copy on dark |
| `--text-tertiary` | `#5B6472` | Captions, metadata |
| `--accent-emerald` | `#10B981` | Existing primary (kept identical) — actions, active states |
| `--accent-emerald-bright` | `#34EEA8` | Hover/glow highlight of emerald |
| `--accent-teal` | `#22D3EE` | AI/"thinking" secondary accent, gradient partner |
| `--accent-violet` | `#8B7CF6` | Rare tertiary — holographic accent only, ≤5% of any screen |
| `--glow-emerald` | `rgba(16,185,129,0.55)` | Box/text glow |
| `--glow-teal` | `rgba(34,211,238,0.45)` | AI-state glow |
| `--success` | `#34D399` | Confirmations |
| `--warning` | `#FBBF24` | Caution states |
| `--error` | `#FB7185` | Destructive/errors (matches existing rose usage in Layout) |
| `--info` | `#38BDF8` | Neutral informational |

**Gradients**
- Primary CTA: `linear-gradient(135deg, #10B981 0%, #22D3EE 100%)`
- Hero mesh: radial blends of `--accent-emerald`, `--accent-teal`, `--accent-violet` at 6–14% opacity over `--bg-base`, animated at walking-pace (60–90s loops), never a fast strobe.
- Holographic border: `linear-gradient(120deg, rgba(16,185,129,.6), rgba(34,211,238,.6), rgba(139,124,246,.6))`, applied via border-image/mask, animated hue-drift on hover only.

**Rule:** never introduce a hue outside this system. Charts/data-viz colors are the one exception and should follow the project's existing categorical chart palette, not this UI palette.

---

## 4. Typography System

- **Display font:** *Space Grotesk* (headlines, hero numerals, section titles) — geometric, technical, slightly futuristic without being a cliché "AI" font.
- **Body font:** *Inter* — already the de-facto web-app standard; maximizes legibility for dense data UI.
- **Mono font:** *JetBrains Mono* — SQL, tokens, timestamps, kbd hints (the existing app already uses `font-mono` for labels; keep that convention).

**Scale (desktop baseline, 1rem = 16px):**

| Role | Size | Weight | Line-height | Letter-spacing |
|---|---|---|---|---|
| Hero display | 64–88px (`clamp(2.75rem, 6vw, 5.5rem)`) | 700 | 1.02 | -0.02em |
| H1 / Section title | 40px | 700 | 1.1 | -0.015em |
| H2 | 28px | 600 | 1.2 | -0.01em |
| H3 / Card title | 20px | 600 | 1.3 | 0 |
| Body large | 17px | 400 | 1.6 | 0 |
| Body | 15px | 400 | 1.6 | 0 |
| Caption / meta | 12–13px | 500 | 1.4 | 0.02em |
| Overline / label | 10–11px | 600 | 1.2 | 0.18–0.22em, uppercase (matches existing sidebar section labels) |
| Button label | 14px | 600 | 1 | 0 |
| Code / mono | 13px | 400–500 | 1.5 | 0 |

Rules: display/hero text always in Space Grotesk with a subtle emerald→teal gradient text-fill on hero-only headlines (see §8 `.text-gradient`); body copy is always `--text-secondary`, never full white, to keep contrast comfortable at night-mode brightness.

---

## 5. Spacing System

- **Base unit:** 4px. All spacing is a multiple of 4 (4/8/12/16/20/24/32/40/48/64/96/128).
- **Grid:** 12-column fluid grid, `max-width: 1440px`, gutters 24px (16px on tablet, 16px on mobile with 4-col collapse).
- **Container widths:** marketing/hero sections `1200px` centered; in-app content `1440px`; dense data tables full-bleed within the content column.
- **Padding scale:** card padding 24px (desktop) / 20px (tablet) / 16px (mobile); section vertical padding 120px desktop / 80px tablet / 56px mobile.
- **Margin scale:** related elements 8–12px; distinct groups 24px; section-to-section 96–160px to create the "cinematic breathing room" premium sites rely on.
- **Section spacing:** every marketing/showcase section gets a full negative-space buffer before the next — no two sections should ever visually touch; each transitions through a gradient fade or a hairline divider with a centered glow dot (see preview file).

---

## 6. Border Radius

A calm, consistent, slightly-rounded-square system (extends the existing `--radius: 0.85rem`):

| Token | Value | Usage |
|---|---|---|
| `--r-xs` | 6px | Badges, chips, kbd |
| `--r-sm` | 10px | Inputs, small buttons |
| `--r-md` | 14px | Default cards, buttons |
| `--r-lg` | 20px | Feature cards, modals |
| `--r-xl` | 28px | Hero panels, large glass containers |
| `--r-full` | 999px | Pills, avatars, icon orbs |

Never mix more than two radius tokens in one component; nested elements use one step smaller than their parent for visual consistency (e.g., 28px panel → 20px inner card → 10px button).

---

## 7. Shadow System

Layered, soft, low-contrast — shadows sell elevation, not weight.

```
--shadow-1: 0 1px 2px rgba(0,0,0,0.4);                         /* resting hairline */
--shadow-2: 0 8px 24px -8px rgba(0,0,0,0.45);                   /* card resting */
--shadow-3: 0 16px 48px -12px rgba(0,0,0,0.55);                 /* card hover / modal */
--shadow-4: 0 24px 80px -16px rgba(0,0,0,0.65);                 /* hero panel / floating orb */
--glow-primary-sm: 0 0 24px rgba(16,185,129,0.35), 0 0 8px rgba(16,185,129,0.25);
--glow-primary-lg: 0 0 60px rgba(16,185,129,0.35), 0 0 16px rgba(16,185,129,0.25);
--glow-ai:          0 0 40px rgba(34,211,238,0.30);
```

Composite pattern for elevated glass: `--shadow-3` (structural) + `--glow-primary-sm` (only on interactive/active elements) stacked — never glow on purely structural containers, or the UI reads as "everything is a button."

---

## 8. Glass Effects

| Property | Resting | Hover/Active |
|---|---|---|
| Background fill | `rgba(255,255,255,0.045)` | `rgba(255,255,255,0.08)` |
| Backdrop blur | `20px` | `26px` |
| Backdrop saturate | `140%` | `160%` |
| Border | `1px solid rgba(255,255,255,0.08)` | `1px solid rgba(16,185,129,0.35)` |
| Inner highlight | `inset 0 1px 0 rgba(255,255,255,0.06)` top edge only | unchanged |
| Corner treatment | radius per §6 | unchanged |

Utility classes referenced throughout the preview:
- `.glass` — base recipe above.
- `.glass-strong` — hover/active recipe, used on focused inputs and open menus.
- `.text-gradient` — `background: linear-gradient(135deg,#10B981,#22D3EE); -webkit-background-clip:text; color:transparent;`
- `.holo-border` — animated conic/linear gradient border for AI-authored content only.

Glass panels always sit on top of the ambient gradient-mesh background — never on a flat solid fill — or the blur has nothing to reveal and looks like plain transparency.

---

## 9. Motion System

**Depth model (z-layers, back to front):**
1. Base canvas + noise
2. Ambient gradient-mesh / particles (slow drift, 60–120s loops)
3. Base content surfaces (cards, panels) — static
4. Elevated/interactive glass (modals, hovered cards, dropdowns)
5. Cursor-linked / floating elements (AI orb, magnetic buttons, tooltips)

**Timing standards**
- Micro (hover, focus): `150–200ms`, `ease-out`
- Standard (reveal, panel open): `350–450ms`, `cubic-bezier(0.22, 1, 0.36, 1)` ("premium overshoot-free ease")
- Cinematic (hero entrance, page transition): `600–900ms`, staggered 60–90ms per child
- Ambient/looping (orb rotation, gradient drift, particles): `20–120s`, linear or ease-in-out, always `prefers-reduced-motion`-gated

**Interaction patterns**
- **Page transitions:** cross-fade + 8px upward drift, 400ms; never a hard cut, never a slide that implies spatial navigation the app doesn't have.
- **Hover interactions:** buttons scale `1.0 → 1.02`, glass cards lift `translateY(-4px)` + shadow step up one level; color/opacity changes always accompany a transform, never alone.
- **Card lift:** on hover, elevate `translateY(-6px) scale(1.01)`, shadow `--shadow-2 → --shadow-3`, border brightens toward `--border-glow`.
- **Magnetic buttons:** primary CTA buttons track cursor within a 12–16px radius via a translate offset capped at 6px — subtle, not cartoonish; releases with a spring back on mouseleave.
- **Cursor interactions:** a soft radial "spotlight" (radial-gradient mask, 250px radius, 6% opacity) follows the cursor across hero/feature sections only — never over dense data tables, where it would be visual noise.
- **Scroll animations:** sections fade+rise into view (`opacity 0→1`, `translateY 24px→0`) via IntersectionObserver, threshold 0.15, one-shot (no re-trigger flicker on scroll-up).
- **Reveal animations:** staggered children (cards in a grid) animate in 60–80ms apart, max 6 stagger steps before falling back to simultaneous (avoid multi-second cascades on long grids).
- **3D parallax:** hero orb and background blobs shift at a different scroll speed ratio (0.15–0.35×) than foreground content (1×), creating depth without any element moving more than ~80px total.
- **Floating object motion:** orb and ambient shapes use a slow figure-8 drift (`translate` + `rotate`, 20–30s loop) plus a faster micro-bob (4–6s) layered on top for organic (non-robotic) movement.
- **Loading animations:** the existing spinning-ring loader stays for functional in-app loading; the preview's marketing surfaces instead use skeleton shimmer (see below) to avoid competing spinners.
- **Skeleton states:** diagonal shimmer sweep, 1.5s loop, on a `--surface-2` base — matches the existing `ui/skeleton.tsx` pattern, just re-skinned with the glass palette.

All motion must respect `prefers-reduced-motion: reduce` — ambient/looping and parallax effects are disabled entirely (not just shortened) under that setting; only functional micro-transitions (150–200ms) remain.

---

## 10. 3D Components

- **Floating AI orb** — the signature hero object: a layered sphere (radial-gradient core in emerald→teal, soft outer glow ring, faint conic "energy" ring rotating independently, 2–3 blurred orbiting particles). Represents "the model" — appears on the landing hero and can recur small-scale as a "thinking" indicator in the chat/Query Studio mockup.
- **Glass cards** — `.glass` recipe (§8) + `--shadow-2` resting; used for feature tiles, stat tiles, chat bubbles, list rows.
- **Perspective dashboards** — the app-screenshot mockups (Home/Analytics/Dashboards) are presented inside a "device frame" tilted slightly in 3D (`perspective(1400px) rotateX(4deg) rotateY(-6deg)`), straightening to `rotateX(0) rotateY(0)` on hover/focus — implies the viewer is looking *into* a live product, not at a flat picture.
- **Layered panels** — sidebar/header/content are literal separate DOM layers with distinct blur/opacity, so scrolling content behind a fixed glass header visibly changes it (real depth, not printed depth).
- **Gradient meshes** — SVG/CSS blurred blob shapes behind every major section, unique per section but drawn from the same 3-color system, so no two sections look identical yet all feel related.
- **Depth hierarchy** — enforced via the 5-layer model in §9; every component must declare which layer it lives on and use only that layer's shadow/blur/z-index budget.
- **Hover rotation** — feature icons and metric badges apply a subtle `rotateY(8deg)` tilt toward the cursor position on hover (simple 2-axis tilt, not a full tilt.js physics rig).
- **Ambient particles** — 12–20 small glowing dots per hero section, CSS-animated drifting upward at varied speed/opacity, standing in for "data flowing through the system."

---

## 11. Component Design

- **Navbar (marketing)** — floating glass pill, centered, appears after 40px scroll (fades/slides in), logo left, links center, "Sign in" ghost + "Get started" gradient CTA right.
- **Sidebar (in-app, existing structure)** — keep exact current information architecture (Home/Query/Schema/History/Analytics/Saved/Dashboards/Schedules/Metrics/Templates/Training + profile menu); upgrade visuals only: stronger blur, animated active-item glow bar (already present as a gradient bar — extend its glow), icon containers get the metallic-gradient treatment on the active item only.
- **Hero** — full-viewport, gradient-mesh + orb background, Space Grotesk display headline with `.text-gradient` accent word, subhead in `--text-secondary`, primary gradient CTA + secondary ghost button, floating perspective screenshot of Query Studio beneath the fold.
- **CTA (sections)** — centered glass panel, holographic border, single headline + single button — never competes with surrounding content for attention.
- **Feature cards** — 3-column glass grid, icon in metallic rounded-square container, title (H3), 1–2 line description, subtle hover lift + icon rotateY.
- **Dashboard preview** — perspective-tilted device frame showing stat tiles + chart placeholders, ambient glow beneath as if the screen is lighting the desk.
- **Chat panel (Query Studio)** — user messages: plain glass bubble, right-aligned, neutral border. AI messages: `.holo-border` glass bubble, left-aligned, small orb-avatar, SQL block rendered in a mono glass panel with syntax-color tokens and a copy affordance; result preview as a compact glass table.
- **Sidebar (marketing footer nav)** — n/a, folded into Footer below.
- **Tables** — zebra-free, hairline row dividers (`--border-hairline`), sticky glass header, hover row highlight `--surface-glass-strong`, numeric columns right-aligned tabular-mono.
- **Forms** — label above field (overline style), inputs as `--surface-2` with hairline border, focus state = `--border-glow` + `--glow-primary-sm`, helper text in `--text-tertiary`.
- **Inputs** — 14px vertical padding, `--r-sm`, mono font for anything literal (connection strings, tokens).
- **Buttons** — Primary: gradient fill + `--glow-primary-sm`, magnetic on hover. Secondary: `--surface-2` + hairline border. Ghost: transparent, text-only, underline-on-hover. Destructive: `--error` text/border on transparent, filled only on confirm step.
- **Modals** — `.glass-strong` panel, `--r-lg`, `--shadow-4`, entrance = scale `0.97→1` + fade, backdrop = blurred dark scrim (matches existing modal pattern, upgraded blur strength).
- **Toasts** — bottom-right stack, glass pill, colored left edge per status (`success`/`warning`/`error`/`info`), auto-dismiss progress bar as a thin glow line.
- **Pricing cards** — 3-tier glass cards, center "recommended" tier elevated (`translateY(-12px) scale(1.03)`) with holographic border and stronger glow; others recede slightly in opacity (90%).
- **Footer** — dark, minimal, 4-column link grid, hairline top divider, small orb-mark logo, no gradients (footer is the one zone allowed to feel "quiet" / at rest).

---

## 12. Responsive Strategy

- **Desktop (≥1280px):** full 3D/parallax/orb treatment, 12-col grid, sidebar always expanded by default.
- **Tablet (768–1279px):** reduce parallax travel by half, device-frame tilt reduced to 2°, feature grids drop from 3 to 2 columns, sidebar defaults to collapsed icon-rail (matches existing collapse behavior).
- **Mobile (<768px):** disable orb rotation/parallax entirely (static glow blob instead), single-column stacks, sidebar becomes the existing slide-over overlay, magnetic-button and cursor-spotlight effects disabled (no meaningful cursor on touch), tap targets ≥44px, section vertical padding drops to 56px.

All breakpoints reuse the existing Tailwind scale already present in the codebase (`sm/md/lg/xl`) — no new breakpoint system introduced.

---

## 13. Accessibility

- **Contrast:** body text (`--text-secondary` on `--bg-elevated`) must clear WCAG AA (4.5:1) at all times; glow/gradient text is decorative-only and never the sole carrier of essential information.
- **Focus states:** every interactive element gets a visible `--border-glow` ring (2px, 2px offset) on `:focus-visible` — glass surfaces do not suppress default focus rings; this is non-negotiable even where it slightly interrupts the "quiet" aesthetic.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables all ambient/looping/parallax/magnetic effects; functional transitions collapse to opacity-only, ≤150ms.
- **Keyboard navigation:** full tab-order parity with the existing app (command palette, nav, modals) is preserved as-is; no visual-only affordance may be the only way to trigger an action (e.g. hover-reveal buttons must also be reachable/visible on focus).
- **Motion sickness safety:** no auto-playing effect may exceed a 0.5Hz flicker or a >100px continuous parallax throw; orb rotation stays slow (20s+ per revolution) precisely to stay outside vestibular-trigger territory.

---

## 14. Design Principles (implementation rules)

1. **Depth encodes meaning, not decoration.** If an element doesn't need to be visually "above" or "behind" something else for a reason, it stays flat.
2. **One glow source per screen.** Never let two unrelated elements compete with independent glows in the same viewport.
3. **Glass needs something to blur.** Never place a glass panel over a flat solid background — always over the gradient-mesh/noise canvas or another layer with visible detail.
4. **Emerald leads, teal supports, violet whispers.** Violet/holographic treatment stays under ~5% of any given screen's surface area — it marks "AI-generated," it doesn't decorate everything.
5. **Motion always has a cause.** Every animation is triggered by a real event (scroll into view, hover, load, user action) — nothing animates "just because," except the ambient background, which is explicitly the one permitted idle motion.
6. **Reuse the five-layer z-model exactly.** Every new component is assigned to one of the five depth layers in §9 before it is styled.
7. **Never sacrifice data legibility for aesthetics.** Tables, SQL, and numeric data always render in the highest-contrast, most static treatment available — 3D/glow effects stop at the edge of the data itself.
8. **Consistency over novelty per page.** Each app page (see the preview file) reuses the same chrome (sidebar/header) and the same card/glass primitives — only the content composition changes. No page invents its own one-off component.
9. **Every effect must survive `prefers-reduced-motion` and keyboard-only use.** If it can't be turned off gracefully or reached without a mouse, it doesn't ship.
10. **Brand continuity over reinvention.** Existing tokens (`--background #0a0c11`, `--primary #10b981`, `--border #232936`, `--radius 0.85rem`) are the seed of this system, not a starting point to discard — a returning user should feel this is "the same product, leveled up," not a different product.

---

*End of specification. See `frontend/3d-ui-preview.html` for a static, non-production visual preview of every existing page rendered in this direction.*
