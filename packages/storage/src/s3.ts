import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import type { StorageDriver } from './driver';

// S3-compatible object store (RustFS in the Compose stacks). Config comes from env.
// forcePathStyle is required for RustFS (and most self-hosted S3 gateways) because
// they do not serve virtual-host-style buckets; hosted stores that only serve
// virtual-host-style buckets set S3_FORCE_PATH_STYLE=false. region is sent but
// ignored by RustFS; a value is still required by the SDK.

export function createS3Driver(env: NodeJS.ProcessEnv = process.env): StorageDriver {
  let cached: { client: S3Client; bucket: string } | null = null;

  function getClient(): { client: S3Client; bucket: string } {
    if (cached) return cached;
    const endpoint = env.S3_ENDPOINT;
    const bucket = env.S3_BUCKET;
    const accessKeyId = env.S3_ACCESS_KEY_ID;
    const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error(
        'S3 storage is not configured: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.',
      );
    }
    cached = {
      client: new S3Client({
        endpoint,
        region: env.S3_REGION || 'us-east-1',
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: env.S3_FORCE_PATH_STYLE !== 'false',
      }),
      bucket,
    };
    return cached;
  }

  return {
    async put(key, body, contentType) {
      const { client, bucket } = getClient();
      await client.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
      );
    },
    async get(key) {
      const { client, bucket } = getClient();
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (!res.Body) throw new Error(`Object '${key}' has no body`);
      return {
        body: (res.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream(),
        contentType: res.ContentType || 'application/octet-stream',
        contentLength: res.ContentLength,
      };
    },
    async delete(key) {
      const { client, bucket } = getClient();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}
