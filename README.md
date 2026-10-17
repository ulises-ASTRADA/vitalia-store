# Vitalia Store

A Spanish-language wholesale storefront that turns a Google Sheets catalog into a browsable shopping experience and a validated WhatsApp order request. It is designed for a business that manages product data in a spreadsheet and confirms availability, shipping, and payment through a conversation.

[Storefront](https://www.vitalia.energy)

## What the application does

- Browse products by category, search without accent sensitivity, sort results, and inspect product details.
- Preserve the cart and theme preference in browser storage across navigation and reloads.
- Build configurable product boxes and offer complementary products through shared pricing rules.
- Prepare an order on a dedicated checkout page, with required customer fields and server-validated product IDs, quantities, and totals.
- Open a prepared WhatsApp message for the customer to send manually. Preparing an order does not send a message or process a payment.

## Architecture and decisions

```text
Google Sheets → server catalog loader → Next.js pages and catalog API
                                             ↓
                                     React storefront/cart
                                             ↓
                              checkout API validates the order
                                             ↓
                                  customer opens WhatsApp
```

**Stack:** Next.js 16 App Router, React 19, JavaScript, Chakra UI 3, Emotion, next-themes, Google Sheets, and Vercel. Node.js 24 is specified in `package.json`.

| Area | Where to review |
| --- | --- |
| Catalog parsing and source configuration | `lib/catalog.js`, `lib/render-catalog.js` |
| Order validation and shared HTTP handlers | `lib/checkout.js`, `server/checkout.js` |
| Product boxes and offer calculations | `lib/boxes.js`, `lib/cart-offers.js`, `lib/recommendations.js` |
| Storefront, cart, and checkout UI | `components/`, `app/checkout/`, `app/boxes/` |
| Security controls and verification history | `lib/request-security.js`, `proxy.js`, `security/STATUS.md` |
| Automated checks | `tests/`, `.github/workflows/ci.yml` |

Catalog data uses a shared server cache with a 60-second revalidation interval. HTML responses are dynamic to support a per-response CSP nonce. Checkout validates against the server catalog cache; final availability is confirmed by the business. The local catalog is an explicit preview option rather than a silent production fallback.

## Run locally

```bash
git clone https://github.com/ulises-ASTRADA/vitalia-store.git
cd vitalia-store
npm ci
npm run dev
```

Open `http://localhost:3000`. Without a configured Google Sheet, local development uses the preview catalog. Create an untracked `.env.local` when configuring integrations:

| Variable | Purpose |
| --- | --- |
| `PREVIEW_MODE` | Explicitly use the local catalog when `true` |
| `GOOGLE_SHEETS_ID`, `GOOGLE_SHEETS_TAB` | Catalog spreadsheet and tab |
| `GOOGLE_SHEETS_PUBLIC` | Use public spreadsheet access when `true` |
| `WHATSAPP_NUMBER` | Business destination in international digits |
| `STORE_NAME`, `STORE_CURRENCY` | Store presentation and currency |
| `ALLOW_TEST_CHECKOUT` | Enable marked test orders outside production |

Private Sheets access can use server-only service account configuration supported by `lib/catalog.js`. Never commit a service account private key. A preview catalog alone does not enable live checkout; configure the destination and appropriate checkout mode explicitly.

## Validation

```bash
npm test
npm run test:ui
npm run build
npm run test:http
```

The tests cover catalog and order rules, box selection, offers, security behavior, and React interactions. The HTTP check requires a production build with matching environment configuration; consult `scripts/verify-next.mjs` and CI for its test setup. These commands are available checks, not a claim that they have been rerun for every documentation update.

## Operational boundaries

The application prepares an order request. It does not implement payment settlement, an inventory reservation system, or automatic WhatsApp delivery. Cart data stays in the browser until checkout submission. Request limits are per instance rather than distributed across a fleet.

See [deployment notes](CONTINUAR_DESPLIEGUE.md), [security status](security/STATUS.md), and [checkout and marketing notes](CHECKOUT_Y_MARKETING.md) for operational detail. Some older notes describe earlier behavior; the current source and security status take precedence.
