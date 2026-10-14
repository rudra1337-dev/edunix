import mongoose from 'mongoose';

const learnerProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    preferences: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    goals: {
      type: [String],
      default: [],
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

const LearnerProfile = mongoose.model('LearnerProfile', learnerProfileSchema);

export default LearnerProfile;
