import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

export const S3_BUCKET = process.env.S3_BUCKET ?? 'pge-shop-attachments'

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  },
  forcePathStyle: !!process.env.S3_ENDPOINT, // required for MinIO; must be off for real AWS S3
})

export async function uploadAttachment(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  }))
}

export async function getAttachmentDownloadUrl(key: string, filename: string, expiresIn = 300) {
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    // Force a download instead of inline rendering, regardless of the
    // object's stored content-type (which originates from an upload-time
    // MIME sniff, not raw client input, but this is cheap defense in depth).
    ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, '')}"`,
  }), { expiresIn })
}

export async function deleteAttachment(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}
