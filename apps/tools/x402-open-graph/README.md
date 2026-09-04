# x402-open-graph — pay-to-call Open Graph extractor

An eighth x402 payment-protocol demo: a **pay-to-call Open Graph / social-preview
extractor**. Unpaid clients get `402` + `Payment-Required` metadata; after a
payment it fetches a remote URL server-side and returns its `og:title`,
`og:description`, `og:image`, `twitter:card` etc. — so you can preview how a link
will render when shared.

## What it returns

- `title` (plain `<title>`), `canonical`, `description`, `lang`
- `og` — `title`, `description`, `image`, `url`, `type`, `site_name`
- `twitter` — `card`, `title`, `description`, `image`

## Protocol

Same HMAC receipt flow as the other x402 servers, so clients swap cleanly.
Receipts are **single-use** (replay rejected). The fetch is server-side (Node
stdlib `http`/`https`, redirect + timeout + size-limit handled); a bad/unfetchable
target consumes the token and returns `502`.

| Route | Method | Notes |
|-------|--------|-------|
| `/health` | GET | liveness, `200` |
| `/og?url=` | GET | `402` unpaid; `200` + og data with valid bearer; `400` bad URL; `502` fetch failed |
| `/pay` | POST | mints a receipt; `body.nonce` optional |

## Usage

```bash
node x402-open-graph.js            # listens on 127.0.0.1:8793

curl -i 'http://127.0.0.1:8793/og?url=https://example.com'    # expect HTTP 402
curl -s -X POST http://127.0.0.1:8793/pay                     # -> single-use token
curl -s -H "Authorization: Bearer <token>" \
  'http://127.0.0.1:8793/og?url=https://example.com'          # expect HTTP 200
```

## Verified (curl)

health `200`; unpaid `402`; bad/missing URL `400`; paid fetch of
`https://example.com` `200` with title/canonical/og data; paid fetch of a
rich-page URL shows populated `og` / `twitter` fields; replay `402`.
