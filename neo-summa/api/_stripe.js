const ACCESS_METADATA_KEY = 'neo_summa_lifetime_access';
const ACCESS_PURCHASED_AT_KEY = 'neo_summa_purchased_at';
const ACCESS_SOURCE_KEY = 'neo_summa_access_source';

export async function stripeRequest(path, { method = 'GET', body } = {}) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Stripe-Version': '2024-06-20'
    },
    body: body ? new URLSearchParams(body) : undefined
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Stripe request failed with ${response.status}`);
  }

  return payload;
}

export async function markCustomerLifetimeAccess({ customerId, email, source = 'stripe_checkout' }) {
  const id = customerId || await createAccessCustomer(email, source);
  await stripeRequest(`/customers/${id}`, {
    method: 'POST',
    body: {
      [`metadata[${ACCESS_METADATA_KEY}]`]: 'true',
      [`metadata[${ACCESS_PURCHASED_AT_KEY}]`]: new Date().toISOString(),
      [`metadata[${ACCESS_SOURCE_KEY}]`]: source
    }
  });
  return id;
}

export async function customerHasLifetimeAccess(email) {
  const result = await stripeRequest(`/customers?${new URLSearchParams({
    email: normalizeEmail(email),
    limit: '10'
  })}`);
  return result.data.some(customer => customer?.metadata?.[ACCESS_METADATA_KEY] === 'true');
}

export async function emailHasPaidCheckout(email) {
  const paidSession = await findPaidCheckoutSession(email, true) ||
    await findPaidCheckoutSession(email, false);

  if (!paidSession) return false;

  await markCustomerLifetimeAccess({
    customerId: typeof paidSession.customer === 'string' ? paidSession.customer : '',
    email: normalizeEmail(email),
    source: 'stripe_checkout_lookup'
  });

  return true;
}

async function findPaidCheckoutSession(email, requireExpectedPaymentLink) {
  const query = { limit: '100' };
  if (requireExpectedPaymentLink && process.env.STRIPE_PAYMENT_LINK_ID) {
    query.payment_link = process.env.STRIPE_PAYMENT_LINK_ID;
  }

  const sessions = await stripeRequest(`/checkout/sessions?${new URLSearchParams(query)}`);
  return sessions.data.find(session =>
    session.mode === 'payment' &&
    session.payment_status === 'paid' &&
    (!requireExpectedPaymentLink || isExpectedPaymentLink(session)) &&
    isExpectedAmount(session) &&
    normalizeEmail(session.customer_details?.email || session.customer_email) === normalizeEmail(email)
  );
}

export function isExpectedPaymentLink(session) {
  const expectedPaymentLink = process.env.STRIPE_PAYMENT_LINK_ID;
  return !expectedPaymentLink || session.payment_link === expectedPaymentLink;
}

export function isExpectedAmount(session) {
  const expectedAmount = Number(process.env.STRIPE_EXPECTED_AMOUNT || 1200);
  const expectedCurrency = String(process.env.STRIPE_EXPECTED_CURRENCY || 'usd').toLowerCase();
  return session.amount_total === expectedAmount && session.currency === expectedCurrency;
}

async function createAccessCustomer(email, source) {
  const customer = await stripeRequest('/customers', {
    method: 'POST',
    body: {
      email,
      [`metadata[${ACCESS_METADATA_KEY}]`]: 'true',
      [`metadata[${ACCESS_PURCHASED_AT_KEY}]`]: new Date().toISOString(),
      [`metadata[${ACCESS_SOURCE_KEY}]`]: source
    }
  });
  return customer.id;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}
