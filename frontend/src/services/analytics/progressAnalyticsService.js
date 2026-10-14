/**
 * Progress Analytics Service for Edunix
 * Pure, deterministic calculation engine for learning progress,
 * topic mastery, section completion, activity trends, and intelligent study recommendations.
 *
 * Grounded in local IndexedDB persisted state (Unified Roadmap Model & Learning Events).
 * Never fabricates historical records or divides by zero.
 */

import { ITEM_STATUSES, PLAN_STATUSES } from '../learning/learningPlanService.js';

export const STATUS_DEFINITIONS = {
  [ITEM_STATUSES.COMPLETED]: {
    key: ITEM_STATUSES.COMPLETED,
    label: 'Completed',
    color: '#10b981', // Emerald green
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    description: 'Mastered topics with verified comprehension and completed exercises.',
    icon: '✅',
  },
  [ITEM_STATUSES.IN_PROGRESS]: {
    key: ITEM_STATUSES.IN_PROGRESS,
    label: 'In Progress',
    color: '#6366f1', // Indigo
    badgeBg: 'rgba(99, 102, 241, 0.15)',
    description: 'Active topics currently being studied with ongoing subtasks.',
    icon: '⚡',
  },
  [ITEM_STATUSES.REVIEW]: {
    key: ITEM_STATUSES.REVIEW,
    label: 'Needs Review',
    color: '#f59e0b', // Amber
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    description: 'Topics flagged for active recall practice to consolidate retention.',
    icon: '🔄',
  },
  [ITEM_STATUSES.NOT_STARTED]: {
    key: ITEM_STATUSES.NOT_STARTED,
    label: 'Not Started',
    color: '#64748b', // Slate
    badgeBg: 'rgba(100, 116, 139, 0.15)',
    description: 'Upcoming topics waiting in sequence or pending prerequisite readiness.',
    icon: '⏳',
  },
};

/**
 * Filter active (non-archived, non-deleted) roadmaps
 */
export const filterActivePlans = (plans = []) => {
  if (!Array.isArray(plans)) return [];
  return plans.filter((p) => p && !p.isDeleted && p.status !== PLAN_STATUSES.ARCHIVED);
};

/**
 * Extract all topics (items) from a set of roadmaps
 */
export const extractAllTopics = (plans = []) => {
  const active = filterActivePlans(plans);
  const topics = [];
  for (const plan of active) {
    if (Array.isArray(plan.items) && plan.items.length > 0) {
      topics.push(...plan.items.map((it) => ({ ...it, roadmapId: plan.id, roadmapTitle: plan.title })));
    } else if (Array.isArray(plan.sections) && plan.sections.length > 0) {
      for (const sec of plan.sections) {
        for (const top of sec.topics || []) {
          topics.push({ ...top, sectionId: sec.id, roadmapId: plan.id, roadmapTitle: plan.title });
        }
      }
    }
  }
  return topics;
};

/**
 * Calculate progress metrics for a list of topics.
 * Returns both topic-level and subtask-level statistics.
 */
export const calculateTopicMetrics = (topics = []) => {
  if (!Array.isArray(topics) || topics.length === 0) {
    return {
      totalTopics: 0,
      completedTopics: 0,
      inProgressTopics: 0,
      reviewTopics: 0,
      notStartedTopics: 0,
      topicCompletionRate: 0,
      totalSubtasks: 0,
      completedSubtasks: 0,
      subtaskCompletionRate: 0,
    };
  }

  let completedTopics = 0;
  let inProgressTopics = 0;
  let reviewTopics = 0;
  let notStartedTopics = 0;

  let totalSubtasks = 0;
  let completedSubtasks = 0;

  for (const t of topics) {
    switch (t.status) {
      case ITEM_STATUSES.COMPLETED:
        completedTopics++;
        break;
      case ITEM_STATUSES.IN_PROGRESS:
        inProgressTopics++;
        break;
      case ITEM_STATUSES.REVIEW:
        reviewTopics++;
        break;
      default:
        notStartedTopics++;
    }

    // Subtask count
    if (Array.isArray(t.checklist)) {
      totalSubtasks += t.checklist.length;
      for (const chk of t.checklist) {
        if (chk && chk.completed) {
          completedSubtasks++;
        }
      }
    }
  }

  const totalTopics = topics.length;
  const topicCompletionRate = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
  const subtaskCompletionRate =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  return {
    totalTopics,
    completedTopics,
    inProgressTopics,
    reviewTopics,
    notStartedTopics,
    topicCompletionRate,
    totalSubtasks,
    completedSubtasks,
    subtaskCompletionRate,
  };
};

