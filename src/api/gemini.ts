import type { WordType } from '../types'

export const DEFAULT_MODEL = 'gemini-flash-latest'

export interface GeminiWordInfo {
  type: WordType
  meaningJa: string
  definitionEn: string
  examples: string[]
  note: string
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    type: {
      type: 'string',
      enum: ['word', 'idiom', 'slang', 'meme', 'phrase'],
      description: '見出し語の種別。通常の単語はword、決まり文句はidiom、俗語はslang、ネットミーム由来はmeme、その他の成句はphrase',
    },
    meaningJa: { type: 'string', description: '日本語での意味(簡潔に)' },
    definitionEn: { type: 'string', description: '英語での定義(英英辞典的な説明)' },
    examples: {
      type: 'array',
      items: { type: 'string' },
      description: '実際の使用例文(1〜3個)',
    },
    note: {
      type: 'string',
      description:
        'ニュアンス、使われる文脈、口語度、そしてスラング・ミーム・イディオムの場合は由来や元ネタの説明(日本語)',
    },
  },
  required: ['type', 'meaningJa', 'definitionEn', 'examples', 'note'],
}

export class GeminiError extends Error {}

export async function fetchWordInfo(
  term: string,
  apiKey: string,
  opts?: { dictionaryDefinitionEn?: string; model?: string; contextText?: string },
): Promise<GeminiWordInfo> {
  if (!apiKey) {
    throw new GeminiError('Gemini APIキーが設定されていません。設定画面で入力してください。')
  }

  const model = opts?.model?.trim() || DEFAULT_MODEL
  const contextLine = opts?.dictionaryDefinitionEn
    ? `\n参考: 英英辞典によるとこの語の定義は "${opts.dictionaryDefinitionEn}" です。この情報も踏まえてください。`
    : ''
  const passageBlock = opts?.contextText
    ? `\n\nこの語は次の文章の中で使われています。複数の意味を持つ語の場合は、この文脈における意味を優先してください:\n"""\n${opts.contextText}\n"""`
    : ''

  const prompt = `あなたは英語学習アプリの辞書アシスタントです。次の英単語・熟語・成句・スラング・ミームについて調べてください: "${term}"

これは通常の英単語だけでなく、口語表現・ネットスラング・ミーム的な言い回し・イディオムである可能性があります。もし俗語やミームなら、その由来・元ネタ・使われる場面(SNS、会話、特定のコミュニティなど)も含めてください。${contextLine}${passageBlock}

指定されたJSONスキーマの形式で日本語を交えて回答してください。`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.4,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 400 || res.status === 404) {
      throw new GeminiError(
        `Geminiリクエストが失敗しました(${res.status})。APIキーまたはモデル名(${model})を設定画面で確認してください。`,
      )
    }
    if (res.status === 429) {
      throw new GeminiError('Geminiの無料枠のレート制限に達しました。しばらく待って再試行してください。')
    }
    throw new GeminiError(`Gemini APIエラー(${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new GeminiError('Geminiから有効な応答が得られませんでした。')
  }

  try {
    const parsed = JSON.parse(text)
    return {
      type: parsed.type ?? 'word',
      meaningJa: parsed.meaningJa ?? '',
      definitionEn: parsed.definitionEn ?? '',
      examples: Array.isArray(parsed.examples) ? parsed.examples.slice(0, 3) : [],
      note: parsed.note ?? '',
    }
  } catch {
    throw new GeminiError('Geminiの応答の解析に失敗しました。')
  }
}
