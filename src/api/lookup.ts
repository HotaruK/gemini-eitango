import { lookupDictionary } from './dictionary'
import { fetchWordInfo } from './gemini'
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
 */
export async function lookupWord(
  term: string,
  apiKey: string,
  model?: string,
  contextText?: string,
): Promise<LookupResult> {
  const trimmed = term.trim()
  if (!trimmed) throw new Error('検索語が空です')

  const dictResult = await lookupDictionary(trimmed)

  const geminiInfo = await fetchWordInfo(trimmed, apiKey, {
    dictionaryDefinitionEn: dictResult.found ? dictResult.definitionEn : undefined,
    model,
    contextText,
  })

  if (dictResult.found) {
    return {
      term: trimmed,
      normalizedTerm: normalize(trimmed),
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
    term: trimmed,
    normalizedTerm: normalize(trimmed),
    type: geminiInfo.type,
    meaningJa: geminiInfo.meaningJa,
    definitionEn: geminiInfo.definitionEn,
    examples: geminiInfo.examples,
    note: geminiInfo.note,
    source: 'gemini',
  }
}
