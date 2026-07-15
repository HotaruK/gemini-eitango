import type { Word } from '../types'

const COLUMNS: (keyof Word)[] = [
  'id',
  'term',
  'normalizedTerm',
  'type',
  'meaningJa',
  'definitionEn',
  'phonetic',
  'audioUrl',
  'examples',
  'note',
  'source',
  'isFlagged',
  'quizCount',
  'correctCount',
  'quizCountReverse',
  'correctCountReverse',
  'createdAt',
  'updatedAt',
]

function escapeCsvField(value: unknown): string {
  if (value === undefined || value === null) return ''
  const str = Array.isArray(value) ? value.join('||') : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function wordsToCsv(words: Word[]): string {
  const header = COLUMNS.join(',')
  const rows = words.map((w) => COLUMNS.map((c) => escapeCsvField((w as any)[c])).join(','))
  return '﻿' + [header, ...rows].join('\r\n')
}

// RFC4180準拠の簡易CSVパーサ(クォート・改行・カンマを含むフィールドに対応)
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  const s = text.replace(/^﻿/, '')

  while (i < s.length) {
    const char = s[i]
    if (inQuotes) {
      if (char === '"') {
        if (s[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += char
      i++
      continue
    }
    if (char === '"') {
      inQuotes = true
      i++
      continue
    }
    if (char === ',') {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (char === '\r') {
      i++
      continue
    }
    if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    field += char
    i++
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

export function csvToWords(text: string): Omit<Word, 'id'>[] {
  const rows = parseCsv(text)
  if (rows.length === 0) return []
  const header = rows[0]
  const dataRows = rows.slice(1)

  return dataRows.map((cells) => {
    const record: Record<string, string> = {}
    header.forEach((col, idx) => {
      record[col] = cells[idx] ?? ''
    })
    return {
      term: record.term ?? '',
      normalizedTerm: record.normalizedTerm ?? (record.term ?? '').trim().toLowerCase(),
      type: (record.type as Word['type']) || 'word',
      meaningJa: record.meaningJa ?? '',
      definitionEn: record.definitionEn ?? '',
      phonetic: record.phonetic || undefined,
      audioUrl: record.audioUrl || undefined,
      examples: record.examples ? record.examples.split('||').filter(Boolean) : [],
      note: record.note ?? '',
      source: (record.source as Word['source']) || 'gemini',
      isFlagged: record.isFlagged === 'true',
      quizCount: Number(record.quizCount) || 0,
      correctCount: Number(record.correctCount) || 0,
      quizCountReverse: Number(record.quizCountReverse) || 0,
      correctCountReverse: Number(record.correctCountReverse) || 0,
      createdAt: Number(record.createdAt) || Date.now(),
      updatedAt: Number(record.updatedAt) || Date.now(),
    }
  })
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
