import { z } from "zod";

export const productSchema = z.object({
  sku: z.string().min(1, "SKU is required").max(100),
  name: z.string().min(1, "Name is required").max(500),
  description: z.string().max(5000).optional().nullable(),
  category: z.string().min(1, "Category is required").max(100),
  brand: z.string().max(200).optional().nullable(),
  status: z.enum(["active", "draft", "archived"]),
  tags: z.array(z.string()).default([]),
  weight_grams: z.number().int().nonnegative().optional().nullable(),
});

export const customerSchema = z.object({
  full_name: z.string().min(1, "Full name is required").max(200),
  email: z.string().email("Invalid email").optional().or(z.literal("")).nullable(),
  phone: z.string().max(20).optional().or(z.literal("")).nullable(),
  city: z.string().max(100).optional().nullable(),
  address: z.string().max(1000).optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).default([]),
});

export const orderSchema = z.object({
  customer_id: z.string().uuid().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  items: z.array(
    z.object({
      variant_id: z.string().uuid(),
      quantity: z.number().int().positive("Quantity must be > 0"),
    }),
  ).min(1, "Order must have at least one item"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = loginSchema.extend({
  full_name: z.string().min(1, "Full name is required").max(200),
});

export const extractTextSchema = z.object({
  text: z.string().min(1, "Text is required").max(50000, "Text too long (max 50,000 chars)"),
  context: z.string().max(2000).optional(),
});

export const scrapeSchema = z.object({
  url: z.string().url("Must be a valid URL (https://example.com)"),
});

export const whatsappUploadSchema = z.object({
  file: z.instanceof(File),
});

export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    errors[path] = issue.message;
  }
  return { success: false, errors };
}