/**
 * Calculate overall learning metrics across all active user roadmaps.
 */
export const calculateOverallMetrics = (plans = [], events = []) => {
  const activePlans = filterActivePlans(plans);
  const allTopics = extractAllTopics(activePlans);
  const topicMetrics = calculateTopicMetrics(allTopics);

  return {
    ...topicMetrics,
    totalRoadmaps: activePlans.length,
    activeRoadmaps: activePlans.filter((p) => p.status === PLAN_STATUSES.ACTIVE).length,
    totalEvents: Array.isArray(events) ? events.length : 0,
  };
};

/**
 * Calculate progress metrics for a single specific roadmap.
 */
export const calculateRoadmapMetrics = (plan, events = []) => {
  if (!plan) {
    return {
      ...calculateTopicMetrics([]),
      totalRoadmaps: 0,
      activeRoadmaps: 0,
      totalEvents: 0,
    };
  }

  const topics = (plan.items || []).map((t) => ({
    ...t,
    roadmapId: plan.id,
    roadmapTitle: plan.title,
  }));
  const topicMetrics = calculateTopicMetrics(topics);
  const planEvents = (events || []).filter((e) => e.learningPlanId === plan.id);

  return {
    ...topicMetrics,
    totalRoadmaps: 1,
    activeRoadmaps: plan.status === PLAN_STATUSES.ACTIVE ? 1 : 0,
    totalEvents: planEvents.length,
    planId: plan.id,
    title: plan.title,
    goal: plan.goal,
    status: plan.status,
  };
};

/**
 * Calculate the distribution of learning statuses (Donut / Bar ready).
 */
export const calculateStatusDistribution = (topics = []) => {
  const { totalTopics, completedTopics, inProgressTopics, reviewTopics, notStartedTopics } =
    calculateTopicMetrics(topics);

  const entries = [
    {
      ...STATUS_DEFINITIONS[ITEM_STATUSES.COMPLETED],
      count: completedTopics,
      percentage: totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0,
    },
    {
      ...STATUS_DEFINITIONS[ITEM_STATUSES.IN_PROGRESS],
      count: inProgressTopics,
      percentage: totalTopics > 0 ? Math.round((inProgressTopics / totalTopics) * 100) : 0,
    },
    {
      ...STATUS_DEFINITIONS[ITEM_STATUSES.REVIEW],
      count: reviewTopics,
      percentage: totalTopics > 0 ? Math.round((reviewTopics / totalTopics) * 100) : 0,
    },
    {
      ...STATUS_DEFINITIONS[ITEM_STATUSES.NOT_STARTED],
      count: notStartedTopics,
      percentage: totalTopics > 0 ? Math.round((notStartedTopics / totalTopics) * 100) : 0,
    },
  ];

  return {
    totalTopics,
    entries,
  };
};

/**
 * Calculate section-level progress for a single structured roadmap.
 */
export const calculateSectionProgress = (plan) => {
  if (!plan || !Array.isArray(plan.sections) || plan.sections.length === 0) {
    return [];
  }

  return plan.sections.map((sec, index) => {
    const topics = sec.topics || [];
    const metrics = calculateTopicMetrics(topics);

    return {
      id: sec.id || `sec_${index + 1}`,
      title: sec.title || `Section ${index + 1}`,
      description: sec.description || '',
      order: sec.order || index + 1,
      totalTopics: metrics.totalTopics,
      completedTopics: metrics.completedTopics,
      inProgressTopics: metrics.inProgressTopics,
      reviewTopics: metrics.reviewTopics,
      notStartedTopics: metrics.notStartedTopics,
      percentage: metrics.topicCompletionRate,
      subtasksCompleted: metrics.completedSubtasks,
      totalSubtasks: metrics.totalSubtasks,
    };
  });
};

/**
 * Calculate progress comparison across all user roadmaps.
 */
export const calculateRoadmapComparison = (plans = []) => {
  const active = filterActivePlans(plans);
  return active.map((p) => {
    const metrics = calculateRoadmapMetrics(p);
    return {
      id: p.id,
      title: p.title || 'Untitled Roadmap',
      status: p.status || 'draft',
      goal: p.goal || '',
      percentage: metrics.topicCompletionRate,
      completedTopics: metrics.completedTopics,
      totalTopics: metrics.totalTopics,
      remainingTopics: metrics.totalTopics - metrics.completedTopics,
      inProgressTopics: metrics.inProgressTopics,
      reviewTopics: metrics.reviewTopics,
      subtaskPercentage: metrics.subtaskCompletionRate,
      estimatedDuration: p.estimatedDuration || 'Self-paced',
      updatedAt: p.updatedAt || p.createdAt,
    };
  });
};

