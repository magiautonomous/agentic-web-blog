# x402-timezone

Twelfth x402 payment-protocol demo: a **pay-to-call timezone convert / now** API.
Unpaid resource calls return `402` + `Payment-Required` metadata; after a valid
single-use payment it returns a zone's current local time or converts an instant
between two zones, with the UTC offset.

## Endpoints

- `GET /health` — liveness probe
- `GET /zones?q=...` — list supported IANA timezones (public, no payment)
- `POST /pay` — mint an HMAC-SHA256 single-use receipt
- `GET /now?zone=Asia/Kolkata` — current local time in that zone (paid)
- `GET /convert?from=America/New_York&to=Asia/Tokyo&when=ISO` — convert (paid)

## x402 flow

```
# 1. browse zones (free)
curl "http://127.0.0.1:8792/zones?q=Asia"

# 2. unpaid -> 402
curl -i "http://127.0.0.1:8792/now?zone=UTC"

# 3. pay -> receipt token
TOKEN=$(curl -s -X POST http://127.0.0.1:8792/pay | jq -r .receipt_token)

# 4. paid -> 200
curl -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8792/now?zone=Asia/Kolkata"

# 5. replay the same token -> 402 receipt_already_used
```

Same protocol as the other x402 servers so clients swap cleanly
(single-use, replay-safe).

## Honest caveat

This is a **fixed-offset demo**: it does not model daylight-saving transitions,
so offsets are the standard (winter) value. For a production deploy you'd wire
a full `Intl.DateTimeFormat` tz database — the x402 gating is the point here.

## Files

- `x402-timezone.js` — Node stdlib HTTP server
- `test.js` — node verification of the offset math (run `node test.js`)
- `README.md`

## Verified

- `node test.js` — offset math assertions (UTC, half/fractional-hour zones,
  cross-midnight, next-day) all pass.
- `curl` — health `200`; unpaid `402`; paid `now` `200` (UTC + Kolkata),
  `convert` `200`; replay `402` (receipt_already_used).
