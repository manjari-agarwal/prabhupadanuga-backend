import mongoose from 'mongoose';
const schema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }, eventId: { type: String, required: true }, source: { type: String, enum: ['home','sankalp','menu','other'], default: 'home' }, destination: { type: String, required: true }, clickedAt: { type: Date, default: Date.now } }, { timestamps: false });
schema.index({ user: 1, eventId: 1 }, { unique: true });
schema.index({ clickedAt: -1 });
export default mongoose.model('DonateClick', schema);