/**
 * Group and aggregate learning activity over time.
 * Computes real historical activity without fabricating past dates or percentages.
 *
 * @param {Array<Object>} events - Array of learning events from learningEventRepository
 * @param {Array<Object>} topics - Array of topics with startedAt/completedAt timestamps
 * @param {string} range - '7d' | '30d' | '90d' | 'all'
 * @returns {Object} { hasData: boolean, range: string, timeline: Array<Object>, summary: Object }
 */
export const calculateActivityTimeline = (events = [], topics = [], range = '30d') => {
  // Collect all real historical dates with activity
  const dateCounts = new Map(); // 'YYYY-MM-DD' => { events: number, completions: number }

  const registerDate = (isoString, type = 'event') => {
    if (!isoString) return;
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return;
      const key = d.toISOString().split('T')[0];
      const current = dateCounts.get(key) || { events: 0, completions: 0 };
      if (type === 'completion') {
        current.completions++;
      } else {
        current.events++;
      }
      dateCounts.set(key, current);
    } catch {
      // Ignore invalid date format
    }
  };

  // 1. Process learning events
  for (const e of events || []) {
    registerDate(e.occurredAt || e.createdAt, 'event');
    if (e.type === 'item_completed') {
      registerDate(e.occurredAt || e.createdAt, 'completion');
    }
  }

  // 2. Process topic completedAt timestamps
  for (const t of topics || []) {
    if (t.completedAt) {
      registerDate(t.completedAt, 'completion');
    }
  }

  if (dateCounts.size === 0) {
    return {
      hasData: false,
      range,
      timeline: [],
      summary: { totalActiveDays: 0, totalActions: 0, totalCompletions: 0 },
    };
  }

  // Determine date bounds
  const now = new Date();
  let daysBack = 30;
  if (range === '7d') daysBack = 7;
  else if (range === '90d') daysBack = 90;
  else if (range === 'all') {
    // Find earliest recorded date
    const allDates = Array.from(dateCounts.keys()).sort();
    const earliest = new Date(allDates[0]);
    const diffMs = Math.max(0, now.getTime() - earliest.getTime());
    daysBack = Math.min(365, Math.max(7, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1));
  }

  const timeline = [];
  let cumulativeCompletions = 0;
  let totalActionsInRange = 0;
  let totalCompletionsInRange = 0;
  let activeDays = 0;

  for (let i = daysBack - 1; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - i);
    const dateStr = targetDate.toISOString().split('T')[0];

    const data = dateCounts.get(dateStr) || { events: 0, completions: 0 };
    cumulativeCompletions += data.completions;

    if (data.events > 0 || data.completions > 0) {
      activeDays++;
      totalActionsInRange += data.events + data.completions;
      totalCompletionsInRange += data.completions;
    }

    timeline.push({
      date: dateStr,
      displayDate: targetDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      eventsCount: data.events,
      completionsCount: data.completions,
      totalActivity: data.events + data.completions,
      cumulativeCompletions,
    });
  }

  return {
    hasData: true,
    range,
    timeline,
    summary: {
      totalActiveDays: activeDays,
      totalActions: totalActionsInRange,
      totalCompletions: totalCompletionsInRange,
    },
  };
};

/**
 * Categorize topics by attention requirement:
 * 1. Needs Review: topics in review status
 * 2. In Progress: actively working topics
 * 3. Ready to Start: not_started topics whose prerequisites/dependencies are met
 * 4. Blocked: not_started topics waiting for unfinished dependencies
 */
