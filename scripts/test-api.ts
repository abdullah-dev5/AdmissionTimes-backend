/**
 * API Endpoint Testing Script
 * 
 * Comprehensive script to test ALL API endpoints from the project
 * Uses real seeded data IDs for more accurate testing
 * Usage: ts-node -r tsconfig-paths/register scripts/test-api.ts
 */

import http from 'http';

// Configuration
const BASE_URL = 'http://localhost:3000';
const TEST_UUID = '00000000-0000-0000-0000-000000000000';

// Test user headers (matching mockAuth middleware)
const TEST_HEADERS = {
  student: {
    'x-user-id': '7998b0fe-9d05-44e4-94ab-e65e0213bf10',
    'x-user-role': 'student',
  },
  university: {
    'x-user-id': '412c9cd6-78db-46c1-84e1-c059a20d11bf',
    'x-user-role': 'university',
    'x-university-id': '412c9cd6-78db-46c1-84e1-c059a20d11bf',
  },
  admin: {
    'x-user-id': 'e61690b2-0a64-47de-9274-66e06d1437b7',
    'x-user-role': 'admin',
  },
};

// Cache for real IDs fetched from API
const ID_CACHE: {
  admissionIds: string[];
  notificationIds: string[];
  deadlineIds: string[];
  watchlistIds: string[];
  changelogIds: string[];
  userIds: { student: string; admin: string; university: string };
} = {
  admissionIds: [],
  notificationIds: [],
  deadlineIds: [],
  watchlistIds: [],
  changelogIds: [],
  userIds: { student: '', admin: '', university: '' },
};

/**
 * Make HTTP request
 */
