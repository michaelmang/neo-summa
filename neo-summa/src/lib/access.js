const ACCESS_KEY = 'neo-summa-access';
const TRIAL_DAYS = 7;
const TRIAL_MS = TRIAL_DAYS * 24 * 60 * 60 * 1000;
const DEFAULT_CHECKOUT_URL = 'https://buy.stripe.com/3cI7sK7oPfg6fitcXlcfK00';

export function getAccessState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(ACCESS_KEY) || '{}');
    const trialStartedAt = Number(stored.trialStartedAt || 0);
    const now = Date.now();
    const trialEndsAt = trialStartedAt ? trialStartedAt + TRIAL_MS : 0;
    const isPurchased = Boolean(stored.purchasedAt);
    const isTrialActive = Boolean(trialStartedAt && now < trialEndsAt);

    return {
      email: stored.email || '',
      isPurchased,
      isTrialActive,
      hasTrialStarted: Boolean(trialStartedAt),
      trialStartedAt,
      trialEndsAt,
      daysRemaining: isPurchased || !trialEndsAt ? null : Math.max(0, Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000)))
    };
  } catch {
    return {
      email: '',
      isPurchased: false,
      isTrialActive: false,
      hasTrialStarted: false,
      trialStartedAt: 0,
      trialEndsAt: 0,
      daysRemaining: null
    };
  }
}

export function startTrial(email) {
  const existing = getAccessState();
  const access = {
    email,
    trialStartedAt: existing.trialStartedAt || Date.now(),
    purchasedAt: existing.isPurchased ? Date.now() : 0
  };
  window.localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
  return getAccessState();
}

export function markPurchased(email = '') {
  const existing = getAccessState();
  window.localStorage.setItem(ACCESS_KEY, JSON.stringify({
    email: email || existing.email,
    trialStartedAt: existing.trialStartedAt || Date.now(),
    purchasedAt: Date.now()
  }));
  return getAccessState();
}

export function isLocalBypassAvailable() {
  const bypassEnabled = import.meta.env.VITE_ENABLE_LOCAL_PAYWALL_BYPASS !== 'false';
  const localHostnames = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
  return bypassEnabled && (import.meta.env.DEV || localHostnames.has(window.location.hostname));
}

export function canAccessApp(access) {
  return Boolean(access?.isPurchased || access?.isTrialActive);
}

export function getCheckoutUrl(email) {
  const configuredUrl = import.meta.env.VITE_STRIPE_CHECKOUT_URL || DEFAULT_CHECKOUT_URL;
  if (!configuredUrl) return '';

  const url = new URL(configuredUrl, window.location.origin);
  if (email && !url.searchParams.has('prefilled_email')) {
    url.searchParams.set('prefilled_email', email);
  }
  return url.toString();
}

export async function verifyPurchasedAccess(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return { hasAccess: false, email: '', error: 'Email is required' };
  }

  try {
    const response = await fetch('/api/access-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: normalizedEmail })
    });
    const payload = await response.json();

    if (!response.ok) {
      return { hasAccess: false, email: normalizedEmail, error: payload?.error || 'Unable to verify access' };
    }

    return {
      hasAccess: Boolean(payload.hasAccess),
      email: payload.email || normalizedEmail,
      error: ''
    };
  } catch {
    return { hasAccess: false, email: normalizedEmail, error: 'Unable to reach the access server' };
  }
}
