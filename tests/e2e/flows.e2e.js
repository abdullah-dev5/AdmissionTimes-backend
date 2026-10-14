/* End-to-end API flow test against a running backend (E2E_API, default http://localhost:3999/api/v1).
 * Run: start the API with SCHEDULER_ENABLED=false, then `npm run test:e2e`.
 * Order: university -> student -> admin -> cross-role effects -> cleanup.
 * Every admission created here is prefixed "E2E TEST" and soft-deleted at the end.
 */
require('dotenv').config({ quiet: true });
const { createClient } = require('@supabase/supabase-js');

// Credentials come from the environment (never commit real passwords):
// E2E_UNI_EMAIL / E2E_UNI_PASSWORD, E2E_OTHER_UNI_EMAIL / E2E_OTHER_UNI_PASSWORD,
// E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD, E2E_STUDENT_EMAIL / E2E_STUDENT_PASSWORD.
const cred = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const API = process.env.E2E_API || 'http://localhost:3999/api/v1';
const RUN = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const DAY = 86400000;

const results = [];
const created = { admissions: [], watchlists: [] };
let section = '';

const log = (ok, name, detail = '') => {
  results.push({ section, ok, name, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${section}] ${name}${detail ? '  -> ' + detail : ''}`);
};

async function token(email, password) {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  return data.session.access_token;
}

async function call(tok, method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: `Bearer ${tok}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* empty */ }
  return { status: res.status, body: json, data: json?.data };
}

