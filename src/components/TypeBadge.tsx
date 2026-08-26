import { TYPE_LABEL } from '../utils/wordTypeLabels'
import type { WordType } from '../types'

interface TypeBadgeProps {
  type: WordType
  small?: boolean
}

export default function TypeBadge({ type, small }: TypeBadgeProps) {
  return <span className={`type-badge${small ? ' small' : ''}`}>{TYPE_LABEL[type]}</span>
}
