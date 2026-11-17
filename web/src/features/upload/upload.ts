import type { DocumentInput, Upload } from 'shared'
import { api, ApiError } from '~/shared/lib/api.ts'

export type OnProgress = (percent: number) => void

// Creates the document, then sends its file straight to S3 through a form the API signs.
export async function uploadDocument(input: DocumentInput, file: Blob, onProgress: OnProgress) {
  const { id, url, fields } = await api.post<Upload>('/documents/upload', { ...input, fileType: file.type })
  const body = new FormData()
  for (const [name, value] of Object.entries(fields)) body.append(name, value)
  // S3 ignores fields that come after the file.
  body.append('file', file)

  // XMLHttpRequest, because fetch doesn't report upload progress.
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => (request.status < 300 ? resolve() : reject(new ApiError('internal_error')))
    request.onerror = () => reject(new ApiError('network_error'))
    request.open('POST', url)
    request.send(body)
  }).catch(async (err: unknown) => {
    // Without its file the document would only wait to expire, so a retry starts clean.
    await api.delete(`/documents/${id}`).catch(() => undefined)
    throw err
  })
}