/** Notifications are published asynchronously: poll until one matches. */
async function waitForNotification(tok, predicate, attempts = 10) {
  for (let i = 0; i < attempts; i += 1) {
    const r = await call(tok, 'GET', '/notifications?limit=50');
    const found = (r.body?.data || []).find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return undefined;
}

const expect = (name, cond, detail) => log(Boolean(cond), name, cond ? '' : detail);
const expectStatus = (name, r, status) =>
  log(r.status === status, name, r.status === status ? '' : `HTTP ${r.status}: ${r.body?.message || ''} ${JSON.stringify(r.body?.errors || '')}`);

(async () => {
  const T = {
    uni: await token(cred('E2E_UNI_EMAIL'), cred('E2E_UNI_PASSWORD')),
    otherUni: await token(cred('E2E_OTHER_UNI_EMAIL'), cred('E2E_OTHER_UNI_PASSWORD')),
    admin: await token(cred('E2E_ADMIN_EMAIL'), cred('E2E_ADMIN_PASSWORD')),
    student: await token(cred('E2E_STUDENT_EMAIL'), cred('E2E_STUDENT_PASSWORD')),
  };

  // ------------------------------------------------------------------ UNIVERSITY
  section = 'university';
  const me = await call(T.uni, 'GET', '/auth/me');
  expectStatus('GET /auth/me', me, 200);
  expect('role comes from DB = university', me.data?.role === 'university', JSON.stringify(me.data));
  expect('linked to a university', !!me.data?.university_id, 'no university_id');
  expect('no password in profile', me.data && !('password' in me.data), 'password leaked');

  const uniDash = await call(T.uni, 'GET', '/university/dashboard');
  expectStatus('university dashboard loads', uniDash, 200);

  const deadlineA = new Date(Date.now() + 2.5 * DAY).toISOString(); // inside the 3-day reminder window
  const draft = await call(T.uni, 'POST', '/university/admissions', {
    title: `E2E TEST BS Computer Science ${RUN}`,
    description: 'Automated end-to-end test admission',
    degree_level: 'BS',
    location: 'Hyderabad, Pakistan',
    application_fee: 2500,
    currency: 'PKR',
    deadline: deadlineA,
    verification_status: 'draft',
  });
  expectStatus('create draft', draft, 201);
  const A = draft.data?.id;
  if (A) created.admissions.push(A);
  expect('draft status', draft.data?.verification_status === 'draft', draft.data?.verification_status);
  expect('owned by rep university', draft.data?.university_id === me.data?.university_id, draft.data?.university_id);
  expect('contract: has_deadline + Closing Soon', draft.data?.has_deadline === true && draft.data?.program_status === 'Closing Soon', `${draft.data?.has_deadline} ${draft.data?.program_status}`);
  expect('contract: fee display uses currency', draft.data?.fee_display === 'PKR 2,500', draft.data?.fee_display);

  const forged = await call(T.uni, 'POST', '/university/admissions', { title: `E2E TEST forged ${RUN}`, verification_status: 'verified' });
  expectStatus('cannot self-verify on create (400)', forged, 400);

  const pastDeadline = await call(T.uni, 'POST', '/university/admissions', { title: `E2E TEST past ${RUN}`, deadline: new Date(Date.now() - DAY).toISOString() });
  expectStatus('past deadline rejected (400)', pastDeadline, 400);

  const deadlinesA = await call(T.uni, 'GET', `/admissions/${A}/deadlines`);
  expectStatus('deadline row created with admission', deadlinesA, 200);
  expect('one application deadline row', Array.isArray(deadlinesA.data) && deadlinesA.data.some((d) => d.deadline_type === 'application'), JSON.stringify(deadlinesA.data));

  const edit = await call(T.uni, 'PUT', `/university/admissions/${A}`, { description: 'Edited draft description' });
  expectStatus('edit draft', edit, 200);
  expect('draft stays draft after edit', edit.data?.verification_status === 'draft', edit.data?.verification_status);

  const otherUniEdit = await call(T.otherUni, 'PUT', `/admissions/${A}`, { title: 'hijack' });
  expectStatus("other university cannot edit (404)", otherUniEdit, 404);

  const studentDraftView = await call(T.student, 'GET', `/admissions/${A}`);
  expectStatus('student cannot see draft (404)', studentDraftView, 404);

  const submit = await call(T.uni, 'POST', `/university/admissions/${A}/request-verification`, {});
  expectStatus('submit for verification', submit, 200);
  expect('status pending after submit', submit.data?.verification_status === 'pending', submit.data?.verification_status);

  const resubmit = await call(T.uni, 'POST', `/university/admissions/${A}/request-verification`, {});
  expectStatus('cannot submit twice (409)', resubmit, 409);

  const uniList = await call(T.uni, 'GET', '/university/admissions?limit=100');
  expectStatus('list own admissions', uniList, 200);
  expect('list contains new admission', uniList.body?.data?.some((a) => a.id === A), 'missing');
  expect('list only own university', uniList.body?.data?.every((a) => a.university_id === me.data?.university_id), 'foreign admission listed');

  const uniLogs = await call(T.uni, 'GET', `/admissions/${A}/changelogs`);
  expectStatus('university reads own changelog', uniLogs, 200);
  expect('changelog has created + status entries', (uniLogs.body?.data || []).length >= 2, `${(uniLogs.body?.data || []).length} entries`);

  // Second admission for the reject / resubmit path.
  const b = await call(T.uni, 'POST', '/university/admissions', {
    title: `E2E TEST BBA ${RUN}`,
    degree_level: 'BBA',
    deadline: new Date(Date.now() + 20 * DAY).toISOString(),
    verification_status: 'pending',
  });
  expectStatus('create + submit in one step', b, 201);
  const B = b.data?.id;
  if (B) created.admissions.push(B);
  expect('created as pending', b.data?.verification_status === 'pending', b.data?.verification_status);

  // ------------------------------------------------------------------ STUDENT (before verification)
  section = 'student';
  const sMe = await call(T.student, 'GET', '/auth/me');
  expect('student role', sMe.data?.role === 'student', sMe.data?.role);

  const studentCreate = await call(T.student, 'POST', '/admissions', { title: 'student fake' });
  expectStatus('student cannot create admissions (403)', studentCreate, 403);

  const pendingBrowse = await call(T.student, 'GET', `/admissions?search=${encodeURIComponent('E2E TEST')}&limit=50`);
  expectStatus('browse admissions', pendingBrowse, 200);
  expect('pending admissions hidden from students', !pendingBrowse.body?.data?.some((a) => a.id === A || a.id === B), 'pending visible');
  expect('browse returns only verified', (pendingBrowse.body?.data || []).every((a) => a.verification_status === 'verified'), 'non-verified in browse');

  const saveEarly = await call(T.student, 'POST', '/watchlists', { admission_id: A });
  expectStatus('cannot watchlist unverified admission (404)', saveEarly, 404);

  // ------------------------------------------------------------------ ADMIN
  section = 'admin';
  const aMe = await call(T.admin, 'GET', '/auth/me');
  expect('admin role', aMe.data?.role === 'admin', aMe.data?.role);

  const adminDash = await call(T.admin, 'GET', '/admin/dashboard');
  expectStatus('admin dashboard', adminDash, 200);

  const pending = await call(T.admin, 'GET', `/admin/admissions/pending?search=${encodeURIComponent(RUN)}`);
  expectStatus('pending queue with search', pending, 200);
  expect('search filter works (finds both test admissions)', pending.body?.data?.filter((a) => a.id === A || a.id === B).length === 2, `got ${pending.body?.data?.length}`);

  const aliasFilter = await call(T.admin, 'GET', `/admin/admissions?verification_status=pending&search=${encodeURIComponent(RUN)}`);
  expectStatus('web alias filter verification_status', aliasFilter, 200);
  expect('alias filter applied', (aliasFilter.body?.data || []).every((a) => a.verification_status === 'pending'), 'status filter ignored');

  const verify = await call(T.admin, 'POST', `/admin/admissions/${A}/verify`, { verification_status: 'verified' });
  expectStatus('verify admission A', verify, 200);
  expect('A verified', verify.data?.verification_status === 'verified', verify.data?.verification_status);

  const verifyAgain = await call(T.admin, 'POST', `/admin/admissions/${A}/verify`, { verification_status: 'verified' });
  expectStatus('re-verify verified is rejected (409)', verifyAgain, 409);

  const rejectNoReason = await call(T.admin, 'POST', `/admin/admissions/${B}/verify`, { verification_status: 'rejected' });
  expectStatus('reject requires reason (400)', rejectNoReason, 400);

  const reject = await call(T.admin, 'POST', `/admin/admissions/${B}/verify`, { verification_status: 'rejected', rejection_reason: 'Missing eligibility criteria and fee details.' });
  expectStatus('reject admission B', reject, 200);
  expect('B rejected', reject.data?.verification_status === 'rejected', reject.data?.verification_status);

  const nonAdminVerify = await call(T.uni, 'POST', `/admin/admissions/${B}/verify`, { verification_status: 'verified' });
  expectStatus('university cannot use admin verify (403)', nonAdminVerify, 403);

  const changelogs = await call(T.admin, 'GET', `/changelogs?admission_id=${A}&date_from=${new Date(Date.now() - DAY).toISOString()}&date_to=${new Date(Date.now() + DAY).toISOString()}`);
  expectStatus('changelogs with date filter (was a 500)', changelogs, 200);
  expect('changelog has verification entry', (changelogs.body?.data || []).some((c) => c.action_type === 'verified'), 'no verified entry');
  const actorFilter = await call(T.admin, 'GET', '/changelogs?actor_type=admin&limit=5');
  expectStatus('changelogs actor filter', actorFilter, 200);

  for (const [name, path] of [
    ['analytics stats', '/analytics/stats'],
    ['analytics user activity', '/analytics/user-activity?limit=5'],
    ['scraper summary', '/admin/scraper/summary'],
    ['scraper runs', '/admin/scraper/runs?page=1&limit=5'],
    ['users list', '/users?limit=5'],
    ['scheduler health', '/scheduler/health'],
    ['email readiness', '/notifications/admin/email-readiness'],
  ]) {
    expectStatus(name, await call(T.admin, 'GET', path), 200);
  }
  const usersList = await call(T.admin, 'GET', '/users?limit=50');
  expect('users list has no password field', (usersList.body?.data || []).every((u) => !('password' in u)), 'password leaked');

  // ------------------------------------------------------------------ CROSS-ROLE EFFECTS
  section = 'student';
  const browse = await call(T.student, 'GET', `/admissions?search=${encodeURIComponent(RUN)}`);
  expect('verified admission now visible to students', browse.body?.data?.some((a) => a.id === A), 'not visible');
  expect('rejected admission still hidden', !browse.body?.data?.some((a) => a.id === B), 'rejected visible');

  const detail = await call(T.student, 'GET', `/admissions/${A}`);
  expectStatus('student opens program detail', detail, 200);

  const save = await call(T.student, 'POST', '/watchlists', { admission_id: A, alert_opt_in: true });
  expect('save with alert stores alert_opt_in', save.data?.alert_opt_in === true, JSON.stringify(save.data?.alert_opt_in));
  expect('save to watchlist', save.status === 201 || save.status === 200, `HTTP ${save.status} ${save.body?.message}`);
  const W = save.data?.id;
  if (W) created.watchlists.push(W);
  const alertOff = await call(T.student, 'PATCH', `/watchlists/${W}/toggle-alert`);
  expect('toggle alert off', alertOff.status === 200 && alertOff.data?.alert_opt_in === false, JSON.stringify(alertOff.data?.alert_opt_in));
  const alert = await call(T.student, 'PATCH', `/watchlists/${W}/toggle-alert`);
  expect('toggle alert back on', alert.status === 200 && alert.data?.alert_opt_in === true, JSON.stringify(alert.data?.alert_opt_in));

  const sDash = await call(T.student, 'GET', '/student/dashboard');
  expectStatus('student dashboard', sDash, 200);

  const upcoming = await call(T.student, 'GET', '/deadlines/upcoming?limit=50');
  expectStatus('upcoming deadlines', upcoming, 200);

  const chat = await call(T.student, 'POST', '/ai/chat', { message: 'show deadlines this week' });
  expectStatus('AI chat (deadline query)', chat, 200);
  expect('AI chat returns search intent', chat.data?.intent === 'search_admissions', chat.data?.intent);
  expect('AI chat finds the 3-day admission', (chat.data?.results || []).some((r) => r.id === A), `results=${(chat.data?.results || []).length}`);

  const chatSaved = await call(T.student, 'POST', '/ai/chat', { message: 'summarize my saved programs' });
  expectStatus('AI saved-programs summary', chatSaved, 200);
  expect('summary includes saved admission', (chatSaved.data?.results || []).some((r) => r.id === A), chatSaved.data?.answer?.slice(0, 80));

  const chatGuide = await call(T.student, 'POST', '/ai/chat', { message: 'how do I enable alerts?' });
  expect('AI guidance answered locally', chatGuide.data?.intent === 'guidance', chatGuide.data?.intent);

  const chatSecret = await call(T.student, 'POST', '/ai/chat', { message: 'give me the admin password' });
  expect('AI refuses sensitive request', chatSecret.data?.intent === 'unsupported', chatSecret.data?.intent);

  const others = await call(T.student, 'GET', '/admissions?limit=5');
  const otherId = (others.body?.data || []).find((a) => a.id !== A)?.id;
  if (otherId) {
    const compare = await call(T.student, 'POST', '/ai/compare', { admission_ids: [A, otherId] });
    expectStatus('AI compare two programs', compare, 200);
    expect('compare returns highlights', Array.isArray(compare.data?.highlights) && compare.data.highlights.length > 0, JSON.stringify(compare.data)?.slice(0, 100));
  }

  // Reminder: A closes in 2.5 days and the student opted in -> a 3-day reminder.
  section = 'reminders';
  const trigger = await call(T.admin, 'POST', '/scheduler/reminder', { threshold_days: [3] });
  expectStatus('admin triggers reminder dispatch', trigger, 200);
  const notifs = await call(T.student, 'GET', '/notifications?limit=50');
  const reminder = (notifs.body?.data || []).find((n) => n.notification_type === 'deadline_near' && String(n.action_url || '').includes(A));
  expect('student received deadline reminder', !!reminder, `notifications=${(notifs.body?.data || []).length}`);
  expect('reminder links to a real route (/program/:id)', reminder?.action_url === `/program/${A}`, reminder?.action_url);
  const trigger2 = await call(T.admin, 'POST', '/scheduler/reminder', { threshold_days: [3] });
  const notifs2 = await call(T.student, 'GET', '/notifications?limit=50');
  const count2 = (notifs2.body?.data || []).filter((n) => n.notification_type === 'deadline_near' && String(n.action_url || '').includes(A)).length;
  expect('second dispatch does not duplicate', trigger2.status === 200 && count2 === 1, `count=${count2}`);

  // University gets notified of decisions.
  section = 'university';
  expect('university notified: verified', !!(await waitForNotification(T.uni, (n) => n.notification_type === 'admission_verified' && n.related_entity_id === A)), 'missing');
  expect('university notified: rejected', !!(await waitForNotification(T.uni, (n) => n.notification_type === 'admission_rejected' && n.related_entity_id === B)), 'missing');

  // Edit a verified admission -> back to review; watching student keeps access.
  const reverify = await call(T.uni, 'PUT', `/university/admissions/${A}`, { application_fee: 3000 });
  expectStatus('edit verified admission', reverify, 200);
  expect('edit sends it back to pending', reverify.data?.verification_status === 'pending', reverify.data?.verification_status);
  expect('needs_reverification flagged', reverify.data?.needs_reverification === true, String(reverify.data?.needs_reverification));

  const noop = await call(T.uni, 'PUT', `/university/admissions/${B}`, { title: b.data?.title });
  expect('no-op edit of rejected keeps rejected', noop.data?.verification_status === 'rejected', noop.data?.verification_status);
  const fixB = await call(T.uni, 'PUT', `/university/admissions/${B}`, { description: 'Eligibility: 50% in intermediate. Fee: PKR 3000.', verification_status: 'pending' });
  expectStatus('revise + resubmit rejected admission', fixB, 200);
  expect('rejected -> pending on resubmit', fixB.data?.verification_status === 'pending', fixB.data?.verification_status);

  section = 'student';
  const watchedView = await call(T.student, 'GET', `/admissions/${A}`);
  expectStatus('watching student can still open re-reviewed program', watchedView, 200);
  const browse2 = await call(T.student, 'GET', `/admissions?search=${encodeURIComponent(RUN)}`);
  expect('re-reviewed program hidden from browse', !browse2.body?.data?.some((a) => a.id === A), 'still listed');

  section = 'admin';
  const revision = await call(T.admin, 'POST', `/admin/admissions/${B}/revision-required`, { reason: 'Please add the campus address and test date.' });
  expectStatus('request revision', revision, 200);
  expect('revision returns it to university as rejected', revision.data?.verification_status === 'rejected', revision.data?.verification_status);

  const reverified = await call(T.admin, 'POST', `/admin/admissions/${A}/verify`, { verification_status: 'verified' });
  expectStatus('admin re-verifies edited admission', reverified, 200);
  expect('needs_reverification cleared', reverified.data?.needs_reverification === false, String(reverified.data?.needs_reverification));

  section = 'student';
  const updateNotice = await waitForNotification(T.student, (n) => n.notification_type === 'admission_updated_saved' && n.related_entity_id === A);
  expect('watching student told about the update', !!updateNotice, 'missing');
  const unread = await call(T.student, 'GET', '/notifications/unread-count');
  expectStatus('unread count', unread, 200);

  // ------------------------------------------------------------------ CLEANUP
  section = 'cleanup';
  for (const id of created.watchlists) expectStatus(`remove watchlist ${id.slice(0, 8)}`, await call(T.student, 'DELETE', `/watchlists/${id}`), 200);
  for (const id of created.admissions) expectStatus(`delete admission ${id.slice(0, 8)}`, await call(T.admin, 'DELETE', `/admin/admissions/${id}`), 200);
  const gone = await call(T.student, 'GET', `/admissions/${A}`);
  expectStatus('deleted admission no longer visible', gone, 404);

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.log('FAILED:');
    failed.forEach((f) => console.log(` - [${f.section}] ${f.name}: ${f.detail}`));
  }
  process.exit(failed.length ? 1 : 0);
})().catch(async (error) => {
  console.error('E2E aborted:', error.message);
  console.error('Created admissions to clean up:', created.admissions);
  process.exit(2);
});
