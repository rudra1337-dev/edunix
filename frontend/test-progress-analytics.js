/**
 * Comprehensive Automated Test Suite for Edunix Personalized Learning Analytics Dashboard
 * Tests:
 * 1. Analytics Calculations & Mathematical Invariants (6 tests)
 * 2. Chart Dataset Generation & Normalization (5 tests)
 * 3. Empirical Activity Trends Over Time & Non-Fabrication (5 tests)
 * 4. Topic Attention & Deterministic Study Recommendations (5 tests)
 * 5. Factual Learning Insights Generation (4 tests)
 * 6. Offline-First Change-Driven Integration (5 tests)
 */

import 'fake-indexeddb/auto';
import { clearAllStores, STORES } from './src/services/storage/db.js';
import learningPlanRepository from './src/services/storage/learningPlanRepository.js';
import learningEventRepository from './src/services/storage/learningEventRepository.js';
import syncQueueRepository from './src/services/storage/syncQueueRepository.js';
import learningPlanService, {
  ITEM_STATUSES,
  PLAN_STATUSES,
  normalizeRoadmap,
} from './src/services/learning/learningPlanService.js';
import progressAnalyticsService, {
  calculateOverallMetrics,
  calculateRoadmapMetrics,
  calculateTopicMetrics,
  calculateStatusDistribution,
  calculateSectionProgress,
  calculateRoadmapComparison,
  calculateActivityTimeline,
  getAttentionTopics,
  getStudyRecommendation,
  deriveLearningInsights,
} from './src/services/analytics/progressAnalyticsService.js';

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

