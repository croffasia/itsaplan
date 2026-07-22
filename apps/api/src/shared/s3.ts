import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

// S3-compatible object store (MinIO) for issue attachments. Only the file
// bytes live here; the metadata and object key are rows in issue_attachment
// (see ../attachments/store.ts).
//
// Config comes from env. forcePathStyle is required for MinIO (and most
// self-hosted S3 gateways) because they do not serve virtual-host-style buckets.
// region is sent but ignored by MinIO; a value is still required by the SDK.

let cached: { client: S3Client; bucket: string } | null = null;

function getClient(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 storage is not configured: set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY.',
    );
  }
  cached = {
    client: new S3Client({
      endpoint,
      region: process.env.S3_REGION || 'us-east-1',
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
    }),
    bucket,
  };
  return cached;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

// Returns a web ReadableStream of the object body so a route can stream it to
// the client without buffering the whole file (matters for video). contentType
// and contentLength fall back to sensible defaults when the store omits them.
export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string; contentLength?: number }> {
  const { client, bucket } = getClient();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Object '${key}' has no body`);
  return {
    body: (res.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream(),
    contentType: res.ContentType || 'application/octet-stream',
    contentLength: res.ContentLength,
  };
}

// Reads a whole object into a UTF-8 string. For small text objects (skill
// markdown and references); do not use for large binaries — it buffers fully.
export async function getObjectText(key: string): Promise<string> {
  const { body } = await getObject(key);
  return new Response(body).text();
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// Deletes several objects, best-effort (a failed delete only orphans bytes).
export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      deleteObject(key).catch((err) => {
        console.error(`[planner] failed to delete object ${key}:`, err);
      }),
    ),
  );
}
