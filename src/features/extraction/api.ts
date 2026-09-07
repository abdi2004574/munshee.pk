import { supabase } from "@/lib/supabase";

export interface ExtractedField<T = unknown> {
  value: T;
  confidence: number | null;
  source_quote: string | null;
}

export interface ExtractedVariant {
  sku: ExtractedField<string | null>;
  name: ExtractedField<string | null>;
  price: ExtractedField<number | null>;
  compare_at_price: ExtractedField<number | null>;
  cost_price: ExtractedField<number | null>;
  barcode: ExtractedField<string | null>;
  options: ExtractedField<Record<string, unknown>>;
  status: ExtractedField<string>;
}

export interface ExtractedProduct {
  name: ExtractedField<string>;
  sku: ExtractedField<string | null>;
  description: ExtractedField<string | null>;
  category: ExtractedField<string | null>;
  brand: ExtractedField<string | null>;
  status: ExtractedField<string>;
  tags: ExtractedField<string[]>;
  weight_grams: ExtractedField<number | null>;
  variants: ExtractedVariant[];
}

export interface ExtractTextResult {
  products: ExtractedProduct[];
}

export async function invokeExtractText(
  text: string,
  context?: string,
): Promise<ExtractTextResult> {
  const { data, error } = await supabase.functions.invoke<ExtractTextResult>(
    "extract-text",
    { body: { text, context } },
  );
  if (error) throw error;
  if (!data) throw new Error("No data returned from extract-text");
  return data;
}

export async function invokeExtractVision(
  imageUrl?: string,
  imageBase64?: string,
): Promise<ExtractTextResult> {
  const body = imageUrl
    ? { image_url: imageUrl }
    : { image_base64: imageBase64 };

  const { data, error } = await supabase.functions.invoke<ExtractTextResult>(
    "extract-vision",
    { body },
  );
  if (error) throw error;
  if (!data) throw new Error("No data returned from extract-vision");
  return data;
}

export interface ExtractFactsResult {
  facts: Array<{
    category: string;
    label: string;
    value: string;
    confidence: number;
    quote: string;
  }>;
  businessName: string;
  warning?: string;
}

export async function invokeExtractFacts(
  url: string,
): Promise<ExtractFactsResult> {
  const { data, error } = await supabase.functions.invoke<ExtractFactsResult>(
    "extract-facts",
    { body: { url } },
  );
  if (error) throw error;
  if (!data) throw new Error("No data returned from extract-facts");
  return data;
}
