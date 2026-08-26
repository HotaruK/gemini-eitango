import { assertGeminiApiKey, GeminiError, generateGeminiJson } from './gemini'
import type { PassageAnalysisResult } from '../types'

const PASSAGE_TIMEOUT_MS = 60000
const PASSAGE_TIMEOUT_MESSAGE = `Geminiからの応答がありませんでした(${PASSAGE_TIMEOUT_MS / 1000}秒でタイムアウト)。文章が長すぎる場合は分割するか、しばらくして再試行してください。`

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
  assertGeminiApiKey(apiKey)
  const trimmed = text.trim()
  if (!trimmed) {
    throw new GeminiError('文章が入力されていません。')
  }

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

  const parsed = await generateGeminiJson({
    apiKey,
    model,
    prompt,
    responseSchema: RESPONSE_SCHEMA,
    temperature: 0.4,
    maxOutputTokens: 8192,
    timeoutMs: PASSAGE_TIMEOUT_MS,
    timeoutMessage: PASSAGE_TIMEOUT_MESSAGE,
    emptyResponseMessage: 'Geminiから有効な応答が得られませんでした。文章が長すぎる場合は分割してお試しください。',
  })

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
}
