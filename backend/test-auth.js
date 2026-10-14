/**
 * End-to-end verification script for SikshaSetu Authentication & Session APIs
 */
const BASE_URL = 'http://localhost:5000/api';

const runTests = async () => {
  console.log('🧪 Starting SikshaSetu Authentication End-to-End Test Suite...\n');

  let passed = 0;
  let failed = 0;

  const assert = (condition, description) => {
    if (condition) {
      console.log(`  ✅ PASS: ${description}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${description}`);
      failed++;
    }
  };

  const testEmail = `student_${Date.now()}@example.com`;
  const testPassword = 'StrongPassword99!';
  let authCookie = null;
  let authToken = null;

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    assert(res.status === 200 && data.status === 'ok', 'GET /api/health returns status 200 ok');
  } catch (err) {
    assert(false, `GET /api/health failed: ${err.message}`);
  }

  // 2. Reject malformed registration (empty body)
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.success === false && Array.isArray(data.errors),
      'POST /api/auth/register rejects empty body with 400 and validation errors'
    );
  } catch (err) {
    assert(false, `Malformed register check error: ${err.message}`);
  }

  // 3. Reject password under 6 characters
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Student',
        email: `short_${Date.now()}@example.com`,
        password: '123',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 400 && data.success === false,
      'POST /api/auth/register rejects password shorter than 6 characters'
    );
  } catch (err) {
    assert(false, `Short password check error: ${err.message}`);
  }

  // 4. Successful registration of new student
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Priyanka Das',
        email: testEmail,
        password: testPassword,
        preferredLanguage: 'or',
      }),
    });
    const data = await res.json();
    const cookieHeader = res.headers.get('set-cookie');
    if (cookieHeader) {
      authCookie = cookieHeader.split(';')[0];
    }
    authToken = data.token;

    assert(
      res.status === 201 &&
        data.success === true &&
        data.user?.email === testEmail.toLowerCase() &&
        data.user?.role === 'STUDENT' &&
        data.user?.preferredLanguage === 'or' &&
        !data.user?.password,
      'POST /api/auth/register successfully creates student and returns safe user profile without password'
    );
    assert(
      Boolean(cookieHeader && cookieHeader.includes('HttpOnly')),
      'POST /api/auth/register sets HttpOnly cookie for session persistence'
    );
  } catch (err) {
    assert(false, `Registration failed: ${err.message}`);
  }

  // 5. Reject duplicate email registration
  try {
    const res = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Student',
        email: testEmail,
        password: 'DifferentPassword123',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 409 && data.success === false,
      'POST /api/auth/register rejects duplicate email with 409 Conflict'
    );
  } catch (err) {
    assert(false, `Duplicate email check error: ${err.message}`);
  }

  // 6. Access /api/auth/me with cookie
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: authCookie },
    });
    const data = await res.json();
    assert(
      res.status === 200 && data.success === true && data.user?.email === testEmail.toLowerCase(),
      'GET /api/auth/me authenticates via HttpOnly cookie and returns user profile'
    );
  } catch (err) {
    assert(false, `Auth me via cookie failed: ${err.message}`);
  }

  // 7. Reject /api/auth/me without token or cookie
  try {
    const res = await fetch(`${BASE_URL}/auth/me`);
    const data = await res.json();
    assert(
      res.status === 401 && data.success === false,
      'GET /api/auth/me rejects unauthenticated request with 401'
    );
  } catch (err) {
    assert(false, `Unauthenticated me check error: ${err.message}`);
  }

  // 8. Reject /api/auth/me with invalid JWT
  try {
    const res = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: 'Bearer this_is_a_completely_invalid_jwt_token' },
    });
    const data = await res.json();
    assert(
      res.status === 401 && data.success === false,
      'GET /api/auth/me rejects invalid JWT token with 401'
    );
  } catch (err) {
    assert(false, `Invalid token check error: ${err.message}`);
  }

  // 9. Login with invalid password
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword!',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 401 && data.success === false && data.message === 'Invalid email or password.',
      'POST /api/auth/login rejects wrong password with 401 and generic message'
    );
  } catch (err) {
    assert(false, `Wrong password login error: ${err.message}`);
  }

  // 10. Login with non-existent email
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `nonexistent_${Date.now()}@example.com`,
        password: 'SomePassword123',
      }),
    });
    const data = await res.json();
    assert(
      res.status === 401 && data.success === false && data.message === 'Invalid email or password.',
      'POST /api/auth/login rejects unknown email with identical 401 generic message (no enumeration)'
    );
  } catch (err) {
    assert(false, `Nonexistent email login error: ${err.message}`);
  }

  // 11. Login with valid credentials
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const data = await res.json();
    const cookieHeader = res.headers.get('set-cookie');
    if (cookieHeader) {
      authCookie = cookieHeader.split(';')[0];
    }
    assert(
      res.status === 200 &&
        data.success === true &&
        data.user?.email === testEmail.toLowerCase() &&
        !data.user?.password,
      'POST /api/auth/login succeeds with valid credentials, sets cookie, and returns safe user'
    );
  } catch (err) {
    assert(false, `Valid login error: ${err.message}`);
  }

  // 12. Logout
  try {
    const res = await fetch(`${BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Cookie: authCookie },
    });
    const data = await res.json();
    const cookieHeader = res.headers.get('set-cookie');
    assert(
      res.status === 200 &&
        data.success === true &&
        cookieHeader &&
        (cookieHeader.includes('Expires=Thu, 01 Jan 1970') || cookieHeader.includes('Max-Age=0')),
      'POST /api/auth/logout clears the session cookie'
    );
  } catch (err) {
    assert(false, `Logout error: ${err.message}`);
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runTests();
