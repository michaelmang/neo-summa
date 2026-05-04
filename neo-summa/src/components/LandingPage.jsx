import { useState } from 'react';

const FEATURE_ROWS = [
  ['Linked citations', 'Internal Summa references open in place, including inferred article references.'],
  ['Authority index', 'See whom Aquinas answers, invokes, and discusses across the work.'],
  ['Scholarly reading modes', 'Move between the full article, the respondeo, replies, and Latin text.'],
  ['Reference panel', 'Open Scripture and imported works beside the article without losing your place.']
];

export default function LandingPage({ access, checkoutNotice, onStartTrial, onOpenApp, onCheckout }) {
  const [email, setEmail] = useState(access.email || '');
  const accessMessage = getAccessMessage(access);

  function handleSubmit(event) {
    event.preventDefault();
    onStartTrial(email.trim());
  }

  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <button className="landing-brand" onClick={onOpenApp}>
          <span>Summa Theologica</span>
          <small>Neo Summa Reader</small>
        </button>
        <div className="landing-nav-actions">
          <button className="landing-link-button" onClick={onOpenApp}>Open App</button>
          {access.isPurchased ? null : (
            <button className="landing-link-button" onClick={onCheckout}>Unlock for $12</button>
          )}
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">A scholarly reader for Aquinas</p>
          <h1>Read the Summa with its questions, authorities, and references close at hand.</h1>
          <p>
            Neo Summa keeps the familiar simplicity of an HTML text while adding the apparatus that makes
            repeated study easier: linked articles, authority counts, Latin toggles, advanced search, and
            a right-hand reference panel.
          </p>

          <div className={`trial-status ${accessMessage.tone}`}>
            <strong>{accessMessage.title}</strong>
            <span>{accessMessage.detail}</span>
          </div>

          {access.hasTrialStarted || access.isPurchased ? (
            <button className="landing-primary-action" onClick={onOpenApp}>Open App</button>
          ) : (
            <form className="trial-form" onSubmit={handleSubmit}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <button type="submit">Begin 7-Day Preview</button>
            </form>
          )}
          {checkoutNotice ? (
            <p className="checkout-notice">Stripe checkout is not configured yet. Add a Checkout link or backend endpoint in <code>VITE_STRIPE_CHECKOUT_URL</code>.</p>
          ) : null}
          <p className="trial-note">No credit card required for the preview. Lifetime access is a one-time $12 purchase.</p>
        </div>

        <div className="landing-reader-preview" aria-label="Reader preview">
          <div className="preview-topline">Prima Pars · Question 1 · Article 1</div>
          <h2>Whether, besides philosophy, any further doctrine is required?</h2>
          <div className="preview-table">
            <div>Authorities Invoked</div>
            <p>Sacred Scripture</p>
            <div>Authorities Discussed</div>
            <p>Sacred Scripture; Augustine; Dionysius</p>
            <div>Cited By</div>
            <p>TP Q.75 A.5</p>
          </div>
          <p className="preview-body">
            It was necessary for man&apos;s salvation that there should be a knowledge revealed by God
            besides philosophical science built up by human reason.
          </p>
        </div>
      </section>

      <section className="landing-feature-table">
        <header>
          <h2>Built for study, not distraction.</h2>
          <p>A quieter interface for professors, students, teachers, seminarians, and serious readers.</p>
        </header>
        <table>
          <tbody>
            {FEATURE_ROWS.map(([feature, detail]) => (
              <tr key={feature}>
                <th scope="row">{feature}</th>
                <td>{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function getAccessMessage(access) {
  if (access.isPurchased) {
    return {
      tone: 'purchased',
      title: 'Lifetime access is active',
      detail: 'Open the app and continue reading.'
    };
  }

  if (access.isTrialActive) {
    return {
      tone: 'active',
      title: `${access.daysRemaining} preview day${access.daysRemaining === 1 ? '' : 's'} remaining`,
      detail: 'No card required during the preview. Unlock lifetime access for $12 when it ends.'
    };
  }

  if (access.hasTrialStarted) {
    return {
      tone: 'expired',
      title: 'Your preview has ended',
      detail: 'Open the app to verify a completed purchase or unlock lifetime access.'
    };
  }

  return {
    tone: 'fresh',
    title: 'Start with a 7-day preview',
    detail: 'Use the full reader first. Pay once only if it becomes useful.'
  };
}
