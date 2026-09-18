import mongoose from 'mongoose';

const hubPostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['tribute', 'story'], required: true, index: true },
  title: { type: String, trim: true, required: true, maxlength: 160 },
  body: { type: String, trim: true, maxlength: 5000 },
  mediaUrl: { type: String, trim: true },
  thumbnailUrl: { type: String, trim: true },
  durationSeconds: { type: Number, min: 1, max: 60 },
  status: { type: String, enum: ['pending', 'published', 'rejected'], required: true, index: true },
  moderationNote: { type: String, trim: true, maxlength: 500 },
  likeCount: { type: Number, min: 0, default: 0 },
  commentCount: { type: Number, min: 0, default: 0 },
  shareCount: { type: Number, min: 0, default: 0 },
  publishedAt: Date,
  deletedAt: Date
}, { timestamps: true, versionKey: false });

hubPostSchema.index({ type: 1, status: 1, createdAt: -1 });
hubPostSchema.index({ author: 1, type: 1, deletedAt: 1 });

export default mongoose.model('HubPost', hubPostSchema);
