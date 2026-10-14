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
 * @desc    Create or update a learning plan
 * @route   POST /api/plans
 * @access  Protected
 */
export const savePlan = asyncHandler(async (req, res) => {
  const { planId, title, goal, description, status, items } = req.body;

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
      description: description || '',
      status: status || 'active',
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
