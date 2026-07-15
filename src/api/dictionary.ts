export interface DictionaryResult {
  found: true
  phonetic?: string
  audioUrl?: string
  partOfSpeech?: string
  definitionEn: string
  examples: string[]
}

export interface DictionaryNotFound {
  found: false
}

/**
 * dictionaryapi.dev は標準的な単語のみ収録。熟語・スラング・ミームは404になる想定
 * (Gemini 側でのフォールバックはこの呼び出し元が担当する)。
 */
export async function lookupDictionary(
  term: string,
): Promise<DictionaryResult | DictionaryNotFound> {
  const res = await fetch(
    `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`,
  )
  if (!res.ok) {
    return { found: false }
  }
  const data = await res.json()
  const entry = Array.isArray(data) ? data[0] : null
  if (!entry) return { found: false }

  const phoneticEntry = (entry.phonetics ?? []).find((p: any) => p.text) ?? {}
  const audioEntry = (entry.phonetics ?? []).find((p: any) => p.audio) ?? {}
  const rawPhonetic: string | undefined = phoneticEntry.text || entry.phonetic || undefined
  const phonetic = rawPhonetic?.replace(/^\/+|\/+$/g, '')

  const meanings = entry.meanings ?? []
  const definitions: string[] = []
  const examples: string[] = []
  let partOfSpeech: string | undefined

  for (const meaning of meanings) {
    if (!partOfSpeech) partOfSpeech = meaning.partOfSpeech
    for (const def of meaning.definitions ?? []) {
      if (def.definition) definitions.push(def.definition)
      if (def.example) examples.push(def.example)
      if (definitions.length >= 3) break
    }
    if (definitions.length >= 3) break
  }

  if (definitions.length === 0) return { found: false }

  return {
    found: true,
    phonetic,
    audioUrl: audioEntry.audio || undefined,
    partOfSpeech,
    definitionEn: definitions.join(' / '),
    examples: examples.slice(0, 3),
  }
}
