import asyncHandler from '../utils/asyncHandler.js';
import SyncOperation from '../models/SyncOperation.js';
import LearnerMemory from '../models/LearnerMemory.js';
import LearningPlan from '../models/LearningPlan.js';
import LearningEvent from '../models/LearningEvent.js';
import LearnerProfile from '../models/LearnerProfile.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

/**
 * @desc    Process a bounded batch of synchronization operations
 * @route   POST /api/sync/batch
 * @access  Protected
 */
export const syncBatch = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { operations } = req.body;

  if (!Array.isArray(operations)) {
    return res.status(400).json({
      success: false,
      message: 'Operations must be an array.',
    });
  }

  // Enforce bounded batch limit
  if (operations.length > 50) {
    return res.status(400).json({
      success: false,
      message: 'Batch size exceeds maximum limit of 50 operations.',
    });
  }

  const acknowledgedOperationIds = [];
  const rejectedOperations = [];

  for (const op of operations) {
    const { operationId, entityType, entityId, operation, payload } = op;

    if (!operationId || !entityType || !entityId) {
      rejectedOperations.push({
        operationId: operationId || 'unknown',
        code: 'VALIDATION_ERROR',
        reason: 'Missing operationId, entityType, or entityId',
      });
      continue;
    }

    try {
      // 1. Check idempotency: if already processed, acknowledge without re-applying
      const alreadyProcessed = await SyncOperation.findOne({ operationId, userId });
      if (alreadyProcessed) {
        acknowledgedOperationIds.push(operationId);
        continue;
      }

      // 2. Dispatch according to entityType and operation
      switch (entityType) {
        case 'learnerMemory': {
          if (operation === 'delete') {
            await LearnerMemory.findOneAndUpdate(
              { memoryId: entityId, userId },
              { status: 'deleted', version: payload?.version || 1 },
              { upsert: false }
            );
          } else {
            await LearnerMemory.findOneAndUpdate(
              { memoryId: entityId, userId },
              {
                userId,
                memoryId: entityId,
                type: payload.type || 'learning_preference',
                key: payload.key,
                value: payload.value,
                source: payload.source || 'observed',
                confidence: payload.confidence || 0.8,
                status: payload.status || 'active',
                supersedesId: payload.supersedesId || null,
                version: payload.version || 1,
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          }
          break;
        }

        case 'learningPlan': {
          if (operation === 'delete') {
            await LearningPlan.findOneAndDelete({ planId: entityId, userId });
          } else {
            await LearningPlan.findOneAndUpdate(
              { planId: entityId, userId },
              {
                userId,
                planId: entityId,
                title: payload.title || 'Learning Plan',
                goal: payload.goal || 'Master Skills',
                description: payload.description || '',
                status: payload.status || 'active',
                items: payload.items || [],
                version: payload.version || 1,
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          }
          break;
        }

        case 'learningEvent': {
          // Append-only with deduplication
          const existingEvent = await LearningEvent.findOne({ eventId: entityId, userId });
          if (!existingEvent) {
            await LearningEvent.create({
              userId,
              eventId: entityId,
              conversationId: payload.conversationId || null,
              learningPlanId: payload.learningPlanId || null,
              learningPlanItemId: payload.learningPlanItemId || null,
              type: payload.type || 'topic_explored',
              topic: payload.topic || 'General',
              payload: payload.payload || {},
              occurredAt: payload.occurredAt || new Date(),
              schemaVersion: payload.schemaVersion || 1,
            });
          }
          break;
        }

        case 'conversation': {
          if (operation === 'delete') {
            await Conversation.findOneAndDelete({ conversationId: entityId, userId });
            await Message.deleteMany({ conversationId: entityId, userId });
          } else {
            await Conversation.findOneAndUpdate(
              { conversationId: entityId, userId },
              {
                userId,
                conversationId: entityId,
                title: payload.title || 'Chat',
                summary: payload.summary || '',
                lastMessageAt: payload.lastMessageAt || new Date(),
                version: payload.version || 1,
              },
              { upsert: true, new: true, setDefaultsOnInsert: true }
            );
          }
          break;
        }

        case 'message': {
          await Message.findOneAndUpdate(
            { messageId: entityId, userId },
            {
              userId,
              messageId: entityId,
              conversationId: payload.conversationId,
              role: payload.role,
              content: payload.content,
              sequence: payload.sequence || 0,
              engine: payload.engine || null,
              model: payload.model || null,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          break;
        }

        case 'learnerProfile': {
          await LearnerProfile.findOneAndUpdate(
            { userId },
            {
              userId,
              preferences: payload.preferences || {},
              goals: payload.goals || [],
              version: payload.version || 1,
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          break;
        }

        default:
          rejectedOperations.push({
            operationId,
            code: 'INVALID_OPERATION',
            reason: `Unsupported entityType '${entityType}'`,
          });
          continue;
      }

      // 3. Record operation for idempotency tracking
      await SyncOperation.create({
        userId,
        operationId,
        entityType,
        entityId,
        operation: operation || 'upsert',
      });

      acknowledgedOperationIds.push(operationId);
    } catch (err) {
      console.error(`[SyncController] Error processing operation ${operationId}:`, err);
      rejectedOperations.push({
        operationId,
        code: 'SERVER_ERROR',
        reason: err.message,
      });
    }
  }

  res.status(200).json({
    success: true,
    data: {
      acknowledgedOperationIds,
      rejectedOperations,
    },
  });
});

/**
 * @desc    Pull latest synchronized data for user
 * @route   GET /api/sync/pull
 * @access  Protected
 */
export const pullSync = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const since = req.query.since ? new Date(req.query.since) : null;

  const dateFilter = since ? { updatedAt: { $gt: since } } : {};

  const [memories, plans, profile] = await Promise.all([
    LearnerMemory.find({ userId, ...dateFilter }),
    LearningPlan.find({ userId, ...dateFilter }),
    LearnerProfile.findOne({ userId }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      memories,
      learnerMemories: memories,
      plans,
      learningPlans: plans,
      profile,
      serverTime: new Date().toISOString(),
    },
  });
});
