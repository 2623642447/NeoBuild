// @ts-nocheck — Supabase Edge Functions use Deno, not Node.js
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RATE_LIMIT = 15 // max requests per minute
const RATE_WINDOW = 60 * 1000 // 1 minute in ms

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

/**
 * Robust JSON extractor from Gemini response text.
 *
 * Gemini sometimes returns preamble text before the JSON even with
 * responseMimeType: "application/json" — e.g.:
 *   "Here is the JSON requested:\n\n{"itemName": "..."..."
 *   "```json\n{"itemName": "..."...```\n"
 *   '{"itemName": "..."...'
 *
 * This function tries multiple strategies:
 * 1. Direct JSON.parse (fast path for clean responses)
 * 2. Strip markdown code blocks then parse
 * 3. Extract first {...} block via brace matching
 * 4. Regex fallback for { through end of string
 */
function extractJSON(text: string): Record<string, unknown> | null {
  // Strategy 0: Direct parse (most common with responseMimeType)
  try {
    return JSON.parse(text)
  } catch {}

  // Strategy 1: Strip markdown code blocks
  try {
    const stripped = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim()
    return JSON.parse(stripped)
  } catch {}

  // Strategy 2: Find first '{' and extract balanced brace block
  const firstBrace = text.indexOf("{")
  if (firstBrace !== -1) {
    let depth = 0
    for (let i = firstBrace; i < text.length; i++) {
      if (text[i] === "{") depth++
      else if (text[i] === "}") depth--
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(firstBrace, i + 1))
        } catch {}
        break
      }
    }
  }

  // Strategy 3: Regex fallback — grab everything from first { to last }
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch {}
  }

  return null
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    // 1. Get authenticated user identity
    // Note: verify_jwt is enabled on this function, so Supabase already
    // validated the JWT before reaching here. We still call getUser() to
    // obtain the user ID for rate limiting.
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return jsonResponse({ error: "未登录" }, 401)
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? ""
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser()

    if (authError || !user) {
      return jsonResponse({ error: "登录已过期，请重新登录" }, 401)
    }

    // 2. Rate limiting — use service role client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const now = Date.now()
    const windowStart = new Date(now - RATE_WINDOW).toISOString()

    const { count, error: countError } = await adminClient
      .from("api_rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("endpoint", "extract-hardware")
      .gte("created_at", windowStart)

    if (countError) {
      console.error("Rate limit check error:", countError)
    }

    if (count && count >= RATE_LIMIT) {
      return jsonResponse(
        { error: "请求过于频繁，请稍后再试", retryAfter: 60 },
        429,
        { "Retry-After": "60" }
      )
    }

    // Record this request (fire-and-forget — don't block on it)
    adminClient
      .from("api_rate_limits")
      .insert({ user_id: user.id, endpoint: "extract-hardware" })
      .then(() => {}, (err: any) => console.error("Rate limit insert error:", err))

    // 3. Parse request body
    const body = await req.json()
    const { imageBase64, categoryHint } = body
    if (!imageBase64) {
      return jsonResponse({ error: "缺少图片数据" }, 400)
    }

    // 4. Call Gemini API
    const apiKey = Deno.env.get("GOOGLE_AI_API_KEY")
    if (!apiKey) {
      return jsonResponse({ error: "服务端未配置 AI API Key" }, 500)
    }

    // Use a specific model version for reliability — dynamic aliases like
    const GEMINI_MODEL = "gemini-2.5-flash-lite"

    const prompt = `你是 NeoBuild 装机助手的智能插件。你的任务是分析用户提供的电商（如京东、淘宝、拼多多）商品截图。

请从图片中精准提取以下信息：
1. **itemName**: 商品全称（包含核心参数，如 "i5-13600K 盒装"）。
2. **price**: 最终实付价格或券后价（纯数字，不带货币符号）。如果图中有多个价格，请优先选择"实付价"、"券后价"或"预估到手价"。
3. **brand**: 品牌名称（如 ASUS, Intel, NVIDIA）。
4. **category**: 配件类别（必须是以下之一：CPU, GPU, Motherboard, RAM, SSD, HDD, PSU, Cooler, Case, Fan, Monitor, Accessory）。
${
  categoryHint
    ? `\n提示：用户指定该配件属于 ${categoryHint} 类别，如果图片内容确实符合此类别请优先使用。`
    : ""
}

注意：
- 只输出一个 JSON 对象，不要包含任何解释文字、前言、markdown 代码块标记。
- 如果无法识别某个字段，请设为 null。

输出格式：
{"itemName": "...", "price": 1234, "brand": "...", "category": "..."}`

    // Extract base64 data and mime type
    const base64Match = imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/)
    const mimeType = base64Match ? base64Match[1] : "image/jpeg"
    const base64Data = base64Match ? base64Match[2] : imageBase64

    // Call Gemini using REST API (no npm dependency needed)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            // Increased from 256 to 512 — complex e-commerce screenshots
            // with Chinese text may need more tokens for complete JSON output.
            // 256 was causing truncated responses in some cases.
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      }
    )

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error("Gemini API error:", errText)
      return jsonResponse({ error: "AI 识别服务暂时不可用" }, 502)
    }

    const geminiData = await geminiResponse.json()

    // Check for safety filter blocks (Gemini may refuse certain images)
    const finishReason = geminiData?.candidates?.[0]?.finishReason
    if (finishReason === "SAFETY") {
      return jsonResponse({ error: "图片内容无法识别，请尝试其他截图" }, 422)
    }

    const text =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""

    if (!text) {
      // Log the full Gemini response for debugging when text is empty
      console.error("Empty Gemini text. Full response:", JSON.stringify(geminiData))
      return jsonResponse({ error: "AI 未能识别图片内容" }, 422)
    }

    // Parse JSON from response using robust extractor
    const extracted = extractJSON(text)
    if (!extracted) {
      console.error("Failed to parse Gemini response:", text)
      return jsonResponse({ error: "AI 返回格式异常，请重试" }, 502)
    }

    // 5. Clean up old rate limit entries (fire-and-forget)
    const cutoff = new Date(now - RATE_WINDOW * 2).toISOString()
    adminClient
      .from("api_rate_limits")
      .delete()
      .lt("created_at", cutoff)
      .then(() => {}, () => {})

    return jsonResponse(extracted)
  } catch (error) {
    console.error("Extract hardware error:", error)
    return jsonResponse({ error: "识别失败，请检查图片或手动输入" }, 500)
  }
})

function jsonResponse(data: any, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  })
}
