export const SCRAPER_URL =
  import.meta.env.VITE_SCRAPER_URL || "http://localhost:3001";

export async function invokeScraper(url: string): Promise<any> {
  const response = await fetch(`${SCRAPER_URL}/scrape`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      text || `Scraper request failed with status ${response.status}`,
    );
  }

  return response.json();
}
