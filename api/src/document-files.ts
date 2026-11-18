import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { FILE_CHANGES, FILE_VERSIONS, type FileChange, type FileType, type FileVersion, type Upload } from 'shared'

const s3 = new S3Client({})
const BUCKET = process.env.DOCUMENTS_BUCKET ?? ''

// How long the browser has to start sending a file.
const UPLOAD_SECONDS = 600

// How long an address of a file works.
export const FILE_URL_SECONDS = 300

// A document's id is a ULID.
export const ID_PATTERN = '[0-9A-HJKMNP-TV-Z]{26}'

// Each version of a file sits under its own prefix. The key starts from the account, so an id from the browser
// can only point at its own files.
const fileKey = (sub: string, id: string, version: FileVersion = 'raw') => `${version}/${sub}/${id}`
const FILE_KEY = new RegExp(`^(${FILE_VERSIONS.join('|')})/([^/]+)/(${ID_PATTERN})$`)

// The version, account and document of a key in the bucket, or undefined for any other key.
export function parseFileKey(key: string) {
  const [, version, sub, id] = FILE_KEY.exec(key) ?? []
  return version && sub && id ? { version: version as FileVersion, sub, id } : undefined
}

// A form the browser posts straight to S3. Every field is signed, so S3 takes only this key and type, and a
// file no larger than the size the storage limit was checked against.
export async function signUpload(sub: string, id: string, type: FileType, size: number): Promise<Upload> {
  const { url, fields } = await createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: fileKey(sub, id),
    Conditions: [['content-length-range', 1, size]],
    Fields: { 'Content-Type': type },
    Expires: UPLOAD_SECONDS,
  })
  return { id, url, fields }
}

// The whole file, as sent unless another version is asked for, with its type. Files are at most FILE_MAX_SIZE.
export async function readFile(sub: string, id: string, version: FileVersion = 'raw') {
  const { Body, ContentType } = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id, version) }))
  return { type: ContentType ?? '', bytes: (await Body?.transformToByteArray()) ?? new Uint8Array() }
}

// What preprocessing did to the photo, from the processed copy's metadata. Nothing for a copy of the original.
export async function readChange(sub: string, id: string): Promise<FileChange | undefined> {
  const { Metadata } = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id, 'processed') }))
  return FILE_CHANGES.find((change) => change === Metadata?.change)
}

// A short-lived address of one version of the file, for an img tag or a new tab.
export const fileUrl = (sub: string, id: string, version: FileVersion) =>
  getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id, version) }), { expiresIn: FILE_URL_SECONDS })

// Deletes every file of the account under each version's prefix, files left by a failed upload too. Each stays
// as an older version until the bucket's lifecycle removes it.
export async function deleteAccountFiles(sub: string) {
  for (const version of FILE_VERSIONS) {
    let token: string | undefined
    do {
      const page = await s3.send(
        new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${version}/${sub}/`, ContinuationToken: token }),
      )
      const files = (page.Contents ?? []).flatMap(({ Key }) => (Key ? [{ Key }] : []))
      if (files.length > 0) {
        const { Errors } = await s3.send(new DeleteObjectsCommand({ Bucket: BUCKET, Delete: { Objects: files, Quiet: true } }))
        if (Errors?.length) throw new Error(`S3 kept ${Errors.length} files of an account being deleted`)
      }
      token = page.NextContinuationToken
    } while (token)
  }
}

// Both copies of a document's file, as sent and processed. The bucket keeps each as an older version for a
// while, as the stack sets. S3 deletes a missing key without error.
export async function deleteFiles(sub: string, id: string) {
  await Promise.all(
    FILE_VERSIONS.map((version) =>
      s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: fileKey(sub, id, version) })),
    ),
  )
}
