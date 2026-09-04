import { invokeExtractText, type ExtractedProduct } from '@/features/extraction/api'
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

export async function processWhatsAppExport(file: File): Promise<{ products: ExtractedProduct[] }> {
  const text = await fileToText(file)
  const messages = parseWhatsAppExport(text)
  const extractionText = toExtractionText(messages)
  return invokeExtractText(extractionText, 'Source: WhatsApp chat export')
}

type ProductFieldKey =
  | 'name'
  | 'sku'
  | 'description'
  | 'category'
  | 'brand'
  | 'status'
  | 'tags'
  | 'weight_grams'

const PRODUCT_FIELD_KEYS: ProductFieldKey[] = [
  'name',
  'sku',
  'description',
  'category',
  'brand',
  'status',
  'tags',
  'weight_grams',
]

const VARIANT_PRICING_FIELDS = ['price', 'compare_at_price', 'cost_price'] as const
const VARIANT_PRODUCT_FIELDS = ['sku', 'name', 'barcode', 'options', 'status'] as const

export function buildWhatsAppFacts(
  products: ExtractedProduct[],
  tenantId: string,
  sourceRef: string = 'WhatsApp chat export',
): BusinessFactInsert[] {
  const facts: BusinessFactInsert[] = []

  for (const product of products) {
    for (const key of PRODUCT_FIELD_KEYS) {
      const field = product[key]
      facts.push({
        tenant_id: tenantId,
        category: 'product',
        label: key,
        value: String(field.value),
        confidence: field.confidence,
        source_ref: sourceRef,
        source_type: 'whatsapp_export',
        linked_table: 'products',
        linked_row_id: null,
        status: 'needs_review',
      })
    }

    for (const variant of product.variants ?? []) {
      for (const key of VARIANT_PRICING_FIELDS) {
        const field = variant[key]
        facts.push({
          tenant_id: tenantId,
          category: 'pricing',
          label: key,
          value: String(field.value),
          confidence: field.confidence,
          source_ref: sourceRef,
          source_type: 'whatsapp_export',
          linked_table: 'product_variants',
          linked_row_id: null,
          status: 'needs_review',
        })
      }

      for (const key of VARIANT_PRODUCT_FIELDS) {
        const field = variant[key]
        facts.push({
          tenant_id: tenantId,
          category: 'product',
          label: key,
          value: String(field.value),
          confidence: field.confidence,
          source_ref: sourceRef,
          source_type: 'whatsapp_export',
          linked_table: 'product_variants',
          linked_row_id: null,
          status: 'needs_review',
        })
      }
    }
  }

  return facts
}