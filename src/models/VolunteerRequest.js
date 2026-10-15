import mongoose from 'mongoose';
const schema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, services: { type: [String], required: true }, name: { type: String, default: '' }, availability: { type: String, default: '' }, note: { type: String, default: '' }, phone: { type: String, default: '' }, email: { type: String, required: true }, status: { type: String, enum: ['submitted','contacted','approved','closed'], default: 'submitted' } }, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
export default mongoose.model('VolunteerRequest', schema);
