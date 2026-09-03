import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function extractJsonLd(html: string): any[] {
  const results: any[] = [];
  const regex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else {
        results.push(parsed);
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return results;
}

function findJsonLdProduct(jsonLd: any[]): any | null {
  for (const item of jsonLd) {
    if (item['@type'] === 'Product') {
      return item;
    }
    if (Array.isArray(item['@type']) && item['@type'].includes('Product')) {
      return item;
    }
  }
  return null;
}

function extractOpenGraph(html: string): Record<string, string> {
  const og: Record<string, string> = {};
  const regex = /<meta\s+(?:property|name)=["'](og:[^"']+)["']\s+content=["']([^"']*)["']\s*\/?>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    og[match[1]] = match[2];
  }
  return og;
}

function extractMetaTags(html: string, name: string): string | null {
  const regex = new RegExp(`<meta\\s+(?:property|name)=["']${name}["']\\s+content=["']([^"']*)["']\\s*\\/?>`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

function getTextFromHtml(html: string, selector: string): string | null {
  const regex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)<\\/${selector}>`, 'i');
  const match = html.match(regex);
  if (match) {
    return match[1].replace(/<[^>]+>/g, '').trim();
  }
  return null;
}

function getCssSelectorText(html: string, selector: string): string | null {
  // Simple regex-based CSS selector extraction for common cases
  const classRegex = /\.([a-zA-Z0-9_-]+)/;
  const attrRegex = /\[([^=]+)=["']([^"']+)["']\]/;
  
  let pattern = '<([a-zA-Z0-9]+)';
  let hasClass = false;
  let hasAttr = false;
  
  const classMatch = selector.match(classRegex);
  const attrMatch = selector.match(attrRegex);
  
  if (classMatch) {
    pattern += `[^>]*class=["'][^"']*${classMatch[1]}[^"']*["'][^>]*>`;
    hasClass = true;
  }
  
  if (attrMatch) {
    pattern += `[^>]*${attrMatch[1]}=["']${attrMatch[2]}["'][^>]*>`;
    hasAttr = true;
  }
  
  if (!hasClass && !hasAttr) {
    pattern += '[^>]*>';
  }
  
  pattern += '([\\s\\S]*?)<\\/\\1>';
  
  const regex = new RegExp(pattern, 'i');
  const match = html.match(regex);
  if (match) {
    return match[2].replace(/<[^>]+>/g, '').trim();
  }
  return null;
}

function cleanText(text: string | null): string {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
}

function extractPrice(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/(?:Rs\.?|PKR|₹|USD|EUR|GBP|\\$)\\s*[\\d,]+\\.?\\d*/i);
  if (match) return match[0];
  const numMatch = text.match(/(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{2})?)/);
  if (numMatch) return numMatch[1];
  return null;
}

app.post('/scrape', async (req, res) => {
  const { url } = req.body;

  if (!url || !isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid or missing URL. Must start with http:// or https://' });
  }

  let page = null;
  try {
    const browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
    
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    
    const html = await page.content();
    
    const products: any[] = [];
    
    // Strategy 1: JSON-LD
    const jsonLd = extractJsonLd(html);
    const jsonLdProduct = findJsonLdProduct(jsonLd);
    
    if (jsonLdProduct) {
      const offers = jsonLdProduct.offers || jsonLdProduct;
      const price = typeof offers === 'object' ? offers.price || offers.lowPrice : null;
      const priceCurrency = typeof offers === 'object' ? offers.priceCurrency : null;
      
      products.push({
        name: cleanText(jsonLdProduct.name),
        sku: cleanText(jsonLdProduct.sku) || cleanText(jsonLdProduct.mpn) || null,
        description: cleanText(jsonLdProduct.description),
        category: cleanText(jsonLdProduct.category) || null,
        brand: jsonLdProduct.brand ? (typeof jsonLdProduct.brand === 'string' ? jsonLdProduct.brand : jsonLdProduct.brand.name) : null,
        status: 'draft',
        tags: jsonLdProduct.keywords ? jsonLdProduct.keywords.split(',').map((k: string) => k.trim()) : [],
        weight_grams: null,
        variants: Array.isArray(offers) ? offers.map((offer: any) => ({
          sku: offer.sku || cleanText(jsonLdProduct.sku),
          price: offer.price || price,
          currency: offer.priceCurrency || priceCurrency,
          inventory_quantity: offer.availability ? (offer.availability.includes('InStock') ? 100 : 0) : null,
        })) : []
      });
    }
    
    // Strategy 2: Open Graph
    const og = extractOpenGraph(html);
    if (products.length === 0 && (og['og:title'] || og['og:description'])) {
      const ogPrice = og['og:price:amount'] || extractMetaTags(html, 'product:price:amount');
      const ogCurrency = extractMetaTags(html, 'product:price:currency');
      
      products.push({
        name: cleanText(og['og:title']),
        sku: null,
        description: cleanText(og['og:description']),
        category: null,
        brand: null,
        status: 'draft',
        tags: [],
        weight_grams: null,
        variants: ogPrice ? [{
          sku: null,
          price: ogPrice,
          currency: ogCurrency,
          inventory_quantity: null,
        }] : []
      });
    }
    
    // Strategy 3: CSS selectors
    if (products.length === 0) {
      const name = cleanText(
        getTextFromHtml(html, 'h1') ||
        getCssSelectorText(html, '.product-title')
      );
      
      const priceEl = getCssSelectorText(html, '.price') ||
                      getCssSelectorText(html, '.product-price') ||
                      getTextFromHtml(html, '[itemprop="price"]');
      
      const price = extractPrice(priceEl);
      
      const description = cleanText(
        getCssSelectorText(html, '.description') ||
        getCssSelectorText(html, '.product-description') ||
        getTextFromHtml(html, '[itemprop="description"]')
      );
      
      const sku = cleanText(
        getCssSelectorText(html, '.sku') ||
        getCssSelectorText(html, '.product-sku') ||
        getTextFromHtml(html, '[itemprop="sku"]')
      ) || null;
      
      if (name || price || description) {
        products.push({
          name: name || 'Imported Product',
          sku,
          description: description || '',
          category: null,
          brand: null,
          status: 'draft',
          tags: [],
          weight_grams: null,
          variants: price ? [{
            sku: sku,
            price,
            currency: null,
            inventory_quantity: null,
          }] : []
        });
      }
    }
    
    await browser.close();
    
    res.json({ products });
  } catch (error) {
    if (page) {
      try {
        await page.context().browser().close();
      } catch {
        // ignore close errors
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error occurred during scraping';
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Munshee scraper running on port ${PORT}`);
});
