import DailyQuote from '../models/DailyQuote.js';
import Quiz from '../models/Quiz.js';
import Kirtan from '../models/Kirtan.js';
import { env } from '../config/env.js';

export function resolveTimezone(value) {
  const timezone = value || 'UTC';
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }); return timezone; }
  catch { return 'UTC'; }
}
export function localDateParts(now, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const fields = Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return { date: `${fields.year}-${fields.month}-${fields.day}`, month: Number(fields.month), day: Number(fields.day) };
}
export function countdown(now) {
  const startAt = env.COUNTDOWN_START_AT ? new Date(env.COUNTDOWN_START_AT) : null;
  const targetAt = env.COUNTDOWN_TARGET_AT ? new Date(env.COUNTDOWN_TARGET_AT) : null;
  return {
    serverNow: now.toISOString(), startAt: startAt?.toISOString() || null,
    targetAt: targetAt?.toISOString() || null,
    isActive: Boolean(startAt && targetAt && now >= startAt && now < targetAt),
    isCompleted: Boolean(targetAt && now >= targetAt),
    remainingSeconds: targetAt ? Math.max(0, Math.floor((targetAt - now) / 1000)) : null
  };
}
export async function dailyDashboard(now, timezone) {
  const date = localDateParts(now, timezone);
  const [quote, activeQuiz, kirtans] = await Promise.all([
    DailyQuote.findOne({ month: date.month, day: date.day, isActive: true }).lean(),
    Quiz.findOne({ status: 'published', quizDate: date.date, $and: [
      { $or: [{ startAt: null }, { startAt: { $lte: now } }] },
      { $or: [{ endAt: null }, { endAt: { $gt: now } }] }
    ] }).sort({ startAt: 1, _id: 1 }).lean(),
    Kirtan.find({ status: 'published', startsAt: { $gte: new Date(now.getTime() - 48 * 60 * 60 * 1000), $lt: new Date(now.getTime() + 48 * 60 * 60 * 1000) } })
      .sort({ startsAt: 1 }).lean()
  ]);
  const visibleKirtans = kirtans.filter(k => {
    // Show sessions whose actual UTC start falls on user's local calendar day.
    return localDateParts(new Date(k.startsAt), timezone).date === date.date && (!k.endsAt || k.endsAt > now);
  });
  const currentKirtan = visibleKirtans.find(k => new Date(k.startsAt) <= now && (!k.endsAt || k.endsAt > now));
  const upcomingKirtan = visibleKirtans.find(k => new Date(k.startsAt) > now);
  const kirtan = currentKirtan || upcomingKirtan || null;
  return {
    timezone, localDate: date.date,
    quote: quote ? { id: String(quote._id), day: date.day, month: date.month, englishText: quote.englishText, footnoteEnglish: quote.footnoteEnglish, imageUrl: quote.imageUrl || null } : null,
    quiz: { available: Boolean(activeQuiz), quiz: activeQuiz ? {
      id: String(activeQuiz._id), title: activeQuiz.title, description: activeQuiz.description, date: activeQuiz.quizDate,
      startsAt: activeQuiz.startAt?.toISOString() || null, endsAt: activeQuiz.endAt?.toISOString() || null,
      durationSeconds: activeQuiz.durationSeconds, maxMarks: activeQuiz.maxMarks, questionCount: activeQuiz.questions.length,
      questions: activeQuiz.questions.map(question => ({ id: String(question._id), text: question.text, type: question.type, marks: question.marks,
        options: question.options.map(option => ({ id: option.id, text: option.text })) }))
    } : null },
    liveKirtan: { available: Boolean(kirtan), isLive: Boolean(currentKirtan), id: kirtan ? String(kirtan._id) : null,
      title: kirtan?.title || null, platform: kirtan?.platform || null, url: kirtan?.url || null,
      startsAt: kirtan?.startsAt.toISOString() || null, endsAt: kirtan?.endsAt?.toISOString() || null },
    countdown: countdown(now)
  };
}
