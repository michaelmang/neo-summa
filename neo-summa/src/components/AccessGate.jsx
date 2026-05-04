import { useState } from 'react';

export default function AccessGate({ access, checkoutNotice, canBypassPaywall, onStartTrial, onCheckout, onConfirmPurchase, onBypassPaywall }) {
  const hasExpiredPreview = access.hasTrialStarted && !access.isTrialActive && !access.isPurchased;

  return (
    <main className="access-gate">
      <section className="access-gate-card">
        <p className="landing-kicker">{hasExpiredPreview ? 'Preview complete' : 'Sign up required'}</p>
        <h1>{hasExpiredPreview ? 'Your 7-day preview has ended.' : 'Begin your free preview.'}</h1>
        <p>
          {hasExpiredPreview
            ? 'Unlock lifetime access for $12, or verify the email used for a completed Stripe purchase.'
            : 'Create a free preview account before entering the reader.'}
        </p>

        {hasExpiredPreview ? (
          <PaymentActions email={access.email} onCheckout={onCheckout} onConfirmPurchase={onConfirmPurchase} />
        ) : (
          <AccessForm defaultEmail={access.email} onStartTrial={onStartTrial} />
        )}
        {checkoutNotice ? (
          <p className="checkout-notice">Stripe checkout is not configured yet. Add <code>VITE_STRIPE_CHECKOUT_URL</code> before launch.</p>
        ) : null}
        {canBypassPaywall ? (
          <button className="access-local-bypass" onClick={onBypassPaywall}>Bypass paywall for local testing</button>
        ) : null}
      </section>
    </main>
  );
}

function PaymentActions({ email, onCheckout, onConfirmPurchase }) {
  const [purchaseEmail, setPurchaseEmail] = useState(email || '');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setChecking(true);
    const result = await onConfirmPurchase(purchaseEmail);
    setChecking(false);

    if (!result.hasAccess) {
      setError(result.error || 'No completed Stripe purchase was found for that email.');
    }
  }

  return (
    <div className="access-payment-actions">
      <button className="access-primary" onClick={onCheckout}>Pay $12 on Stripe</button>
      <p>After Stripe confirms your payment, return to this screen and verify the same email used at checkout.</p>
      <form className="activation-form" onSubmit={handleSubmit}>
        <h2>Already paid?</h2>
        <label>
          <span>Purchase email</span>
          <input
            type="email"
            required
            value={purchaseEmail}
            onChange={event => setPurchaseEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>
        <button type="submit" disabled={checking}>{checking ? 'Checking Stripe...' : 'Verify Lifetime Access'}</button>
      </form>
      {error ? <p className="activation-error">{error}</p> : null}
    </div>
  );
}

function AccessForm({ defaultEmail = '', onStartTrial }) {
  function handleSubmit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onStartTrial(String(form.get('email') || '').trim());
  }

  return (
    <form className="trial-form compact" onSubmit={handleSubmit}>
      <label>
        <span>Email</span>
        <input name="email" type="email" required defaultValue={defaultEmail} placeholder="you@example.com" />
      </label>
      <button type="submit">Begin 7-Day Preview</button>
    </form>
  );
}
