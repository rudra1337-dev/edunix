import learningPlanRepository from '../storage/learningPlanRepository.js';
import syncQueueRepository from '../storage/syncQueueRepository.js';
import learningEventRepository from '../storage/learningEventRepository.js';

const generatePlanId = () => `plan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const generateItemId = () => `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
const generateEvtId = () => `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

export const PLAN_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const ITEM_STATUSES = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  COMPLETED: 'completed',
};

// Valid status transitions
const VALID_TRANSITIONS = {
  [ITEM_STATUSES.NOT_STARTED]: [ITEM_STATUSES.IN_PROGRESS],
  [ITEM_STATUSES.IN_PROGRESS]: [ITEM_STATUSES.COMPLETED, ITEM_STATUSES.REVIEW],
  [ITEM_STATUSES.COMPLETED]: [ITEM_STATUSES.REVIEW, ITEM_STATUSES.IN_PROGRESS],
  [ITEM_STATUSES.REVIEW]: [ITEM_STATUSES.COMPLETED, ITEM_STATUSES.IN_PROGRESS],
};

/**
 * Pure function: Calculate progress statistics from plan items.
 * Safely handles empty or missing arrays without division-by-zero errors.
 */
export const calculateProgress = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      review: 0,
      notStarted: 0,
      percentage: 0,
    };
  }

  let completed = 0;
  let inProgress = 0;
  let review = 0;
  let notStarted = 0;

  for (const item of items) {
    switch (item.status) {
      case ITEM_STATUSES.COMPLETED:
        completed++;
        break;
      case ITEM_STATUSES.IN_PROGRESS:
        inProgress++;
        break;
      case ITEM_STATUSES.REVIEW:
        review++;
        break;
      default:
        notStarted++;
    }
  }

  const total = items.length;
  const percentage = Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    review,
    notStarted,
    percentage,
  };
};

/**
 * Default starter curriculum for Linux / Unix Systems
 */
export const createDefaultPlan = (userId = 'local-user') => ({
  id: generatePlanId(),
  userId,
  title: 'Linux & Unix Systems Mastery',
  goal: 'Master Unix command line, shell scripting, process control, and systems programming',
  description: 'Structured adaptive learning path covering foundational to advanced Unix concepts.',
  status: PLAN_STATUSES.ACTIVE,
  version: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [
    {
      id: 'item_1_philosophy',
      title: 'Unix Philosophy & Command Line Fundamentals',
      description: 'Understanding KISS principle, text streams, core navigation (cd, ls, pwd, cat, man).',
      order: 1,
      status: ITEM_STATUSES.COMPLETED,
      startedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 86400000).toISOString(),
      reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
      dependencies: [],
    },
    {
      id: 'item_2_permissions',
      title: 'File System Hierarchy & Permissions (chmod/chown)',
      description: 'Directory structure, inode concepts, octal permissions (755 vs 644), and ownership.',
      order: 2,
      status: ITEM_STATUSES.IN_PROGRESS,
      startedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      completedAt: null,
      reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
      dependencies: ['item_1_philosophy'],
    },
    {
      id: 'item_3_streams_pipes',
      title: 'Standard Streams, Redirection & Pipes (|)',
      description: 'Connecting programs using stdin, stdout, stderr (2>&1), and pipelines.',
      order: 3,
      status: ITEM_STATUSES.NOT_STARTED,
      startedAt: null,
      completedAt: null,
      reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
      dependencies: ['item_1_philosophy'],
    },
    {
      id: 'item_4_text_processing',
      title: 'Text Processing Utilities (grep, sed, awk)',
      description: 'Powerful stream editing, regular expressions, pattern matching, and columnar extraction.',
      order: 4,
      status: ITEM_STATUSES.NOT_STARTED,
      startedAt: null,
      completedAt: null,
      reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
      dependencies: ['item_3_streams_pipes'],
    },
    {
      id: 'item_5_bash_scripting',
      title: 'Bash Scripting & Automation (set -euo pipefail)',
      description: 'Writing robust scripts with variables, loops, conditionals, exit codes, and functions.',
      order: 5,
      status: ITEM_STATUSES.NOT_STARTED,
      startedAt: null,
      completedAt: null,
      reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
      dependencies: ['item_4_text_processing'],
    },
    {
      id: 'item_6_process_mgmt',
      title: 'Unix Process Management, PIDs & Signals',
      description: 'Process life cycle (fork/exec), PID, signals (SIGTERM, SIGKILL, SIGHUP), and background jobs (&, bg, fg).',
      order: 6,
      status: ITEM_STATUSES.NOT_STARTED,
      startedAt: null,
      completedAt: null,
      reviewMetadata: { reviewCount: 0, lastReviewedAt: null },
      dependencies: ['item_5_bash_scripting'],
    },
  ],
});

export class LearningPlanService {
  constructor() {
    this.planRepo = learningPlanRepository;
    this.syncRepo = syncQueueRepository;
    this.eventRepo = learningEventRepository;
  }

  /**
   * Get active plan for user, initializing default if not yet created
   */
  async getOrCreateActivePlan(userId = 'local-user') {
    let plan = await this.planRepo.getActivePlan(userId);
    if (!plan) {
      plan = createDefaultPlan(userId);
      await this.planRepo.savePlan(plan);
      await this.syncRepo.enqueue({
        userId,
        entityType: 'learningPlan',
        entityId: plan.id,
        operation: 'upsert',
        payload: plan,
      });
    }
    return plan;
  }

  /**
   * Validate whether a status transition is permitted
   */
  validateTransition(currentStatus, targetStatus) {
    if (currentStatus === targetStatus) return true;
    const allowed = VALID_TRANSITIONS[currentStatus] || [];
    return allowed.includes(targetStatus);
  }

  /**
   * Update the status of a specific item in a plan.
   * Enforces transition validation, records learning event, and queues sync.
   *
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.planId
   * @param {string} params.itemId
   * @param {string} params.newStatus - 'not_started' | 'in_progress' | 'review' | 'completed'
   */
  async updateItemStatus({ userId = 'local-user', planId, itemId, newStatus }) {
    if (!Object.values(ITEM_STATUSES).includes(newStatus)) {
      throw new Error(`Invalid status '${newStatus}'. Allowed: ${Object.values(ITEM_STATUSES).join(', ')}`);
    }

    const plan = await this.planRepo.getPlan(planId);
    if (!plan) {
      throw new Error(`Learning plan with ID '${planId}' not found.`);
    }

    const itemIndex = (plan.items || []).findIndex((i) => i.id === itemId);
    if (itemIndex === -1) {
      throw new Error(`Item with ID '${itemId}' not found in plan.`);
    }

    const item = plan.items[itemIndex];
    const previousStatus = item.status;

    if (previousStatus === newStatus) {
      // No change
      return { plan, item, changed: false };
    }

    // Validate transition
    if (!this.validateTransition(previousStatus, newStatus)) {
      throw new Error(
        `Invalid status transition from '${previousStatus}' to '${newStatus}'.`
      );
    }

    const now = new Date().toISOString();
    const updatedItem = {
      ...item,
      status: newStatus,
    };

    let eventType = null;

    // Transition-specific timestamp and metadata updates
    if (newStatus === ITEM_STATUSES.IN_PROGRESS) {
      if (!updatedItem.startedAt) updatedItem.startedAt = now;
      eventType = 'plan_item_started';
    } else if (newStatus === ITEM_STATUSES.COMPLETED) {
      updatedItem.completedAt = now;
      if (previousStatus === ITEM_STATUSES.REVIEW) {
        updatedItem.reviewMetadata = {
          reviewCount: (updatedItem.reviewMetadata?.reviewCount || 0) + 1,
          lastReviewedAt: now,
        };
        eventType = 'review_completed';
      } else {
        eventType = 'plan_item_completed';
      }
    } else if (newStatus === ITEM_STATUSES.REVIEW) {
      eventType = 'review_requested';
    }

    // Update plan document
    const updatedItems = [...plan.items];
    updatedItems[itemIndex] = updatedItem;

    const updatedPlan = {
      ...plan,
      items: updatedItems,
      updatedAt: now,
      version: (plan.version || 1) + 1,
    };

    // 1. Persist locally to IndexedDB
    await this.planRepo.savePlan(updatedPlan);

    // 2. Enqueue sync operation for the plan
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updatedPlan.id,
      operation: 'upsert',
      payload: updatedPlan,
    });

    // 3. Record learning event
    if (eventType) {
      await this.eventRepo.recordEvent({
        eventId: generateEvtId(),
        userId,
        learningPlanId: plan.id,
        learningPlanItemId: item.id,
        type: eventType,
        topic: item.title,
        payload: {
          previousStatus,
          newStatus,
          timestamp: now,
        },
      });
    }

    return { plan: updatedPlan, item: updatedItem, changed: true };
  }

  /**
   * Reorder items within a plan deterministically
   */
  async reorderItems({ userId = 'local-user', planId, itemIds }) {
    const plan = await this.planRepo.getPlan(planId);
    if (!plan) {
      throw new Error(`Learning plan with ID '${planId}' not found.`);
    }

    const itemMap = new Map((plan.items || []).map((item) => [item.id, item]));
    const reorderedItems = [];

    // Place items in the order specified by itemIds
    itemIds.forEach((id, index) => {
      const item = itemMap.get(id);
      if (item) {
        reorderedItems.push({
          ...item,
          order: index + 1,
        });
        itemMap.delete(id);
      }
    });

    // Append any remaining items that were not in itemIds
    itemMap.forEach((item) => {
      reorderedItems.push({
        ...item,
        order: reorderedItems.length + 1,
      });
    });

    const updatedPlan = {
      ...plan,
      items: reorderedItems,
      updatedAt: new Date().toISOString(),
      version: (plan.version || 1) + 1,
    };

    await this.planRepo.savePlan(updatedPlan);
    await this.syncRepo.enqueue({
      userId,
      entityType: 'learningPlan',
      entityId: updatedPlan.id,
      operation: 'upsert',
      payload: updatedPlan,
    });

    return updatedPlan;
  }
}

export default new LearningPlanService();
