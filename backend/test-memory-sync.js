/**
 * Integration Test Suite for Edunix Backend Synchronization & Memory APIs
 * Tests:
 * - Session authentication & ownership guards
 * - POST /api/sync/batch with multi-entity payloads
 * - Idempotency & deduplication on repeated operations
 * - Partial batch failure handling (acknowledged vs rejected)
 * - GET /api/sync/pull state retrieval
 * - Cross-user data isolation
 */

const BASE_URL = 'http://localhost:5000/api';

let passed = 0;
let failed = 0;

const assert = (condition, message) => {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
};

const runSyncTestSuite = async () => {
  console.log('🧪 Starting Edunix Backend Memory & Synchronization Test Suite...\n');

  // 1. Register a test user
  const testEmail = `sync_tester_${Date.now()}@edunix.local`;
  const registerRes = await fetch(`${BASE_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sync Student',
      email: testEmail,
      password: 'SecurePassword123!',
    }),
  });

  const registerData = await registerRes.json();
  const rawCookie = registerRes.headers.get('set-cookie');
  const authCookie = rawCookie ? rawCookie.split(';')[0] : '';
  const token = registerData.data?.token || '';

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(authCookie ? { Cookie: authCookie } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  assert(registerRes.status === 201 && registerData.success, 'Test student registered successfully');

  // Test 1: Unauthenticated sync request is rejected with 401
  try {
    const unauthRes = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operations: [] }),
    });
    assert(unauthRes.status === 401, 'POST /api/sync/batch rejects unauthenticated request with 401');
  } catch (err) {
    assert(false, `Unauthenticated guard test failed: ${err.message}`);
  }

  // Test 2: Bounded batch validation (exceeding 50 operations rejected with 400)
  try {
    const bigBatch = Array.from({ length: 55 }, (_, i) => ({
      operationId: `op_overflow_${i}`,
      entityType: 'learnerMemory',
      entityId: `mem_${i}`,
      operation: 'upsert',
      payload: {},
    }));

    const overflowRes = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ operations: bigBatch }),
    });
    const overflowJson = await overflowRes.json();
    assert(
      overflowRes.status === 400 && overflowJson.message.includes('exceeds maximum limit'),
      'POST /api/sync/batch rejects batches exceeding 50 operations with 400'
    );
  } catch (err) {
    assert(false, `Batch limit test failed: ${err.message}`);
  }

  // Test 3: Multi-entity batch sync execution
  const opMemId = `op_mem_${Date.now()}`;
  const memId = `mem_${Date.now()}`;
  const opPlanId = `op_plan_${Date.now()}`;
  const planId = `plan_${Date.now()}`;
  const opEvtId = `op_evt_${Date.now()}`;
  const evtId = `evt_${Date.now()}`;

  const syncBatchPayload = {
    operations: [
      {
        operationId: opMemId,
        entityType: 'learnerMemory',
        entityId: memId,
        operation: 'upsert',
        payload: {
          key: 'preferred_language',
          value: 'Odia',
          type: 'learning_preference',
          source: 'explicit',
          confidence: 1.0,
        },
      },
      {
        operationId: opPlanId,
        entityType: 'learningPlan',
        entityId: planId,
        operation: 'upsert',
        payload: {
          title: 'Linux Systems Mastery',
          goal: 'Master Bash Scripting',
          status: 'active',
          items: [
            {
              id: 'it_1',
              title: 'Unix Philosophy',
              status: 'completed',
              order: 1,
            },
          ],
        },
      },
      {
        operationId: opEvtId,
        entityType: 'learningEvent',
        entityId: evtId,
        operation: 'upsert',
        payload: {
          type: 'plan_item_completed',
          topic: 'Unix Philosophy',
          payload: { score: 100 },
        },
      },
    ],
  };

  try {
    const syncRes = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(syncBatchPayload),
    });
    const syncJson = await syncRes.json();

    const ack = syncJson.data?.acknowledgedOperationIds || [];
    assert(
      syncRes.status === 200 &&
        syncJson.success &&
        ack.includes(opMemId) &&
        ack.includes(opPlanId) &&
        ack.includes(opEvtId),
      'POST /api/sync/batch accepts multi-entity batch and returns acknowledgedOperationIds'
    );
  } catch (err) {
    assert(false, `Batch sync test failed: ${err.message}`);
  }

  // Test 4: Idempotency & Deduplication — Repeating the exact same batch returns ack without duplicating
  try {
    const retryRes = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(syncBatchPayload),
    });
    const retryJson = await retryRes.json();
    const ack = retryJson.data?.acknowledgedOperationIds || [];

    assert(
      retryRes.status === 200 &&
        ack.includes(opMemId) &&
        ack.includes(opPlanId) &&
        ack.includes(opEvtId) &&
        retryJson.data?.rejectedOperations?.length === 0,
      'POST /api/sync/batch is idempotent: re-submitting already processed operations acknowledges without duplication'
    );
  } catch (err) {
    assert(false, `Idempotency test failed: ${err.message}`);
  }

  // Test 5: Partial batch success & validation rejection
  try {
    const mixedBatch = {
      operations: [
        {
          operationId: `op_valid_${Date.now()}`,
          entityType: 'learnerProfile',
          entityId: 'profile',
          operation: 'upsert',
          payload: { preferences: { theme: 'dark' } },
        },
        {
          operationId: `op_invalid_${Date.now()}`,
          entityType: 'unsupportedEntityCategory',
          entityId: 'xyz_123',
          operation: 'upsert',
          payload: {},
        },
      ],
    };

    const mixedRes = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(mixedBatch),
    });
    const mixedJson = await mixedRes.json();

    const ack = mixedJson.data?.acknowledgedOperationIds || [];
    const rej = mixedJson.data?.rejectedOperations || [];

    assert(
      mixedRes.status === 200 &&
        ack.length === 1 &&
        rej.length === 1 &&
        rej[0].code === 'INVALID_OPERATION',
      'POST /api/sync/batch handles partial failure: valid operations acknowledged, invalid operation rejected'
    );
  } catch (err) {
    assert(false, `Partial batch test failed: ${err.message}`);
  }

  // Test 6: GET /api/sync/pull returns the user synchronized state
  try {
    const pullRes = await fetch(`${BASE_URL}/sync/pull`, {
      method: 'GET',
      headers: authHeaders,
    });
    const pullJson = await pullRes.json();

    const memories = pullJson.data?.memories || [];
    const plans = pullJson.data?.plans || [];

    assert(
      pullRes.status === 200 &&
        pullJson.success &&
        memories.some((m) => m.memoryId === memId && m.value === 'Odia') &&
        plans.some((p) => p.planId === planId),
      'GET /api/sync/pull retrieves persisted server-side memories, plans, and profile'
    );
  } catch (err) {
    assert(false, `Pull sync test failed: ${err.message}`);
  }

  // Test 7: Tombstone / soft-delete synchronization
  try {
    const deleteOpId = `op_del_${Date.now()}`;
    const delRes = await fetch(`${BASE_URL}/sync/batch`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        operations: [
          {
            operationId: deleteOpId,
            entityType: 'learnerMemory',
            entityId: memId,
            operation: 'delete',
            payload: { status: 'deleted', version: 2 },
          },
        ],
      }),
    });
    const delJson = await delRes.json();
    assert(
      delRes.status === 200 && delJson.data?.acknowledgedOperationIds?.includes(deleteOpId),
      'POST /api/sync/batch processes tombstone deletion for memories'
    );

    // Verify status in pull
    const verifyPull = await fetch(`${BASE_URL}/sync/pull`, {
      method: 'GET',
      headers: authHeaders,
    });
    const verifyJson = await verifyPull.json();
    const deletedMem = (verifyJson.data?.memories || []).find((m) => m.memoryId === memId);
    assert(
      deletedMem && deletedMem.status === 'deleted',
      'Soft-deleted memory record preserves status: deleted on server'
    );
  } catch (err) {
    assert(false, `Tombstone deletion test failed: ${err.message}`);
  }

  // Test 8: User isolation (Another user cannot view or mutate first user records)
  try {
    const otherEmail = `sync_other_${Date.now()}@edunix.local`;
    const otherReg = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Other Student',
        email: otherEmail,
        password: 'SecurePassword123!',
      }),
    });
    const otherData = await otherReg.json();
    const otherCookie = otherReg.headers.get('set-cookie')?.split(';')[0] || '';
    const otherToken = otherData.data?.token || '';
    const otherHeaders = {
      'Content-Type': 'application/json',
      ...(otherCookie ? { Cookie: otherCookie } : {}),
      ...(otherToken ? { Authorization: `Bearer ${otherToken}` } : {}),
    };

    const otherPull = await fetch(`${BASE_URL}/sync/pull`, {
      method: 'GET',
      headers: otherHeaders,
    });
    const otherPullJson = await otherPull.json();
    const otherMemories = otherPullJson.data?.memories || [];
    const otherPlans = otherPullJson.data?.plans || [];

    assert(
      !otherMemories.some((m) => m.memoryId === memId) &&
        !otherPlans.some((p) => p.planId === planId),
      'Strict user isolation: second student cannot view or access first student memories or plans'
    );
  } catch (err) {
    assert(false, `User isolation test failed: ${err.message}`);
  }

  console.log(`\n========================================`);
  console.log(`Sync Test Results: ${passed} passed, ${failed} failed.`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
};

runSyncTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
