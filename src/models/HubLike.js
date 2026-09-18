import mongoose from 'mongoose';

const hubLikeSchema = new mongoose.Schema({
  post: { type: mongoose.Schema.Types.ObjectId, ref: 'HubPost', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true, versionKey: false });

hubLikeSchema.index({ post: 1, user: 1 }, { unique: true });

export default mongoose.model('HubLike', hubLikeSchema);
