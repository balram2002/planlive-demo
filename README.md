# liveWAB demo/test

A stripped-down clone of the planLive app for demoing the core live-shopping
loop end to end, with nothing else in the way:

- **`/`** — buyer discover page: list of currently-live streams.
- **`/live/[streamId]`** — buyer live room: LiveKit video + a "Shop" button
  that opens the product list, each with **Buy Now** → a checkout drawer.
- **`/backstage-92k4x7`** — seller studio (see below). Not linked from
  anywhere in the UI, and gated by a password modal.

That's the entire app. No accounts, no sign-in, no product management pages,
no chat/reactions, no online payment. Checkout only asks for a name, mobile
number (not OTP-verified) and delivery address, then places a **Cash on
Delivery** order.

## The seller studio is hidden, not public

`/backstage-92k4x7` is the seller "start live" studio: add products (with a
photo), pick which ones to feature, go live. Once live, this same page
becomes the broadcast view (camera/mic controls + End stream). Nothing in the
buyer-facing UI links to it.

The hidden URL is only obscurity, though — the actual protection is a
password gate in front of it (`SELLER_PASSWORD`). Every seller-only API route
(`/api/products` POST/GET, `/api/stream/start`, `/api/stream/end`,
`/api/upload`, `/api/imagekit-auth`) independently checks a signed session
cookie, so even someone who finds the URL can't add products or go live
without the password — and calling those APIs directly, bypassing the UI
entirely, doesn't work either.

**Change the path**: rename the `src/app/backstage-92k4x7` folder to whatever
you want the URL to be.

**Change the password**: set `SELLER_PASSWORD` in your env. Sessions last 12
hours per browser (httpOnly cookie); there's a "Lock" button in the studio to
end one early.

## How "authless broadcasting" works

Separately from the password gate above: once inside the studio, nothing
server-side can tell "the seller's browser" apart from anyone else's for
LiveKit purposes. `POST /api/stream/start` mints a random `broadcastSecret`
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
project — `DATABASE_URL` (must point at a different database/collection
prefix than production if you're testing against the same cluster, since the
Prisma models here are a different shape), `LIVEKIT_API_KEY` /
`LIVEKIT_API_SECRET` / `LIVEKIT_URL`, and optionally the `NEXT_PUBLIC_IMAGEKIT_*`
/ `IMAGEKIT_PRIVATE_KEY` trio. If ImageKit isn't configured, product photos
fall back to local disk storage at `public/uploads/`. `SELLER_PASSWORD` is
new to this app (planLive doesn't have it) — pick your own value.

> **Use a separate database** from the production planLive app — this schema
> only has `Product`, `Stream`, and `Order` models and doesn't include seller
> accounts, so pointing it at the same database as the real app would leave
> orphaned/incompatible data on both sides.

### `DATABASE_URL` must include a database name

MongoDB connection strings copied straight from the Atlas "Connect" dialog
often look like `mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/?appName=Cluster0`
— no database name before the `?`. Prisma's Mongo connector rejects that with
`empty database name not allowed`, and since every API route in this app
touches the database, that one typo makes *all* of them fail at once. Add a
name:

```
mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/livewab_demo?retryWrites=true&w=majority
```

`npm run db:check` catches this (and a couple of other common misconfigs —
Atlas IP allowlist, a paused cluster) with a specific message instead of a
raw driver stack trace. Run it after changing `DATABASE_URL`, and again after
deploying if API routes start 500ing in production.

### Deploying (e.g. Vercel)

Set every var from `.env.local` in your host's environment settings too —
`.env.local` is never deployed. If DB calls fail only in production, it's
almost always **Atlas Network Access**: Vercel's outbound IPs are dynamic, so
the cluster's IP allowlist needs `0.0.0.0/0` (or Vercel's Secure Compute with
a static IP, if you have it) — not just your own machine's IP.

## Notes on scope

- Single implicit seller — only one stream can be live at a time.
- Stock is decremented atomically at the moment an order is placed (no
  separate "hold" step, since there's no signed-in buyer to hold it for).
- Orders are Cash on Delivery only; there's no order-status/fulfilment
  tracking beyond "placed" — this is a funnel demo, not a full commerce
  backend.
