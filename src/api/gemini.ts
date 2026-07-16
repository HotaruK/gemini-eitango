import type { WordType } from '../types'

export const DEFAULT_MODEL = 'gemini-flash-lite-latest'

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
      description: 'Kind. Normal word=word. Fixed saying=idiom. Slang=slang. Meme=meme. Other phrase=phrase.',
    },
    meaningJa: { type: 'string', description: 'Meaning. Japanese. Short.' },
    definitionEn: { type: 'string', description: 'Definition. English. Dictionary style.' },
    examples: {
      type: 'array',
      items: { type: 'string' },
      description: 'Example sentence(s), real usage. 1 to 3.',
    },
    note: {
      type: 'string',
      description: 'Nuance, context, how casual. Slang/meme/idiom: origin story too. Japanese.',
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
    ? `\nDict say: "${opts.dictionaryDefinitionEn}". Use this too.`
    : ''
  const passageBlock = opts?.contextText
    ? `\nWord in this text. Many meaning? Pick meaning fit here:\n"""${opts.contextText}"""`
    : ''

  const prompt = `You dictionary bot for English learner. Look up: "${term}"

Maybe normal word. Maybe slang, meme, idiom, phrasal saying. Slang or meme? Give origin, where used (SNS, chat, community).${contextLine}${passageBlock}

Output: JSON per schema. Text language: Japanese.`

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
