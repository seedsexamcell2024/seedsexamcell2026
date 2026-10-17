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

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json({ error: 'Account management is not configured on the server.' }, 500);

  const authorization = request.headers.get('Authorization') || '';
  const accessToken = authorization.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Sign in before managing accounts.' }, 401);

  const callerClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(accessToken);
  if (callerError || !callerData.user) return json({ error: 'Your sign-in has expired. Sign in again.' }, 401);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle();
  if (profileError) return json({ error: 'Could not verify developer access.' }, 500);
  if (callerProfile?.role !== 'developer') return json({ error: 'Only a developer can manage user accounts.' }, 403);

  try {
    const input = await request.json();
    if (input.action === 'list') {
      const { data: profiles, error } = await admin
        .from('profiles')
        .select('id, school_id, role, display_name, teacher_id')
        .in('role', ['teacher', 'parent'])
        .order('display_name');
      if (error) throw error;

      const usersById = new Map<string, string>();
      for (let page = 1; ; page += 1) {
        const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        if (usersError) throw usersError;
        for (const user of data.users) usersById.set(user.id, user.email || '');
        if (data.users.length < 1000) break;
      }
      return json({
        accounts: (profiles || []).map(profile => ({ ...profile, email: usersById.get(profile.id) || '' })),
      });
    }

    if (input.action === 'create') {
      const role = input.role;
      const displayName = String(input.display_name || '').trim();
      const email = String(input.email || '').trim().toLowerCase();
      const password = String(input.password || '');
      const schoolId = String(input.school_id || '');
      if (!['teacher', 'parent'].includes(role)) return json({ error: 'Only teacher and parent accounts can be created here.' }, 400);
      if (!displayName || !email || !email.includes('@')) return json({ error: 'Enter a name and valid email address.' }, 400);
      if (password.length < 12) return json({ error: 'Temporary passwords must contain at least 12 characters.' }, 400);
      if (!schoolId) return json({ error: 'Choose a school for this account.' }, 400);

      const { data: school, error: schoolError } = await admin.from('schools').select('id').eq('id', schoolId).maybeSingle();
      if (schoolError) throw schoolError;
      if (!school) return json({ error: 'The selected school does not exist.' }, 400);

      let teacherId: string | null = null;
      let studentIds: string[] = [];
      if (role === 'teacher') {
        teacherId = String(input.teacher_id || '');
        const { data: teacher, error: teacherError } = await admin
          .from('teachers')
          .select('id')
          .eq('id', teacherId)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (teacherError) throw teacherError;
        if (!teacher) return json({ error: 'Choose a teacher profile from the selected school.' }, 400);
      } else {
        studentIds = Array.isArray(input.student_ids) ? input.student_ids.map(String) : [];
        if (!studentIds.length) return json({ error: 'Select at least one student for the parent account.' }, 400);
        const { data: students, error: studentsError } = await admin
          .from('students')
          .select('id')
          .eq('school_id', schoolId)
          .in('id', studentIds);
        if (studentsError) throw studentsError;
        if (!students || students.length !== studentIds.length) return json({ error: 'All selected students must belong to the chosen school.' }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName },
      });
      if (createError) throw createError;
      if (!created.user) throw new Error('Supabase did not return the new account.');

      const { error: insertProfileError } = await admin.from('profiles').insert({
        id: created.user.id,
        school_id: schoolId,
        role,
        display_name: displayName,
        ...(teacherId ? { teacher_id: teacherId } : {}),
      });
      if (insertProfileError) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
        if (cleanupError) {
          throw new Error(`Profile setup failed and the unused Auth user could not be removed. Delete user ${created.user.id} in Supabase Auth. ${cleanupError.message}`);
        }
        throw insertProfileError;
      }

      if (role === 'parent') {
        const { error: linksError } = await admin.from('parent_students').insert(
          studentIds.map(studentId => ({ school_id: schoolId, parent_profile_id: created.user.id, student_id: studentId })),
        );
        if (linksError) {
          const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id);
          if (cleanupError) {
            throw new Error(`Parent links failed and the unused Auth user could not be removed. Delete user ${created.user.id} in Supabase Auth. ${cleanupError.message}`);
          }
          throw linksError;
        }
      }
      return json({ account_id: created.user.id });
    }

    if (input.action === 'set-password') {
      const userId = String(input.user_id || '');
      const password = String(input.password || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return json({ error: 'Choose a valid account.' }, 400);
      if (password.length < 12) return json({ error: 'Temporary passwords must contain at least 12 characters.' }, 400);
      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target || !['teacher', 'parent'].includes(target.role)) return json({ error: 'Only teacher and parent passwords can be reset here.' }, 404);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ updated: true });
    }

    if (input.action === 'delete-account') {
      const userId = String(input.user_id || '');
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return json({ error: 'Choose a valid account.' }, 400);
      const { data: target, error: targetError } = await admin
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (targetError) throw targetError;
      if (!target || !['teacher', 'parent'].includes(target.role)) return json({ error: 'Only teacher and parent sign-ins can be removed here.' }, 404);
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ deleted: true });
    }

    return json({ error: 'Unknown account action.' }, 400);
  } catch (error) {
    console.error('Account management failed:', error);
    const message = error instanceof Error ? error.message : 'Account management failed.';
    return json({ error: message }, 500);
  }
});
