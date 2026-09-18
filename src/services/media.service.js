import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { unlink } from 'node:fs/promises';

const required = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_BASE_URL'];
function client() {
  if (required.some(key => !process.env[key])) throw Object.assign(new Error('Media storage is not configured yet'), { statusCode: 503 });
  return new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
}
export async function uploadProfileImage(userId, file) {
  if (!file?.buffer) throw Object.assign(new Error('Profile image file is required'), { statusCode: 400 });
  const extension = file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const key = `profiles/${userId}/${Date.now()}.${extension}`;
  await client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }));
  return `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
}

export async function uploadHubMedia(userId, type, file) {
  if (!file?.path) throw Object.assign(new Error('Media file is required'), { statusCode: 400 });
  const extensionByMime = {
    'video/mp4': 'mp4', 'video/quicktime': 'mov',
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'
  };
  const extension = extensionByMime[file.mimetype];
  if (!extension) throw Object.assign(new Error('Unsupported media type'), { statusCode: 415 });
  const key = `connection-hub/${userId}/${type}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
  try {
    await client().send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key, Body: createReadStream(file.path), ContentType: file.mimetype, ContentLength: file.size }));
    return `${process.env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`;
  } finally {
    await unlink(file.path).catch(() => {});
  }
}
