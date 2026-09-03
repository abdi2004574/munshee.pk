import { useMutation } from "@tanstack/react-query";
import {
  invokeExtractText,
  invokeExtractVision,
  type ExtractTextResult,
} from "./api";

export function useExtractText() {
  return useMutation<ExtractTextResult, Error, { text: string; context?: string }>({
    mutationFn: ({ text, context }) => invokeExtractText(text, context),
  });
}

export function useExtractVision() {
  return useMutation<
    ExtractTextResult,
    Error,
    { imageUrl?: string; imageBase64?: string }
  >({
    mutationFn: ({ imageUrl, imageBase64 }) =>
      invokeExtractVision(imageUrl, imageBase64),
  });
}
