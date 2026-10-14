import asyncHandler from '../utils/asyncHandler.js';
import chatEngineManager from '../services/ai/chatEngineManager.js';

/**
 * @desc    Process a chat message with auto / online / offline mode
 * @route   POST /api/chat/message
 * @access  Public / Authenticated
 */
export const sendMessage = asyncHandler(async (req, res) => {
  const {
    messages,
    mode,
    conversationId,
    context,
    systemPrompt,
    learnerContext,
    responsePreferences,
  } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'A valid non-empty array of messages is required.',
    });
  }

  const result = await chatEngineManager.executeChat({
    messages,
    mode: mode || 'auto',
    conversationId,
    userId: req.user?._id?.toString() || req.user?.id || req.body.userId || 'local-user',
    context,
    systemPrompt,
    learnerContext,
    responsePreferences,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

/**
 * @desc    Check status of online and offline AI services
 * @route   GET /api/chat/status
 * @access  Public
 */
export const getEngineStatus = asyncHandler(async (_req, res) => {
  const status = await chatEngineManager.getStatus();

  res.status(200).json({
    success: true,
    data: status,
  });
});
