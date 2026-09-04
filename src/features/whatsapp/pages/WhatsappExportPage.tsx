import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { Card } from '@/components/Card'
import { Button } from '@/components/Button'
import { Badge } from '@/components/Badge'
import { Money } from '@/components/Money'
import { EmptyState } from '@/components/EmptyState'
import { useWhatsAppExport } from '../hooks'
import { useCreateBusinessFacts } from '@/features/facts/hooks'
import { useCreateAuditLog } from '@/features/audit/hooks'
import { supabase } from '@/lib/supabase'
import type { ExtractedProduct, ExtractedVariant } from '@/features/extraction/api'
import type { ParsedWhatsAppMessage } from '../utils/parse'
import { parseWhatsAppExport } from '../utils/parse'
import { buildWhatsAppFacts, fileToText } from '../api'

const TRUNCATE_DESCRIPTION = 220

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max).trimEnd()}…`
}

function buildSourceRef(messages: ParsedWhatsAppMessage[]): string {
  const senders = Array.from(new Set(messages.map((m) => m.sender)))
  const timestamps = messages.map((m) => m.timestamp)
  const from = messages.length > 0 ? timestamps[0] : ''
  const to = messages.length > 0 ? timestamps[timestamps.length - 1] : ''
  return `WhatsApp chat export - ${senders.length} sender(s) (${senders.join(
    ', ',
  )}), ${from} to ${to}`
}

interface WhatsappProductsResultProps {
  products: ExtractedProduct[]
}

function WhatsappProductsResult({ products }: WhatsappProductsResultProps) {
  if (products.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-sm text-ink-muted">
          The extraction completed but no products were found in the chat.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {products.map((product, idx) => (
        <Card
          key={`${product.sku.value ?? product.name.value}-${idx}`}
          className="p-4"
        >
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-ink">
                {product.name.value}
              </h3>
              {product.sku.value && (
                <Badge variant="info">SKU: {product.sku.value}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
              {product.category.value && (
                <span>
                  <span className="font-medium text-ink">Category:</span>{' '}
                  {product.category.value}
                </span>
              )}
              {product.brand.value && (
                <span>
                  <span className="font-medium text-ink">Brand:</span>{' '}
                  {product.brand.value}
                </span>
              )}
            </div>

            {product.description.value && (
              <p className="text-sm text-ink-muted">
                {truncate(product.description.value, TRUNCATE_DESCRIPTION)}
              </p>
            )}

            {product.variants && product.variants.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                <p className="text-xs font-medium text-ink-muted">Variants</p>
                <ul className="space-y-1">
                  {product.variants.map((variant: ExtractedVariant, vIdx) => (
                    <li
                      key={`${variant.sku.value ?? variant.name.value ?? 'variant'}-${vIdx}`}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-ink">
                        {variant.name.value ?? variant.sku.value ?? `Variant ${vIdx + 1}`}
                      </span>
                      {variant.price.value != null && (
                        <Money value={variant.price.value} currency="PKR" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {product.tags.value && product.tags.value.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {product.tags.value.map((tag) => (
                  <Badge key={tag} variant="default">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

interface MessagesPreviewProps {
  messages: ParsedWhatsAppMessage[]
}

function MessagesPreview({ messages }: MessagesPreviewProps) {
  if (messages.length === 0) {
    return (
      <EmptyState
        title="No messages parsed"
        description="The selected file did not contain readable WhatsApp messages."
      />
    )
  }

  return (
    <div className="max-h-60 space-y-1.5 overflow-y-auto text-sm">
      {messages.map((m, idx) => (
        <div key={idx} className="rounded-lg border border-gray-100 px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-medium text-ink">{m.sender}</span>
            <span className="text-xs text-ink-muted">{m.timestamp}</span>
          </div>
          <p className="mt-0.5 break-words text-ink-muted">{m.message}</p>
        </div>
      ))}
    </div>
  )
}

export function WhatsappExportPage() {
  const navigate = useNavigate()
  const extract = useWhatsAppExport()
  const createBusinessFacts = useCreateBusinessFacts()
  const createAuditLog = useCreateAuditLog()

  const [file, setFile] = useState<File | null>(null)
  const [messages, setMessages] = useState<ParsedWhatsAppMessage[] | null>(null)
  const [readError, setReadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const result = extract.data
  const products = result?.products ?? []
  const canExtract = Boolean(file) && !extract.isPending
  const canSave = products.length > 0 && !saving
  const hasPreview = Boolean(file) && messages !== null

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setMessages(null)
    setReadError(null)
    extract.reset()
    e.target.value = ''
    if (!selected) return

    try {
      const text = await fileToText(selected)
      const parsed = parseWhatsAppExport(text)
      setMessages(parsed)
    } catch (err) {
      setReadError(err instanceof Error ? err.message : 'Failed to read file')
    }
  }

  async function onExtract() {
    if (!file) return
    setSaveError(null)
    try {
      await extract.mutateAsync(file)
    } catch {}
  }

  async function onSaveToFacts() {
    if (!messages || !result || products.length === 0) return
    setSaveError(null)
    setSaving(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const tenantId = sessionData.session?.user.id
      if (!tenantId) throw new Error('Not authenticated')

      const sourceRef = buildSourceRef(messages)
      const facts = buildWhatsAppFacts(products, tenantId, sourceRef)

      await createBusinessFacts.mutateAsync(facts)

      await createAuditLog.mutateAsync({
        tenant_id: tenantId,
        fact_id: null,
        actor: tenantId,
        action: 'import',
        old_value: null,
        new_value: { source_type: 'whatsapp_export', facts_count: facts.length },
      })

      navigate('/apps/review')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save facts')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">WhatsApp chat export</h1>
        <p className="text-sm text-ink-muted">
          Upload a WhatsApp chat export (.zip or .txt) to extract product data
          discussed in the conversation.
        </p>
      </div>

      <Card className="space-y-4 p-6">
        <label
          htmlFor="whatsapp-file"
          className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-gray-200 text-center transition-colors hover:border-brand-500"
        >
          <input
            id="whatsapp-file"
            type="file"
            accept=".txt,.zip"
            onChange={handleFileChange}
            className="sr-only"
          />
          <svg
            className="h-8 w-8 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          <div>
            <span className="block text-sm font-medium text-ink">
              {file ? file.name : 'Upload a .zip or .txt chat export'}
            </span>
            {file && (
              <p className="mt-1 text-xs text-ink-muted">{file.size} bytes</p>
            )}
          </div>
        </label>

        {readError && <p className="text-sm text-danger">{readError}</p>}

        {hasPreview && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-ink">
              Messages preview ({messages?.length ?? 0})
            </h2>
            <MessagesPreview messages={messages ?? []} />
          </div>
        )}

        {extract.isError && (
          <p className="text-sm text-danger">
            {extract.error instanceof Error
              ? extract.error.message
              : 'Extraction failed'}
          </p>
        )}

        <div className="flex justify-end">
          <Button onClick={onExtract} disabled={!canExtract}>
            {extract.isPending ? 'Extracting…' : 'Extract Facts'}
          </Button>
        </div>
      </Card>

      {extract.isPending && (
        <Card className="p-6">
          <p className="text-sm text-ink-muted">
            Reading your chat and extracting product data…
          </p>
        </Card>
      )}

      {result && !extract.isPending && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-ink">
              Extracted products ({products.length})
            </h2>
            {saveError && <p className="text-sm text-danger">{saveError}</p>}
          </div>

          <WhatsappProductsResult products={products} />

          <div className="flex justify-end">
            <Button onClick={onSaveToFacts} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save to Facts'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}