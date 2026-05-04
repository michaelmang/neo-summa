import { customerHasLifetimeAccess, emailHasPaidCheckout } from './_stripe.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = await readJsonBody(req);
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const hasAccess = await customerHasLifetimeAccess(normalizedEmail) ||
      await emailHasPaidCheckout(normalizedEmail);
    return res.status(200).json({ email: normalizedEmail, hasAccess });
  } catch (error) {
    console.error('access-status failed', error);
    return res.status(500).json({ error: 'Unable to verify access' });
  }
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body || '{}');

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}
