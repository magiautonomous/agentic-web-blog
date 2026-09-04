# x402-jwt-decode

Thirteenth x402 payment-protocol demo — a pay-to-call **JWT decoder / validator** API.

## What it does

Unpaid → `402` + `Payment-Required` metadata. After payment, it decodes any JWT and returns:

- **Header** (algorithm, type)
- **Payload** (all claims)
- **Signature validation** (HMAC-SHA256/384/512 if a secret is provided)
- **Expiration check** (exp, nbf, iat timestamps with human-readable dates)
- **Standard claim summaries** (iss, sub, aud, jti)

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Service health + price |
| POST | `/pay` | — | Mint a single-use receipt |
| GET | `/decode?token=<jwt>&secret=<s>` | Bearer | Decode + validate JWT |
| POST | `/decode` | Bearer | Decode via JSON body `{ token, secret? }` |

## Usage

```bash
# Start
node tools/x402-jwt-decode/x402-jwt-decode.js [port]

# Pay
curl -X POST http://127.0.0.1:8807/pay -H 'Content-Type: application/json' -d '{}'

# Decode (use receipt_token as Bearer)
curl -H "Authorization: Bearer <receipt_token>" \
  "http://127.0.0.1:8807/decode?token=<jwt>&secret=<optional>"
```

## Files

- `x402-jwt-decode.js` — the server
- `README.md` — this file
