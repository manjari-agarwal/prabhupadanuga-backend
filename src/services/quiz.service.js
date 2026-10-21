import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import { resolveTimezone, localDateParts } from './dashboard.service.js';

export function httpError(message, statusCode = 400) { return Object.assign(new Error(message), { statusCode }); }
export const id = value => String(value);
export function quizMeta(quiz) {
  if (!quiz) return null;
  return { id: id(quiz._id), title: quiz.title, description: quiz.description || '',
    startsAt: quiz.startAt || null, endsAt: quiz.endAt || null, durationSeconds: quiz.durationSeconds,
    questionCount: quiz.questions.length, maxMarks: quiz.questions.reduce((n,q)=>n+q.marks,0) };
}
export function publicQuestions(attempt) {
  return attempt.questions.map(q => ({ id: q.questionId, text: q.text, type: q.type,
    marks: q.marks, options: q.options.map(o => ({ id: o.id, text: o.text })),
    selectedOptionIds: [] }));
}
export function attemptView(attempt) {
  return { attemptId: id(attempt._id), quizId: id(attempt.quiz), title: attempt.title, status: attempt.status,
    startedAt: attempt.startedAt, deadlineAt: attempt.deadlineAt, serverNow: new Date(),
    questionCount: attempt.questions.length, questions: publicQuestions(attempt) };
}
export function resultView(attempt) {
  return { attemptId: id(attempt._id), quizId: id(attempt.quiz), title: attempt.title,
    status: attempt.status, submittedAt: attempt.submittedAt, score: attempt.score, maxMarks: attempt.maxMarks,
    percentage: attempt.maxMarks ? Math.round(100*attempt.score/attempt.maxMarks) : 0,
    correctCount: attempt.correctCount, totalQuestions: attempt.questionCount,
    questions: attempt.questions.map(q => {
      const chosen = attempt.answers.find(a=>a.questionId===q.questionId)?.selectedOptionIds || [];
      const correct = q.correctOptionIds || [];
      return { id: q.questionId, text: q.text, type: q.type, options: q.options,
        selectedOptionIds: chosen, correctOptionIds: correct,
        isCorrect: chosen.length > 0 && chosen.length === correct.length && chosen.every(x=>correct.includes(x)),
        marks: q.marks, explanation: q.explanation || '' };
    }) };
}
export async function activeQuiz(now = new Date()) {
  return Quiz.findOne({ status: 'published', isActive: true,
    $and: [ { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gt: now } }] } ] }).schemaLevelProjections(false).lean();
}
export async function finishAttempt(attempt, status, now = new Date()) {
  if (attempt.status !== 'in_progress') return attempt;
  // Atomically claim finalization. Parallel requests must never recalculate a finalized score.
  let score = 0, correctCount = 0;
  for (const q of attempt.questions) {
    const chosen = attempt.answers.find(a=>a.questionId===q.questionId)?.selectedOptionIds || [];
    if (chosen.length > 0 && chosen.length === q.correctOptionIds.length && chosen.every(x=>q.correctOptionIds.includes(x))) {
      score += q.marks; correctCount++;
    }
  }
  const updated = await QuizAttempt.findOneAndUpdate({ _id: attempt._id, status:'in_progress', __v:attempt.__v },
    { $set: { status, submittedAt: now, score, correctCount, maxMarks: attempt.questions.reduce((n,q)=>n+q.marks,0), questionCount: attempt.questions.length }, $inc:{__v:1} }, { new: true });
  if(updated)return updated;
  const fresh=await QuizAttempt.findById(attempt._id);
  return fresh.status==='in_progress' ? finishAttempt(fresh,status,now) : fresh;
}
export async function ensureCurrent(attempt) {
  if (attempt.status === 'in_progress' && Date.now() >= +attempt.deadlineAt) return finishAttempt(attempt, 'expired', attempt.deadlineAt);
  return attempt;
}
export async function quizState(user, quiz, now = new Date()) {
  if (!quiz) return { available:false, quiz:null, state:'unavailable', canPlay:false, result:null };
  let attempt = await QuizAttempt.findOne({ user: user._id, quiz: quiz._id });
  if (attempt) attempt = await ensureCurrent(attempt);
  return { available:true, quiz:quizMeta(quiz), state:attempt ? attempt.status : 'not_started',
    canPlay:!attempt, canResume:false, attemptId:attempt ? id(attempt._id):null,
    deadlineAt:attempt?.status==='in_progress'?attempt.deadlineAt:null,
    result:attempt?.status !== 'in_progress' && attempt ? { score:attempt.score,maxMarks:attempt.maxMarks,correctCount:attempt.correctCount,questionCount:attempt.questionCount } : null };
}
export async function streakFor(user) {
  const timezone = resolveTimezone(user.timezone);
  const items = await QuizAttempt.find({ user:user._id, status: { $in:['submitted','expired'] } }).select('submittedAt').sort({submittedAt:-1}).lean();
  const dates = [...new Set(items.map(a=>localDateParts(a.submittedAt,timezone).date))].sort().reverse();
  let best=0, run=0, last='';
  for(const date of [...dates].reverse()) { const diff=last? Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(last+'T00:00:00Z'))/86400000):1; run=diff===1?run+1:1; best=Math.max(best,run);last=date; }
  const today=localDateParts(new Date(),timezone).date;
  const previous= new Date(Date.parse(today+'T00:00:00Z')-86400000).toISOString().slice(0,10);
  let current=0;
  if(dates[0]===today || dates[0]===previous) { let expected=dates[0];for(const d of dates){if(d!==expected)break; current++;expected=new Date(Date.parse(expected+'T00:00:00Z')-86400000).toISOString().slice(0,10);} }
  return { currentStreak:current, longestStreak:best, playedDays:dates.length, definition:'Consecutive calendar days with a finalized quiz; today or yesterday can extend the streak.' };
}
