import mongoose from 'mongoose';
import Master from '../models/QuestionBankMaster.js';
import Question from '../models/QuestionBank.js';
import CmsAuditLog from '../models/CmsAuditLog.js';
const ok = (res, data) => res.json({ success: true, statusCode: 200, message: 'Success', data });
const fail = (res, message, code = 422) => res.status(code).json({ success: false, statusCode: code, message, data: null });
const valid = id => mongoose.isValidObjectId(id);
const audit = (req, action, resource, row) => CmsAuditLog.create({ admin: req.cmsAdmin.id, action, resource, resourceId: String(row._id), after: { title: row.title || row.text?.slice(0, 80) } });
function parseQuestion(q) { if (!q || typeof q.text !== 'string' || !q.text.trim() || q.text.length > 2000 || !['single_choice', 'multiple_choice'].includes(q.type) || !Array.isArray(q.options) || q.options.length !== 4) throw Error('Invalid question'); const options = q.options.map((o, i) => ({ id: 'abcd'[i], text: String(o.text || '').trim() })); const keys = q.correctOptionIds; if (options.some(o => !o.text || o.text.length > 500) || !Array.isArray(keys) || keys.length < 1 || new Set(keys).size !== keys.length || keys.some(x => !options.some(o => o.id === x)) || (q.type === 'single_choice' && keys.length !== 1) || !Number.isInteger(Number(q.marks)) || Number(q.marks) < 1 || Number(q.marks) > 100) throw Error('Invalid question options or answers'); return { text: q.text.trim(), type: q.type, options, correctOptionIds: keys, marks: Number(q.marks), explanation: String(q.explanation || '').slice(0, 3000), isActive: q.isActive !== false }; }
export async function masters(req, res) { const items = await Master.find().sort({ title: 1, chapter: 1, topic: 1 }).lean(); return ok(res, { items: items.map(x => ({ ...x, id: String(x._id) })) }); }
export async function saveMaster(req, res) { const { title, chapter = '', topic = '', description = '', isActive = true } = req.body || {}; if (!String(title || '').trim() || String(title).length > 180 || String(chapter).length > 180 || String(topic).length > 180) return fail(res, 'Invalid title/chapter/topic'); if (req.params.id && !valid(req.params.id)) return fail(res, 'Invalid master id'); try { const row = req.params.id ? await Master.findById(req.params.id) : new Master(); if (!row) return fail(res, 'Master not found', 404); Object.assign(row, { title: String(title).trim(), chapter: String(chapter).trim(), topic: String(topic).trim(), description: String(description).slice(0, 2000), isActive: Boolean(isActive) }); await row.save(); await audit(req, req.params.id ? 'edit' : 'create', 'QuestionBankMaster', row); return ok(res, { id: String(row.id) }); } catch (e) { if (e.code === 11000) return fail(res, 'This title/chapter/topic already exists', 409); throw e; } }
export async function questions(req, res) {
    const {
        masterId,
        q = '',
        page = '1',
        limit = '50',
        active
    } = req.query;

    const filter = {};

    if (masterId) {
        if (!valid(masterId)) {
            return fail(res, 'Invalid masterId');
        }

        filter.master = masterId;
    }

    // Fixed regex for MongoDB question search
    if (q) {
        const escapedQuery = String(q)
            .slice(0, 100)
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

        filter.text = {
            $regex: escapedQuery,
            $options: 'i'
        };
    }

    if (active === 'true') {
        filter.isActive = true;
    }

    const p = Math.max(1, Number(page) || 1);
    const n = Math.min(100, Math.max(1, Number(limit) || 50));

    const [items, total] = await Promise.all([
        Question.find(filter)
            .sort({ _id: -1 })
            .skip((p - 1) * n)
            .limit(n)
            .lean(),

        Question.countDocuments(filter)
    ]);

    return ok(res, {
        items: items.map(x => ({
            ...x,
            id: String(x._id),
            masterId: String(x.master)
        })),
        pagination: {
            page: p,
            limit: n,
            total
        }
    });
}
export async function saveQuestion(req, res){ try { const masterId = req.body?.masterId; if (!valid(masterId) || !await Master.exists({ _id: masterId })) return fail(res, 'Valid masterId required'); const parsed = parseQuestion(req.body); if (req.params.id && !valid(req.params.id)) return fail(res, 'Invalid question id'); const row = req.params.id ? await Question.findById(req.params.id) : new Question(); if (!row) return fail(res, 'Question not found', 404); Object.assign(row, { ...parsed, master: masterId }); await row.save(); await audit(req, req.params.id ? 'edit' : 'create', 'QuestionBank', row); return ok(res, { id: String(row.id) }); } catch (e) { return fail(res, e.message); } }
    export async function bulkQuestions(req, res) { const { masterId, questions: rows } = req.body || {}; if (!valid(masterId) || !await Master.exists({ _id: masterId }) || !Array.isArray(rows) || rows.length < 1 || rows.length > 100) return fail(res, 'Invalid master or bulk questions (max 100)'); let parsed; try { parsed = rows.map(q => ({ ...parseQuestion(q), master: masterId })); } catch (e) { return fail(res, e.message); } const inserted = await Question.insertMany(parsed, { ordered: true }); for (const row of inserted) await audit(req, 'create', 'QuestionBank', row); return ok(res, { ids: inserted.map(x => String(x.id)) }); }
    export async function pdf(req, res) { const { masterId, ids, withAnswers } = req.query; if (!masterId || !valid(masterId)) return fail(res, 'Valid masterId required'); const master = await Master.findById(masterId).lean(); if (!master) return fail(res, 'Master not found', 404); const filter = { master: masterId }; if (ids) { const idList = String(ids).split(','); if (idList.length > 200 || idList.some(x => !valid(x))) return fail(res, 'Invalid question ids'); filter._id = { $in: idList }; } const list = await Question.find(filter).sort({ _id: 1 }).limit(200).lean(); if (!list.length) return fail(res, 'No questions to export', 404); const { default: PDFDocument } = await import('pdfkit'); const doc = new PDFDocument({ size: 'A4', margin: 45, bufferPages: true }); res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="question-bank-${masterId}.pdf"`); doc.pipe(res); doc.font('Helvetica-Bold').fontSize(17).text(master.title); doc.font('Helvetica').fontSize(10).text([master.chapter, master.topic].filter(Boolean).join(' | ')); doc.moveDown(); list.forEach((q, i) => { doc.font('Helvetica-Bold').fontSize(11).text(`${i + 1}. ${q.text}`); doc.font('Helvetica').fontSize(10); q.options.forEach(o => doc.text(`   ${o.id.toUpperCase()}. ${o.text}`)); if (withAnswers === 'true') { doc.font('Helvetica-Bold').text(`Answer: ${q.correctOptionIds.join(', ').toUpperCase()}`); if (q.explanation) doc.font('Helvetica').text(q.explanation); } doc.moveDown(.7); }); doc.end(); }
