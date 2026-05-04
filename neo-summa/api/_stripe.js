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
      'Content-Type': 'application/x-www-form-urlencoded'
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
  const query = `email:'${escapeStripeSearchValue(email)}'`;
  const result = await stripeRequest(`/customers/search?${new URLSearchParams({ query, limit: '10' })}`);
  return result.data.some(customer => customer?.metadata?.[ACCESS_METADATA_KEY] === 'true');
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

function escapeStripeSearchValue(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
