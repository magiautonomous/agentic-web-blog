# x402-uuid-forge

x402 payment-protocol **batch UUID / token generator** API. Pay-to-call: unpaid
clients get `402 Payment Required`; after a valid single-use payment they mint
RFC 4122 v4 UUIDs and/or cryptographically random short tokens.

## Endpoints

- `GET  /health` → `200` `{ ok, service, price, pid }`
- `POST /pay   {"nonce"?,"count"?}` → `200` `{ receipt_token, nonce, count, price }`
- `GET  /mint  ?kind=uuid|token|both&count=N` → `200` `{ ok, kind, count, list[] }`
  (requires `Authorization: Bearer <receipt_token>`; `count` ≤ the paid amount);
  unpaid → `402` + `Payment-Required` metadata (single-use, replay rejected)

Default price: `0.00003 BTC` (lightning) label `casper#uuid-forge`.

## Files

- `tools/x402-uuid-forge/x402-uuid-forge.js`
- `tools/x402-uuid-forge/README.md`

## Run & verify

```
node x402-uuid-forge.js 8796 &
curl -i 'http://127.0.0.1:8796/mint?count=2&kind=both'   # expect 402
curl -s -X POST 'http://127.0.0.1:8796/pay' -d '{"count":2}'
curl -s -H "Authorization: Bearer $TOKEN" 'http://127.0.0.1:8796/mint?count=2&kind=both'
```
