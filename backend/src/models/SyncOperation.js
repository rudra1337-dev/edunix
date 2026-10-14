import mongoose from 'mongoose';

const syncOperationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    operationId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
    },
    entityId: {
      type: String,
      required: true,
    },
    operation: {
      type: String,
      enum: ['upsert', 'delete'],
      required: true,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const SyncOperation = mongoose.model('SyncOperation', syncOperationSchema);

export default SyncOperation;
