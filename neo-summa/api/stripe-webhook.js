import crypto from 'node:crypto';
import { markCustomerLifetimeAccess } from './_stripe.js';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET is not configured' });
  }

  try {
    const rawBody = await readRawBody(req);
    verifyStripeSignature(rawBody, req.headers['stripe-signature'], webhookSecret);

    const event = JSON.parse(rawBody);
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('stripe webhook failed', error);
    return res.status(400).json({ error: 'Webhook handling failed' });
  }
}

async function handleCheckoutCompleted(session) {
  if (session.mode !== 'payment' || session.payment_status !== 'paid') return;
  if (!isExpectedPaymentLink(session)) return;
  if (!isExpectedAmount(session)) return;

  const email = normalizeEmail(session.customer_details?.email || session.customer_email);
  if (!email) {
    throw new Error(`Checkout session ${session.id} does not include an email`);
  }

  await markCustomerLifetimeAccess({
    customerId: typeof session.customer === 'string' ? session.customer : '',
    email,
    source: 'stripe_checkout'
  });
}

function isExpectedPaymentLink(session) {
  const expectedPaymentLink = process.env.STRIPE_PAYMENT_LINK_ID;
  return !expectedPaymentLink || session.payment_link === expectedPaymentLink;
}

function isExpectedAmount(session) {
  const expectedAmount = Number(process.env.STRIPE_EXPECTED_AMOUNT || 1200);
  const expectedCurrency = String(process.env.STRIPE_EXPECTED_CURRENCY || 'usd').toLowerCase();
  return session.amount_total === expectedAmount && session.currency === expectedCurrency;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

function verifyStripeSignature(rawBody, signatureHeader, webhookSecret) {
  if (!signatureHeader) {
    throw new Error('Missing Stripe signature header');
  }

  const entries = signatureHeader.split(',').map(part => part.split('='));
  const timestamp = entries.find(([key]) => key === 't')?.[1];
  const signatures = entries.filter(([key]) => key === 'v1').map(([, value]) => value);

  if (!timestamp || signatures.length === 0) {
    throw new Error('Malformed Stripe signature header');
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  const hasValidSignature = signatures.some(signature => timingSafeEqual(signature, expected));
  if (!hasValidSignature) {
    throw new Error('Invalid Stripe signature');
  }

  const toleranceSeconds = 5 * 60;
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > toleranceSeconds) {
    throw new Error('Stripe signature timestamp is outside tolerance');
  }
}

function timingSafeEqual(received, expected) {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  return receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}
