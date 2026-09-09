import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
