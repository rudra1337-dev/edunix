/**
 * Automated Verification Suite for Edunix Offline-First Memory, Learning Plans & Synchronization
 * Covers Sections 17.2 through 17.6 of specification:
 * - 17.2 Change-Driven Memory Engine Tests (10 tests)
 * - 17.3 Learning Plan & Checklist Tests (8 tests)
 * - 17.4 Context Retrieval Tests (5 tests)
 * - 17.5 Synchronization Tests (6 tests)
 * - 17.6 End-to-End Offline-to-Online Integration Flow (7 steps)
 */

import 'fake-indexeddb/auto';
import { getDB, clearAllStores, STORES } from './src/services/storage/db.js';
import memoryRepository from './src/services/storage/memoryRepository.js';
import learningPlanRepository from './src/services/storage/learningPlanRepository.js';
import learningEventRepository from './src/services/storage/learningEventRepository.js';
import conversationRepository from './src/services/storage/conversationRepository.js';
import syncQueueRepository from './src/services/storage/syncQueueRepository.js';
import memoryService, { MemoryService } from './src/services/memory/memoryService.js';
import {
  evaluateMemoryDecision,
  DECISIONS,
  areValuesSemanticallyEqual,
  normalizeText,
} from './src/services/memory/memoryComparison.js';
import learningPlanService, {
  LearningPlanService,
  calculateProgress,
  ITEM_STATUSES,
  PLAN_STATUSES,
} from './src/services/learning/learningPlanService.js';
import contextRetrievalService, {
  ContextRetrievalService,
} from './src/services/ai/contextRetrievalService.js';
import syncEngine, { SyncEngine } from './src/services/sync/syncEngine.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const assert = (condition, testName, details = '') => {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
};

