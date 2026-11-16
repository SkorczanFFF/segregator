import type { Upload } from 'shared'
import { api, ApiError } from '~/shared/lib/api.ts'

// Sends the file straight to S3 through a form the API signs, and returns the file's id.
export async function uploadFile(file: File, onProgress: (percent: number) => void) {
  const { id, url, fields } = await api.post<Upload>('/documents/upload', { type: file.type })
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
  })
  return id
}
