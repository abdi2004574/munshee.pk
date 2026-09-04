export interface ParsedWhatsAppMessage {
  sender: string
  message: string
  timestamp: string
}

const IOS_RE = /^\[(\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2})\]\s+(.*)$/
const ANDROID_RE = /^(\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2})\s+-\s+(.*)$/

const BRACKET_OMITTED_RE = /<[^>]*\s+omitted>/gi
const BARE_OMITTED_RE = /^(?:image|video|audio|document|media|gif|sticker)\s+omitted$/gi

function cleanMessage(message: string): string | null {
  let cleaned = message.replace(BRACKET_OMITTED_RE, '').trim()
  cleaned = cleaned.replace(BARE_OMITTED_RE, '').trim()
  cleaned = cleaned.replace(/\s+/g, ' ')
  return cleaned.length > 0 ? cleaned : null
}

function matchTimestampLine(line: string): [string, string] | null {
  const ios = line.match(IOS_RE)
  if (ios) {
    return [ios[1], ios[2]]
  }
  const android = line.match(ANDROID_RE)
  if (android) {
    return [android[1], android[2]]
  }
  return null
}

export function parseWhatsAppExport(text: string): ParsedWhatsAppMessage[] {
  const messages: ParsedWhatsAppMessage[] = []
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/)
  let current: ParsedWhatsAppMessage | null = null

  for (const line of lines) {
    if (line.trim() === '') {
      continue
    }

    const matched = matchTimestampLine(line)

    if (matched) {
      const [timestamp, rest] = matched
      const idx = rest.indexOf(': ')
      if (idx === -1) {
        current = null
        continue
      }
      const sender = rest.slice(0, idx)
      const cleaned = cleanMessage(rest.slice(idx + 2))
      if (cleaned === null) {
        current = null
        continue
      }
      const message: ParsedWhatsAppMessage = {
        sender,
        message: cleaned,
        timestamp,
      }
      messages.push(message)
      current = message
    } else if (current) {
      const continuation = line.trim().replace(/\s+/g, ' ')
      if (continuation.length > 0) {
        current.message += ' ' + continuation
      }
    }
  }

  return messages
}

export function toExtractionText(messages: ParsedWhatsAppMessage[]): string {
  return messages.map((m) => `${m.sender}: ${m.message}`).join('\n')
}