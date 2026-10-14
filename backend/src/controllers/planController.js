import asyncHandler from '../utils/asyncHandler.js';
import LearningPlan from '../models/LearningPlan.js';

/**
 * @desc    Get all learning plans for the authenticated user
 * @route   GET /api/plans
 * @access  Protected
 */
export const getPlans = asyncHandler(async (req, res) => {
  const plans = await LearningPlan.find({ userId: req.user.id }).sort({ updatedAt: -1 });
  res.status(200).json({
    success: true,
    data: plans,
  });
});

/**
 * @desc    Get single learning plan by planId
 * @route   GET /api/plans/:planId
 * @access  Protected
 */
export const getPlanById = asyncHandler(async (req, res) => {
  const plan = await LearningPlan.findOne({
    planId: req.params.planId,
    userId: req.user.id,
  });

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Learning plan not found.',
    });
  }

  res.status(200).json({
    success: true,
    data: plan,
  });
});

/**
 * @desc    Create or update a learning plan
 * @route   POST /api/plans
 * @access  Protected
 */
export const savePlan = asyncHandler(async (req, res) => {
  const {
    planId,
    title,
    goal,
    summary,
    description,
    learningObjectives,
    prerequisites,
    targetAudience,
    estimatedDuration,
    source,
    conversationId,
    status,
    sections,
    items,
  } = req.body;

  if (!planId || !title || !goal) {
    return res.status(400).json({
      success: false,
      message: 'Plan requires planId, title, and goal.',
    });
  }

  const plan = await LearningPlan.findOneAndUpdate(
    { planId, userId: req.user.id },
    {
      userId: req.user.id,
      planId,
      title,
      goal,
      summary: summary || '',
      description: description || '',
      learningObjectives: learningObjectives || [],
      prerequisites: prerequisites || [],
      targetAudience: targetAudience || 'All Levels',
      estimatedDuration: estimatedDuration || 'Self-paced',
      source: source || 'user_created',
      conversationId: conversationId || null,
      status: status || 'active',
      sections: sections || [],
      items: items || [],
      $inc: { version: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  res.status(200).json({
    success: true,
    data: plan,
  });
});

/**
 * @desc    Update roadmap details or topics
 * @route   PUT /api/plans/:planId
 * @access  Protected
 */
export const updatePlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const updates = req.body;

  delete updates._id;
  delete updates.userId;
  delete updates.planId;

  const plan = await LearningPlan.findOneAndUpdate(
    { planId, userId: req.user.id },
    {
      ...updates,
      $inc: { version: 1 },
    },
    { new: true }
  );

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Learning plan not found or unauthorized.',
    });
  }

  res.status(200).json({
    success: true,
    data: plan,
  });
});

/**
 * @desc    Delete a learning plan
 * @route   DELETE /api/plans/:planId
 * @access  Protected
 */
export const deletePlan = asyncHandler(async (req, res) => {
  const { planId } = req.params;

  const plan = await LearningPlan.findOneAndDelete({
    planId,
    userId: req.user.id,
  });

  if (!plan) {
    return res.status(404).json({
      success: false,
      message: 'Learning plan not found or unauthorized.',
    });
  }

  res.status(200).json({
    success: true,
    message: 'Roadmap deleted successfully.',
    data: { planId },
  });
});
