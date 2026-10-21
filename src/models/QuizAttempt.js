import mongoose from 'mongoose';
const answerSchema = new mongoose.Schema({
  questionId: { type: String, required: true }, selectedOptionIds: { type: [String], default: [] }
}, { _id: false });
const questionSnapshot = new mongoose.Schema({
  questionId: String, text: String, type: String, options: [{ id: String, text: String, _id: false }],
  correctOptionIds: [String], marks: Number, explanation: String
}, { _id: false });
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  title: String,
  quizDate: String,
  timezone: String,
  startedAt: { type: Date, required: true },
  deadlineAt: { type: Date, required: true },
  submittedAt: Date,
  status: { type: String, enum: ['in_progress','submitted','expired'], default: 'in_progress' },
  questions: [questionSnapshot],
  answers: [answerSchema],
  score: Number,
  maxMarks: Number,
  correctCount: Number,
  questionCount: Number
}, { timestamps: true });
schema.index({ user: 1, quiz: 1 }, { unique: true });
schema.index({ user: 1, startedAt: -1 });
export default mongoose.model('QuizAttempt', schema);
