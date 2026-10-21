import Quiz from '../models/Quiz.js';
import QuizAttempt from '../models/QuizAttempt.js';
import { activeQuiz, quizState, attemptView, resultView, ensureCurrent, finishAttempt, httpError, streakFor } from '../services/quiz.service.js';
import { resolveTimezone, localDateParts } from '../services/dashboard.service.js';
import { success } from '../utils/apiResponse.js';
const wrap = fn => (req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
export const current = wrap(async (req,res) => success(res, await quizState(req.user, await activeQuiz())));
export const start = wrap(async (req,res) => {
  const quiz = await activeQuiz();
  if (!quiz) throw httpError('No active quiz available',404);
  let attempt = await QuizAttempt.findOne({ user:req.user._id,quiz:quiz._id });
  if (attempt) {
    attempt = await ensureCurrent(attempt);
    throw httpError('Quiz already started; resume is not permitted',409);
  }
  const now = new Date();
  const end = Math.min(now.getTime()+quiz.durationSeconds*1000,quiz.endAt?new Date(quiz.endAt).getTime():Infinity);
  if (end <= +now) throw httpError('Quiz is no longer available',409);
  const questions = quiz.questions.map(q=>({ questionId:String(q._id), text:q.text, type:q.type,
    options:q.options.map(o=>({id:o.id,text:o.text})),
    correctOptionIds:q.correctOptionIds?.length?q.correctOptionIds:[q.correctOptionId].filter(Boolean),
    marks:q.marks, explanation:q.explanation||'' }));
  if (!questions.length || questions.some(q=>!q.correctOptionIds.length || (q.type==='single_choice' && q.correctOptionIds.length!==1) || q.options.length!==4 || q.correctOptionIds.some(id=>!q.options.some(o=>o.id===id))))
    throw httpError('Quiz questions are not configured correctly',409);
  try {
    attempt = await QuizAttempt.create({ user:req.user._id,quiz:quiz._id,title:quiz.title,quizDate:localDateParts(now,resolveTimezone(req.user.timezone)).date,
      timezone:resolveTimezone(req.user.timezone), startedAt:now, deadlineAt:new Date(end),questions,answers:[] });
  } catch(e) {
    if(e.code!==11000)throw e;
    attempt=await QuizAttempt.findOne({user:req.user._id,quiz:quiz._id});
    attempt=await ensureCurrent(attempt);
    throw httpError('Quiz already started; resume is not permitted',409);
  }
  return success(res,attemptView(attempt),'Quiz started');
});
export const submit = wrap(async(req,res)=>{
  const {answers}=req.body;
  let attempt=await QuizAttempt.findOne({_id:req.params.attemptId,user:req.user._id});
  if(!attempt)throw httpError('Attempt not found',404);
  attempt=await ensureCurrent(attempt);
  if(attempt.status!=='in_progress') {
    // Retrying a successful submit may read the frozen result, but never alter it.
    return success(res,resultView(attempt),'Quiz result');
  }
  const now=new Date();
  if(now>=attempt.deadlineAt) {
    attempt=await finishAttempt(attempt,'expired',attempt.deadlineAt);
    return success(res,resultView(attempt),'Quiz time expired');
  }
  const seen=new Set();
  for(const answer of answers){
    if(seen.has(answer.questionId))throw httpError('Duplicate question ID',422);
    seen.add(answer.questionId);
    const question=attempt.questions.find(q=>q.questionId===answer.questionId);
    if(!question)throw httpError('Invalid question ID',422);
    if(question.type==='single_choice' && answer.selectedOptionIds.length>1)throw httpError('Only one option may be selected',422);
    if(new Set(answer.selectedOptionIds).size!==answer.selectedOptionIds.length ||
      answer.selectedOptionIds.some(id=>!question.options.some(o=>o.id===id)))throw httpError('Invalid option selection',422);
  }
  // Atomic finalize: score is calculated only from this submission; answers never saved earlier.
  const scored=attempt.questions.map(q=>{
    const selected=answers.find(a=>a.questionId===q.questionId)?.selectedOptionIds||[];
    const correct=q.correctOptionIds||[];
    return {questionId:q.questionId,selectedOptionIds:selected,isCorrect:selected.length>0 && selected.length===correct.length && selected.every(id=>correct.includes(id)),marks:q.marks};
  });
  const updated=await QuizAttempt.findOneAndUpdate({
    _id:attempt._id,user:req.user._id,status:'in_progress',deadlineAt:{$gt:new Date()},__v:attempt.__v
  },{$set:{
    status:'submitted',submittedAt:new Date(),answers:scored.map(a=>({questionId:a.questionId,selectedOptionIds:a.selectedOptionIds})),
    score:scored.reduce((n,a)=>n+(a.isCorrect?a.marks:0),0),correctCount:scored.filter(a=>a.isCorrect).length,
    maxMarks:attempt.questions.reduce((n,q)=>n+q.marks,0),questionCount:attempt.questions.length
  },$inc:{__v:1}},{new:true});
  if(!updated){
    const fresh=await ensureCurrent(await QuizAttempt.findById(attempt._id));
    if(fresh.status==='in_progress')throw httpError('Submission conflict; please retry',409);
    return success(res,resultView(fresh),'Quiz result');
  }
  return success(res,resultView(updated),'Quiz result');
});
export const history = wrap(async(req,res)=>{
  const page=Math.max(1,Number(req.query.page)||1);
  const limit=Math.min(50,Math.max(1,Number(req.query.limit)||20));
  const filter={user:req.user._id};
  const [items,total,streak]=await Promise.all([
    QuizAttempt.find(filter).select('-questions -answers').sort({startedAt:-1}).skip((page-1)*limit).limit(limit).lean(),
    QuizAttempt.countDocuments(filter),streakFor(req.user)
  ]);
  return success(res,{items:items.map(a=>({attemptId:String(a._id),quizId:String(a.quiz),title:a.title,startedAt:a.startedAt,submittedAt:a.submittedAt,status:a.status,
    score:a.status==='in_progress'?null:a.score,maxMarks:a.status==='in_progress'?null:a.maxMarks,percentage:a.maxMarks?Math.round(a.score*100/a.maxMarks):null})),page,limit,total,streak});
});
export const result = wrap(async(req,res)=>{
  let attempt=await QuizAttempt.findOne({_id:req.params.attemptId,user:req.user._id});
  if(!attempt)throw httpError('Attempt not found',404);
  attempt=await ensureCurrent(attempt);
  if(attempt.status==='in_progress')throw httpError('Complete or submit this quiz before viewing results',409);
  return success(res,resultView(attempt));
});
