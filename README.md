# liveWAB demo/test

A stripped-down clone of the planLive app for demoing the core live-shopping
loop end to end, with nothing else in the way:

- **`/`** — seller "start live" studio: add products (with a photo), pick
  which ones to feature, go live. Once live, this same page becomes the
  broadcast view (camera/mic controls + End stream).
- **`/discover`** — buyer list of currently-live streams.
- **`/live/[streamId]`** — buyer live room: LiveKit video + a "Shop" button
  that opens the product list, each with **Buy Now** → a checkout drawer.

That's the entire app. No accounts, no sign-in, no product management pages,
no chat/reactions, no online payment. Checkout only asks for a name, mobile
number (not OTP-verified) and delivery address, then places a **Cash on
Delivery** order.

## How "authless broadcasting" works

There's no login, so nothing server-side can tell "the seller's browser"
apart from anyone else's. Instead, `POST /api/stream/start` mints a random
`broadcastSecret` and returns it once, to the caller only. The seller's
browser stashes it in `localStorage`; every request that needs publish
rights (minting a LiveKit token, ending the stream) has to present it. Lose
it — clear localStorage, open a different browser — and you can no longer
control that stream, only watch it end on its own. Good enough for a demo;
not a real auth system.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, LIVEKIT_*, (optional) ImageKit
npm run db:push              # push the Prisma schema to your MongoDB Atlas cluster
npm run dev
```

This app is designed to reuse the **same env vars** as the main planLive
project — `DATABASE_URL` (must point at a different database/collection
prefix than production if you're testing against the same cluster, since the
Prisma models here are a different shape), `LIVEKIT_API_KEY` /
`LIVEKIT_API_SECRET` / `LIVEKIT_URL`, and optionally the `NEXT_PUBLIC_IMAGEKIT_*`
/ `IMAGEKIT_PRIVATE_KEY` trio. If ImageKit isn't configured, product photos
fall back to local disk storage at `public/uploads/`.

> **Use a separate database** from the production planLive app — this schema
> only has `Product`, `Stream`, and `Order` models and doesn't include seller
> accounts, so pointing it at the same database as the real app would leave
> orphaned/incompatible data on both sides.

## Notes on scope

- Single implicit seller — only one stream can be live at a time.
- Stock is decremented atomically at the moment an order is placed (no
  separate "hold" step, since there's no signed-in buyer to hold it for).
- Orders are Cash on Delivery only; there's no order-status/fulfilment
  tracking beyond "placed" — this is a funnel demo, not a full commerce
  backend.