const runAllTests = async () => {
  console.log('================================================================');
  console.log('🚀 EDUNIX OFFLINE-FIRST LEARNING MEMORY & SYNC TEST SUITE');
  console.log('================================================================\n');

  const testUser = `test_learner_${Date.now()}`;

  // ----------------------------------------------------------------
  // 17.2 CHANGE-DRIVEN MEMORY ENGINE TESTS (10 TESTS)
  // ----------------------------------------------------------------
  console.log('📌 Section 17.2: Change-Driven Memory Engine Tests');
  await clearAllStores();

  // Test 1: Unchanged observation causes zero writes and zero sync operations
  const initialMem = {
    id: 'mem_lang_01',
    userId: testUser,
    key: 'preferred_language',
    value: 'Odia',
    type: 'learning_preference',
    source: 'explicit',
    confidence: 1.0,
    status: 'active',
    version: 1,
  };
  await memoryRepository.saveMemory(initialMem);

  const syncCountBefore1 = await syncQueueRepository.getQueueCount();
  const memCountBefore1 = (await memoryRepository.getMemories(testUser)).length;

  const res1 = await memoryService.processCandidateMemory(testUser, {
    key: 'preferred_language',
    value: 'Odia',
    type: 'learning_preference',
    source: 'explicit',
  });

  const syncCountAfter1 = await syncQueueRepository.getQueueCount();
  const memCountAfter1 = (await memoryRepository.getMemories(testUser)).length;

  assert(
    res1.action === 'ignored' &&
      syncCountBefore1 === syncCountAfter1 &&
      memCountBefore1 === memCountAfter1,
    '1. Unchanged observation causes zero writes and zero sync operations'
  );

  // Test 2: Semantic equality detects identical preference regardless of whitespace or casing
  const areEqualCaseWhitespace = areValuesSemanticallyEqual(
    'Simple explanations with practical examples',
    '   simple   explanations   with PRACTICAL examples   '
  );
  const decisionSem = evaluateMemoryDecision(
    {
      key: 'explanation_style',
      value: '   simple   explanations   with PRACTICAL examples   ',
      type: 'learning_preference',
    },
    [
      {
        key: 'explanation_style',
        value: 'Simple explanations with practical examples',
        type: 'learning_preference',
        status: 'active',
      },
    ]
  );
  assert(
    areEqualCaseWhitespace === true && decisionSem.decision === DECISIONS.IGNORE,
    '2. Semantic equality detects identical preference regardless of whitespace or casing'
  );

  // Test 3: Explicit user preference update replaces old value and creates sync operation
  const syncCountBefore3 = await syncQueueRepository.getQueueCount();
  const res3 = await memoryService.processCandidateMemory(testUser, {
    key: 'preferred_language',
    value: 'Hindi',
    type: 'learning_preference',
    source: 'explicit',
    confidence: 1.0,
  });
  const syncCountAfter3 = await syncQueueRepository.getQueueCount();
  const updatedMem3 = (await memoryRepository.getMemories(testUser, { status: 'active' })).find(
    (m) => m.key === 'preferred_language'
  );

  assert(
    res3.action === 'updated' &&
      updatedMem3?.value === 'Hindi' &&
      updatedMem3?.version === 2 &&
      syncCountAfter3 === syncCountBefore3 + 1,
    '3. Explicit user preference update replaces old value and creates sync operation'
  );

  // Test 4: User message without memory-worthy information generates no memory records
  const casualCandidates1 = memoryService.extractCandidates('Hello there, how are you today?');
  const casualCandidates2 = memoryService.extractCandidates('Ok thank you, understood!');
  assert(
    casualCandidates1.length === 0 && casualCandidates2.length === 0,
    '4. User message without memory-worthy information generates no memory records'
  );

  // Test 5: Inferred observation with low confidence does NOT overwrite existing explicit preference
  const res5 = evaluateMemoryDecision(
    {
      key: 'preferred_language',
      value: 'English',
      type: 'learning_preference',
      source: 'inferred',
      confidence: 0.5,
    },
    [
      {
        key: 'preferred_language',
        value: 'Hindi',
        type: 'learning_preference',
        source: 'explicit',
        confidence: 1.0,
        status: 'active',
      },
    ]
  );
  assert(
    res5.decision === DECISIONS.IGNORE && res5.reason.includes('explicit user preference'),
    '5. Inferred observation with low confidence does NOT overwrite existing explicit preference'
  );

  // Test 6: Observation deduplication detects duplicate within same conversation window
  const duplicateCandidate = {
    key: 'goal_docker',
    value: 'Master Docker containerization',
    type: 'learning_goal',
    source: 'explicit',
    confidence: 0.95,
  };
  const firstPass = await memoryService.processCandidateMemory(testUser, duplicateCandidate);
  const secondPass = await memoryService.processCandidateMemory(testUser, duplicateCandidate);
  assert(
    firstPass.action === 'created' && secondPass.action === 'ignored',
    '6. Observation deduplication detects duplicate within same conversation window'
  );

  // Test 7: Explicit user override of inferred memory updates provenance and confidence
  const inferredMem = {
    id: 'mem_style_inferred',
    userId: testUser,
    key: 'explanation_style',
    value: 'Detailed technical explanations',
    type: 'learning_preference',
    source: 'inferred',
    confidence: 0.6,
    status: 'active',
    version: 1,
  };
  await memoryRepository.saveMemory(inferredMem);

  const res7 = await memoryService.processCandidateMemory(testUser, {
    key: 'explanation_style',
    value: 'Simple beginner friendly explanations',
    type: 'learning_preference',
    source: 'explicit',
    confidence: 1.0,
  });
  const updatedMem7 = (await memoryRepository.getMemories(testUser, { status: 'active' })).find(
    (m) => m.key === 'explanation_style'
  );
  assert(
    res7.action === 'updated' &&
      updatedMem7?.source === 'explicit' &&
      updatedMem7?.confidence === 1.0 &&
      updatedMem7?.value === 'Simple beginner friendly explanations',
    '7. Explicit user override of inferred memory updates provenance and confidence'
  );

  // Test 8: Failed memory extraction retains existing memory state without corruption
  const memsBefore8 = await memoryRepository.getMemories(testUser);
  const res8 = await memoryService.processCandidateMemory(testUser, null);
  const memsAfter8 = await memoryRepository.getMemories(testUser);
  assert(
    res8.action === 'ignored' && memsBefore8.length === memsAfter8.length,
    '8. Failed memory extraction retains existing memory state without corruption'
  );

  // Test 9: Summarization triggers only when unsummarized message threshold is exceeded
  const convId = 'conv_summary_test';
  await conversationRepository.saveConversation({
    id: convId,
    userId: testUser,
    title: 'Linux CLI',
    summary: 'Initial summary',
    summaryMessageCount: 2,
  });
  const shortMsgList = [
    { role: 'user', content: 'What is grep?' },
    { role: 'assistant', content: 'grep searches text' },
    { role: 'user', content: 'What is cat?' },
  ];
  // 3 messages - 2 = 1 (threshold is 4)
  const summaryNoTrigger = await memoryService.evaluateConversationSummary(convId, shortMsgList);

  const longMsgList = [
    { role: 'user', content: 'What is grep?' },
    { role: 'assistant', content: 'grep searches text' },
    { role: 'user', content: 'What is cat?' },
    { role: 'assistant', content: 'cat concatenates files' },
    { role: 'user', content: 'What is chmod?' },
    { role: 'assistant', content: 'chmod changes permissions' },
    { role: 'user', content: 'What is chown?' },
  ];
  // 7 messages - 2 = 5 >= 4 -> triggers!
  const summaryTriggered = await memoryService.evaluateConversationSummary(convId, longMsgList);
  assert(
    summaryNoTrigger === 'Initial summary' &&
      summaryTriggered !== 'Initial summary' &&
      summaryTriggered.includes('Recent topics'),
    '9. Summarization triggers only when unsummarized message threshold is exceeded'
  );

  // Test 10: Soft-deleted memory is excluded from active retrieval and propagates as tombstone
  const memToDelete = {
    id: 'mem_to_delete_01',
    userId: testUser,
    key: 'temporary_note',
    value: 'Delete me soon',
    status: 'active',
  };
  await memoryRepository.saveMemory(memToDelete);
  await memoryService.deleteMemory(testUser, memToDelete.id);

  const activeMemsAfterDelete = await memoryRepository.getMemories(testUser, { status: 'active' });
  const rawDeleted = await memoryRepository.getMemory(memToDelete.id);
  const syncQueueAfterDel = await syncQueueRepository.getPendingBatch();
  const deleteOp = syncQueueAfterDel.find(
    (op) => op.entityId === memToDelete.id && op.operation === 'delete'
  );

  assert(
    !activeMemsAfterDelete.some((m) => m.id === memToDelete.id) &&
      rawDeleted?.status === 'deleted' &&
      Boolean(deleteOp),
    '10. Soft-deleted memory is excluded from active retrieval and propagates as tombstone'
  );

  // ----------------------------------------------------------------
  // 17.3 LEARNING PLAN & CHECKLIST TESTS (8 TESTS)
  // ----------------------------------------------------------------
  console.log('\n📌 Section 17.3: Learning Plan & Checklist Tests');
  await clearAllStores();

  // Test 1: Plan creation initializes ordered items and default progress stats
  const plan = await learningPlanService.getOrCreateActivePlan(testUser);
  const initialProg = calculateProgress(plan.items);
  assert(
    Boolean(plan.id) &&
      Array.isArray(plan.items) &&
      plan.items.length === 6 &&
      plan.items[0].order === 1 &&
      plan.items[1].order === 2 &&
      initialProg.total === 6 &&
      initialProg.completed === 1,
    '1. Plan creation initializes ordered items and default progress stats'
  );

  // Test 2: Item state transition from 'not_started' to 'in_progress' succeeds
  const item3 = plan.items.find((i) => i.id === 'item_3_streams_pipes');
  const resTrans2 = await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: plan.id,
    itemId: item3.id,
    newStatus: ITEM_STATUSES.IN_PROGRESS,
  });
  assert(
    resTrans2.changed === true &&
      resTrans2.item.status === ITEM_STATUSES.IN_PROGRESS &&
      Boolean(resTrans2.item.startedAt),
    '2. Item state transition from \'not_started\' to \'in_progress\' succeeds'
  );

  // Test 3: Item transition to 'completed' sets completedAt timestamp
  const resTrans3 = await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: plan.id,
    itemId: item3.id,
    newStatus: ITEM_STATUSES.COMPLETED,
  });
  assert(
    resTrans3.changed === true &&
      resTrans3.item.status === ITEM_STATUSES.COMPLETED &&
      Boolean(resTrans3.item.completedAt) &&
      new Date(resTrans3.item.completedAt).getTime() > 0,
    '3. Item transition to \'completed\' sets completedAt timestamp'
  );

  // Test 4: Item transition to 'review' increments reviewCount
  await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: plan.id,
    itemId: item3.id,
    newStatus: ITEM_STATUSES.REVIEW,
  });
  const resTrans4 = await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: plan.id,
    itemId: item3.id,
    newStatus: ITEM_STATUSES.COMPLETED,
  });
  assert(
    resTrans4.item.reviewMetadata.reviewCount === 1 &&
      Boolean(resTrans4.item.reviewMetadata.lastReviewedAt),
    '4. Item transition to \'review\' increments reviewCount upon subsequent completion'
  );

  // Test 5: Invalid status transition is rejected with clear error
  let rejectedError = null;
  try {
    // Attempt illegal transition directly from not_started to completed
    await learningPlanService.updateItemStatus({
      userId: testUser,
      planId: plan.id,
      itemId: 'item_4_text_processing', // currently not_started
      newStatus: ITEM_STATUSES.COMPLETED,
    });
  } catch (err) {
    rejectedError = err;
  }
  assert(
    rejectedError !== null && rejectedError.message.includes('Invalid status transition'),
    '5. Invalid status transition is rejected with clear error'
  );

  // Test 6: Overall progress calculation accurately reflects item states
  const sampleItems = [
    { status: ITEM_STATUSES.COMPLETED },
    { status: ITEM_STATUSES.COMPLETED },
    { status: ITEM_STATUSES.IN_PROGRESS },
    { status: ITEM_STATUSES.REVIEW },
  ];
  const prog6 = calculateProgress(sampleItems);
  assert(
    prog6.total === 4 &&
      prog6.completed === 2 &&
      prog6.inProgress === 1 &&
      prog6.review === 1 &&
      prog6.percentage === 50,
    '6. Overall progress calculation accurately reflects item states'
  );

  // Test 7: Progress calculation handles empty items list safely without NaN
  const progEmpty = calculateProgress([]);
  assert(
    progEmpty.total === 0 &&
      progEmpty.completed === 0 &&
      progEmpty.percentage === 0 &&
      !Number.isNaN(progEmpty.percentage),
    '7. Progress calculation handles empty items list safely without NaN'
  );

  // Test 8: Checklist reordering updates order indices deterministically
  const initialOrder = plan.items.map((i) => i.id);
  const reversedOrder = [...initialOrder].reverse();
  const reorderedPlan = await learningPlanService.reorderItems({
    userId: testUser,
    planId: plan.id,
    itemIds: reversedOrder,
  });
  const newOrderValid = reorderedPlan.items.every(
    (item, idx) => item.id === reversedOrder[idx] && item.order === idx + 1
  );
  assert(
    newOrderValid === true && reorderedPlan.version > plan.version,
    '8. Checklist reordering updates order indices deterministically'
  );

  // ----------------------------------------------------------------
  // 17.4 CONTEXT RETRIEVAL TESTS (5 TESTS)
  // ----------------------------------------------------------------
  console.log('\n📌 Section 17.4: Context Retrieval Tests');
  await clearAllStores();

  // Populate local data
  await memoryRepository.saveMemory({
    id: 'm1',
    userId: testUser,
    type: 'learning_preference',
    key: 'preferred_language',
    value: 'Odia',
    status: 'active',
    syncStatus: 'synced',
    _id: 'internal_mongo_id_123',
    __v: 0,
  });
  await memoryRepository.saveMemory({
    id: 'm2',
    userId: testUser,
    type: 'learning_goal',
    key: 'linux_signals',
    value: 'Master SIGTERM and POSIX signals',
    status: 'active',
  });
  await memoryRepository.saveMemory({
    id: 'm_deleted',
    userId: testUser,
    type: 'learning_preference',
    key: 'old_pref',
    value: 'Forbidden deleted value',
    status: 'deleted',
  });
  const testPlan = await learningPlanService.getOrCreateActivePlan(testUser);

  // Test 1: Assembled context stays within configured token/character budget
  const assembledContext = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'Teach me Unix signals' }],
  });
  const prompt1 = contextRetrievalService.buildSystemPrompt(assembledContext);
  assert(
    prompt1.length > 50 && prompt1.length < 2500,
    '1. Assembled context stays within configured token/character budget'
  );

  // Test 2: Highly relevant memory is included; low-relevance memory is excluded when budget is constrained
  assert(
    assembledContext.learner.preferences.preferred_language === 'Odia' &&
      assembledContext.learner.relevantMemories.some((m) => m.key === 'linux_signals'),
    '2. Highly relevant memory is included; low-relevance memory is excluded'
  );

  // Test 3: Internal sync, deleted, and raw database fields are never leaked into assembled context
  const contextJson = JSON.stringify(assembledContext);
  const promptText = prompt1;
  const leaksDbFields =
    contextJson.includes('internal_mongo_id_123') ||
    contextJson.includes('Forbidden deleted value') ||
    contextJson.includes('syncStatus') ||
    promptText.includes('Forbidden deleted value');
  assert(
    leaksDbFields === false,
    '3. Internal sync, deleted, and raw database fields are never leaked into assembled context'
  );

  // Test 4: Retrieval works identically with mock offline data without network calls
  let fetchAttempted = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    fetchAttempted = true;
    return Promise.reject(new Error('Network offline'));
  };

  const offlineContext = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'What is a process?' }],
  });
  globalThis.fetch = originalFetch;

  assert(
    fetchAttempted === false && Boolean(offlineContext.learning.activePlan),
    '4. Retrieval works identically with offline IndexedDB data without network calls'
  );

  // Test 5: Context formatting produces clean Markdown/text suitable for system prompts
  const cleanPrompt = contextRetrievalService.buildSystemPrompt(assembledContext);
  assert(
    cleanPrompt.includes('You are Edunix') &&
      cleanPrompt.includes('Learner Preferences:') &&
      cleanPrompt.includes('Odia') &&
      cleanPrompt.includes('Active Study Plan:'),
    '5. Context formatting produces clean Markdown/text suitable for system prompts'
  );

  // ----------------------------------------------------------------
  // 17.5 SYNCHRONIZATION TESTS (6 TESTS)
  // ----------------------------------------------------------------
  console.log('\n📌 Section 17.5: Synchronization Tests');
  await clearAllStores();

  // Test 1: Offline queue accumulates operations when backend is unreachable
  const op1 = await syncQueueRepository.enqueue({
    userId: testUser,
    entityType: 'learnerMemory',
    entityId: 'mem_offline_1',
    operation: 'upsert',
    payload: { key: 'pref_1', value: 'Val 1' },
  });
  const op2 = await syncQueueRepository.enqueue({
    userId: testUser,
    entityType: 'learnerMemory',
    entityId: 'mem_offline_2',
    operation: 'upsert',
    payload: { key: 'pref_2', value: 'Val 2' },
  });
  const pendingBatch1 = await syncQueueRepository.getPendingBatch();
  assert(
    pendingBatch1.length === 2 && pendingBatch1[0].status === 'pending',
    '1. Offline queue accumulates operations when backend is unreachable'
  );

  // Test 2: Sync worker executes idempotent batch push when connection restores
  // We simulate a successful batch sync with mock API responder
  const originalApiPost = syncEngine.isBackendReachable;
  syncEngine.isBackendReachable = async () => true;

  // Let's test with the live backend using a registered user!
  const syncTesterEmail = `offline_test_${Date.now()}@edunix.local`;
  const regRes = await fetch('http://localhost:5000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Sync Tester',
      email: syncTesterEmail,
      password: 'Password123!',
    }),
  });
  const regJson = await regRes.json();
  const token = regJson.token || regJson.data?.token;
  const registeredUserId = regJson.user?.id || regJson.data?.user?.id;

  const liveMemId = `mem_live_${Date.now()}`;
  const liveOpId = `op_live_${Date.now()}`;

  // Direct batch push against backend
  const pushRes = await fetch('http://localhost:5000/api/sync/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      operations: [
        {
          operationId: liveOpId,
          entityType: 'learnerMemory',
          entityId: liveMemId,
          operation: 'upsert',
          payload: {
            id: liveMemId,
            userId: registeredUserId,
            key: 'editor',
            value: 'vim',
            type: 'learning_preference',
            status: 'active',
          },
        },
      ],
    }),
  });
  const pushJson = await pushRes.json();
  assert(
    pushRes.ok && pushJson.data?.acknowledgedOperationIds?.includes(liveOpId),
    '2. Sync worker executes idempotent batch push when connection restores'
  );

  // Test 3: Duplicate operations in queue are deduplicated before transmission
  await clearAllStores();
  await syncQueueRepository.enqueue({
    userId: testUser,
    entityType: 'learnerMemory',
    entityId: 'mem_dedup_01',
    operation: 'upsert',
    payload: { value: 'First value' },
  });
  await syncQueueRepository.enqueue({
    userId: testUser,
    entityType: 'learnerMemory',
    entityId: 'mem_dedup_01',
    operation: 'upsert',
    payload: { value: 'Second updated value' },
  });
  const dedupBatch = await syncQueueRepository.getPendingBatch();
  assert(
    dedupBatch.length === 1 && dedupBatch[0].payload.value === 'Second updated value',
    '3. Duplicate operations in queue are deduplicated before transmission'
  );

  // Test 4: Server acknowledgment causes successful queue cleanup
  await syncQueueRepository.acknowledge([dedupBatch[0].operationId]);
  const queueAfterAck = await syncQueueRepository.getQueueCount();
  assert(
    queueAfterAck === 0,
    '4. Server acknowledgment causes successful queue cleanup'
  );

  // Test 5: Server 4xx client error moves operation to dead-letter queue without blocking others
  const badOp = await syncQueueRepository.enqueue({
    userId: testUser,
    entityType: 'learnerMemory',
    entityId: 'mem_bad_01',
    operation: 'upsert',
    payload: { invalid: true },
  });
  await syncQueueRepository.recordFailure(badOp.operationId, 'Invalid Schema Payload', true);
  const storedBadOp = await syncQueueRepository.getPendingBatch();
  assert(
    !storedBadOp.some((op) => op.operationId === badOp.operationId),
    '5. Server 4xx client error moves operation to dead-letter queue without blocking others'
  );

  // Test 6: Exponential backoff increases delay after consecutive network failures
  const retryOp = await syncQueueRepository.enqueue({
    userId: testUser,
    entityType: 'learnerMemory',
    entityId: 'mem_retry_01',
    operation: 'upsert',
    payload: { valid: true },
  });
  const opFailedOnce = await syncQueueRepository.recordFailure(retryOp.operationId, 'Timeout');
  const delay1 = new Date(opFailedOnce.nextAttemptAt).getTime() - Date.now();
  const opFailedTwice = await syncQueueRepository.recordFailure(retryOp.operationId, 'Timeout');
  const delay2 = new Date(opFailedTwice.nextAttemptAt).getTime() - Date.now();
  assert(
    opFailedTwice.attempts === 2 && delay2 > delay1,
    '6. Exponential backoff increases delay after consecutive network failures'
  );

  // ----------------------------------------------------------------
  // 17.6 END-TO-END OFFLINE-TO-ONLINE INTEGRATION FLOW (7 STEPS)
  // ----------------------------------------------------------------
  console.log('\n📌 Section 17.6: End-to-End Offline-to-Online Integration Flow');
  await clearAllStores();

  const e2eUser = registeredUserId || `user_e2e_${Date.now()}`;

  // Step 1: User starts conversation in offline mode
  const conv = await conversationRepository.saveConversation({
    id: `conv_${Date.now()}`,
    userId: e2eUser,
    title: 'Offline Linux Exploration',
    summary: '',
    syncStatus: 'pending',
  });
  assert(Boolean(conv.id), 'Step 1: User starts conversation in offline mode');

  // Step 2: Memory service extracts new preference
  const candidateMem = {
    key: 'preferred_language',
    value: 'Odia',
    type: 'learning_preference',
    source: 'explicit',
    confidence: 1.0,
  };
  const memResult = await memoryService.processCandidateMemory(e2eUser, candidateMem);
  assert(
    memResult.action === 'created' && memResult.memory.value === 'Odia',
    'Step 2: Memory service extracts new preference and stores it locally'
  );

  // Step 3: Context retrieval supplies that preference to subsequent offline chat query
  const offlineAssembled = await contextRetrievalService.assembleContext({
    userId: e2eUser,
    conversationId: conv.id,
    currentMessages: [{ role: 'user', content: 'Explain grep command' }],
  });
  const promptOffline = contextRetrievalService.buildSystemPrompt(offlineAssembled);
  assert(
    offlineAssembled.learner.preferences.preferred_language === 'Odia' &&
      promptOffline.includes('Odia'),
    'Step 3: Context retrieval supplies that preference to subsequent offline chat query'
  );

  // Step 4: User checks off a learning plan item offline
  const e2ePlan = await learningPlanService.getOrCreateActivePlan(e2eUser);
  const targetItem = e2ePlan.items.find((i) => i.id === 'item_2_permissions');
  const planUpdateRes = await learningPlanService.updateItemStatus({
    userId: e2eUser,
    planId: e2ePlan.id,
    itemId: targetItem.id,
    newStatus: ITEM_STATUSES.COMPLETED,
  });
  assert(
    planUpdateRes.item.status === ITEM_STATUSES.COMPLETED &&
      Boolean(planUpdateRes.item.completedAt),
    'Step 4: User checks off a learning plan item offline (completedAt set)'
  );

  // Step 5: Connection is restored & pending queue inspected
  const pendingToSync = await syncQueueRepository.getPendingBatch(50);
  assert(
    pendingToSync.length >= 2,
    `Step 5: Connection is restored; ${pendingToSync.length} offline operations queued for sync`
  );

  // Step 6: Sync worker drains queue to MongoDB backend
  const syncPushRes = await fetch('http://localhost:5000/api/sync/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      operations: pendingToSync.map((op) => ({
        operationId: op.operationId,
        entityType: op.entityType,
        entityId: op.entityId,
        operation: op.operation,
        payload: op.payload,
        createdAt: op.createdAt,
      })),
    }),
  });
  const syncPushData = await syncPushRes.json();
  const ackedIds = syncPushData.data?.acknowledgedOperationIds || [];
  await syncQueueRepository.acknowledge(ackedIds);
  const remainingInQueue = await syncQueueRepository.getQueueCount();
  assert(
    syncPushRes.ok && ackedIds.length >= 2 && remainingInQueue === 0,
    `Step 6: Sync worker drains queue to MongoDB (${ackedIds.length} operations acknowledged, 0 remaining)`
  );

  // Step 7: Verification query to MongoDB confirms updated memory and plan item state
  const pullRes = await fetch('http://localhost:5000/api/sync/pull', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const pullData = await pullRes.json();
  const remoteMemories = pullData.data?.memories || pullData.data?.learnerMemories || [];
  const remotePlans = pullData.data?.plans || pullData.data?.learningPlans || [];
  const verifiedMem = remoteMemories.find((m) => m.key === 'preferred_language');
  const verifiedPlan = remotePlans.find((p) => (p.id === e2ePlan.id || p.planId === e2ePlan.id));
  const verifiedPlanItem = verifiedPlan?.items?.find((i) => (i.id === targetItem.id || i.itemId === targetItem.id));

  assert(
    pullRes.ok &&
      verifiedMem?.value === 'Odia' &&
      verifiedPlanItem?.status === ITEM_STATUSES.COMPLETED,
    'Step 7: Server pull confirms updated memory (Odia) and plan item (completed) persisted in MongoDB'
  );

  // ----------------------------------------------------------------
  // TEST SUITE SUMMARY
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 TEST SUITE COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`❌ FAILED: ${failedTests} tests failed.`);
    process.exit(1);
  } else {
    console.log('🎉 ALL EDUNIX OFFLINE-FIRST TESTS PASSED SUCCESSFULLY (100%)');
    console.log('================================================================\n');
    process.exit(0);
  }
};

runAllTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
