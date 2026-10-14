import mongoose from 'mongoose';

const learnerMemorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    memoryId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: [
        'learning_preference',
        'learning_goal',
        'knowledge_observation',
        'difficulty_observation',
        'learner_context',
      ],
      required: true,
    },
    key: {
      type: String,
      required: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    source: {
      type: String,
      enum: ['explicit', 'observed', 'inferred', 'assessed'],
      default: 'observed',
    },
    confidence: {
      type: Number,
      default: 0.8,
      min: 0,
      max: 1,
    },
    status: {
      type: String,
      enum: ['active', 'superseded', 'deleted'],
      default: 'active',
      index: true,
    },
    supersedesId: {
      type: String,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

learnerMemorySchema.index({ userId: 1, status: 1 });
learnerMemorySchema.index({ userId: 1, type: 1 });
learnerMemorySchema.index({ userId: 1, key: 1 });

const LearnerMemory = mongoose.model('LearnerMemory', learnerMemorySchema);

export default LearnerMemory;
