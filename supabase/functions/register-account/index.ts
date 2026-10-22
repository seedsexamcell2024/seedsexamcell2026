import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const normalizeMobile = (raw: string) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '92' + digits.slice(1);
  if (digits.length === 10 && digits.startsWith('3')) digits = '92' + digits;
  if (digits.length === 11 && digits.startsWith('3')) digits = '92' + digits;
  return digits;
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Registration is not configured on the server.' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const input = await request.json();
    const mobile = normalizeMobile(String(input.mobile || ''));
    const fullName = String(input.display_name || '').trim();
    const role = String(input.role || 'student');
    let schoolId = String(input.school_id || '');

    if (!/^923[0-9]{9}$/.test(mobile)) return json({ error: 'Enter a valid Pakistani mobile number.' }, 400);
    if (fullName.length < 2) return json({ error: 'Enter your full name.' }, 400);
    if (!['developer', 'admin', 'teacher', 'parent', 'student'].includes(role)) return json({ error: 'Choose a valid account type.' }, 400);

    if (!schoolId) {
      const { data: schools } = await admin.from('schools').select('id').limit(1);
      schoolId = schools?.[0]?.id || '';
    }
    if (!schoolId) return json({ error: 'No school is configured yet.' }, 400);

    const email = `${mobile}@seeds.local`;
    const { data: users } = await admin.auth.admin.listUsers();
    const dup = (users?.users || []).find(u => (u.email || '').toLowerCase() === email);
    if (dup) return json({ error: 'An account with this mobile number already exists.' }, 409);

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: mobile,
      email_confirm: true,
      user_metadata: { display_name: fullName, mobile },
    });
    if (createError || !created?.user) return json({ error: createError?.message || 'Could not create account.' }, 400);

    const { error: profileError } = await admin.from('profiles').insert({
      id: created.user.id,
      school_id: schoolId,
      role,
      display_name: fullName,
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: profileError.message }, 400);
    }
    return json({ account_id: created.user.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed.';
    return json({ error: message }, 500);
  }
});