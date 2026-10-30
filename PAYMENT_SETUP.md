# Crypto payment setup

USDT is accepted on BNB Smart Chain (BEP20) and Solana only. BSC uses canonical USDT with 18 decimals; Solana uses canonical USDT with 6 decimals.

## Credentials

Configure `BSCSCAN_API_KEY` and `HELIUS_API_KEY` using Lovable's secure secrets form. The code references these environment names but deliberately does not store fake placeholder credentials. BNB Smart Chain uses the Etherscan V2 API with chain ID 56; supply an Etherscan V2 key with BSC access, not a legacy BscScan-only key. Solana uses a Helius mainnet RPC key. Networks remain disabled until their key exists.

The current saved Etherscan key returns "Free API access is not supported for this chain" for BSC. Upgrade to a plan with BSC access before accepting BEP20 payments. Invoice creation probes BSC access and refuses to request funds if the explorer rejects the key. The saved Helius key passed a mainnet health check.

## Runtime environment (checkout)

`createPayment` is an authenticated server function. It needs these variables in the **deployment runtime** (Vercel → Project → Settings → Environment Variables, or the Lovable Cloud project env), not only in GitHub Actions secrets — Actions secrets are only used to run the build, they are not injected into the running app.

| Variable                                             | Used by                                       | Notes                                                                                                                                         |
| ---------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                       | service-role client, token verification       | Server-side base URL. `VITE_SUPABASE_URL` is used as a documented fallback and reported in the diagnostic summary when it supplies the value. |
| `SUPABASE_SERVICE_ROLE_KEY`                          | `createPayment` (`create_crypto_invoice` RPC) | Server-only secret. Never expose it through a `VITE_` variable.                                                                               |
| `SUPABASE_PUBLISHABLE_KEY`                           | bearer-token verification                     | Public key used to validate the caller's session token.                                                                                       |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | browser client                                | Inlined by Vite at build time.                                                                                                                |

The server client reads `process.env` per request (never at module scope) and keys its client cache by the exact url+key pair, so a worker or cold start that receives its environment late still resolves the right backend.

Checkout failures now show the reason instead of a blank "Payment failed. Please try again.":

- `Payment failed: Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY.` — `stage: config`, plus a secret-free summary such as `SUPABASE_URL=set SUPABASE_SERVICE_ROLE_KEY=MISSING host=…`.
- `Payment failed: <PostgREST message>` — `stage: database · code: <pg code>`, e.g. `42883` when `public.create_crypto_invoice` is missing because `drizzle/migrations/0002_manual_payment_verification.sql` was not applied, or `42501` when the RPC is not executable by the service role.
- `Payment failed: Unauthorized: …` — `stage: auth`; the client refreshes the session once and retries the call automatically.
- `Payment failed: No active session found. Sign in again and retry.` — no request was sent because the browser had no access token.

Matching detail is written to the server log as `[createPayment] …` with the user, card, method, Postgres code/details/hint and the environment summary (never the key values).

## Delivery inventory

In Admin → Card details, add one real prepaid card's delivery details at a time, associated with its product. Each unit is reserved atomically for one invoice and is never exposed in public product reads. No sample card numbers are generated. Checkout is blocked if there is no available delivery unit.

## Verification

The managed `vcard-verify-crypto-payments` schedule calls `/api/public/jobs/verify-payments` every minute with managed bearer authentication. Publish the app before relying on production callbacks. Do not supply webhook secrets or publishable keys to the schedule.

BscScan / Etherscan V2 discovers BSC USDT transfers with block bounds and persistent pagination. Verification then checks BSC mainnet, finalized height, successful canonical receipt, exact recipient and receipt USDT balance transfer amount. Solana uses Helius finalized signatures/transactions, recipient USDT token accounts, exact balance delta and the Memo program order UUID. Payment timestamp must fall within the invoice's 30-minute window. Delayed detection still honors the original transaction time.

Five invoices per callback are selected oldest-check-first to bound workload. Large volume or very busy recipient wallets may delay checks beyond one minute. Provider errors are saved for review; public RPC outages fail closed. Unpaid or rejected orders retain their reserved unit: an admin must reconcile the chain before reassigning it, preventing late payments from receiving a resold card. Wrong amounts, late payments, missing memos, and unsupported tokens need manual review.

Only server-role RPCs can create/fulfill invoices. Unique transaction references prevent reuse, and row locks make repeated fulfillment idempotent. Manual admin approval/rejection remains available and requires delivery details before completion.

## Validation boundary

Unit tests cover wallet values, exact matching, canonical tokens, memo, finality, timestamps and QR payment parameters. Real mainnet payment verification must be tested after valid provider keys and real private card inventory are supplied. Never mark a fabricated payment as verified.
