import { fetchWithTimeout } from '../utils/fetchWithTimeout'
import type { WordType } from '../types'

export const DEFAULT_MODEL = 'gemini-flash-lite-latest'

const GEMINI_TIMEOUT_MS = 30000
const GEMINI_TIMEOUT_MESSAGE = `Geminiからの応答がありませんでした(${GEMINI_TIMEOUT_MS / 1000}秒でタイムアウト)。ネットワーク状況を確認して再試行してください。`

export interface GeminiWordInfo {
  type: WordType
  meaningJa: string
  definitionEn: string
  examples: string[]
  note: string
}

export class GeminiError extends Error {}

export interface RelatedTerm {
  term: string
  meaningJa: string
}

export interface RelatedTermsResult {
  synonyms: RelatedTerm[]
  idioms: RelatedTerm[]
}

const RELATED_TERM_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    term: { type: 'string', description: 'The word, phrase, or idiom text.' },
    meaningJa: { type: 'string', description: 'Short meaning. Japanese.' },
  },
  required: ['term', 'meaningJa'],
}

const RELATED_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    synonyms: {
      type: 'array',
      items: RELATED_TERM_ITEM_SCHEMA,
      description: 'Words or short phrases with a similar meaning. Up to 10.',
    },
    idioms: {
      type: 'array',
      items: RELATED_TERM_ITEM_SCHEMA,
      description: 'Idioms or set phrases that use this word. Up to 10.',
    },
  },
  required: ['synonyms', 'idioms'],
}

export interface BatchTermInput {
  term: string
  dictionaryDefinitionEn?: string
}

const BATCH_ITEM_SCHEMA = {
  type: 'object',
  properties: {
    term: { type: 'string', description: 'Echo back the input term text exactly, unchanged.' },
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
  required: ['term', 'type', 'meaningJa', 'definitionEn', 'examples', 'note'],
}

const BATCH_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: BATCH_ITEM_SCHEMA,
      description: 'One entry per input term. Same order and same count as input.',
    },
  },
  required: ['results'],
}

export function assertGeminiApiKey(apiKey: string): void {
  if (!apiKey) {
    throw new GeminiError('Gemini APIキーが設定されていません。設定画面で入力してください。')
  }
}

const DEFAULT_EMPTY_RESPONSE_MESSAGE = 'Geminiから有効な応答が得られませんでした。'

export interface GeminiInlineImage {
  mimeType: string
  /** data URLの接頭辞を除いたbase64文字列 */
  data: string
}

interface GenerateGeminiJsonOptions {
  apiKey: string
  model?: string
  prompt: string
  images?: GeminiInlineImage[]
  responseSchema: object
  temperature: number
  maxOutputTokens?: number
  timeoutMs: number
  timeoutMessage: string
  emptyResponseMessage?: string
}

/**
 * Gemini generateContent APIを叩き、JSONスキーマ応答をパースして返す共通処理。
 * リクエスト組み立て・タイムアウト・HTTPエラー種別ごとのメッセージ・応答パースは
 * 呼び出し元(fetchWordInfoBatch / fetchRelatedTerms / analyzePassage / extractTextFromImage)で共通のため、ここに集約する。
 */
export async function generateGeminiJson(opts: GenerateGeminiJsonOptions): Promise<any> {
  const model = opts.model?.trim() || DEFAULT_MODEL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(opts.apiKey)}`

  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              ...(opts.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
              { text: opts.prompt },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: opts.responseSchema,
          temperature: opts.temperature,
          maxOutputTokens: opts.maxOutputTokens,
        },
      }),
    },
    opts.timeoutMs,
    opts.timeoutMessage,
  )

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
    throw new GeminiError(opts.emptyResponseMessage ?? DEFAULT_EMPTY_RESPONSE_MESSAGE)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new GeminiError('Geminiの応答の解析に失敗しました。')
  }
}

/**
 * 複数語を1リクエストにまとめて問い合わせる。単語数分だけ並列にAPIを叩くとGeminiの
 * レート制限(429)に当たりやすいため、検索語数によらず常に1回のリクエストで済ませる。
 */
export async function fetchWordInfoBatch(
  terms: BatchTermInput[],
  apiKey: string,
  opts?: { model?: string; contextText?: string },
): Promise<GeminiWordInfo[]> {
  assertGeminiApiKey(apiKey)
  if (terms.length === 0) return []

  const passageBlock = opts?.contextText
    ? `\nWords appear in this text. Many meaning? Pick meaning fit here:\n"""${opts.contextText}"""`
    : ''

  const termLines = terms
    .map((t, i) => {
      const dict = t.dictionaryDefinitionEn ? ` | Dict says: "${t.dictionaryDefinitionEn}"` : ''
      return `${i + 1}. "${t.term}"${dict}`
    })
    .join('\n')

  const prompt = `You dictionary bot for English learner. Look up each term below. Maybe normal word. Maybe slang, meme, idiom, phrasal saying. Slang or meme? Give origin, where used (SNS, chat, community).${passageBlock}

Terms (${terms.length} total):
${termLines}

Output: JSON per schema. Exactly one result per term, same order, same count. Echo "term" field back exactly as given. Text language: Japanese.`

  const parsed = await generateGeminiJson({
    apiKey,
    model: opts?.model,
    prompt,
    responseSchema: BATCH_RESPONSE_SCHEMA,
    temperature: 0.4,
    maxOutputTokens: 8192,
    timeoutMs: GEMINI_TIMEOUT_MS,
    timeoutMessage: GEMINI_TIMEOUT_MESSAGE,
  })
  const results: any[] = Array.isArray(parsed.results) ? parsed.results : []

  return terms.map((t, i) => {
    const match =
      results.find((r) => typeof r?.term === 'string' && r.term.trim().toLowerCase() === t.term.trim().toLowerCase()) ??
      results[i]
    return {
      type: match?.type ?? 'word',
      meaningJa: match?.meaningJa ?? '',
      definitionEn: match?.definitionEn ?? '',
      examples: Array.isArray(match?.examples) ? match.examples.slice(0, 3) : [],
      note: match?.note ?? '',
    }
  })
}

export async function fetchRelatedTerms(
  term: string,
  apiKey: string,
  opts?: { meaningJa?: string; model?: string },
): Promise<RelatedTermsResult> {
  assertGeminiApiKey(apiKey)

  const contextLine = opts?.meaningJa ? ` (meaning: ${opts.meaningJa})` : ''

  const prompt = `You are a dictionary bot for English learners. For the word/phrase: "${term}"${contextLine}

List:
1. Up to 10 words or short phrases with a similar meaning (synonyms).
2. Up to 10 idioms or set phrases that use this word.

Output: JSON per schema. meaningJa language: Japanese.`

  const parsed = await generateGeminiJson({
    apiKey,
    model: opts?.model,
    prompt,
    responseSchema: RELATED_RESPONSE_SCHEMA,
    temperature: 0.4,
    timeoutMs: GEMINI_TIMEOUT_MS,
    timeoutMessage: GEMINI_TIMEOUT_MESSAGE,
  })

  const toItems = (arr: unknown): RelatedTerm[] =>
    Array.isArray(arr)
      ? arr
          .filter((it): it is RelatedTerm => !!it && typeof it.term === 'string')
          .map((it) => ({ term: it.term, meaningJa: it.meaningJa ?? '' }))
          .slice(0, 10)
      : []
  return {
    synonyms: toItems(parsed.synonyms),
    idioms: toItems(parsed.idioms),
  }
}