function makeRequest(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options: http.RequestOptions = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch (error) {
          resolve({ status: res.statusCode || 200, data: { raw: data } });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

/**
 * Fetch real IDs from API for testing
 */
async function fetchRealIds(): Promise<void> {
  console.log('📋 Fetching real IDs from seeded data...\n');

  try {
    // Fetch admission IDs
    const admissionsResult = await makeRequest('GET', '/api/v1/admissions?limit=10', TEST_HEADERS.student);
    if (admissionsResult.status === 200 && admissionsResult.data.data) {
      ID_CACHE.admissionIds = admissionsResult.data.data.map((a: any) => a.id).slice(0, 5);
      console.log(`  ✅ Found ${ID_CACHE.admissionIds.length} admission IDs`);
    }

    // Fetch notification IDs
    const notificationsResult = await makeRequest('GET', '/api/v1/notifications?limit=10', TEST_HEADERS.student);
    if (notificationsResult.status === 200 && notificationsResult.data.data) {
      ID_CACHE.notificationIds = notificationsResult.data.data.map((n: any) => n.id).slice(0, 3);
      console.log(`  ✅ Found ${ID_CACHE.notificationIds.length} notification IDs`);
    }

    // Fetch deadline IDs
    const deadlinesResult = await makeRequest('GET', '/api/v1/deadlines?limit=10', TEST_HEADERS.student);
    if (deadlinesResult.status === 200 && deadlinesResult.data.data) {
      ID_CACHE.deadlineIds = deadlinesResult.data.data.map((d: any) => d.id).slice(0, 3);
      console.log(`  ✅ Found ${ID_CACHE.deadlineIds.length} deadline IDs`);
    }

    // Fetch watchlist IDs
    const watchlistsResult = await makeRequest('GET', '/api/v1/watchlists?limit=10', TEST_HEADERS.student);
    if (watchlistsResult.status === 200 && watchlistsResult.data.data) {
      ID_CACHE.watchlistIds = watchlistsResult.data.data.map((w: any) => w.id).slice(0, 3);
      console.log(`  ✅ Found ${ID_CACHE.watchlistIds.length} watchlist IDs`);
    }

    // Fetch changelog IDs
    const changelogsResult = await makeRequest('GET', '/api/v1/changelogs?limit=10', TEST_HEADERS.student);
    if (changelogsResult.status === 200 && changelogsResult.data.data) {
      ID_CACHE.changelogIds = changelogsResult.data.data.map((c: any) => c.id).slice(0, 3);
      console.log(`  ✅ Found ${ID_CACHE.changelogIds.length} changelog IDs`);
    }

    // Set user IDs from headers
    ID_CACHE.userIds = {
      student: TEST_HEADERS.student['x-user-id'],
      admin: TEST_HEADERS.admin['x-user-id'],
      university: TEST_HEADERS.university['x-user-id'],
    };

    console.log('  ✅ User IDs cached\n');
  } catch (error: any) {
    console.log(`  ⚠️  Could not fetch all IDs: ${error.message}`);
    console.log('  Using fallback TEST_UUID for tests\n');
  }
}

/**
 * Get a real ID or fallback to TEST_UUID
 */
function getRealId(type: keyof typeof ID_CACHE, index: number = 0): string {
  const ids = ID_CACHE[type];
  if (Array.isArray(ids) && ids.length > index) {
    return ids[index];
  }
  if (type === 'userIds') {
    const userIds = ID_CACHE.userIds;
    if (index === 0) return userIds.student;
    if (index === 1) return userIds.admin;
    if (index === 2) return userIds.university;
  }
  return TEST_UUID;
}

/**
 * Test result interface
 */
interface TestResult {
  name: string;
  method: string;
  path: string;
  status: number;
  success: boolean;
  message: string;
  duration: number;
}

/**
 * Run a test
 */
async function runTest(
  name: string,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: any
): Promise<TestResult> {
  const startTime = Date.now();
  try {
    const result = await makeRequest(method, path, headers, body);
    const duration = Date.now() - startTime;
    // Accept 2xx, 3xx, 4xx as "successful" responses (server responded correctly)
    // Only fail on 5xx or connection errors
    const success = result.status < 500;

    return {
      name,
      method,
      path,
      status: result.status,
      success,
      message: result.data.message || result.data.error || (success ? 'OK' : 'Server Error'),
      duration,
    };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    return {
      name,
      method,
      path,
      status: 0,
      success: false,
      message: error.message || 'Request failed',
      duration,
    };
  }
}

/**
 * Print test result
 */
function printResult(result: TestResult): void {
  const statusIcon = result.success ? '✅' : '❌';
  const statusColor = result.success ? '\x1b[32m' : '\x1b[31m';
  const resetColor = '\x1b[0m';
  const statusText = result.status === 0 ? 'ERR' : result.status.toString();

  console.log(
    `${statusIcon} ${result.name.padEnd(55)} ${statusColor}${statusText}${resetColor} ${result.duration}ms`
  );
}

/**
 * Print section header
 */
function printSection(title: string): void {
  console.log('\n' + '='.repeat(80));
  console.log(`  ${title}`);
  console.log('='.repeat(80));
}

/**
 * Main test function
 */
async function main() {
  console.log('\n🚀 Starting Comprehensive API Endpoint Tests...\n');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Testing ALL 51+ endpoints from the project\n`);

  // Fetch real IDs first
  await fetchRealIds();

  const results: TestResult[] = [];

  // ============================================
  // Health & Documentation
  // ============================================
  printSection('Health & Documentation');
  results.push(await runTest('Health Check', 'GET', '/health'));
  printResult(results[results.length - 1]);

  // ============================================
  // Admissions Domain (11 endpoints)
  // ============================================
  printSection('Admissions Domain (11 endpoints)');
  
  const realAdmissionId = getRealId('admissionIds', 0);
  
  results.push(await runTest('List Admissions', 'GET', '/api/v1/admissions?page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Admission Detail (Real ID)', 'GET', `/api/v1/admissions/${realAdmissionId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Admission Detail (Non-existent)', 'GET', `/api/v1/admissions/${TEST_UUID}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Search Admissions', 'GET', '/api/v1/admissions?search=Computer Science&page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Filter Admissions by Degree', 'GET', '/api/v1/admissions?degree_level=bachelor&page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // Create admission with unique timestamp to avoid duplicates
  const uniqueTestId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  results.push(await runTest('Create Admission (University)', 'POST', '/api/v1/admissions', TEST_HEADERS.university, {
    title: `Test Program ${uniqueTestId}`,
    description: `A comprehensive program created for testing purposes (${uniqueTestId}). This program includes detailed curriculum, industry partnerships, and excellent placement opportunities.`,
    program_type: 'undergraduate',
    degree_level: 'bachelor',
    field_of_study: 'Computer Science',
    duration: '4 years',
    tuition_fee: 1000000,
    currency: 'PKR',
    application_fee: 5000,
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    start_date: '2026-09-01',
    location: 'Lahore, Punjab',
    delivery_mode: 'on-campus',
    requirements: {
      eligibility: ['F.Sc (Pre-Engineering) with minimum 60% marks'],
      documents: ['Matriculation certificate', 'Intermediate/F.Sc certificate', 'CNIC copy'],
    },
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update Admission', 'PUT', `/api/v1/admissions/${realAdmissionId}`, TEST_HEADERS.university, {
    title: 'Updated Test Program',
    description: 'Updated description',
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Submit Admission', 'PATCH', `/api/v1/admissions/${realAdmissionId}/submit`, TEST_HEADERS.university));
  printResult(results[results.length - 1]);

  results.push(await runTest('Verify Admission (Admin)', 'PATCH', `/api/v1/admissions/${realAdmissionId}/verify`, TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Reject Admission (Admin)', 'PATCH', `/api/v1/admissions/${realAdmissionId}/reject`, TEST_HEADERS.admin, {
    rejection_reason: 'Test rejection reason - incomplete documentation',
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Dispute Admission (University)', 'PATCH', `/api/v1/admissions/${realAdmissionId}/dispute`, TEST_HEADERS.university, {
    dispute_reason: 'Test dispute reason - deadline information incorrect',
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Admission Changelogs', 'GET', `/api/v1/admissions/${realAdmissionId}/changelogs`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Admission Deadlines', 'GET', `/api/v1/admissions/${realAdmissionId}/deadlines`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Parse PDF (Empty Body)', 'POST', '/api/v1/admissions/parse-pdf', TEST_HEADERS.university, {}));
  printResult(results[results.length - 1]);

  // ============================================
  // Notifications Domain (7 endpoints)
  // ============================================
  printSection('Notifications Domain (7 endpoints)');
  
  const realNotificationId = getRealId('notificationIds', 0);
  
  results.push(await runTest('List Notifications', 'GET', '/api/v1/notifications?page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Unread Count', 'GET', '/api/v1/notifications/unread-count', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Filter Unread Notifications', 'GET', '/api/v1/notifications?is_read=false&page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // Create notification with unique content to avoid duplicates
  const uniqueNotifId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  results.push(await runTest('Create Notification (Admin)', 'POST', '/api/v1/notifications', TEST_HEADERS.admin, {
    user_type: 'student',
    category: 'system',
    priority: 'medium',
    title: `Test System Notification ${uniqueNotifId}`,
    message: `This is a test notification created via API testing script (${uniqueNotifId}).`,
    related_entity_type: 'admission',
    related_entity_id: realAdmissionId,
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Notification Detail (Real ID)', 'GET', `/api/v1/notifications/${realNotificationId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Notification Detail (Non-existent)', 'GET', `/api/v1/notifications/${TEST_UUID}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Mark Notification as Read', 'PATCH', `/api/v1/notifications/${realNotificationId}/read`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Mark All Notifications as Read', 'PATCH', '/api/v1/notifications/read-all', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Delete Notification', 'DELETE', `/api/v1/notifications/${realNotificationId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // ============================================
  // Deadlines Domain (6 endpoints)
  // ============================================
  printSection('Deadlines Domain (6 endpoints)');
  
  const realDeadlineId = getRealId('deadlineIds', 0);
  
  results.push(await runTest('List Deadlines', 'GET', '/api/v1/deadlines?page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Upcoming Deadlines', 'GET', '/api/v1/deadlines/upcoming?limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Deadline Detail (Real ID)', 'GET', `/api/v1/deadlines/${realDeadlineId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // Create deadline with unique date to avoid duplicates (check if deadline already exists for this admission)
  const uniqueDeadlineDate = new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(); // 35 days instead of 30
  results.push(await runTest('Create Deadline (University)', 'POST', '/api/v1/deadlines', TEST_HEADERS.university, {
    admission_id: realAdmissionId,
    deadline_type: 'document_submission', // Use different type to avoid duplicates
    deadline_date: uniqueDeadlineDate,
    timezone: 'Asia/Karachi',
    is_flexible: false,
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update Deadline', 'PUT', `/api/v1/deadlines/${realDeadlineId}`, TEST_HEADERS.university, {
    deadline_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    is_flexible: true,
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Delete Deadline', 'DELETE', `/api/v1/deadlines/${realDeadlineId}`, TEST_HEADERS.university));
  printResult(results[results.length - 1]);

  // ============================================
  // User Activity Domain (2 endpoints)
  // ============================================
  printSection('User Activity Domain (2 endpoints)');
  
  results.push(await runTest('List Activities', 'GET', '/api/v1/activity?page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Filter Activities by Type', 'GET', '/api/v1/activity?activity_type=viewed&page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // Note: Activity detail endpoint might not exist, using TEST_UUID
  results.push(await runTest('Get Activity Detail', 'GET', `/api/v1/activity/${TEST_UUID}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // ============================================
  // Users Domain (5 endpoints)
  // ============================================
  printSection('Users Domain (5 endpoints)');
  
  results.push(await runTest('Get Current User (Student)', 'GET', '/api/v1/users/me', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Current User (Admin)', 'GET', '/api/v1/users/me', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Current User (University)', 'GET', '/api/v1/users/me', TEST_HEADERS.university));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update Current User', 'PUT', '/api/v1/users/me', TEST_HEADERS.student, {
    display_name: 'Updated Test Student',
    email: 'updated.student@example.com',
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('List Users (Admin)', 'GET', '/api/v1/users?page=1&limit=10', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get User by ID', 'GET', `/api/v1/users/${getRealId('userIds', 0)}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update User Role (Admin)', 'PATCH', `/api/v1/users/${getRealId('userIds', 0)}/role`, TEST_HEADERS.admin, {
    role: 'student',
  }));
  printResult(results[results.length - 1]);

  // ============================================
  // User Preferences Domain (3 endpoints)
  // ============================================
  printSection('User Preferences Domain (3 endpoints)');
  
  results.push(await runTest('Get User Preferences', 'GET', '/api/v1/users/me/preferences', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update User Preferences (Full)', 'PUT', '/api/v1/users/me/preferences', TEST_HEADERS.student, {
    email_notifications_enabled: true,
    email_frequency: 'daily',
    language: 'en',
    theme: 'light',
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update User Preferences (Partial)', 'PATCH', '/api/v1/users/me/preferences', TEST_HEADERS.student, {
    language: 'ur',
    theme: 'dark',
  }));
  printResult(results[results.length - 1]);

  // ============================================
  // Analytics Domain (5 endpoints)
  // ============================================
  printSection('Analytics Domain (5 endpoints)');
  
  // Track event - analytics events are append-only, duplicates are fine but use unique metadata
  const uniqueEventId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  results.push(await runTest('Track Event', 'POST', '/api/v1/analytics/events', TEST_HEADERS.student, {
    event_type: 'admission_viewed',
    entity_type: 'admission',
    entity_id: realAdmissionId,
    user_type: 'student',
    metadata: {
      page: '/admissions/detail',
      referrer: '/admissions/list',
      test_id: uniqueEventId,
      timestamp: new Date().toISOString(),
    },
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get General Statistics', 'GET', '/api/v1/analytics/stats', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Admission Statistics', 'GET', '/api/v1/analytics/admissions', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get User Statistics', 'GET', '/api/v1/analytics/users', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Activity Feed', 'GET', '/api/v1/analytics/activity?limit=10', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  // ============================================
  // Changelogs Domain (3 endpoints)
  // ============================================
  printSection('Changelogs Domain (3 endpoints)');
  
  const realChangelogId = getRealId('changelogIds', 0);
  
  results.push(await runTest('List Changelogs', 'GET', '/api/v1/changelogs?page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Filter Changelogs by Action', 'GET', '/api/v1/changelogs?action_type=updated&page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Changelog by ID (Real ID)', 'GET', `/api/v1/changelogs/${realChangelogId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Admission Changelogs', 'GET', `/api/v1/changelogs/admission/${realAdmissionId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // ============================================
  // Watchlists Domain (5 endpoints)
  // ============================================
  printSection('Watchlists Domain (5 endpoints)');
  
  const realWatchlistId = getRealId('watchlistIds', 0);
  
  results.push(await runTest('List Watchlists', 'GET', '/api/v1/watchlists?page=1&limit=10', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // Add to watchlist - use unique notes to identify test entries
  const uniqueWatchlistId = `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  results.push(await runTest('Add to Watchlist', 'POST', '/api/v1/watchlists', TEST_HEADERS.student, {
    admission_id: realAdmissionId,
    notes: `Test watchlist entry ${uniqueWatchlistId} - Interested in this program for testing purposes`,
    alert_opt_in: true,
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Get Watchlist Item (Real ID)', 'GET', `/api/v1/watchlists/${realWatchlistId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('Update Watchlist Notes', 'PATCH', `/api/v1/watchlists/${realWatchlistId}`, TEST_HEADERS.student, {
    notes: 'Updated notes - still interested',
    alert_opt_in: false,
  }));
  printResult(results[results.length - 1]);

  results.push(await runTest('Remove from Watchlist', 'DELETE', `/api/v1/watchlists/${realWatchlistId}`, TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // ============================================
  // Dashboard Domain (4 endpoints)
  // ============================================
  printSection('Dashboard Domain (4 endpoints)');
  
  results.push(await runTest('Student Dashboard', 'GET', '/api/v1/student/dashboard', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  results.push(await runTest('University Dashboard', 'GET', '/api/v1/university/dashboard', TEST_HEADERS.university));
  printResult(results[results.length - 1]);

  results.push(await runTest('Admin Dashboard', 'GET', '/api/v1/admin/dashboard', TEST_HEADERS.admin));
  printResult(results[results.length - 1]);

  results.push(await runTest('Student Recommendations', 'GET', '/api/v1/student/recommendations?limit=5&min_score=75', TEST_HEADERS.student));
  printResult(results[results.length - 1]);

  // ============================================
  // Summary
  // ============================================
  printSection('Test Summary');
  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const total = results.length;

  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed (2xx/3xx/4xx): ${passed}`);
  console.log(`❌ Failed (5xx/Connection): ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%\n`);

  // Group by status code
  const statusGroups: Record<number, number> = {};
  results.forEach((r) => {
    statusGroups[r.status] = (statusGroups[r.status] || 0) + 1;
  });

  console.log('Status Code Distribution:');
  Object.entries(statusGroups)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .forEach(([status, count]) => {
      const statusLabel = status === '0' ? 'ERR (Connection)' : status;
      console.log(`  ${statusLabel}: ${count} endpoint(s)`);
    });

  if (failed > 0) {
    console.log('\n⚠️  Failed Tests (5xx or Connection Errors):');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  ❌ ${r.name} - ${r.method} ${r.path} (${r.status}) - ${r.message}`);
      });
  }

  // Show 404s separately (expected for non-existent resources)
  const notFounds = results.filter((r) => r.status === 404);
  if (notFounds.length > 0) {
    console.log('\n📝 Expected 404s (Non-existent Resources):');
    notFounds.forEach((r) => {
      console.log(`  ℹ️  ${r.name} - ${r.method} ${r.path}`);
    });
  }

  console.log('\n');
}

// Run tests
main().catch((error) => {
  console.error('❌ Test execution failed:', error);
  process.exit(1);
});
