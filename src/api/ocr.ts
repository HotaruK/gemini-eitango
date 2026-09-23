import { assertGeminiApiKey, GeminiError, generateGeminiJson, type GeminiInlineImage } from './gemini'

const OCR_TIMEOUT_MS = 45000
const OCR_TIMEOUT_MESSAGE = `Geminiからの応答がありませんでした(${OCR_TIMEOUT_MS / 1000}秒でタイムアウト)。しばらくして再試行してください。`

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    text: {
      type: 'string',
      description: 'All English text in image, transcribed exactly. No text found? Empty string.',
    },
  },
  required: ['text'],
}

/**
 * 画像内の英文を書き起こす。翻訳・解析はしない(読み取り結果をユーザーが確認・編集してから
 * analyzePassageに渡す2段構成にして、誤読の修正や不要部分の削除をできるようにしている)。
 */
export async function extractTextFromImage(
  image: GeminiInlineImage,
  apiKey: string,
  model?: string,
): Promise<string> {
  assertGeminiApiKey(apiKey)

  const prompt = `You OCR bot. Transcribe English text in image exactly as written. Keep original spelling, slang, typo. No translate, no fix, no explain.

Rules:
- Keep reading order. Paragraph break = blank line.
- Chat, comic speech bubble, SNS post, dialogue: one line per speaker turn. Speaker name visible? Write "Name: text".
- Skip UI junk: button label, like count, timestamp, menu, ad.
- Word hyphen-split across line end? Join back.

Output: JSON per schema.`

  const parsed = await generateGeminiJson({
    apiKey,
    model,
    prompt,
    images: [image],
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0,
    maxOutputTokens: 8192,
    timeoutMs: OCR_TIMEOUT_MS,
    timeoutMessage: OCR_TIMEOUT_MESSAGE,
    emptyResponseMessage: 'Geminiから有効な応答が得られませんでした。画像を変えてお試しください。',
  })

  const text = typeof parsed.text === 'string' ? parsed.text.trim() : ''
  if (!text) {
    throw new GeminiError('画像から英文を読み取れませんでした。文字がはっきり写った画像でお試しください。')
  }
  return text
}
