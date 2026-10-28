import { createClient } from '@supabase/supabase-js';

export function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function createAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authorizeAdmin(req) {
  const allowedEmails = (process.env.ORDER_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (allowedEmails.length === 0 || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { error: 'Admin access is not configured.', status: 503 };
  }

  const authorization = req.headers.authorization;
  const match = typeof authorization === 'string' ? authorization.match(/^Bearer\s+(.+)$/i) : null;
  if (!match) return { error: 'Sign in to access the admin dashboard.', status: 401 };

  const supabase = createAdminClient();
  let data;
  let error;
  try {
    ({ data, error } = await supabase.auth.getUser(match[1]));
  } catch (requestError) {
    console.error('Unable to validate admin session.', requestError instanceof Error ? requestError.message : 'Unknown error.');
    return { error: 'Admin sign-in could not be verified. Please try again.', status: 503 };
  }
  if (error || !data.user || !allowedEmails.includes(data.user.email?.trim().toLowerCase() || '')) {
    return { error: 'You are not authorized to access the admin dashboard.', status: 403 };
  }

  return { supabase, user: data.user };
}