export const getAttentionTopics = (plans = []) => {
  const activePlans = filterActivePlans(plans);
  const allTopics = extractAllTopics(activePlans);

  const completedIds = new Set(
    allTopics.filter((t) => t.status === ITEM_STATUSES.COMPLETED).map((t) => t.id)
  );

  const needsReview = [];
  const inProgress = [];
  const readyToStart = [];
  const blocked = [];

  for (const t of allTopics) {
    if (t.status === ITEM_STATUSES.REVIEW) {
      needsReview.push({
        ...t,
        category: 'review',
        badge: 'Needs Review',
        urgency: 'high',
        reason: 'Marked for spaced retrieval review to solidify understanding.',
      });
    } else if (t.status === ITEM_STATUSES.IN_PROGRESS) {
      const completedSub = (t.checklist || []).filter((c) => c.completed).length;
      const totalSub = (t.checklist || []).length;
      inProgress.push({
        ...t,
        category: 'in_progress',
        badge: 'In Progress',
        urgency: 'medium',
        reason: totalSub > 0 ? `${completedSub} of ${totalSub} subtasks completed.` : 'Under active study.',
      });
    } else if (t.status === ITEM_STATUSES.NOT_STARTED) {
      const deps = t.dependencies || [];
      const hasUnmetDeps = deps.length > 0 && deps.some((depId) => !completedIds.has(depId));

      if (hasUnmetDeps) {
        blocked.push({
          ...t,
          category: 'blocked',
          badge: 'Prerequisites Pending',
          urgency: 'low',
          reason: `Requires completion of ${deps.length} prerequisite topic(s).`,
        });
      } else {
        readyToStart.push({
          ...t,
          category: 'ready',
          badge: 'Ready to Start',
          urgency: 'medium',
          reason: 'All prerequisites met. Ready for study.',
        });
      }
    }
  }

  return {
    needsReview,
    inProgress,
    readyToStart,
    blocked,
    totalNeedingAttention: needsReview.length + inProgress.length,
  };
};

/**
 * Intelligent, deterministic "What to Learn Next" study recommendation.
 * Prioritizes: Review -> In Progress -> Next Ready in Order -> Completed.
 */
export const getStudyRecommendation = (plans = []) => {
  const activePlans = filterActivePlans(plans);
  if (activePlans.length === 0) {
    return {
      topic: null,
      roadmap: null,
      reason: 'No active learning roadmaps found. Create or explore a roadmap to start learning!',
      actionType: 'create',
      actionLabel: 'Create New Roadmap →',
    };
  }

  // 1. Check for primary active plan or use first plan
  const targetPlan = activePlans.find((p) => p.status === PLAN_STATUSES.ACTIVE) || activePlans[0];
  const items = targetPlan.items || [];

  if (items.length === 0) {
    return {
      topic: null,
      roadmap: targetPlan,
      reason: 'Your active roadmap does not have topics yet. Add or generate curriculum modules.',
      actionType: 'open_roadmap',
      actionLabel: 'Open Roadmap Workspace →',
    };
  }

  // Check 1: Review topic in active roadmap
  const reviewTopic = items.find((i) => i.status === ITEM_STATUSES.REVIEW);
  if (reviewTopic) {
    return {
      topic: reviewTopic,
      roadmap: targetPlan,
      reason: `Topic "${reviewTopic.title}" is scheduled for spaced repetition review to reinforce retention.`,
      actionType: 'review',
      actionLabel: 'Start Review Session →',
      status: ITEM_STATUSES.REVIEW,
    };
  }

  // Check 2: Active topic in progress
  const inProgressTopic = items.find((i) => i.status === ITEM_STATUSES.IN_PROGRESS);
  if (inProgressTopic) {
    const remaining = (inProgressTopic.checklist || []).filter((c) => !c.completed).length;
    return {
      topic: inProgressTopic,
      roadmap: targetPlan,
      reason: `Topic "${inProgressTopic.title}" is currently in progress (${remaining} checklist items remaining).`,
      actionType: 'continue',
      actionLabel: 'Continue Topic →',
      status: ITEM_STATUSES.IN_PROGRESS,
    };
  }

  // Check 3: Next ready topic where prerequisites are met
  const completedIds = new Set(
    items.filter((i) => i.status === ITEM_STATUSES.COMPLETED).map((i) => i.id)
  );
  const nextReady = items.find((i) => {
    if (i.status !== ITEM_STATUSES.NOT_STARTED) return false;
    const deps = i.dependencies || [];
    return deps.every((d) => completedIds.has(d));
  });

  if (nextReady) {
    return {
      topic: nextReady,
      roadmap: targetPlan,
      reason: `All prerequisites satisfied for "${nextReady.title}". Ready to begin in sequence.`,
      actionType: 'start',
      actionLabel: 'Begin Studying →',
      status: ITEM_STATUSES.NOT_STARTED,
    };
  }

  // Check 4: Any first unstarted topic
  const firstUnstarted = items.find((i) => i.status === ITEM_STATUSES.NOT_STARTED);
  if (firstUnstarted) {
    return {
      topic: firstUnstarted,
      roadmap: targetPlan,
      reason: `Upcoming in curriculum sequence: "${firstUnstarted.title}".`,
      actionType: 'start',
      actionLabel: 'Begin Studying →',
      status: ITEM_STATUSES.NOT_STARTED,
    };
  }

  // Check 5: Roadmap 100% completed!
  return {
    topic: null,
    roadmap: targetPlan,
    reason: `Congratulations! You have completed all units in "${targetPlan.title}". Consider practicing a hands-on project or starting an advanced roadmap.`,
    actionType: 'complete',
    actionLabel: 'Explore New Roadmap →',
  };
};

