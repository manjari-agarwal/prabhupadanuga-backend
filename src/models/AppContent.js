import mongoose from 'mongoose';
const schema = new mongoose.Schema({ slug: { type: String, unique: true, required: true, match: /^[a-z0-9-]+$/ }, title: { type: String, required: true }, body: { type: String, default: '' }, imageUrl: String, links: [{ label: String, url: String }], published: { type: Boolean, default: false }, version: { type: Number, default: 1 } }, { timestamps: true });
export default mongoose.model('AppContent', schema);
