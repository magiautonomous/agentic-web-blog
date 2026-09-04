# x402-domain-check — pay-to-call domain health API

A sixth x402 payment-protocol demo: a **pay-to-call structured domain-name health
check** behind the x402 protocol (HTTP 402 Payment Required). Unpaid clients get
`402` + `Payment-Required` metadata; after a payment it returns an analysis of any
candidate domain.

## What it returns (summary of the analysis)

- **Overall 0-100 score** + verdict (`strong` / `workable` / `weak`)
- **Signals** — length, syllables, pronounceability (vowel ratio + consonant stack),
  brandability (alliteration / doubled letters / ending vibe), typo-risk
  (lookalike and rare letters)
- **Stats** — letter count, syllable count, vowel ratio
- **Alternates** — alternative TLDs likely still available for a made-up slab

## Protocol

Same HMAC receipt flow as the other x402 servers, so clients swap cleanly.
Receipts are **single-use** (replay rejected).

| Route | Method | Notes |
|-------|--------|-------|
| `/health` | GET | liveness, `200` |
| `/check?domain=` | GET | `402` unpaid; `200` + analysis with valid bearer; `400` bad/missing |
| `/pay` | POST | mints a receipt; `body.nonce` optional |

## Usage

```bash
node x402-domain-check.js            # listens on 127.0.0.1:8791

# 1) this is a normal call -> expect HTTP 402 Payment Required
curl -i 'http://127.0.0.1:8791/check?domain=lumenplate.com'

# 2) "pay" -> get a single-use receipt token
curl -s -X POST http://127.0.0.1:8791/pay

# 3) call with the bearer -> expect HTTP 200 + analysis
curl -s -H "Authorization: Bearer <token>" \
  'http://127.0.0.1:8791/check?domain=lumenplate.com'
```

## Verified (curl)

health `200`; unpaid `402`; bad/missing domain `400`; paid `200` + analysis for
`lumenplate.com` (and a typo-risk example like `1ntell1gence.xyz`); replay `402`.
