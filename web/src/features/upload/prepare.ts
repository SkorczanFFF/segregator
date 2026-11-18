import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { isPdf } from 'shared'

// A photo shrinks to this longer side: about 1 MB, with the text of a receipt still sharp enough to read.
const PHOTO_MAX_SIDE = 2560
// Sharp enough for the preview on a phone screen.
const PREVIEW_WIDTH = 1200

export type PreparedFile = {
  // What goes to S3: a photo as a new JPEG, a PDF as it came.
  file: Blob
  // SHA-256 of the file as picked, in hex. Taken before preparing, so the same file is found again whatever
  // a browser makes of it. The API takes it as sent and compares it only with the account's own files.
  hash: string
  // The first page as an image. A photo is its own preview.
  preview: Blob
  pages: number
}

// What a document is sent with.
export type FileToSend = Pick<PreparedFile, 'file' | 'hash'>

// A photo the browser can't open throws.
export async function prepareFile(file: File, quarterTurns: number): Promise<PreparedFile> {
  const [prepared, hash] = await Promise.all([
    isPdf(file.type) ? preparePdf(file) : preparePhoto(file, quarterTurns),
    sha256(file),
  ])
  return { ...prepared, hash }
}

async function sha256(file: Blob) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// Draws the photo upright by its EXIF, turned clockwise by quarterTurns × 90° and no larger than PHOTO_MAX_SIDE.
// The new JPEG has no EXIF, so the location a phone may have saved in it is gone.
async function preparePhoto(photo: File, quarterTurns: number): Promise<Omit<PreparedFile, 'hash'>> {
  const bitmap = await createImageBitmap(photo, { imageOrientation: 'from-image' })
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const sideways = quarterTurns % 2 === 1
  const canvas = document.createElement('canvas')
  canvas.width = sideways ? height : width
  canvas.height = sideways ? width : height

  const context = canvas.getContext('2d')!
  // JPEG has no transparency, so a PNG gets a white ground.
  context.fillStyle = 'white'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.translate(canvas.width / 2, canvas.height / 2)
  context.rotate((quarterTurns * Math.PI) / 2)
  context.imageSmoothingQuality = 'high'
  context.drawImage(bitmap, -width / 2, -height / 2, width, height)
  bitmap.close()

  const jpeg = await toJpeg(canvas)
  return { file: jpeg, preview: jpeg, pages: 1 }
}

// Draws the first page and counts the pages. A PDF with a password throws.
async function preparePdf(pdf: File): Promise<Omit<PreparedFile, 'hash'>> {
  // pdf.js is large, so it loads only once someone picks a PDF.
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = pdfWorker
  const task = getDocument({ data: await pdf.arrayBuffer() })
  try {
    const doc = await task.promise
    const page = await doc.getPage(1)
    const viewport = page.getViewport({ scale: PREVIEW_WIDTH / page.getViewport({ scale: 1 }).width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    await page.render({ canvas, viewport }).promise
    return { file: pdf, preview: await toJpeg(canvas), pages: doc.numPages }
  } finally {
    await task.destroy()
  }
}

const toJpeg = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas gave no image'))), 'image/jpeg', 0.9),
  )
