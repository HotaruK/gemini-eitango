import { DEFAULT_MODEL, GeminiError } from './gemini'
import type { PassageAnalysisResult } from '../types'

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    translationJa: {
      type: 'string',
      description: '文章全体の自然な日本語訳。直訳ではなく、意味とトーンが伝わる意訳でよい',
    },
    explanation: {
      type: 'string',
      description:
        'この文章が何を言っているかの解説。特にジョーク・皮肉・比喩・文脈依存の意味がある場合、なぜそれが面白い/皮肉なのかを具体的に説明する',
    },
    wordplay: {
      type: 'string',
      description:
        '文章内の言葉遊び(駄洒落、韻、頭韻)、離れた箇所同士の呼応、前の発言者の言葉を受けたコールバックなど、構造的な仕掛けがあれば該当箇所を挙げて具体的に解説する。該当箇所がなければ空文字列にする',
    },
    terms: {
      type: 'array',
      description:
        '文章中の、日本人英語学習者にとって難しい・見慣れないイディオム・スラング・句動詞・単語の一覧。基礎的すぎる単語は含めない',
      items: {
        type: 'object',
        properties: {
          term: { type: 'string', description: '原文での見出し語(活用形ではなく基本形が望ましい)' },
          type: {
            type: 'string',
            enum: ['word', 'idiom', 'slang', 'meme', 'phrase'],
          },
          meaningJa: { type: 'string', description: 'この文脈における意味(日本語、簡潔に)' },
          note: { type: 'string', description: '文中でどう使われているかの簡単な補足' },
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

  const prompt = `あなたは英語(特にイギリス英語)の読解を助ける学習アシスタントです。次の文章を読んで解析してください。

文章はジョークや皮肉、言葉遊びを含む場合があります。単語ひとつひとつの意味だけでなく、文章全体として何を伝えようとしているかを重視してください。

---
${trimmed}
---

以下を行ってください:
1. 文章全体の自然な日本語訳(意訳可)
2. 何を言っているかの解説。特にジョーク・皮肉・比喩・文脈依存の意味がある場合は、なぜそれが面白い/皮肉なのかを具体的に説明する
3. 韻を踏んでいる箇所、駄洒落、離れた箇所同士の呼応、前の発言を受けた言葉遊びなど、構造的な仕掛けがあれば具体的に指摘して解説する(なければ空文字でよい)
4. 文章中に含まれる、学習者にとって難しい・見慣れないイディオム・スラング・句動詞・単語をリストアップする(基礎的な単語は除く)

指定されたJSONスキーマの形式で回答してください。`

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
