import { invokeExtractText, type Fact } from '@/features/extraction/api'
import type { BusinessFactInsert } from '@/features/facts/api'
import { extractTxtFromZip } from './utils/zip'
import { parseWhatsAppExport, toExtractionText } from './utils/parse'

export async function fileToText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.zip')) {
    return extractTxtFromZip(await file.arrayBuffer())
  }
  return file.text()
}

export async function processWhatsAppExport(file: File): Promise<{ facts: Fact[]; businessName: string; warning?: string }> {
  const text = await fileToText(file)
  const messages = parseWhatsAppExport(text)
  const extractionText = toExtractionText(messages)
  return invokeExtractText(extractionText, 'Source: WhatsApp chat export')
}

export function buildWhatsAppFacts(
  facts: Fact[],
  tenantId: string,
  sourceRef: string = 'WhatsApp chat export',
): BusinessFactInsert[] {
  return facts.map((fact) => ({
    tenant_id: tenantId,
    category: fact.category,
    label: fact.label,
    value: fact.value,
    confidence: fact.confidence,
    status: 'needs_review',
    source_type: 'whatsapp_export',
    source_ref: sourceRef,
    linked_table: null,
    linked_row_id: null,
  }))
}
