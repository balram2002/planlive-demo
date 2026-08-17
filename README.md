# liveWAB demo/test

A close clone of planLive's live-shopping experience — same components,
same interactions, same design system — adapted for a no-accounts,
COD-only demo:

- **`/`** — buyer discover page: category rail + auto-refreshing live-stream
  grid, styled like planLive's own (`StreamCard`, `CategoryRail`), with a
  footer link through to the seller studio.
- **`/live/[streamId]`** — buyer live room, matching planLive's feature set:
  LiveKit video, live chat (with broadcaster moderation), double-tap/button
  heart reactions with floating animation, a rolling activity ticker
  (joins/likes/shares/follows), a pinned "featured product" card, a
  full-screen "someone just bought this" celebration when any order lands, a
  live viewer count, a full share sheet (WhatsApp/Telegram/X/Facebook/Email/
  native share), a three-dot menu (mute audio / hide video / report), and a
  "Shop" button opening the product panel with **Buy Now** → a checkout
  drawer.
- **`/backstage-92k4x7`** — seller studio (see below), password-gated.

No accounts, no sign-in, no online payment. Checkout only asks for a name,
mobile number (not OTP-verified) and delivery address, then places a **Cash
on Delivery** order. Chat/reactions/notices ride the LiveKit data channel —
nothing is stored in the database, it only exists for as long as the room
does.

**One thing is necessarily different**: *Follow* has no buyer account to
persist against (there are none), so it's a per-browser, per-stream
`localStorage` toggle — real interaction, cosmetic persistence. Said plainly
here rather than silently faking a real follow relationship.

## The seller studio: hidden path + password, not auth

`/backstage-92k4x7` is the seller studio — matching planLive's actual
architecture, its mutations (`createProduct`, `startStream`, `endStream`,
`createProductInLive`, `addProductToStream`, `removeProductFromStream`,
`setFeaturedProduct`, `adjustStock`) are real Next.js **Server Actions**
(`src/app/backstage-92k4x7/actions.ts`), not REST calls.

The funnel: add products → pick a category (required) → review → go live.
Once live, this same page becomes the broadcast studio:

- Camera/mic controls, the same chat/reactions/notices/celebration the buyer
  sees, plus moderation (delete a message, mute a sender).
- **Live console**: live order/revenue stats, pin/unpin the featured
  product, adjust stock ±1, remove a product from the stream, add an
  existing product to the stream, or add a brand-new product without
  leaving the broadcast (`LiveAddProduct` — same overlay-pill-on-video
  pattern as planLive).

The URL isn't linked from the buyer-facing pages except the discover page's
footer link — that link makes the path discoverable, so it is **not** the
real protection. The real protection is a password gate in front of it
(`SELLER_PASSWORD`). Every seller-only route and action independently checks
a signed session cookie, so even someone who has the URL can't add products
or go live without the password.

**Change the path**: rename the `src/app/backstage-92k4x7` folder (the
actions file lives alongside it) to whatever you want the URL to be, and
update the footer link in `src/app/page.tsx` to match.

**Change the password**: set `SELLER_PASSWORD` in your env. Sessions last 12
hours per browser (httpOnly cookie); there's a "Lock" button in the studio to
end one early.

## How "authless broadcasting" works

Separately from the password gate above: once inside the studio, nothing
server-side can tell "the seller's browser" apart from anyone else's for
LiveKit purposes. The `startStream` action mints a random `broadcastSecret`
and returns it once, to the caller only. The seller's browser stashes it in
`localStorage`; minting a LiveKit *publish* token requires presenting it.
Lose it — clear localStorage, open a different browser — and you can no
longer control that specific stream, only watch it end on its own.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, LIVEKIT_*, SELLER_PASSWORD, (optional) ImageKit
npm run db:check             # verify the DB connection before anything else
npm run dev
```

This app is designed to reuse the **same env vars** as the main planLive
project — `DATABASE_URL` (must point at a different database than
production, since the Prisma models here are a different shape),
`LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` / `LIVEKIT_URL`, and optionally the
`NEXT_PUBLIC_IMAGEKIT_*` / `IMAGEKIT_PRIVATE_KEY` trio. If ImageKit isn't
configured, product photos fall back to local disk storage at
`public/uploads/`. `SELLER_PASSWORD` is new to this app (planLive doesn't
have it) — pick your own value.

> **Use a separate database** from the production planLive app — this
> schema (`Product`, `Stream`, `Category`, `Order`) doesn't include seller
> accounts, so pointing it at the same database as the real app would leave
> orphaned/incompatible data on both sides.

### `DATABASE_URL` must include a database name

MongoDB connection strings copied straight from the Atlas "Connect" dialog
often look like `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?appName=Cluster0`
— no database name before the `?`. Prisma's Mongo connector rejects that with
`empty database name not allowed`, and since almost every route in this app
touches the database, that one typo makes most of them fail at once. Add a
name:

```
mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/livewab_demo?retryWrites=true&w=majority
```

`npm run db:check` catches this (and a couple of other common misconfigs —
Atlas IP allowlist, a paused cluster) with a specific message instead of a
raw driver stack trace. Run it after changing `DATABASE_URL`, and again after
deploying if things start 500ing in production.

### Deploying (e.g. Vercel)

Set every var from `.env.local` in your host's environment settings too —
`.env.local` is never deployed. If DB calls fail only in production, it's
almost always **Atlas Network Access**: Vercel's outbound IPs are dynamic, so
the cluster's IP allowlist needs `0.0.0.0/0` (or Vercel's Secure Compute with
a static IP, if you have it) — not just your own machine's IP.

## Seeding demo data

```bash
npm run db:check                                    # confirm the DB connection first
node --env-file=.env.local scripts/seed-categories.mjs
node --env-file=.env.local scripts/seed-demo.mjs    # 5 demo products with real hosted images
```

Both are safe to re-run.

## Notes on scope

- Single implicit seller — only one stream can be live at a time.
- Stock is decremented atomically at the moment an order is placed (no
  separate "hold" step, since there's no signed-in buyer to hold it for).
- Orders are Cash on Delivery only; there's no order-status/fulfilment
  tracking beyond "placed" — this is a funnel demo, not a full commerce
  backend.
- `/api/health` reports DB connectivity + which integrations are configured,
  without leaking secrets — hit it after any deploy to sanity-check.
- Full design-system parity with planLive: light/dark theme (via
  `next-themes`, follows system preference), the same product-attribute
  presets (clothing sizes, electronics storage/RAM, etc.), the same toast
  system, the same motion vocabulary.
