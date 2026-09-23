import type { GeminiInlineImage } from '../api/gemini'

/** OCR用途なら長辺1600pxで文字は十分読める。スマホ写真(数MB)をそのまま送ると遅く、無料枠のトークンも食う。 */
const MAX_EDGE_PX = 1600
const JPEG_QUALITY = 0.85

/**
 * 画像ファイルを長辺MAX_EDGE_PX以下に縮小し、JPEGのbase64に変換する。
 * 透過PNG(スクショ等)は背景が黒になると文字が読めなくなるため白で塗ってから描画する。
 */
export async function prepareImageForGemini(file: Blob): Promise<GeminiInlineImage> {
  if (!file.type.startsWith('image/')) {
    throw new Error('画像ファイルを選択してください。')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('画像を読み込めませんでした。別の形式(JPEG/PNG)でお試しください。')
  }

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('画像の変換に失敗しました。')
  }
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  return { mimeType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
