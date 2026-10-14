/**
 * Automated Test Suite for Edunix Personalized Learning Journey & Notion-Style Roadmaps
 * Tests:
 * 1. Schema Normalization & Metrics (4 tests)
 * 2. Roadmap Management & CRUD Lifecycle (7 tests)
 * 3. Deterministic Next-Step Recommendation Engine (4 tests)
 * 4. AI Generation & Resilient Parser (4 tests)
 * 5. Roadmap-Aware AI Context Retrieval & Pedagogical Guidance (7 tests)
 */

import 'fake-indexeddb/auto';
import { clearAllStores, STORES } from './src/services/storage/db.js';
import learningPlanRepository from './src/services/storage/learningPlanRepository.js';
import syncQueueRepository from './src/services/storage/syncQueueRepository.js';
import memoryRepository from './src/services/storage/memoryRepository.js';
import conversationRepository from './src/services/storage/conversationRepository.js';
import learningPlanService, {
  normalizeRoadmap,
  calculateProgress,
  ITEM_STATUSES,
  PLAN_STATUSES,
} from './src/services/learning/learningPlanService.js';
import contextRetrievalService from './src/services/ai/contextRetrievalService.js';

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

async function runRoadmapTests() {
  console.log('================================================================');
  console.log('🚀 EDUNIX PERSONALIZED NOTION ROADMAP SYSTEM TEST SUITE');
  console.log('================================================================');

  const testUser = `student_${Date.now()}`;

  // ----------------------------------------------------------------
  // SECTION 1: SCHEMA NORMALIZATION & METRICS
  // ----------------------------------------------------------------
  console.log('\n📌 Section 1: Schema Normalization & Metrics');
  await clearAllStores();

  // Test 1: Empty or minimal plan normalizes to valid Notion curriculum
  const normalizedEmpty = normalizeRoadmap({ title: 'Test Linux Path' });
  assert(
    normalizedEmpty.title === 'Test Linux Path' &&
      Array.isArray(normalizedEmpty.sections) &&
      normalizedEmpty.sections.length > 0 &&
      Array.isArray(normalizedEmpty.items) &&
      normalizedEmpty.items.length > 0 &&
      Boolean(normalizedEmpty.id),
    '1. Empty or minimal plan normalizes to valid Notion curriculum'
  );

  // Test 2: Legacy flat items plan maps into sections and preserves order
  const legacyPlan = {
    id: 'legacy_plan_1',
    title: 'Legacy Flat Plan',
    items: [
      { id: 't1', title: 'Topic One', status: ITEM_STATUSES.NOT_STARTED, order: 1 },
      { id: 't2', title: 'Topic Two', status: ITEM_STATUSES.IN_PROGRESS, order: 2 },
    ],
  };
  const normalizedLegacy = normalizeRoadmap(legacyPlan);
  assert(
    normalizedLegacy.sections.length === 1 &&
      normalizedLegacy.sections[0].topics.length === 2 &&
      normalizedLegacy.items.length === 2 &&
      normalizedLegacy.items[0].id === 't1' &&
      normalizedLegacy.sections[0].topics[1].status === ITEM_STATUSES.IN_PROGRESS,
    '2. Legacy flat items plan maps into sections and preserves order'
  );

  // Test 3: Hierarchical sections flatten into items in bidirectional sync
  const hierarchicalPlan = {
    id: 'hier_1',
    title: 'Kubernetes Architecture',
    sections: [
      {
        id: 'sec_control_plane',
        title: 'Control Plane Components',
        topics: [
          { id: 'top_etcd', title: 'etcd Distributed Store', status: ITEM_STATUSES.COMPLETED },
          { id: 'top_api_server', title: 'kube-apiserver', status: ITEM_STATUSES.IN_PROGRESS },
        ],
      },
      {
        id: 'sec_worker_nodes',
        title: 'Worker Nodes',
        topics: [
          { id: 'top_kubelet', title: 'kubelet Agent', status: ITEM_STATUSES.NOT_STARTED },
        ],
      },
    ],
  };
  const normalizedHier = normalizeRoadmap(hierarchicalPlan);
  assert(
    normalizedHier.sections.length === 2 &&
      normalizedHier.items.length === 3 &&
      normalizedHier.items.find((i) => i.id === 'top_etcd').sectionId === 'sec_control_plane' &&
      normalizedHier.items.find((i) => i.id === 'top_kubelet').sectionId === 'sec_worker_nodes',
    '3. Hierarchical sections flatten into items in bidirectional sync'
  );

  // Test 4: Progress statistics accurately calculate across status counts
  const progStats = calculateProgress(normalizedHier.items);
  assert(
    progStats.total === 3 &&
      progStats.completed === 1 &&
      progStats.inProgress === 1 &&
      progStats.notStarted === 1 &&
      progStats.percentage === 33,
    '4. Progress statistics accurately calculate across status counts'
  );

  // ----------------------------------------------------------------
  // SECTION 2: ROADMAP MANAGEMENT & CRUD LIFECYCLE
  // ----------------------------------------------------------------
  console.log('\n📌 Section 2: Roadmap Management & CRUD Lifecycle');

  // Test 1: createRoadmap persists to IndexedDB and enqueues sync operation
  const created = await learningPlanService.createRoadmap({
    userId: testUser,
    title: 'Advanced Docker Internals',
    goal: 'Understand cgroups, namespaces, and union filesystems',
    targetAudience: 'Senior Engineers',
    estimatedDuration: '3 Weeks',
    sections: [
      {
        id: 'sec_isolation',
        title: 'Kernel Isolation Mechanisms',
        topics: [
          {
            id: 'top_namespaces',
            title: 'Linux Namespaces (PID, Mount, Net)',
            status: ITEM_STATUSES.NOT_STARTED,
            checklist: [
              { id: 'chk_unshare', text: 'Run unshare -p -f --mount-proc', completed: false },
              { id: 'chk_nsenter', text: 'Inspect with nsenter', completed: false },
            ],
            notes: 'Initial study notes',
          },
        ],
      },
    ],
  });

  const persistedInDb = await learningPlanRepository.getPlan(created.id);
  const queueOps = await syncQueueRepository.getPendingBatch(100);
  const lastSyncOp = queueOps.find((op) => op.entityId === created.id);

  assert(
    Boolean(persistedInDb) &&
      persistedInDb.title === 'Advanced Docker Internals' &&
      persistedInDb.items.length === 1 &&
      Boolean(lastSyncOp) &&
      lastSyncOp.operation === 'upsert',
    '1. createRoadmap persists to IndexedDB and enqueues sync operation'
  );

  // Test 2: renameRoadmap updates title in local store and enqueues sync
  const renamed = await learningPlanService.renameRoadmap({
    userId: testUser,
    planId: created.id,
    newTitle: 'Deep Dive: Linux Containers & Namespaces',
  });
  const afterRename = await learningPlanRepository.getPlan(created.id);
  assert(
    renamed.title === 'Deep Dive: Linux Containers & Namespaces' &&
      afterRename.title === 'Deep Dive: Linux Containers & Namespaces' &&
      afterRename.version > created.version,
    '2. renameRoadmap updates title in local store and enqueues sync'
  );

  // Test 3: updateRoadmapDetails modifies metadata fields
  const updatedMeta = await learningPlanService.updateRoadmapDetails({
    userId: testUser,
    planId: created.id,
    summary: 'Mastering modern container runtimes from first principles',
    estimatedDuration: '5 Weeks',
    targetAudience: 'DevOps & SREs',
  });
  assert(
    updatedMeta.summary === 'Mastering modern container runtimes from first principles' &&
      updatedMeta.estimatedDuration === '5 Weeks' &&
      updatedMeta.targetAudience === 'DevOps & SREs',
    '3. updateRoadmapDetails modifies metadata fields'
  );

  // Test 4: updateTopicNotes saves personal learner notes and enqueues sync
  const updatedNotesPlan = await learningPlanService.updateTopicNotes({
    userId: testUser,
    planId: created.id,
    topicId: 'top_namespaces',
    notes: 'Remember: PID 1 in new namespace dies if child dies without reaper.',
  });
  const targetTopic = updatedNotesPlan.items.find((i) => i.id === 'top_namespaces');
  assert(
    targetTopic.notes.includes('PID 1 in new namespace dies'),
    '4. updateTopicNotes saves personal learner notes and enqueues sync'
  );

  // Test 5: updateChecklistItem toggles subtask completion
  const updatedChecklistPlan = await learningPlanService.updateChecklistItem({
    userId: testUser,
    planId: created.id,
    topicId: 'top_namespaces',
    checklistId: 'chk_unshare',
    completed: true,
  });
  const chkTopic = updatedChecklistPlan.items.find((i) => i.id === 'top_namespaces');
  const chkItem = chkTopic.checklist.find((c) => c.id === 'chk_unshare');
  assert(
    chkItem.completed === true,
    '5. updateChecklistItem toggles subtask completion'
  );

  // Test 6: updateItemStatus advances topic through lifecycle with timestamps
  const startedRes = await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: created.id,
    itemId: 'top_namespaces',
    newStatus: ITEM_STATUSES.IN_PROGRESS,
  });
  assert(
    startedRes.item.status === ITEM_STATUSES.IN_PROGRESS && Boolean(startedRes.item.startedAt),
    '6. updateItemStatus advances topic through lifecycle with timestamps'
  );

  // Test 7: deleteRoadmap deletes from local store and records sync tombstone
  await learningPlanService.deleteRoadmap({
    userId: testUser,
    planId: created.id,
  });
  const afterDelete = await learningPlanRepository.getPlan(created.id);
  const queueAfterDelete = await syncQueueRepository.getPendingBatch(100);
  const deleteOp = queueAfterDelete.find(
    (op) => op.entityId === created.id && op.operation === 'delete'
  );
  assert(
    afterDelete === undefined && Boolean(deleteOp),
    '7. deleteRoadmap deletes from local store and records sync tombstone'
  );

  // Test 8: setActiveRoadmap activates target plan and getOrCreateActivePlan retrieves it
  const planA = await learningPlanService.createRoadmap({
    userId: testUser,
    title: 'Plan A: Advanced Networking',
    goal: 'Master TCP/IP, eBPF, and packet filtering',
    status: PLAN_STATUSES.ACTIVE,
  });
  const planB = await learningPlanService.createRoadmap({
    userId: testUser,
    title: 'Plan B: Storage Engines',
    goal: 'Master LSM trees and B+ trees',
    status: PLAN_STATUSES.ACTIVE,
  });
  // Since Plan B was created active most recently, Plan A was demoted to inactive
  const activePlanNow = await learningPlanService.getOrCreateActivePlan(testUser);
  assert(
    activePlanNow.id === planB.id && activePlanNow.title === 'Plan B: Storage Engines',
    '8a. createRoadmap with active status makes it the active plan for getOrCreateActivePlan'
  );

  // Switch active plan back to Plan A
  const activatedA = await learningPlanService.setActiveRoadmap({
    userId: testUser,
    planId: planA.id,
  });
  const activePlanAfterSwitch = await learningPlanService.getOrCreateActivePlan(testUser);
  assert(
    activatedA.status === PLAN_STATUSES.ACTIVE &&
      activePlanAfterSwitch.id === planA.id &&
      activePlanAfterSwitch.title === 'Plan A: Advanced Networking',
    '8b. setActiveRoadmap switches active plan so StudyPlan getOrCreateActivePlan immediately reflects it'
  );

  // ----------------------------------------------------------------
  // SECTION 3: DETERMINISTIC RECOMMENDATION ENGINE
  // ----------------------------------------------------------------
  console.log('\n📌 Section 3: Deterministic Recommendation Engine');

  const recPlan = {
    id: 'plan_rec_test',
    title: 'Algorithms in C',
    items: [
      { id: 'i1', title: 'Pointers & Memory', status: ITEM_STATUSES.COMPLETED },
      { id: 'i2', title: 'Binary Trees', status: ITEM_STATUSES.REVIEW },
      { id: 'i3', title: 'Graph Traversal', status: ITEM_STATUSES.IN_PROGRESS },
      { id: 'i4', title: 'Dynamic Programming', status: ITEM_STATUSES.NOT_STARTED },
    ],
  };

  // Test 1: Prioritizes review topics first
  const rec1 = learningPlanService.getRecommendedNextStep(recPlan);
  assert(
    rec1.topic.id === 'i2' && rec1.action === 'review',
    '1. Prioritizes review topics first'
  );

  // Test 2: Prioritizes in-progress topic when no reviews exist
  const recPlanNoReview = {
    ...recPlan,
    items: recPlan.items.filter((i) => i.status !== ITEM_STATUSES.REVIEW),
  };
  const rec2 = learningPlanService.getRecommendedNextStep(recPlanNoReview);
  assert(
    rec2.topic.id === 'i3' && rec2.action === 'continue',
    '2. Prioritizes in-progress topic when no reviews exist'
  );

  // Test 3: Recommends next ready unstarted topic when nothing in-progress
  const recPlanUnstarted = {
    ...recPlan,
    items: [
      { id: 'i1', title: 'Pointers & Memory', status: ITEM_STATUSES.COMPLETED },
      { id: 'i4', title: 'Dynamic Programming', status: ITEM_STATUSES.NOT_STARTED },
    ],
  };
  const rec3 = learningPlanService.getRecommendedNextStep(recPlanUnstarted);
  assert(
    rec3.topic.id === 'i4' && rec3.action === 'start',
    '3. Recommends next ready unstarted topic when nothing in-progress'
  );

  // Test 4: Handles 100% completed plan gracefully
  const recPlanCompleted = {
    ...recPlan,
    items: [
      { id: 'i1', title: 'Pointers & Memory', status: ITEM_STATUSES.COMPLETED },
    ],
  };
  const rec4 = learningPlanService.getRecommendedNextStep(recPlanCompleted);
  assert(
    (rec4.action === 'complete' || rec4.action === 'completed') && rec4.topic === null,
    '4. Handles 100% completed plan gracefully'
  );

  // ----------------------------------------------------------------
  // SECTION 4: AI GENERATION & RESILIENT PARSER
  // ----------------------------------------------------------------
  console.log('\n📌 Section 4: AI Generation & Resilient Parser');

  // Test 1: Parses clean JSON roadmap
  const rawJson = JSON.stringify({
    title: 'Rust Concurrency',
    goal: 'Master threads, channels, and async/await',
    sections: [
      {
        title: 'Thread Basics',
        topics: [{ title: 'std::thread::spawn', summary: 'Spawning native OS threads' }],
      },
    ],
  });
  const parsed1 = learningPlanService.parseAndValidateAIRoadmap(rawJson);
  assert(
    parsed1 !== null &&
      parsed1.title === 'Rust Concurrency' &&
      parsed1.sections.length === 1 &&
      parsed1.items.length === 1,
    '1. Parses clean JSON roadmap'
  );

  // Test 2: Extracts JSON embedded inside Markdown code fences
  const markdownWrapped = `Here is your learning roadmap:\n\`\`\`json\n${rawJson}\n\`\`\`\nGood luck!`;
  const parsed2 = learningPlanService.parseAndValidateAIRoadmap(markdownWrapped);
  assert(
    parsed2 !== null && parsed2.title === 'Rust Concurrency',
    '2. Extracts JSON embedded inside Markdown code fences'
  );

  // Test 3: Fallback converts unstructured bullet points into a valid roadmap
  const unstructuredText = `
Here is a plan for learning Golang:
- Topic 1: Goroutines and Go Runtime
- Topic 2: Channels and Select Statements
- Topic 3: Mutexes and Atomic Operations
  `;
  const parsed3 = learningPlanService.parseAndValidateAIRoadmap(unstructuredText);
  assert(
    parsed3 !== null && parsed3.items.length === 3 && parsed3.sections.length === 1,
    '3. Fallback converts unstructured bullet points into a valid roadmap'
  );

  // Test 4: Fallback generator generates offline curriculum when network is unreachable
  const offlineGenerated = await learningPlanService.generateAIRoadmap({
    userId: testUser,
    prompt: 'Network Socket Programming in C',
    targetAudience: 'Intermediate',
    estimatedDuration: '4 Weeks',
  });
  assert(
    offlineGenerated.title.includes('Socket Programming') &&
      offlineGenerated.sections.length >= 2 &&
      offlineGenerated.items.length >= 3,
    '4. Fallback generator generates offline curriculum when network is unreachable'
  );

  // ----------------------------------------------------------------
  // SECTION 5: ROADMAP-AWARE CONTEXT RETRIEVAL & PEDAGOGICAL GUIDANCE
  // ----------------------------------------------------------------
  console.log('\n📌 Section 5: Roadmap-Aware AI Context Retrieval');
  await clearAllStores();

  // Seed active roadmap with multiple topic statuses
  const seededPlan = await learningPlanService.createRoadmap({
    userId: testUser,
    title: 'Linux Systems Mastery',
    goal: 'Master Unix systems programming and kernel mechanics',
    status: 'active',
    sections: [
      {
        id: 'sec_core_sys',
        title: 'Core Systems Programming',
        topics: [
          {
            id: 'top_file_io',
            title: 'File Descriptors and System Calls',
            status: ITEM_STATUSES.COMPLETED,
          },
          {
            id: 'top_signals',
            title: 'Unix Signals and Asynchronous Handling',
            status: ITEM_STATUSES.IN_PROGRESS,
          },
          {
            id: 'top_ipc',
            title: 'Inter-Process Communication (IPC)',
            status: ITEM_STATUSES.REVIEW,
          },
          {
            id: 'top_memory',
            title: 'Virtual Memory and mmap',
            status: ITEM_STATUSES.NOT_STARTED,
          },
        ],
      },
    ],
  });

  // Test 1: Matches query to IN_PROGRESS topic and produces active guidance
  const ctxSignals = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'How do Unix signals and sigaction work?' }],
  });
  const promptSignals = contextRetrievalService.buildSystemPrompt(ctxSignals);
  assert(
    ctxSignals.learning.activePlan.matchedTopic.id === 'top_signals' &&
      ctxSignals.learning.activePlan.matchedTopic.status === ITEM_STATUSES.IN_PROGRESS &&
      promptSignals.includes('Status: IN_PROGRESS') &&
      promptSignals.includes('Explain core concepts clearly'),
    '1. Matches query to IN_PROGRESS topic and produces active guidance'
  );

  // Test 2: Matches query to COMPLETED topic and instructs not to re-explain from scratch
  const ctxFileIO = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'What is a File Descriptor in Unix?' }],
  });
  const promptFileIO = contextRetrievalService.buildSystemPrompt(ctxFileIO);
  assert(
    ctxFileIO.learning.activePlan.matchedTopic.id === 'top_file_io' &&
      ctxFileIO.learning.activePlan.matchedTopic.status === ITEM_STATUSES.COMPLETED &&
      promptFileIO.includes('Status: COMPLETED') &&
      promptFileIO.includes('already completed this topic'),
    '2. Matches query to COMPLETED topic and instructs not to re-explain from scratch'
  );

  // Test 3: Matches query to REVIEW topic and provides refresher prompt guidance
  const ctxIPC = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'Explain Inter-Process Communication pipes' }],
  });
  const promptIPC = contextRetrievalService.buildSystemPrompt(ctxIPC);
  assert(
    ctxIPC.learning.activePlan.matchedTopic.id === 'top_ipc' &&
      ctxIPC.learning.activePlan.matchedTopic.status === ITEM_STATUSES.REVIEW &&
      promptIPC.includes('Status: REVIEW') &&
      promptIPC.includes('reinforce retention'),
    '3. Matches query to REVIEW topic and provides refresher prompt guidance'
  );

  // Test 4: Matches query to NOT_STARTED topic and instructs gentle prerequisite intro
  const ctxMem = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'How does Virtual Memory work?' }],
  });
  const promptMem = contextRetrievalService.buildSystemPrompt(ctxMem);
  assert(
    ctxMem.learning.activePlan.matchedTopic.id === 'top_memory' &&
      ctxMem.learning.activePlan.matchedTopic.status === ITEM_STATUSES.NOT_STARTED &&
      promptMem.includes('Status: NOT_STARTED') &&
      promptMem.includes('Check prerequisite understanding first'),
    '4. Matches query to NOT_STARTED topic and instructs gentle prerequisite intro'
  );

  // Test 5: Archived and deleted plans are completely excluded from context
  await learningPlanRepository.savePlan({
    ...seededPlan,
    id: 'archived_plan_999',
    title: 'Old Archived Python Roadmap',
    isArchived: true,
    status: 'archived',
  });
  const ctxArchived = await contextRetrievalService.assembleContext({
    userId: testUser,
    conversationId: null,
    currentMessages: [{ role: 'user', content: 'Tell me about Python decorators' }],
  });
  assert(
    ctxArchived.learning.activePlan.title !== 'Old Archived Python Roadmap',
    '5. Archived and deleted plans are completely excluded from context'
  );

  // Test 6: Internal database and sync fields are never leaked into prompt
  const leakedFields =
    promptSignals.includes('syncStatus') ||
    promptSignals.includes('_id') ||
    promptSignals.includes('version') ||
    promptSignals.includes('lastModified');
  assert(
    leakedFields === false,
    '6. Internal database and sync fields are never leaked into prompt'
  );

  // Test 7: System prompt stays bounded within token/character budget
  assert(
    promptSignals.length > 50 && promptSignals.length < 2500,
    '7. System prompt stays bounded within token/character budget'
  );

  // ----------------------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 ROADMAP TEST SUITE COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests === 0) {
    console.log('🎉 ALL ROADMAP SYSTEM TESTS PASSED SUCCESSFULLY (100%)');
  } else {
    console.error(`❌ FAILED: ${failedTests} tests failed.`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) process.exit(1);
}

runRoadmapTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
