import { supabase } from "@/lib/supabase";

export interface Fact {
  category: string;
  label: string;
  value: string;
  confidence: number;
  quote: string;
}

export interface ExtractTextResult {
  facts: Fact[];
  businessName: string;
  warning?: string;
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