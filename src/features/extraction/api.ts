import { supabase } from "@/lib/supabase";

export interface ExtractedVariant {
  sku?: string;
  name?: string;
  price?: number;
  currency?: string;
  options?: Record<string, unknown>;
}

export interface ExtractedProduct {
  name: string;
  sku?: string;
  category?: string;
  brand?: string;
  description?: string;
  tags?: string[];
  variants?: ExtractedVariant[];
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
