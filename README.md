# localstr

A hyperlocal, location-based **Nostr client**. Open it and see what's happening
around you: live chat, notes, and calendar events — all plain Nostr events
filtered by **geohash**.

Mobile-first PWA built with Next.js (App Router), TypeScript, Tailwind,
`nostr-tools`, `ngeohash`, and Leaflet. Deployable to Vercel as-is (static
client app, no server state).

## What it does

- **Now** — live IRC-style chat for your geohash cell (kind `20000` ephemeral
  events, wire-compatible with **bitchat** and Nymchat: `["g", geohash]` +
  optional `["n", nick]`).
- **Feed** — kind `1` notes tagged with nearby geohashes, newest first, with
  replies (NIP-10), reactions (NIP-25), and zaps (NIP-57: counts from `9735`
  receipts, sending via LNURL → WebLN or invoice QR).
- **Events** — NIP-52 calendar events (`31922`/`31923`) tagged nearby, sorted
  by start time.
- **Map** — your cell + its 8 neighbors as rectangles with per-cell activity;
  tap a cell (or anywhere) to **teleport** and browse that place's feed.
- **Identity** — NIP-07 browser extension if you have one; otherwise an
  ephemeral local key (localStorage) so you can lurk and chat immediately.
- **No location permission?** Search any place (Nominatim) and browse it.

## Geohash model (the important design decision)

A "nearby" radius circle never aligns with geohash cell boundaries — if you
only query the cell you're standing in, someone 50 m away across a cell edge
is invisible. So the query unit is always **the user's cell plus its 8
neighbors** (`ngeohash.neighbors`) at the chosen precision:

| Zoom | Geohash length | Cell size (approx.) |
|------|----------------|---------------------|
| Block | 6 | ~0.6 km |
| Hood (default) | 5 | ~5 km |
| City | 4 | ~20 km |
| Region | 3 | ~150 km |

**Publishing:** notes are tagged with the geohash at the chosen precision
*and every shorter prefix* (`u0yjb`, `u0yj`, `u0y`, `u0`, `u`), so a relay
query at any coarser precision still matches them with an exact `#g` filter.
Chat messages carry a single `g` tag at the current precision, matching the
bitchat convention.

**Relays that don't index `#g`:** some relays ignore unknown tag filters and
return everything. Every geo subscription therefore re-checks events
client-side (`matchesCells`): an event counts as "here" if any of its `g`
tags equals one of the 9 cells or is a finer-precision hash inside one
(prefix match).

## Architecture

```
src/
├── app/                    Next.js shell (all UI is client-side; SSR skipped)
├── lib/
│   ├── geo.ts              precisions, cell set (+8 neighbors), prefix tags,
│   │                       client-side match fallback
│   ├── location.ts         browser geolocation, Nominatim search/reverse
│   ├── store.ts            zustand app store (position, precision, tab,
│   │                       persisted: relays / nickname / precision)
│   └── nostr/
│       ├── manager.ts      THE nostr layer: one SimplePool, geo-scoped
│       │                   subscriptions, meta + profile fetching, publish
│       ├── nostrStore.ts   runtime event caches (chat/notes/calendar/meta/
│       │                   profiles/cell activity) as a zustand store
│       ├── identity.ts     NIP-07 signer + local ephemeral key fallback
│       ├── publish.ts      event builders: note, reply, chat, reaction
│       ├── zaps.ts         NIP-57 send flow (LNURL → invoice → WebLN/QR)
│       ├── zapParse.ts     zap receipt → msats (bolt11 hrp parser)
│       └── kinds.ts        kind constants + interop notes
└── components/             UI only — no relay logic in components
```

**Nostr ↔ UI separation.** Components never talk to relays. They read from
`useNostrStore` (plain data) and call `publish.ts` helpers. All relay I/O
lives in `manager.ts`, a singleton around **one** `SimplePool`:

- Three geo-scoped subscriptions (chat / notes / calendar) are torn down and
  re-created — **debounced 500 ms** — whenever the cell set or relay list
  changes, so panning/zooming/teleporting collapses into one re-subscribe.
- A **meta** subscription follows the ~100 most recent visible notes and
  pulls reactions (kind 7), replies (kind 1 `#e`), and zap receipts (9735),
  re-issued debounced as new notes stream in.
- Kind-0 **profiles** are batch-fetched (debounced, deduplicated, EOSE-closed).
- `SimplePool` **verifies the signature of every incoming event**; invalid
  events never reach handlers. Note content is rendered as escaped text only
  (URLs linkified, images lazy-loaded) — no raw HTML, ever.
- Ephemeral kind-20000 subscriptions use a `since` window; relays don't store
  them, which is the point.

## NIP decisions

| Concern | Choice | Why |
|---|---|---|
| Local chat | kind 20000 + `g`/`n` tags | bitchat/Nymchat interop — don't invent a chat kind |
| Notes | kind 1 + `g` prefix tags | works with exact-match `#g` filters at every zoom |
| Events | NIP-52 (31922/31923) | existing calendar ecosystem; addressable dedupe by `(kind, pubkey, d)` |
| Reactions | NIP-25 `+` | simplest interoperable like |
| Zaps | NIP-57 | receipts for counts; LNURL-pay + WebLN/QR for sending |
| Identity | NIP-07 → local key | extension when available, zero-friction lurking otherwise |
| Reviews | **not in MVP** | planned as NIP-32 labels (kind 1985 + `g` tags); the manager's scope-keyed subscriptions make adding a "reviews" scope a one-liner — see `kinds.ts` TODO |

Also intentionally skipped for the MVP: Cashu rewards, push notifications,
native builds.

## Default relays

`relay.damus.io`, `nos.lol`, `relay.primal.net`, `offchain.pub`, `nostr.wine`
— editable in Settings (persisted locally).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (what Vercel runs)
npm run typecheck
```

Deploy: push to a repo and import into Vercel — no env vars required.
