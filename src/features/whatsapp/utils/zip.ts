import { strFromU8, unzipSync } from 'fflate'

export async function extractTxtFromZip(zipBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(zipBuffer)
  const entries = unzipSync(bytes)
  const txtName = Object.keys(entries).find((name) =>
    name.toLowerCase().endsWith('.txt'),
  )
  if (!txtName) {
    throw new Error('No .txt file found in the zip archive')
  }
  return strFromU8(entries[txtName])
}