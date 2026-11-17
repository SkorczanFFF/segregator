import type { Upload } from 'shared'
import { api, ApiError } from '~/shared/lib/api.ts'

type UploadHandlers = {
  // The draft exists, so the page can keep its id.
  onCreated: (id: string) => void
  onProgress: (percent: number) => void
  // Stops the upload, as when the person cancels.
  signal: AbortSignal
}

// Creates a draft for the file, sends the file straight to S3 through a form the API signs, and reports
// the file sent, so the draft shows as processing. Answers the draft's id.
export async function uploadDraft(file: Blob, { onCreated, onProgress, signal }: UploadHandlers) {
  const { id, url, fields } = await api.post<Upload>('/documents/upload', { fileType: file.type })
  try {
    // Cancelled while the draft was being made.
    signal.throwIfAborted()
    onCreated(id)
    await sendFile(file, { url, fields }, onProgress, signal)
  } catch (err) {
    // Without its file the draft would only wait to expire, so a retry starts clean.
    await api.delete(`/documents/${id}`).catch(() => undefined)
    throw err
  }
  // Only shows the stage sooner: the worker takes the file even without this report.
  await api.post(`/documents/${id}/sent`).catch(() => undefined)
  return id
}

// XMLHttpRequest, because fetch doesn't report upload progress.
function sendFile(file: Blob, form: Pick<Upload, 'url' | 'fields'>, onProgress: (percent: number) => void, signal: AbortSignal) {
  const body = new FormData()
  for (const [name, value] of Object.entries(form.fields)) body.append(name, value)
  // S3 ignores fields that come after the file.
  body.append('file', file)

  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    request.onload = () => (request.status < 300 ? resolve() : reject(new ApiError('internal_error')))
    request.onerror = () => reject(new ApiError('network_error'))
    request.onabort = () => reject(signal.reason)
    signal.addEventListener('abort', () => request.abort(), { once: true })
    request.open('POST', form.url)
    request.send(body)
  })
}
