import { authorizeAdmin, json } from '../../lib/admin.js';

const settingFields = {
  payment_bank_name: { maxLength: 120, required: true },
  payment_account_name: { maxLength: 160, required: true },
  payment_account_number: { maxLength: 100, required: true },
  payment_bank_branch: { maxLength: 120, required: false },
  payment_instructions: { maxLength: 2000, required: false },
};

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const authorization = await authorizeAdmin(req);
  if (authorization.error) return json(res, authorization.status, { error: authorization.error });

  try {
    if (req.method === 'GET') {
      const { data, error } = await authorization.supabase
        .from('admin_settings')
        .select('payment_bank_name, payment_account_name, payment_account_number, payment_bank_branch, payment_instructions')
        .eq('singleton', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return json(res, 500, { error: 'Admin payment settings are not initialized. Run the latest Supabase migration.' });
      return json(res, 200, { settings: data });
    }

    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(res, 400, { error: 'Enter valid payment settings.' });
    }

    const settings = {};
    for (const [field, rules] of Object.entries(settingFields)) {
      const value = body[field];
      if (typeof value !== 'string' || value.length > rules.maxLength || (rules.required && !value.trim())) {
        return json(res, 400, { error: `Enter a valid ${field.replaceAll('_', ' ')} (up to ${rules.maxLength} characters).` });
      }
      settings[field] = value.trim();
    }

    const { error } = await authorization.supabase
      .from('admin_settings')
      .upsert({ singleton: true, ...settings, updated_at: new Date().toISOString() }, { onConflict: 'singleton' });
    if (error) throw error;
    return json(res, 200, { ok: true, settings });
  } catch (error) {
    console.error('Unable to access admin payment settings.', error instanceof Error ? error.message : 'Unknown error.');
    return json(res, 500, { error: 'Payment settings could not be saved or loaded. Please try again.' });
  }
}
