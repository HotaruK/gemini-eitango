import { lookupDictionary } from './dictionary'
import { fetchWordInfoBatch } from './gemini'
import { normalize } from '../db'
import type { Source, Word } from '../types'

export interface LookupResult {
  term: string
  normalizedTerm: string
  type: Word['type']
  meaningJa: string
  definitionEn: string
  phonetic?: string
  audioUrl?: string
  examples: string[]
  note: string
  source: Source
}

/**
 * 標準的な単語は無料辞書APIでまず引き、Geminiは英日訳・ニュアンス・由来の補完に使う。
 * 辞書API未収録(熟語・スラング・ミーム等)の場合はGeminiのみで全項目を生成する。
 * Geminiへの問い合わせは単語数によらず常に1回のリクエストにまとめる
 * (単語ごとに並列リクエストするとレート制限に当たりやすいため)。
 */
export async function lookupWords(
  terms: string[],
  apiKey: string,
  model?: string,
  contextText?: string,
): Promise<LookupResult[]> {
  const trimmedTerms = terms.map((t) => t.trim()).filter(Boolean)
  if (trimmedTerms.length === 0) return []

  const dictResults = await Promise.all(trimmedTerms.map((t) => lookupDictionary(t)))

  const geminiInfos = await fetchWordInfoBatch(
    trimmedTerms.map((term, i) => ({
      term,
      dictionaryDefinitionEn: dictResults[i].found ? dictResults[i].definitionEn : undefined,
    })),
    apiKey,
    { model, contextText },
  )

  return trimmedTerms.map((term, i) => {
    const dictResult = dictResults[i]
    const geminiInfo = geminiInfos[i]
    const normalizedTerm = normalize(term)

    if (dictResult.found) {
      return {
        term,
        normalizedTerm,
        type: geminiInfo.type,
        meaningJa: geminiInfo.meaningJa,
        definitionEn: dictResult.definitionEn,
        phonetic: dictResult.phonetic,
        audioUrl: dictResult.audioUrl,
        examples: dictResult.examples.length > 0 ? dictResult.examples : geminiInfo.examples,
        note: geminiInfo.note,
        source: 'mixed',
      }
    }

    return {
      term,
      normalizedTerm,
      type: geminiInfo.type,
      meaningJa: geminiInfo.meaningJa,
      definitionEn: geminiInfo.definitionEn,
      examples: geminiInfo.examples,
      note: geminiInfo.note,
      source: 'gemini',
    }
  })
}
