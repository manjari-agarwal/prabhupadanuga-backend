import mongoose from 'mongoose';
const optionSchema = new mongoose.Schema({ id: { type: String, required: true }, text: { type: String, required: true } }, { _id: false });
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['single_choice'], default: 'single_choice' },
  options: { type: [optionSchema], required: true },
  correctOptionId: { type: String, required: true, select: false },
  marks: { type: Number, required: true, min: 0 },
  explanation: { type: String, default: '', select: false }
});
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  quizDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  scheduleTimezone: { type: String, default: 'UTC' },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  durationSeconds: { type: Number, required: true, min: 30 },
  questions: { type: [questionSchema], required: true },
  maxMarks: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['draft','published','archived'], default: 'draft' }
}, { timestamps: true });
schema.index({ quizDate: 1, status: 1 });
export default mongoose.model('Quiz', schema);
