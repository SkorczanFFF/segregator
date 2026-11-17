import { DeleteObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { FILE_MAX_SIZE, type FileType, type Upload } from 'shared'

const s3 = new S3Client({})
const BUCKET = process.env.DOCUMENTS_BUCKET ?? ''

// How long the browser has to start sending a file.
export const UPLOAD_SECONDS = 600

// A document's id is a ULID.
export const ID_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}'

// The key starts from the account, so an id from the browser can only point at its own files.
const fileKey = (sub: string, id: string) => `raw/${sub}/${id}`
const FILE_KEY = new RegExp(`^raw/([^/]+)/(${ID_PATTERN})$`)

// The account and document of a key in the bucket, or undefined for any other key.
export function parseFileKey(key: string) {
  const [, sub, id] = FILE_KEY.exec(key) ?? []
  return sub && id ? { sub, id } : undefined
}

// A form the browser posts straight to S3. Every field is signed, so S3 takes only this key and type.
export async function signUpload(sub: string, id: string, type: FileType): Promise<Upload> {
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: fileKey(sub, id),
    Conditions: [['content-length-range', 1, FILE_MAX_SIZE]],
    Fields: { 'Content-Type': type },
    Expires: UPLOAD_SECONDS,
  })
  return { id, url, fields }
}

// The whole file with the type the upload was signed for. Files are at most FILE_MAX_SIZE.
export async function readFile(sub: string, id: string) {
  const { Body, ContentType } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id) }))
  return { type: ContentType ?? '', bytes: (await Body?.transformToByteArray()) ?? new Uint8Array() }
}

// A short-lived address of the file itself, for an img tag or a new tab.
export const fileUrl = (sub: string, id: string) =>
  getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id) }), { expiresIn: 300 })

export async function deleteFile(sub: string, id: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id) }))
}
