import mongoose from 'mongoose';

const planItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'review', 'completed'],
      default: 'not_started',
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    reviewMetadata: {
      reviewCount: { type: Number, default: 0 },
      lastReviewedAt: { type: Date, default: null },
    },
    dependencies: { type: [String], default: [] },
  },
  { _id: false }
);

const learningPlanSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    goal: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      index: true,
    },
    items: [planItemSchema],
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

learningPlanSchema.index({ userId: 1, status: 1 });

const LearningPlan = mongoose.model('LearningPlan', learningPlanSchema);

export default LearningPlan;
