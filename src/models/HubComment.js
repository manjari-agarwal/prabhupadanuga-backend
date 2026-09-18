import mongoose from 'mongoose';

const hubCommentSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'HubPost', required: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, trim: true, required: true, maxlength: 1000 },
  deletedAt: Date
}, { timestamps: true, versionKey: false });

hubCommentSchema.index({ post: 1, deletedAt: 1, createdAt: -1 });

export default mongoose.model('HubComment', hubCommentSchema);
