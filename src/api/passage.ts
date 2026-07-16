import { DEFAULT_MODEL, GeminiError } from './gemini'
import type { PassageAnalysisResult } from '../types'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    translationJa: {
      type: 'string',
      description: 'Whole text, Japanese translation. Meaning over literal, ok.',
    },
    explanation: {
      type: 'string',
      description: 'What text mean. Joke/irony/metaphor/hidden meaning? Explain why funny or ironic, specific.',
    },
    wordplay: {
      type: 'string',
      description:
        'Rhyme, pun, alliteration, callback (far-apart lines connect), wordplay off earlier speaker. Point exact spot, explain. None found? Empty string.',
    },
    terms: {
      type: 'array',
      description: 'Hard/unusual idiom, slang, phrasal verb, word for Japanese English learner. Skip easy basic word.',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string', description: 'Word/phrase as in text. Base form better than inflected.' },
          type: {
            type: 'string',
            enum: ['word', 'idiom', 'slang', 'meme', 'phrase'],
          },
          meaningJa: { type: 'string', description: 'Meaning in this context. Japanese. Short.' },
          note: { type: 'string', description: 'Short note: how used in text.' },
        },
        required: ['term', 'type', 'meaningJa', 'note'],
      },
    },
  },
  required: ['translationJa', 'explanation', 'wordplay', 'terms'],
}

export async function analyzePassage(
  text: string,
  apiKey: string,
  model?: string,
): Promise<PassageAnalysisResult> {
  if (!apiKey) {
    throw new GeminiError('Gemini APIキーが設定されていません。設定画面で入力してください。')
  }
  const trimmed = text.trim()
  if (!trimmed) {
    throw new GeminiError('文章が入力されていません。')
  }

  const useModel = model?.trim() || DEFAULT_MODEL

  const prompt = `You reading-helper bot for English learner. Text below, maybe British, maybe joke or wordplay inside. Whole meaning matter most, not just single word.

---
${trimmed}
---

Do this:
1. Natural Japanese translation. Meaning over literal, ok.
2. Explain what text mean. Joke/irony/metaphor/hidden meaning? Explain why funny or ironic, specific.
3. Find rhyme, pun, callback (far-apart lines connect), wordplay off earlier speaker. Point exact spot, explain. None found? Empty string ok.
4. List hard/unusual idiom, slang, phrasal verb, word for learner. Skip easy basic word.

Output: JSON per schema. Text language: Japanese.`

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    useModel,
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
        maxOutputTokens: 8192,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    if (res.status === 400 || res.status === 404) {
      throw new GeminiError(
        `Geminiリクエストが失敗しました(${res.status})。APIキーまたはモデル名(${useModel})を設定画面で確認してください。`,
      )
    }
    if (res.status === 429) {
      throw new GeminiError('Geminiの無料枠のレート制限に達しました。しばらく待って再試行してください。')
    }
    throw new GeminiError(`Gemini APIエラー(${res.status}): ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!textOut) {
    throw new GeminiError('Geminiから有効な応答が得られませんでした。文章が長すぎる場合は分割してお試しください。')
  }

  try {
    const parsed = JSON.parse(textOut)
    return {
      translationJa: parsed.translationJa ?? '',
      explanation: parsed.explanation ?? '',
      wordplay: parsed.wordplay ?? '',
      terms: Array.isArray(parsed.terms)
        ? parsed.terms.map((t: any) => ({
            term: t.term ?? '',
            type: t.type ?? 'word',
            meaningJa: t.meaningJa ?? '',
            note: t.note ?? '',
          }))
        : [],
    }
  } catch {
    throw new GeminiError('Geminiの応答の解析に失敗しました。')
  }
}
