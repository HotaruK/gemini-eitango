export type WordType = 'word' | 'idiom' | 'slang' | 'meme' | 'phrase'
export type Source = 'dictionary' | 'gemini' | 'mixed'

export interface Word {
  id?: number
  term: string
  normalizedTerm: string
  type: WordType
  meaningJa: string
  definitionEn: string
  phonetic?: string
  audioUrl?: string
  examples: string[]
  note: string
  source: Source
  isFlagged: boolean
  quizCount: number
  correctCount: number
  quizCountReverse: number
  correctCountReverse: number
  createdAt: number
  updatedAt: number
}

export interface ExtractedTerm {
  term: string
  type: WordType
  meaningJa: string
  note: string
}

export interface PassageAnalysisResult {
  translationJa: string
  explanation: string
  wordplay: string
  terms: ExtractedTerm[]
}

export type QuizDirection = 'termToMeaning' | 'meaningToTerm'

export interface QuizQuestion {
  direction: QuizDirection
  target: Word
  choices: string[]
  correctIndex: number
}
