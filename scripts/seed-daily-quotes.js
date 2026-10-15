import 'dotenv/config';
import fs from 'node:fs';
import mongoose from 'mongoose';
import DailyQuote from '../src/models/DailyQuote.js';
const source = process.argv[2];
if (!source) { console.error('Usage: node scripts/seed-daily-quotes.js <quotes.json>'); process.exit(1); }
const entries = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!Array.isArray(entries)) throw new Error('Expected JSON array');
const keys = new Set();
for (const q of entries) {
  if (!Number.isInteger(q.month) || q.month < 1 || q.month > 12 || !Number.isInteger(q.day) || q.day < 1 || q.day > new Date(Date.UTC(2024, q.month, 0)).getUTCDate() || !q.englishText?.trim()) throw new Error('Invalid quote date or text');
  const key = `${q.month}-${q.day}`;
  if (keys.has(key)) throw new Error(`Duplicate date ${key}`);
  keys.add(key);
}
try {
  await mongoose.connect(process.env.MONGODB_URI);
  const ops = entries.map(q => ({ updateOne: { filter: { month: q.month, day: q.day }, update: { $set: { englishText: q.englishText, footnoteEnglish: q.footnoteEnglish || '', isActive: true }, $setOnInsert: { month: q.month, day: q.day } }, upsert: true } }));
  const result = await DailyQuote.bulkWrite(ops, { ordered: false });
  console.log({ count: entries.length, inserted: result.upsertedCount, modified: result.modifiedCount });
} finally { await mongoose.disconnect(); }
