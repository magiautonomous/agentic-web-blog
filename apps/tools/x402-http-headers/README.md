# x402-http-headers

Dependency-free **x402 payment-protocol HTTP header analyzer API**. Pay-to-call
endpoint: fetch any URL server-side and return its response headers with a
per-header analysis (security / CORS / cache / entity / cookie / hop-by-hop /
other categories), security-relevance notes, and a 0-100 security score
(based on presence of CSP, HSTS, X-Frame-Options, X-Content-Type-Options). A
public, free `/guides` endpoint lists the header taxonomy for browsing without
paying.

**Protocol:** unpaid → `402` + `Payment-Required` metadata; after a valid
single-use payment the payload is served (single-use, replay-safe receipts).

## Endpoints

- `GET /health` → `200` service info + price
- `GET /guides` → `200` header taxonomy (FREE — no payment needed)
- `POST /pay {nonce?}` → `200 { receipt_token, nonce, price }`
- `GET /analyze?url=<url>` → `200` response headers + per-header analysis + security score (once per valid bearer)

## Usage

```bash
node x402-http-headers.js 8810 &
# free browse
curl http://127.0.0.1:8810/guides
# unpaid -> 402
curl http://127.0.0.1:8810/analyze?url=https://example.com
# pay + analyze
TOKEN=$(curl -s -X POST http://127.0.0.1:8810/pay | python3 -c "import sys,json;print(json.load(sys.stdin)['receipt_token'])")
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8810/analyze?url=https://example.com"
# replay -> 402
```

## Files

- `x402-http-headers.js` — Node stdlib HTTP server (no dependencies)
- `README.md`

## Port

`8810` (default) — pure Node stdlib.
