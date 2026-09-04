import { useMutation } from '@tanstack/react-query'
import type { ExtractTextResult } from '@/features/extraction/api'
import { processWhatsAppExport } from './api'

export function useWhatsAppExport() {
  return useMutation<ExtractTextResult, Error, File>({
    mutationFn: (file) => processWhatsAppExport(file),
  })
}