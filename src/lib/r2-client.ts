import { S3Client } from '@aws-sdk/client-s3';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const r2Endpoint = process.env['R2_ENDPOINT'] ||
  `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`;

const s3Client = new S3Client({
  region: 'auto',
  endpoint: r2Endpoint,
  credentials: {
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
  },
  requestHandler: {
    requestTimeout: 30_000,
    connectionTimeout: 10_000,
  },
});

export const r2Bucket = requireEnv('R2_BUCKET_NAME');
export { s3Client };
