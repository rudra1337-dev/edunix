import mongoose from 'mongoose';

const topicChecklistItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const topicResourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, default: '' },
    type: { type: String, default: 'documentation' },
  },
  { _id: false }
);

const roadmapTopicSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, default: '' },
    explanation: { type: String, default: '' },
    learningObjectives: { type: [String], default: [] },
    prerequisites: { type: [String], default: [] },
    checklist: [topicChecklistItemSchema],
    practiceExercises: { type: [String], default: [] },
    resources: [topicResourceSchema],
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
    notes: { type: String, default: '' },
    order: { type: Number, default: 1 },
    dependencies: { type: [String], default: [] },
  },
  { _id: false }
);

const roadmapSectionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 1 },
    topics: [roadmapTopicSchema],
  },
  { _id: false }
);

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
    summary: { type: String, default: '' },
    explanation: { type: String, default: '' },
    learningObjectives: { type: [String], default: [] },
    checklist: [topicChecklistItemSchema],
    practiceExercises: { type: [String], default: [] },
    notes: { type: String, default: '' },
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
    summary: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    learningObjectives: {
      type: [String],
      default: [],
    },
    prerequisites: {
      type: [String],
      default: [],
    },
    targetAudience: {
      type: String,
      default: 'All Levels',
    },
    estimatedDuration: {
      type: String,
      default: 'Self-paced',
    },
    source: {
      type: String,
      enum: ['system', 'ai_generated', 'user_created'],
      default: 'user_created',
    },
    conversationId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
      index: true,
    },
    sections: [roadmapSectionSchema],
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
