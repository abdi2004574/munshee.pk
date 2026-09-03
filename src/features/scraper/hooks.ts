import { useMutation } from "@tanstack/react-query";
import { invokeScraper } from "./api";

export function useScrape() {
  return useMutation({
    mutationFn: (url: string) => invokeScraper(url),
  });
}
