import {
  S3Client,
  type S3ClientConfig,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { resolveBucket } from './storage-keys'

function createS3Client() {
  const config: S3ClientConfig = {
    region: process.env.S3_REGION ?? 'us-east-1',
  }

  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT
    config.forcePathStyle = true
  }

  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    }
  }

  return new S3Client(config)
}

const s3 = createS3Client()

export const BUCKETS = {
  public: process.env.S3_BUCKET_PUBLIC ?? 'marinero-public',
  private: process.env.S3_BUCKET_PRIVATE ?? 'marinero-private',
}

export async function uploadFile(
  key: string,
  body: Buffer | Uint8Array | ReadableStream,
  contentType: string,
  bucket?: 'public' | 'private'
) {
  const targetBucket = bucket ?? resolveBucket(key)

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKETS[targetBucket],
      Key: key,
      Body: body as Buffer,
      ContentType: contentType,
    })
  )

  if (targetBucket === 'public') {
    return getPublicUrl(key)
  }

  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKETS.private, Key: key }),
    { expiresIn: 3600 }
  )
}

export function getPublicUrl(key: string): string {
  const base = process.env.NEXT_PUBLIC_STORAGE_URL?.replace(/\/$/, '')
  return `${base}/${key}`
}

export async function getPrivateUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKETS.private, Key: key }),
    { expiresIn }
  )
}

export async function headObject(key: string) {
  const bucket = resolveBucket(key)
  const result = await s3.send(
    new HeadObjectCommand({ Bucket: BUCKETS[bucket], Key: key })
  )
  return {
    contentType: result.ContentType ?? 'application/octet-stream',
    size: result.ContentLength ?? 0,
    etag: result.ETag ?? '',
    bucket,
  }
}

export async function getObjectStream(key: string, range?: string) {
  const bucket = resolveBucket(key)
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKETS[bucket],
      Key: key,
      Range: range,
    })
  )
  return {
    stream: result.Body,
    contentType: result.ContentType ?? 'application/octet-stream',
    contentLength: result.ContentLength,
    contentRange: result.ContentRange,
    etag: result.ETag ?? '',
    statusCode: range ? 206 : 200,
  }
}

export async function fileExists(key: string) {
  try {
    await headObject(key)
    return true
  } catch {
    return false
  }
}

export async function deleteFile(key: string) {
  const bucket = resolveBucket(key)
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKETS[bucket], Key: key }))
}

export async function deletePrefix(prefix: string, bucket: 'public' | 'private' = 'private') {
  const listed = await s3.send(
    new ListObjectsV2Command({ Bucket: BUCKETS[bucket], Prefix: prefix })
  )
  const keys = listed.Contents?.map((o) => ({ Key: o.Key! })) ?? []
  if (keys.length === 0) return
  await s3.send(new DeleteObjectsCommand({ Bucket: BUCKETS[bucket], Delete: { Objects: keys } }))
}

export default s3