/**
 * Derive deterministic, fact-based learning insights from metrics and events.
 * Strictly uses underlying empirical data; never invents statistics or applies manipulative streak pressure.
 */
export const deriveLearningInsights = (metrics, plans = [], events = []) => {
  const insights = [];

  if (!metrics || metrics.totalTopics === 0) {
    return [
      {
        id: 'ins_welcome',
        type: 'info',
        icon: '💡',
        title: 'Begin Your Learning Track',
        text: 'Select or generate a roadmap in your Learning Journey to start measuring your skill mastery.',
      },
    ];
  }

  // 1. Spaced Repetition / Review Attention Insight
  if (metrics.reviewTopics > 0) {
    insights.push({
      id: 'ins_review',
      type: 'warning',
      icon: '🔄',
      title: `${metrics.reviewTopics} Topic${metrics.reviewTopics > 1 ? 's' : ''} Need Review`,
      text: `${metrics.reviewTopics} topic${
        metrics.reviewTopics > 1 ? 's are' : ' is'
      } flagged for active recall. Conducting periodic reviews significantly improves long-term retention.`,
    });
  }

  // 2. High Completion / Milestone Insight
  if (metrics.topicCompletionRate >= 75) {
    insights.push({
      id: 'ins_high_mastery',
      type: 'success',
      icon: '🎯',
      title: 'Advanced Curriculum Mastery',
      text: `You have completed ${metrics.completedTopics} of ${metrics.totalTopics} topics (${metrics.topicCompletionRate}%). You are close to finishing this curriculum!`,
    });
  } else if (metrics.topicCompletionRate >= 30) {
    insights.push({
      id: 'ins_steady_momentum',
      type: 'success',
      icon: '🚀',
      title: 'Consistent Steady Momentum',
      text: `With ${metrics.completedTopics} topics mastered, you have established a solid foundation across your roadmaps.`,
    });
  }

  // 3. In-Progress Focus Insight
  if (metrics.inProgressTopics > 3) {
    insights.push({
      id: 'ins_focus',
      type: 'info',
      icon: '⚖️',
      title: 'Optimize Cognitive Load',
      text: `You have ${metrics.inProgressTopics} topics active simultaneously. Concentrating on 1 or 2 topics at a time helps achieve deeper focus.`,
    });
  } else if (metrics.inProgressTopics > 0) {
    insights.push({
      id: 'ins_active_work',
      type: 'info',
      icon: '⚡',
      title: 'Active Study Focus',
      text: `${metrics.inProgressTopics} topic currently underway with checklist exercises ready to tackle.`,
    });
  }

  // 4. Subtasks Progress Insight
  if (metrics.totalSubtasks > 0) {
    insights.push({
      id: 'ins_subtasks',
      type: 'info',
      icon: '📝',
      title: 'Checklist Execution',
      text: `${metrics.completedSubtasks} of ${metrics.totalSubtasks} checklist tasks completed (${metrics.subtaskCompletionRate}%).`,
    });
  }

  // 5. Offline-First Reliability Fact
  insights.push({
    id: 'ins_offline',
    type: 'neutral',
    icon: '🛡️',
    title: 'Offline-First Resilience',
    text: 'All progress metrics and curriculum data are persisted in your browser’s local IndexedDB and remain 100% accessible offline.',
  });

  return insights;
};

export const progressAnalyticsService = {
  STATUS_DEFINITIONS,
  filterActivePlans,
  extractAllTopics,
  calculateTopicMetrics,
  calculateOverallMetrics,
  calculateRoadmapMetrics,
  calculateStatusDistribution,
  calculateSectionProgress,
  calculateRoadmapComparison,
  calculateActivityTimeline,
  getAttentionTopics,
  getStudyRecommendation,
  deriveLearningInsights,
};

export default progressAnalyticsService;
