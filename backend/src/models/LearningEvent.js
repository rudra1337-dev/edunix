import mongoose from 'mongoose';

const learningEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    conversationId: {
      type: String,
      default: null,
    },
    learningPlanId: {
      type: String,
      default: null,
    },
    learningPlanItemId: {
      type: String,
      default: null,
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    topic: {
      type: String,
      default: 'General',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    occurredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    schemaVersion: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

learningEventSchema.index({ userId: 1, occurredAt: -1 });

const LearningEvent = mongoose.model('LearningEvent', learningEventSchema);

export default LearningEvent;
