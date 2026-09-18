import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PassThrough } from 'node:stream';
import { createAccessToken, createOtpProof, verifyOtpProof } from '../src/services/token.service.js';
import { downloadCertificate } from '../src/controllers/profile.controller.js';
import { validate } from '../src/routes/hub.routes.js';
import { z } from 'zod';

test('OTP proof is bound to destination and channel', () => {
  const token = createOtpProof('devotee@example.com', 'email');
  assert.equal(verifyOtpProof(token, 'devotee@example.com', 'email'), true);
  assert.equal(verifyOtpProof(token, 'another@example.com', 'email'), false);
});

test('access token can be created', () => {
  assert.equal(typeof createAccessToken({ id: '507f1f77bcf86cd799439011', role: 'devotee' }), 'string');
});

test('certificate endpoint produces a PDF', async () => {
  const output = new PassThrough();
  const chunks = [];
  const headers = {};
  output.setHeader = (key, value) => { headers[key] = value; };
  output.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => { output.on('end', resolve); output.on('error', reject); });
  downloadCertificate({ user: { name: 'Test Devotee', initiationName: 'Test Dasa', registrationId: 'PPA-2026-TEST', createdAt: new Date('2026-09-18T00:00:00Z') } }, output);
  await done;
  const pdf = Buffer.concat(chunks);
  assert.equal(headers['Content-Type'], 'application/pdf');
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(pdf.length > 10_000);
});

test('Postman collection is valid JSON and certificate asset exists', () => {
  const collection = JSON.parse(fs.readFileSync('Prabhupadanuga-Phase-1.postman_collection.json', 'utf8'));
  assert.equal(collection.info.name, 'Prabhupadanuga Phase 1 APIs');
  assert.equal(fs.existsSync('src/assets/prabhupadanuga-certificate-background.png'), true);
});

test('query validation works with Express 5 getter-only req.query', () => {
  const req = {};
  Object.defineProperty(req, 'query', { get: () => ({ page: '2' }) });
  let error;
  validate(z.object({ page: z.coerce.number().int().default(1) }), 'query')(req, {}, value => { error = value; });
  assert.equal(error, undefined);
  assert.deepEqual(req.validatedQuery, { page: 2 });
});
