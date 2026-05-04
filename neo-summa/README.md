# Neo Summa Reader

## Local Development

```bash
npm install
npm run dev
```

The local paywall bypass appears only on localhost/dev builds when:

```env
VITE_ENABLE_LOCAL_PAYWALL_BYPASS=true
```

## Stripe/Vercel Launch Setup

Set these environment variables in Vercel for production:

```env
VITE_STRIPE_CHECKOUT_URL=https://buy.stripe.com/3cI7sK7oPfg6fitcXlcfK00
VITE_ENABLE_LOCAL_PAYWALL_BYPASS=false
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_EXPECTED_AMOUNT=1200
STRIPE_EXPECTED_CURRENCY=usd
STRIPE_PAYMENT_LINK_ID=plink_...
```

`STRIPE_PAYMENT_LINK_ID` is optional but recommended. It prevents unrelated Stripe payments from granting access.

## Stripe Webhook

In Stripe, create a webhook endpoint for:

```text
https://neo-summa.vercel.app/api/stripe-webhook
```

Subscribe to:

```text
checkout.session.completed
```

Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Access Flow

1. A reader starts a seven-day preview with their email.
2. After preview, they pay via the Stripe Payment Link.
3. Stripe sends `checkout.session.completed` to `/api/stripe-webhook`.
4. The webhook marks the Stripe Customer metadata with lifetime access.
5. The app verifies access by posting the email to `/api/access-status`.

The browser still caches access in localStorage for convenience, but Stripe is the durable source of truth.
