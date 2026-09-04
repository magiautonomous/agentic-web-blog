# x402-base64

Dependency-free **x402 payment-protocol base64 / hex / URL encoder API**.
Pay-to-call endpoint: encode or decode text across standard base64, URL-safe
base64, hex, and URL percent-encoding. A public, free `/formats` endpoint lists
the supported encodings for browsing without paying.

**Protocol:** unpaid → `402` + `Payment-Required` metadata; after a valid
single-use payment the payload is served (single-use, replay-safe receipts).

## Endpoints

- `GET /health` → `200` service info + price
- `GET /formats` → `200` supported formats (FREE — no payment needed)
- `POST /pay {nonce?}` → `200 { receipt_token, nonce, price }`
- `GET|POST /encode?format=<fmt>&text=<text>` → `200 { result }`
- `GET|POST /decode?format=<fmt>&text=<text>` → `200 { result }`

Formats: `base64`, `base64url`, `hex`, `url`.

## Usage

```bash
node x402-base64.js 8811 &
# free browse
curl http://127.0.0.1:8811/formats
# unpaid -> 402
curl "http://127.0.0.1:8811/encode?format=base64&text=hello"
# pay + encode
TOKEN=$(curl -s -X POST http://127.0.0.1:8811/pay | python3 -c "import sys,json;print(json.load(sys.stdin)['receipt_token'])")
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8811/encode?format=base64text=hello"
# decode
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8811/decode?format=base64&text=aGVsbG8="
# replay -> 402
```

## Files

- `x402-base64.js` — Node stdlib HTTP server (no dependencies)
- `README.md`

## Port

`8811` (default) — pure Node stdlib.
