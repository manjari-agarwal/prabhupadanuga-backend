import mongoose from 'mongoose';
const optionSchema = new mongoose.Schema({ id: { type: String, required: true }, text: { type: String, required: true } }, { _id: false });
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  questionBankId: { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionBank', default: null },
  type: { type: String, enum: ['single_choice', 'multiple_choice'], default: 'single_choice' },
  options: { type: [optionSchema], required: true, validate: v => v.length === 4 && new Set(v.map(o => o.id)).size === 4 },
  correctOptionIds: { type: [String], required: true, select: false },
  // Keep for backward compatibility with existing seed/admin quiz records.
  correctOptionId: { type: String, select: false },
  marks: { type: Number, required: true, min: 0, default: 1 },
  explanation: { type: String, default: '', select: false }
});
const schema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  quizDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
  scheduleTimezone: { type: String, default: 'UTC' },
  startAt: { type: Date, default: null },
  endAt: { type: Date, default: null },
  durationSeconds: { type: Number, required: true, min: 30 },
  questions: { type: [questionSchema], required: true },
  maxMarks: { type: Number, min: 0 },
  status: { type: String, enum: ['draft','published','archived'], default: 'draft' },
  isActive: { type: Boolean, default: false }
}, { timestamps: true });
schema.index({ status: 1, isActive: 1 });
// Enforce at most one active quiz at the database level, even under concurrent admin changes.
schema.index({ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true }, name: 'only_one_active_quiz' });
export default mongoose.model('Quiz', schema);
