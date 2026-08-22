# Design System — Ganesh Chaturthi Ledger

Companion to `ganesh-chaturthi-ledger-PRD.md`. This defines the visual language: colors, type, and sizing rules, so every screen looks consistent when built.

## Design direction

This is a **money ledger used outdoors, on phones, often in bright daylight**, by non-technical youth volunteers. The look should feel like a **temple donation board / bank passbook** — trustworthy, legible, a little ceremonial — not a generic SaaS dashboard. Avoid the default "AI app" look (cream background + terracotta accent, or black + neon accent). Draw color from actual festival materials: marigold garlands, durva grass, sindoor, brass lamps, peacock-blue accents on Ganesh idols.

**Signature element:** the totals bar at the top of the Dashboard is styled like a physical donation tally board — large tabular-mono numbers, a marigold underline rule, "Collected / Spent / Balance" as fixed labels, always visible, never buried in a card.

---

## Color Tokens

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FBF3E4` | App background — warm ivory, not stark white |
| `ink` | `#2B1B12` | Primary text — warm near-black |
| `ink-muted` | `#6B5C4E` | Secondary text, timestamps, captions |
| `marigold` | `#D99A1B` | Primary accent — CTAs, active states, the signature totals rule |
| `durva` | `#4B7A4E` | Chanda / income — positive amounts, "collected" badges, success states |
| `sindoor` | `#A83232` | Expense / spending — expense amounts, destructive-adjacent states (never used for delete, since nothing is deletable — used for "spent" only) |
| `peacock` | `#1F6E76` | Links, secondary interactive elements, View-Only badge, admin accents |
| `line` | `#E4D9C4` | Hairline dividers between ledger rows |
| `surface` | `#FFFFFF` | Cards/sheets sitting on `paper` |

**Usage rule:** `durva` and `sindoor` are reserved *only* for chanda vs. expense amounts throughout the app (list rows, totals, charts). Never repurpose them for anything else — that consistency is what makes the ledger scannable at a glance.

---

## Typography

Three type roles, each doing one job:

| Role | Typeface | Fallback stack |
|---|---|---|
| **Display** (headings, totals) | Fraunces (variable, use weight 500–600) | `'Fraunces', Georgia, serif` |
| **Body / UI** (labels, buttons, lists) | Inter | `'Inter', system-ui, sans-serif` |
| **Amounts** (all currency figures) | IBM Plex Mono (tabular figures) | `'IBM Plex Mono', ui-monospace, monospace` |

**Why a mono face for amounts:** in a ledger, numbers need to align vertically in columns and be impossible to misread (₹500 vs ₹5000 at a glance). Tabular mono digits solve this; it's also a deliberate visual cue that "this is a number that means money," distinct from headings/body.

**Regional names:** donor and member names may be entered in Telugu/Hindi/other Indic scripts. Add `Noto Sans Telugu` and `Noto Sans Devanagari` as fallbacks after Inter in the body stack so names never render as tofu boxes:
`font-family: 'Inter', 'Noto Sans Telugu', 'Noto Sans Devanagari', system-ui, sans-serif;`

### Type Scale

| Token | Size / Line-height | Weight | Face | Example use |
|---|---|---|---|---|
| `display-xl` | 40px / 44px | 600 | Fraunces | Balance figure on Dashboard |
| `display-lg` | 28px / 34px | 600 | Fraunces | Total Collected / Total Spent |
| `heading-1` | 22px / 28px | 600 | Fraunces | Screen titles ("Dashboard", "Members") |
| `heading-2` | 18px / 24px | 600 | Inter | Section headers ("Recent Chanda") |
| `body` | 15px / 22px | 400 | Inter | Default text, form labels |
| `body-strong` | 15px / 22px | 600 | Inter | Donor/vendor names in list rows |
| `caption` | 13px / 18px | 400 | Inter | Timestamps, "Entered on…", helper text |
| `amount-lg` | 20px / 26px | 500 | IBM Plex Mono | Amount in a transaction detail view |
| `amount-sm` | 15px / 20px | 500 | IBM Plex Mono | Amount inline in a list row |
| `badge` | 12px / 16px | 600, uppercase, tracked +0.02em | Inter | "FULL ACCESS", "VIEW ONLY", "ADMIN" tags |

---

## Component color mapping

- **Chanda amount:** `durva` text, prefixed with `+`
- **Expense amount:** `sindoor` text, prefixed with `−`
- **Balance figure:** `ink` if ≥ 0 always (balance shouldn't alarm anyone with red — festivals often run tight before donations catch up)
- **Primary button** (Save Chanda, Save Expense, Post Announcement): `marigold` background, `paper` text
- **Secondary/outline button:** transparent, `ink` text, `line` border
- **Sync status badge:** "Synced" → `durva` dot; "Pending sync" → `marigold` dot with subtle pulse; never `sindoor` (offline isn't an error state, it's expected behavior)
- **Admin badge:** `peacock` background tint, `peacock` text
- **View Only badge:** `ink-muted` background tint, `ink-muted` text

---

## Layout notes

- Ledger rows use `line` (1px) hairline dividers, not shadow-based cards — reinforces the passbook/register feel.
- Generous tap targets (min 44px height) — this is used one-handed while standing outdoors.
- Numbers are always right-aligned in list rows so amounts form a clean visual column, per standard ledger convention.
- Keep border-radius modest and consistent (6–8px) — enough to feel modern, not so much it feels playful; this app handles other people's money.

---

## Tailwind config snippet (for the coding assistant)

```js
// tailwind.config.js — extend theme
colors: {
  paper: '#FBF3E4',
  ink: { DEFAULT: '#2B1B12', muted: '#6B5C4E' },
  marigold: '#D99A1B',
  durva: '#4B7A4E',
  sindoor: '#A83232',
  peacock: '#1F6E76',
  line: '#E4D9C4',
  surface: '#FFFFFF',
},
fontFamily: {
  display: ['Fraunces', 'Georgia', 'serif'],
  sans: ['Inter', 'Noto Sans Telugu', 'Noto Sans Devanagari', 'system-ui', 'sans-serif'],
  mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
},
```
