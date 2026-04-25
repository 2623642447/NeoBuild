import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

//代码现状：product-api.ts:16 中 fetchProductInfo 调用它，而它被 AddItemDialog.tsx 使用——当用户添加配件并粘贴电商链接时，Edge Function 抓取商品标题、图片等信息。 

interface ProductInfo {
  title: string | null;
  imageUrl: string | null;
  description: string | null;
  price: number | null;
  priceStatus: "cached" | "unavailable" | "none";
}

function extractMetaContent(html: string, property: string): string | null {
  // Try og: prefix first, then regular meta
  const ogPattern = new RegExp(
    `<meta[^>]*property=["']${escapeRegex(property)}["'][^>]*content=["']([^"']*)["']`,
    "i"
  );
  const ogMatch = html.match(ogPattern);
  if (ogMatch) return decodeHtmlEntities(ogMatch[1]);

  // Also try content before property
  const reversePattern = new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${escapeRegex(property)}["']`,
    "i"
  );
  const reverseMatch = html.match(reversePattern);
  if (reverseMatch) return decodeHtmlEntities(reverseMatch[1]);

  return null;
}

function extractTitle(html: string): string | null {
  const ogTitle = extractMetaContent(html, "og:title");
  if (ogTitle) return ogTitle;

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : null;
}

function extractDescription(html: string): string | null {
  const ogDesc = extractMetaContent(html, "og:description");
  if (ogDesc) return ogDesc;

  const metaDesc = extractMetaContent(html, "description");
  return metaDesc;
}

function extractImage(html: string): string | null {
  const ogImage = extractMetaContent(html, "og:image");
  if (ogImage) return ogImage;

  const twitterImage = extractMetaContent(html, "twitter:image");
  return twitterImage;
}

// Try to extract price from common e-commerce meta tags or JSON-LD
function extractPrice(html: string): number | null {
  // JSON-LD structured data
  const jsonLdPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdMatch;
  while ((jsonLdMatch = jsonLdPattern.exec(html)) !== null) {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      const products = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      for (const item of products) {
        // Check for Offer
        const offers = item.offers;
        if (offers) {
          const offerList = Array.isArray(offers) ? offers : [offers];
          for (const offer of offerList) {
            if (offer.price !== undefined) {
              const p = parseFloat(String(offer.price));
              if (!isNaN(p) && p > 0) return p;
            }
            if (offer.lowPrice !== undefined) {
              const p = parseFloat(String(offer.lowPrice));
              if (!isNaN(p) && p > 0) return p;
            }
          }
        }
        // Direct price property
        if (item.price !== undefined) {
          const p = parseFloat(String(item.price));
          if (!isNaN(p) && p > 0) return p;
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  // JD-specific meta tags
  const jdPriceMatch = html.match(
    /<meta[^>]*itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i
  );
  if (jdPriceMatch) {
    const p = parseFloat(jdPriceMatch[1]);
    if (!isNaN(p) && p > 0) return p;
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function detectPlatformFromUrl(url: string): string | null {
  if (/jd\.com/i.test(url)) return "京东";
  if (/taobao\.com/i.test(url)) return "淘宝";
  if (/tmall\.com/i.test(url)) return "天猫";
  if (/yangkeduo\.com|pinduoduo\.com/i.test(url)) return "拼多多";
  return null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing or invalid 'url' parameter" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid URL format" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Only allow http/https
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return new Response(
        JSON.stringify({ error: "Only HTTP/HTTPS URLs are supported" }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Step 1: Check cache first (dedup by URL)
    const { data: cached } = await supabase
      .from("product_cache")
      .select("*")
      .eq("url", url)
      .maybeSingle();

    if (cached && cached.title) {
      // We have cached data — return it with price status
      const result: ProductInfo = {
        title: cached.title,
        imageUrl: cached.image_url,
        description: cached.description,
        price: cached.price,
        priceStatus: cached.price ? "cached" : "unavailable",
      };
      return new Response(JSON.stringify(result), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Step 2: Fetch the page and parse OG tags
    let productInfo: ProductInfo = {
      title: null,
      imageUrl: null,
      description: null,
      price: null,
      priceStatus: "none",
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const fetchResponse = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; NeoBuildBot/1.0; +https://neobuild.app)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        },
      });
      clearTimeout(timeoutId);

      if (fetchResponse.ok) {
        const html = await fetchResponse.text();

        productInfo.title = extractTitle(html);
        productInfo.imageUrl = extractImage(html);
        productInfo.description = extractDescription(html);

        const extractedPrice = extractPrice(html);
        if (extractedPrice !== null) {
          productInfo.price = extractedPrice;
          productInfo.priceStatus = "cached";
        } else {
          productInfo.priceStatus = "unavailable";
        }
      }
    } catch {
      // Network error or timeout — we'll still return what we have
      productInfo.priceStatus = "unavailable";
    }

    // Step 3: Save to cache (upsert by url)
    const platform = detectPlatformFromUrl(url);
    const cacheData = {
      url,
      platform,
      title: productInfo.title,
      image_url: productInfo.imageUrl,
      description: productInfo.description,
      price: productInfo.price,
      price_updated_at: productInfo.price ? new Date().toISOString() : null,
      fetched_at: new Date().toISOString(),
    };

    await supabase
      .from("product_cache")
      .upsert(cacheData, { onConflict: "url" });

    return new Response(JSON.stringify(productInfo), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