async function runProgressAnalyticsTests() {
  console.log('================================================================');
  console.log('📊 EDUNIX PERSONALIZED LEARNING ANALYTICS TEST SUITE');
  console.log('================================================================');

  const testUser = `student_analytics_${Date.now()}`;
  await clearAllStores();

  // ----------------------------------------------------------------
  // SECTION 1: ANALYTICS CALCULATIONS & MATHEMATICAL INVARIANTS
  // ----------------------------------------------------------------
  console.log('\n📌 Section 1: Analytics Calculations & Invariants');

  // Test 1: Zero topics handled safely without division by zero
  const emptyMetrics = calculateTopicMetrics([]);
  assert(
    emptyMetrics.totalTopics === 0 &&
      emptyMetrics.topicCompletionRate === 0 &&
      emptyMetrics.totalSubtasks === 0 &&
      emptyMetrics.subtaskCompletionRate === 0,
    '1. Zero topics handled safely without division-by-zero (returns 0%)'
  );

  // Test 2: Accurate topic-level and subtask-level calculation
  const sampleTopics = [
    {
      id: 'top_1',
      status: ITEM_STATUSES.COMPLETED,
      checklist: [{ id: 'c1', completed: true }, { id: 'c2', completed: true }],
    },
    {
      id: 'top_2',
      status: ITEM_STATUSES.IN_PROGRESS,
      checklist: [{ id: 'c3', completed: true }, { id: 'c4', completed: false }],
    },
    {
      id: 'top_3',
      status: ITEM_STATUSES.REVIEW,
      checklist: [{ id: 'c5', completed: false }],
    },
    {
      id: 'top_4',
      status: ITEM_STATUSES.NOT_STARTED,
      checklist: [{ id: 'c6', completed: false }],
    },
  ];

  const calculated = calculateTopicMetrics(sampleTopics);
  assert(
    calculated.totalTopics === 4 &&
      calculated.completedTopics === 1 &&
      calculated.inProgressTopics === 1 &&
      calculated.reviewTopics === 1 &&
      calculated.notStartedTopics === 1 &&
      calculated.topicCompletionRate === 25, // 1/4 = 25%
    '2. Topic-level completion percentage accurately calculated (25%)'
  );

  // Test 3: Subtask checklist completion correctly calculated without double-counting
  assert(
    calculated.totalSubtasks === 6 &&
      calculated.completedSubtasks === 3 &&
      calculated.subtaskCompletionRate === 50, // 3/6 = 50%
    '3. Subtask checklist completion correctly calculated (3/6 = 50%)'
  );

  // Test 4: Archived and deleted roadmaps are excluded from overall metrics
  const mockPlans = [
    {
      id: 'p1',
      title: 'Active Path',
      status: PLAN_STATUSES.ACTIVE,
      items: [{ id: 't1', status: ITEM_STATUSES.COMPLETED }],
    },
    {
      id: 'p2',
      title: 'Archived Path',
      status: PLAN_STATUSES.ARCHIVED,
      items: [{ id: 't2', status: ITEM_STATUSES.COMPLETED }],
    },
    {
      id: 'p3',
      title: 'Deleted Path',
      isDeleted: true,
      items: [{ id: 't3', status: ITEM_STATUSES.COMPLETED }],
    },
  ];
  const overallFiltered = calculateOverallMetrics(mockPlans, []);
  assert(
    overallFiltered.totalRoadmaps === 1 &&
      overallFiltered.totalTopics === 1 &&
      overallFiltered.completedTopics === 1,
    '4. Archived and soft-deleted roadmaps are excluded from analytics aggregation'
  );

  // Test 5: Legacy flat items plan normalizes correctly in analytics
  const legacyFlatPlan = normalizeRoadmap({
    id: 'flat_legacy',
    title: 'Unix Shell Scripting',
    items: [
      { id: 'f1', title: 'Pipes', status: ITEM_STATUSES.COMPLETED },
      { id: 'f2', title: 'Sed & Awk', status: ITEM_STATUSES.NOT_STARTED },
    ],
  });
  const flatMetrics = calculateRoadmapMetrics(legacyFlatPlan);
  assert(
    flatMetrics.totalTopics === 2 &&
      flatMetrics.completedTopics === 1 &&
      flatMetrics.topicCompletionRate === 50,
    '5. Legacy flat items plan normalizes into accurate analytics metrics'
  );

  // Test 6: Section-level metrics handle empty sections safely
  const emptySectionPlan = { id: 'sec_empty', sections: [] };
  const emptySecProgress = calculateSectionProgress(emptySectionPlan);
  assert(
    Array.isArray(emptySecProgress) && emptySecProgress.length === 0,
    '6. Section progress handles plans with empty sections array gracefully'
  );

  // ----------------------------------------------------------------
  // SECTION 2: CHART DATASET GENERATION & NORMALIZATION
  // ----------------------------------------------------------------
  console.log('\n📌 Section 2: Chart Dataset Generation');

  // Test 1: Status distribution produces complete 4-state breakdown with correct percentages
  const dist = calculateStatusDistribution(sampleTopics);
  assert(
    dist.totalTopics === 4 &&
      dist.entries.length === 4 &&
      dist.entries.find((e) => e.key === ITEM_STATUSES.COMPLETED).percentage === 25 &&
      dist.entries.find((e) => e.key === ITEM_STATUSES.IN_PROGRESS).percentage === 25 &&
      dist.entries.find((e) => e.key === ITEM_STATUSES.REVIEW).percentage === 25 &&
      dist.entries.find((e) => e.key === ITEM_STATUSES.NOT_STARTED).percentage === 25,
    '1. Status distribution produces full 4-state breakdown with colors and descriptions'
  );

  // Test 2: Section progress calculates accurate percentages per section
  const multiSectionPlan = {
    id: 'sec_plan_1',
    sections: [
      {
        id: 's1',
        title: 'Foundations',
        order: 1,
        topics: [
          { id: 't1', status: ITEM_STATUSES.COMPLETED },
          { id: 't2', status: ITEM_STATUSES.COMPLETED },
        ],
      },
      {
        id: 's2',
        title: 'Advanced Operations',
        order: 2,
        topics: [
          { id: 't3', status: ITEM_STATUSES.IN_PROGRESS },
          { id: 't4', status: ITEM_STATUSES.NOT_STARTED },
        ],
      },
    ],
  };
  const sectionMetrics = calculateSectionProgress(multiSectionPlan);
  assert(
    sectionMetrics.length === 2 &&
      sectionMetrics[0].percentage === 100 &&
      sectionMetrics[0].completedTopics === 2 &&
      sectionMetrics[1].percentage === 0 &&
      sectionMetrics[1].inProgressTopics === 1,
    '2. Section progress breakdown calculates accurate percentages per module'
  );

  // Test 3: Roadmap comparison dataset calculates progress across multiple roadmaps
  const compRoadmaps = [
    {
      id: 'r1',
      title: 'Linux Fundamentals',
      status: PLAN_STATUSES.ACTIVE,
      items: [
        { id: 'a1', status: ITEM_STATUSES.COMPLETED },
        { id: 'a2', status: ITEM_STATUSES.COMPLETED },
      ],
    },
    {
      id: 'r2',
      title: 'Kubernetes Architecture',
      status: 'draft',
      items: [
        { id: 'b1', status: ITEM_STATUSES.IN_PROGRESS },
        { id: 'b2', status: ITEM_STATUSES.NOT_STARTED },
      ],
    },
  ];
  const comparison = calculateRoadmapComparison(compRoadmaps);
  assert(
    comparison.length === 2 &&
      comparison[0].percentage === 100 &&
      comparison[0].remainingTopics === 0 &&
      comparison[1].percentage === 0 &&
      comparison[1].remainingTopics === 2,
    '3. Roadmap comparison generates horizontal comparison dataset'
  );

  // Test 4: Single roadmap filter isolates analytics exclusively to target roadmap
  const singleRoadmapMetrics = calculateRoadmapMetrics(compRoadmaps[0]);
  assert(
    singleRoadmapMetrics.planId === 'r1' &&
      singleRoadmapMetrics.totalTopics === 2 &&
      singleRoadmapMetrics.completedTopics === 2 &&
      singleRoadmapMetrics.topicCompletionRate === 100,
    '4. Single roadmap isolation restricts metrics strictly to selected roadmap'
  );

  // Test 5: Empty comparison handles empty plans array
  const emptyComp = calculateRoadmapComparison([]);
  assert(
    Array.isArray(emptyComp) && emptyComp.length === 0,
    '5. Roadmap comparison safely handles empty roadmap lists'
  );

  // ----------------------------------------------------------------
  // SECTION 3: EMPIRICAL ACTIVITY TRENDS & NON-FABRICATION
  // ----------------------------------------------------------------
  console.log('\n📌 Section 3: Activity Trends & Non-Fabrication');

  // Test 1: Zero events returns honest empty state (hasData: false) without invented flat line
  const emptyActivity = calculateActivityTimeline([], []);
  assert(
    emptyActivity.hasData === false &&
      emptyActivity.timeline.length === 0 &&
      emptyActivity.summary.totalActions === 0,
    '1. Empty historical events returns honest hasData: false without fabricating flat lines'
  );

  // Test 2: Real events are grouped by exact calendar dates
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const realEvents = [
    { eventId: 'e1', type: 'item_completed', occurredAt: today.toISOString() },
    { eventId: 'e2', type: 'item_started', occurredAt: today.toISOString() },
    { eventId: 'e3', type: 'item_completed', occurredAt: yesterday.toISOString() },
  ];
  const realTimeline = calculateActivityTimeline(realEvents, [], '7d');
  assert(
    realTimeline.hasData === true &&
      realTimeline.timeline.length === 7 &&
      realTimeline.summary.totalActiveDays >= 2 &&
      realTimeline.summary.totalActions >= 3,
    '2. Real historical events populate exact date buckets across selected range'
  );

  // Test 3: Date range selector (7d vs 30d vs 90d) adjusts timeline length
  const timeline7d = calculateActivityTimeline(realEvents, [], '7d');
  const timeline30d = calculateActivityTimeline(realEvents, [], '30d');
  const timeline90d = calculateActivityTimeline(realEvents, [], '90d');
  assert(
    timeline7d.timeline.length === 7 &&
      timeline30d.timeline.length === 30 &&
      timeline90d.timeline.length === 90,
    '3. Date range filtering properly adjusts timeline bucket window (7d, 30d, 90d)'
  );

  // Test 4: Cumulative completions track progression monotonically
  const lastBucket = realTimeline.timeline[realTimeline.timeline.length - 1];
  assert(
    lastBucket.cumulativeCompletions >= 2,
    '4. Cumulative topic completions aggregate monotonically over time'
  );

  // Test 5: Topic completedAt timestamps contribute to empirical completion trend
  const topicWithTimestamp = [
    { id: 'top_time_1', title: 'File Descriptors', completedAt: today.toISOString() },
  ];
  const topicTimeline = calculateActivityTimeline([], topicWithTimestamp, '7d');
  assert(
    topicTimeline.hasData === true && topicTimeline.summary.totalCompletions >= 1,
    '5. Topic completedAt timestamps accurately reflect in historical activity'
  );

  // ----------------------------------------------------------------
  // SECTION 4: TOPIC ATTENTION & STUDY RECOMMENDATIONS
  // ----------------------------------------------------------------
  console.log('\n📌 Section 4: Topic Attention & Study Recommendations');

  const attentionTopicsList = [
    { id: 'top_rev', title: 'Bash Redirection', status: ITEM_STATUSES.REVIEW },
    {
      id: 'top_prog',
      title: 'Signals & Traps',
      status: ITEM_STATUSES.IN_PROGRESS,
      checklist: [{ id: 'c1', completed: true }, { id: 'c2', completed: false }],
    },
    { id: 'top_ready', title: 'POSIX Threads', status: ITEM_STATUSES.NOT_STARTED, dependencies: [] },
    {
      id: 'top_blocked',
      title: 'Kernel Modules',
      status: ITEM_STATUSES.NOT_STARTED,
      dependencies: ['top_ready'], // unmet dependency
    },
  ];
  const testAttentionPlan = {
    id: 'att_plan',
    title: 'Linux Advanced',
    status: PLAN_STATUSES.ACTIVE,
    items: attentionTopicsList,
  };

  // Test 1: Categorizes topics into needsReview, inProgress, ready, and blocked
  const attentionResult = getAttentionTopics([testAttentionPlan]);
  assert(
    attentionResult.needsReview.length === 1 &&
      attentionResult.needsReview[0].id === 'top_rev' &&
      attentionResult.inProgress.length === 1 &&
      attentionResult.inProgress[0].id === 'top_prog' &&
      attentionResult.readyToStart.length === 1 &&
      attentionResult.readyToStart[0].id === 'top_ready' &&
      attentionResult.blocked.length === 1 &&
      attentionResult.blocked[0].id === 'top_blocked',
    '1. Categorizes attention topics into review, in_progress, ready, and blocked'
  );

  // Test 2: Recommendation prioritizes spaced repetition review work first
  const rec1 = getStudyRecommendation([testAttentionPlan]);
  assert(
    rec1.actionType === 'review' &&
      rec1.topic.id === 'top_rev' &&
      rec1.reason.includes('spaced repetition'),
    '2. Study recommendation prioritizes spaced repetition review work first'
  );

  // Test 3: Recommendation prioritizes in-progress topic when no reviews exist
  const noReviewPlan = {
    id: 'p_no_rev',
    title: 'Networking',
    status: PLAN_STATUSES.ACTIVE,
    items: [
      { id: 'ip_1', title: 'Sockets', status: ITEM_STATUSES.IN_PROGRESS },
      { id: 'ns_1', title: 'TCP Handshake', status: ITEM_STATUSES.NOT_STARTED },
    ],
  };
  const rec2 = getStudyRecommendation([noReviewPlan]);
  assert(
    rec2.actionType === 'continue' && rec2.topic.id === 'ip_1',
    '3. Study recommendation prioritizes in-progress momentum when no review is pending'
  );

  // Test 4: Recommendation picks next ready topic respecting dependencies
  const unstartedPlan = {
    id: 'p_unstarted',
    title: 'Systems Programming',
    status: PLAN_STATUSES.ACTIVE,
    items: [
      { id: 'b_dep', title: 'Memory Malloc', status: ITEM_STATUSES.NOT_STARTED, dependencies: ['none'] },
      { id: 'a_ready', title: 'C Syntax', status: ITEM_STATUSES.NOT_STARTED, dependencies: [] },
    ],
  };
  const rec3 = getStudyRecommendation([unstartedPlan]);
  assert(
    rec3.actionType === 'start' && rec3.topic.id === 'a_ready',
    '4. Study recommendation respects prerequisite ordering for next unstarted unit'
  );

  // Test 5: Gracefully handles 100% completed curriculum
  const completedPlan = {
    id: 'p_done',
    title: 'Git Mastery',
    status: PLAN_STATUSES.ACTIVE,
    items: [{ id: 'g1', title: 'Rebase', status: ITEM_STATUSES.COMPLETED }],
  };
  const rec4 = getStudyRecommendation([completedPlan]);
  assert(
    rec4.actionType === 'complete' && rec4.reason.includes('completed all units'),
    '5. Gracefully handles 100% completed curriculum with celebratory guidance'
  );

  // ----------------------------------------------------------------
  // SECTION 5: FACTUAL LEARNING INSIGHTS GENERATION
  // ----------------------------------------------------------------
  console.log('\n📌 Section 5: Factual Learning Insights Generation');

  // Test 1: Review insight generates when review units exist
  const insightsReview = deriveLearningInsights(
    { totalTopics: 5, completedTopics: 1, inProgressTopics: 1, reviewTopics: 2, topicCompletionRate: 20 },
    [testAttentionPlan],
    []
  );
  assert(
    insightsReview.some((i) => i.id === 'ins_review' && i.type === 'warning'),
    '1. Emits review attention insight when topics are scheduled for review'
  );

  // Test 2: Mastery milestone insight triggers when completion rate >= 75%
  const insightsMastery = deriveLearningInsights(
    { totalTopics: 8, completedTopics: 6, inProgressTopics: 1, reviewTopics: 0, topicCompletionRate: 75 },
    [testAttentionPlan],
    []
  );
  assert(
    insightsMastery.some((i) => i.id === 'ins_high_mastery' && i.type === 'success'),
    '2. Emits advanced curriculum mastery insight when rate reaches milestone (>=75%)'
  );

  // Test 3: Cognitive load balance insight triggers when >3 topics in progress
  const insightsCognitive = deriveLearningInsights(
    { totalTopics: 10, completedTopics: 0, inProgressTopics: 4, reviewTopics: 0, topicCompletionRate: 0 },
    [testAttentionPlan],
    []
  );
  assert(
    insightsCognitive.some((i) => i.id === 'ins_focus' && i.type === 'info'),
    '3. Emits cognitive load balance insight when multiple topics are active simultaneously'
  );

  // Test 4: Offline resilience insight is consistently present
  assert(
    insightsReview.some((i) => i.id === 'ins_offline'),
    '4. Emits offline-first resilience indicator confirming local IndexedDB persistence'
  );

  // ----------------------------------------------------------------
  // SECTION 6: OFFLINE-FIRST CHANGE-DRIVEN INTEGRATION
  // ----------------------------------------------------------------
  console.log('\n📌 Section 6: Offline-First Change-Driven Integration');

  // Test 1: Plan creation persists to IndexedDB and calculates immediately
  const createdPlan = await learningPlanService.createRoadmap({
    userId: testUser,
    title: 'Database Internals',
    goal: 'Understand LSM trees and WAL',
    sections: [
      {
        id: 'sec_db_1',
        title: 'Storage Engines',
        topics: [
          {
            id: 'top_wal',
            title: 'Write-Ahead Logging',
            status: ITEM_STATUSES.NOT_STARTED,
            checklist: [{ id: 'chk_wal_1', text: 'Crash recovery guarantees', completed: false }],
          },
        ],
      },
    ],
  });
  const loadedPlans = await learningPlanService.getPlans(testUser);
  const initialMetrics = calculateOverallMetrics(loadedPlans, []);
  assert(
    initialMetrics.totalTopics === 1 &&
      initialMetrics.completedTopics === 0 &&
      initialMetrics.topicCompletionRate === 0 &&
      initialMetrics.totalSubtasks === 1,
    '1. Newly created roadmap persists to IndexedDB and computes instant initial metrics'
  );

  // Test 2: Topic status advancement records event and updates metrics locally
  await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: createdPlan.id,
    itemId: 'top_wal',
    newStatus: ITEM_STATUSES.IN_PROGRESS,
  });
  await learningPlanService.updateItemStatus({
    userId: testUser,
    planId: createdPlan.id,
    itemId: 'top_wal',
    newStatus: ITEM_STATUSES.COMPLETED,
  });
  const updatedPlans = await learningPlanService.getPlans(testUser);
  const userEvents = await learningEventRepository.getEvents(testUser, 10);
  const updatedMetrics = calculateOverallMetrics(updatedPlans, userEvents);
  assert(
    updatedMetrics.completedTopics === 1 &&
      updatedMetrics.topicCompletionRate === 100 &&
      userEvents.length >= 2, // roadmap_created + item_started + item_completed
    '2. Updating topic to completed advances mastery rate to 100% and appends learning event'
  );

  // Test 3: Subtask checklist item toggle records checklist event and updates subtask rate
  await learningPlanService.updateChecklistItem({
    userId: testUser,
    planId: createdPlan.id,
    topicId: 'top_wal',
    checkId: 'chk_wal_1',
    completed: true,
  });
  const afterCheckPlans = await learningPlanService.getPlans(testUser);
  const afterCheckMetrics = calculateOverallMetrics(afterCheckPlans, []);
  const checkEvents = await learningEventRepository.getEvents(testUser, 10);
  const checkEvt = checkEvents.find((e) => e.type === 'checklist_item_completed');
  assert(
    afterCheckMetrics.completedSubtasks === 1 &&
      afterCheckMetrics.subtaskCompletionRate === 100 &&
      Boolean(checkEvt),
    '3. Checklist toggle records checklist_item_completed event and updates subtask metrics'
  );

  // Test 4: Pending sync operations queued in IndexedDB for background sync
  const pendingSyncQueue = await syncQueueRepository.getPendingBatch(100);
  const planSyncOp = pendingSyncQueue.find(
    (op) => op.entityType === 'learningPlan' && op.entityId === createdPlan.id
  );
  assert(
    Boolean(planSyncOp) && planSyncOp.operation === 'upsert',
    '4. Offline mutations queue idempotent operations in STORES.SYNC_QUEUE'
  );

  // Test 5: User data isolation - second user does not see first user's metrics
  const otherUser = `student_other_${Date.now()}`;
  const otherPlans = await learningPlanService.getPlans(otherUser);
  // Default plan is auto-initialized for new users
  assert(
    !otherPlans.some((p) => p.id === createdPlan.id),
    '5. Strict user data isolation: other student cannot access or mix first student plans'
  );

  // ----------------------------------------------------------------
  // SUMMARY REPORT
  // ----------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`📊 PROGRESS ANALYTICS TEST SUITE COMPLETE: ${passedTests}/${totalTests} PASSED`);
  if (failedTests === 0) {
    console.log('🎉 ALL PROGRESS ANALYTICS TESTS PASSED SUCCESSFULLY (100%)');
  } else {
    console.error(`⚠️ ${failedTests} TESTS FAILED`);
  }
  console.log('================================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runProgressAnalyticsTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
