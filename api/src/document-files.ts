import { DeleteObjectCommand, HeadObjectCommand, NotFound, S3Client } from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { FILE_MAX_SIZE, type DocumentFile, type FileType, type Upload } from 'shared'
import { ulid } from 'ulid'

const s3 = new S3Client({})
const BUCKET = process.env.DOCUMENTS_BUCKET ?? ''

// The key starts from the account, so an id from the browser can only point at its own files.
const fileKey = (sub: string, id: string) => `raw/${sub}/${id}`

// A form the browser posts straight to S3. Every field is signed, so S3 takes only this key and type.
export async function signUpload(sub: string, type: FileType): Promise<Upload> {
  const id = ulid()
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: fileKey(sub, id),
    Conditions: [['content-length-range', 1, FILE_MAX_SIZE]],
    Fields: { 'Content-Type': type },
    Expires: 600,
  })
  return { id, url, fields }
}

// What S3 holds under this id. Undefined means the file never arrived.
export async function fileInfo(sub: string, id: string): Promise<DocumentFile | undefined> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id) }))
    return { type: head.ContentType as FileType, size: head.ContentLength ?? 0 }
  } catch (err) {
    if (err instanceof NotFound) return undefined
    throw err
  }
}

export async function deleteFile(sub: string, id: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id) }))
}
