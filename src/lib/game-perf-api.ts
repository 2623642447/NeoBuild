/**
 * Game Performance Analysis Engine
 *
 * FPS calculation based on ratio-based algorithm with bottleneck detection,
 * diminishing returns soft caps, and resolution scaling.
 *
 * Data source: game_db.json (CPU/GPU benchmark scores + game requirements)
 */

import gameDB from '@/data/game_db.json'
import { supabase } from './supabase'

// ===================== Types =====================

export type Resolution = '1080p' | '1440p' | '4K'

export interface GamePerfResult {
  game: string
  gameCN: string
  fps: Record<Resolution, number>
  tier: Record<Resolution, string>
  bottleneck: 'gpu' | 'cpu'
}

export interface HardwareMatch {
  name: string
  score: number
  confidence: 'exact' | 'high' | 'medium' | 'low' | 'manual'
}

export interface PerfAnalysisResponse {
  cpu: string | null
  gpu: string | null
  cpuMatched: HardwareMatch | null
  gpuMatched: HardwareMatch | null
  results: GamePerfResult[]
  analyzedAt: string
  matched: boolean
}

// ===================== Resolution Constants =====================

export const RES_FACTORS: Record<Resolution, number> = {
  '1080p': 1.0,
  '1440p': 1.78,
  '4K': 4.0,
}

export const RES_LABELS: Record<Resolution, string> = {
  '1080p': '1080p',
  '1440p': '2K',
  '4K': '4K',
}

// ===================== Hardware Matching Engine =====================

/**
 * Normalize a hardware name for comparison.
 * Handles e-commerce titles with Chinese names, brackets, and marketing noise.
 *
 * Input:  "【AMD AMD 锐龙 7 9800X3D】AMD锐龙 7 9800X3D 游戏处理器 8核16线程..."
 * Output: "amd amd 锐龙 7 9800x3d amd 锐龙 7 9800x3d 游戏处理器 8核16线程..."
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove 【】brackets and their content (e-commerce tags like 【行情 报价 价格 评测】)
    .replace(/【[^】]*】/g, ' ')
    // Remove trailing e-commerce noise
    .replace(/[-—]\s*京东$|[-—]\s*淘宝$|[-—]\s*天猫$|[-—]\s*拼多多$/g, '')
    // Remove parenthetical notes: (Mobile), (APU), etc.
    .replace(/[(（][^)）]*[)）]/g, ' ')
    // Normalize whitespace
    .replace(/[\s\-_.]+/g, ' ')
    .trim()
}

/**
 * Chinese-to-English brand/model alias map for token extraction.
 * E-commerce titles often use Chinese names: 锐龙→Ryzen, 酷睿→Core, etc.
 */
const CN_ALIASES: Record<string, string> = {
  '锐龙': 'ryzen',
  '酷睿': 'core',
  '线程撕裂者': 'threadripper',
  '显卡': 'gpu',
  '处理器': 'cpu',
}

/**
 * Extract key model tokens from a hardware name.
 * Handles both English and Chinese e-commerce titles.
 *
 * Input examples:
 *   "【AMD AMD 锐龙 7 9800X3D】AMD锐龙 7 9800X3D 游戏处理器 8核16线程..."
 *   "技嘉（GIGABYTE）RTX 5080 显卡 魔鹰 GeForce RTX 5080 Gaming OC 16G"
 *   "Intel Core i9-14900K"
 */
function extractModelTokens(name: string): string[] {
  const norm = normalizeName(name)

  // Replace Chinese aliases with English equivalents for pattern matching
  let expanded = norm
  for (const [cn, en] of Object.entries(CN_ALIASES)) {
    expanded = expanded.replace(new RegExp(cn, 'g'), en)
  }

  const tokens: string[] = []

  // Intel Core i-series: i3/i5/i7/i9 + number (e.g., "i9 14900k", "i5 12400f")
  const intelMatch = expanded.match(/(i[3579])\s*(\d{4,5}[a-z]*)/i)
  if (intelMatch) {
    tokens.push(`${intelMatch[1]}${intelMatch[2]}`)  // e.g., "i914900k"
    tokens.push(intelMatch[2])                         // e.g., "14900k"
  }

  // Intel Ultra model: ultra + number (e.g., "ultra 9 285k")
  const ultraMatch = expanded.match(/ultra\s*([3579])\s*(\d{3}[a-z]*)/i)
  if (ultraMatch) {
    tokens.push(`ultra${ultraMatch[1]}${ultraMatch[2]}`)
    tokens.push(`${ultraMatch[2]}`)
  }

  // AMD Ryzen model: ryzen/r + tier + number (e.g., "ryzen 7 7800x3d", "r7 7800x3d")
  // Also matches "锐龙 7 9800x3d" after CN alias replacement
  const ryzenMatch = expanded.match(/(?:ryzen|r)\s*([3579])\s*(\d{4}[a-z0-9]*)/i)
  if (ryzenMatch) {
    tokens.push(`r${ryzenMatch[1]}${ryzenMatch[2]}`)   // e.g., "r77800x3d"
    tokens.push(ryzenMatch[2])                           // e.g., "7800x3d"
  }

  // AMD Threadripper model
  const threadripperMatch = expanded.match(/threadripper\s*(\w+)/i)
  if (threadripperMatch) {
    tokens.push(`threadripper${threadripperMatch[1]}`)
    tokens.push(threadripperMatch[1])
  }

  // NVIDIA GPU model: rtx/gtx + number + suffix (e.g., "rtx 4090", "gtx 1080 ti")
  const nvidiaMatch = expanded.match(/(rtx|gtx)\s*(\d{3,5})\s*(super|ti|s)?/i)
  if (nvidiaMatch) {
    const series = nvidiaMatch[1].toLowerCase()
    const model = nvidiaMatch[2]
    const suffix = (nvidiaMatch[3] || '').toLowerCase().trim()
    tokens.push(`${series}${model}${suffix}`)   // e.g., "rtx4090"
    tokens.push(`${model}${suffix}`)              // e.g., "4090"
    tokens.push(model)                             // e.g., "4090"
  }

  // AMD Radeon GPU model: rx + number (e.g., "rx 7900 xtx")
  const radeonMatch = expanded.match(/rx\s*(\d{4})\s*(xtx|xt|gre)?/i)
  if (radeonMatch) {
    const model = radeonMatch[1]
    const suffix = (radeonMatch[2] || '').toLowerCase().trim()
    tokens.push(`rx${model}${suffix}`)    // e.g., "rx7900xtx"
    tokens.push(`${model}${suffix}`)       // e.g., "7900xtx"
    tokens.push(model)                      // e.g., "7900"
  }

  // Intel Arc GPU model (e.g., "arc a770")
  const arcMatch = expanded.match(/arc\s*(a\d{3})/i)
  if (arcMatch) {
    tokens.push(`arc${arcMatch[1]}`)
    tokens.push(arcMatch[1])
  }

  // Vega model
  const vegaMatch = expanded.match(/vega\s*(\d+)/i)
  if (vegaMatch) {
    tokens.push(`vega${vegaMatch[1]}`)
  }

  // Fallback: extract bare model numbers like "9800x3d", "7800x3d", "14900k"
  // This catches cases where the prefix wasn't recognized
  const bareModelMatch = expanded.match(/\b(\d{4,5}[a-z]+\d*[a-z]*)\b/i)
  if (bareModelMatch && !tokens.some(t => t === bareModelMatch[1])) {
    tokens.push(bareModelMatch[1])   // e.g., "9800x3d"
  }

  return tokens
}

/**
 * Calculate match score between input name and a database entry.
 * Returns a score from 0-100 based on how well the names match.
 */
function calculateMatchScore(input: string, dbEntry: string): number {
  const inputNorm = normalizeName(input)
  const dbNorm = normalizeName(dbEntry)

  // Exact match after normalization
  if (inputNorm === dbNorm) return 100

  // One contains the other
  if (inputNorm.includes(dbNorm) || dbNorm.includes(inputNorm)) return 90

  // Token-based matching
  const inputTokens = extractModelTokens(input)
  const dbTokens = extractModelTokens(dbEntry)

  if (inputTokens.length === 0 || dbTokens.length === 0) return 0

  // Check how many input tokens match db tokens
  let matchedTokenScore = 0
  let bestTokenScore = 0

  for (const it of inputTokens) {
    for (const dt of dbTokens) {
      if (it === dt) {
        matchedTokenScore = Math.max(matchedTokenScore, 100)
      } else if (it.includes(dt) || dt.includes(it)) {
        // Partial token match - score based on length ratio
        const ratio = Math.min(it.length, dt.length) / Math.max(it.length, dt.length)
        matchedTokenScore = Math.max(matchedTokenScore, Math.round(ratio * 80))
      }
    }
    bestTokenScore = Math.max(bestTokenScore, matchedTokenScore)
    matchedTokenScore = 0
  }

  if (bestTokenScore > 0) return bestTokenScore

  // Fallback: substring match on normalized names
  // Extract just the numeric part for comparison
  const inputNums = inputNorm.replace(/[^0-9]/g, '')
  const dbNums = dbNorm.replace(/[^0-9]/g, '')

  if (inputNums && dbNums && (inputNums.includes(dbNums) || dbNums.includes(inputNums))) {
    return 50
  }

  return 0
}

/**
 * Find the best matching hardware from the database.
 * Returns null if no reasonable match is found (score < 30).
 */
function findBestMatch(
  input: string | null,
  db: readonly { name: string; score: number }[]
): HardwareMatch | null {
  if (!input || input.trim() === '') return null

  let bestMatch: HardwareMatch | null = null
  let bestScore = 0

  for (const entry of db) {
    const score = calculateMatchScore(input, entry.name)
    if (score > bestScore) {
      bestScore = score
      const confidence: HardwareMatch['confidence'] =
        score >= 100 ? 'exact' :
        score >= 70 ? 'high' :
        score >= 50 ? 'medium' : 'low'
      bestMatch = { name: entry.name, score: entry.score, confidence }
    }
  }

  // Only return matches with reasonable confidence
  return bestScore >= 30 ? bestMatch : null
}

// ===================== FPS Calculation Engine =====================

/**
 * Classify FPS into performance tier.
 */
export function classifyTier(fps: number): string {
  if (fps >= 144) return 'ultra'
  if (fps >= 60) return 'high'
  if (fps >= 45) return 'medium'
  if (fps >= 30) return 'low'
  return 'unplayable'
}

/**
 * Calculate FPS for a single game at a given resolution.
 *
 * Algorithm (from reference):
 * 1. Calculate raw performance ratios: gpuScore/reqGpu, cpuScore/reqCpu
 * 2. Bottleneck detection: performance limited by the weaker component
 * 3. Base FPS = 60 * rawPerformance
 * 4. Apply resolution scaling: fps / Math.sqrt(resFactor)
 * 5. Apply game optimization coefficient: fps * opt
 * 6. Soft cap: diminishing returns above 144 and 240 FPS
 * 7. Round and cap at 999
 */
function calculateFPS(
  cpuScore: number,
  gpuScore: number,
  reqCpu: number,
  reqGpu: number,
  opt: number,
  resFactor: number
): { fps: number; bottleneck: 'gpu' | 'cpu' } {
  // Step 1: Raw performance ratios
  const gpuPotential = gpuScore / reqGpu
  const cpuPotential = cpuScore / reqCpu

  // Step 2: Bottleneck - performance is limited by the weaker component
  let rawPerformance: number
  let bottleneck: 'gpu' | 'cpu'

  if (gpuPotential < cpuPotential) {
    rawPerformance = gpuPotential
    bottleneck = 'gpu'
  } else {
    rawPerformance = cpuPotential
    bottleneck = 'cpu'
  }

  // Step 3: Base FPS (60 fps is the target of recommended requirements)
  let fps = 60 * rawPerformance

  // Step 4: Apply resolution scaling
  fps = fps / Math.sqrt(resFactor)

  // Step 5: Apply game optimization coefficient
  fps = fps * opt

  // Step 6: Soft cap - diminishing returns
  if (fps > 144) {
    fps = 144 + (fps - 144) * 0.5
  }
  if (fps > 240) {
    fps = 240 + (fps - 240) * 0.25
  }

  // Step 7: Round and cap
  fps = Math.round(fps)
  if (fps > 999) fps = 999

  return { fps, bottleneck }
}

// ===================== Main Analysis Engine =====================

/**
 * Analyze game performance for a given CPU + GPU configuration.
 * Calculates FPS for all supported games at all resolutions.
 *
 * First attempts Edge Function, then falls back to local calculation.
 */
export async function analyzeGamePerformance(
  cpuName: string | null,
  gpuName: string | null
): Promise<PerfAnalysisResponse> {
  // Try Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke('game-perf-analysis', {
      body: { cpu: cpuName, gpu: gpuName },
    })
    if (!error && data?.results) {
      return data as PerfAnalysisResponse
    }
  } catch {
    // Edge Function not available, fall back to local calculation
  }

  // Local calculation using game_db.json
  return analyzeLocally(cpuName, gpuName)
}

// ===================== Short Display Name =====================

/**
 * Extract a short, recognizable model identifier from a matched hardware name.
 *
 * Examples:
 *   "AMD Ryzen 7 9800X3D"         → "9800X3D"
 *   "Intel Core i9-14900K"         → "i9-14900K"
 *   "Intel Core Ultra 9 285K"      → "Ultra 9 285K"
 *   "NVIDIA RTX 5080"              → "RTX 5080"
 *   "NVIDIA RTX 4070 Ti Super"     → "RTX 4070 Ti Super"
 *   "AMD Radeon RX 7900 XTX"       → "RX 7900 XTX"
 *   "Intel Arc A770 16GB"          → "Arc A770"
 */
export function getShortModelName(match: HardwareMatch | null, type: 'cpu' | 'gpu'): string {
  if (!match) return type === 'cpu' ? '未知CPU' : '未知显卡'
  const name = match.name

  if (type === 'gpu') {
    // NVIDIA: extract "RTX/GTX + model + suffix"
    const nvidiaMatch = name.match(/(RTX|GTX)\s+(\d{3,5}(?:\s+(?:Ti|Super|S))*)/i)
    if (nvidiaMatch) return nvidiaMatch[0].replace(/\s+/g, ' ').trim()

    // AMD Radeon: extract "RX + model + suffix"
    const radeonMatch = name.match(/(RX)\s+(\d{4}(?:\s+(?:XTX|XT|GRE))*)/i)
    if (radeonMatch) return radeonMatch[0].replace(/\s+/g, ' ').trim()

    // Intel Arc: extract "Arc + model"
    const arcMatch = name.match(/Arc\s+A\d{3}/i)
    if (arcMatch) return arcMatch[0]

    // Vega
    const vegaMatch = name.match(/Vega\s+\d+/i)
    if (vegaMatch) return vegaMatch[0]

    return name
  }

  // CPU
  // Intel Core i-series: extract "i3/i5/i7/i9 + model"
  const intelMatch = name.match(/(i[3579])[-\s](\d{4,5}[A-Z0-9]*)/i)
  if (intelMatch) return `${intelMatch[1]}-${intelMatch[2]}`

  // Intel Ultra: extract "Ultra + tier + model"
  const ultraMatch = name.match(/Ultra\s+([3579])\s+(\d{3}[A-Z0-9]*)/i)
  if (ultraMatch) return `Ultra ${ultraMatch[1]} ${ultraMatch[2]}`

  // AMD Ryzen: extract "model number + suffix" (e.g., 9800X3D, 7600X, 5600G)
  const ryzenMatch = name.match(/\b(\d{4}[A-Z0-9]*)\b/i)
  if (ryzenMatch) return ryzenMatch[1]

  // Threadripper
  const threadripperMatch = name.match(/Threadripper\s+(\w+)/i)
  if (threadripperMatch) return `Threadripper ${threadripperMatch[1]}`

  return name
}

// ===================== Tier Display Helpers =====================

export function getTierLabel(t: string): string {
  const map: Record<string, string> = {
    ultra: '极致', high: '流畅', medium: '中等', low: '勉强', unplayable: '卡顿',
  }
  return map[t] || t
}

export function getTierColor(t: string): string {
  const map: Record<string, string> = {
    ultra: 'text-emerald-500',
    high: 'text-primary',
    medium: 'text-yellow-500',
    low: 'text-orange-500',
    unplayable: 'text-destructive',
  }
  return map[t] || 'text-muted-foreground'
}

export function getTierBg(t: string): string {
  const map: Record<string, string> = {
    ultra: 'bg-emerald-500/10 border-emerald-500/20',
    high: 'bg-primary/10 border-primary/20',
    medium: 'bg-yellow-500/10 border-yellow-500/20',
    low: 'bg-orange-500/10 border-orange-500/20',
    unplayable: 'bg-destructive/10 border-destructive/20',
  }
  return map[t] || 'bg-muted border-border'
}

export function getConfidenceLabel(c: string): string {
  const map: Record<string, string> = {
    exact: '精确匹配',
    high: '高度匹配',
    medium: '近似匹配',
    low: '粗略估算',
    manual: '手动选择',
  }
  return map[c] || c
}

/** Export local analysis for manual hardware selection */
export function analyzeLocally(
  cpuName: string | null,
  gpuName: string | null
): PerfAnalysisResponse {
  const cpuMatch = findBestMatch(cpuName, gameDB.cpus)
  const gpuMatch = findBestMatch(gpuName, gameDB.gpus)
  const cpuScore = cpuMatch?.score ?? 10000
  const gpuScore = gpuMatch?.score ?? 5000

  const results: GamePerfResult[] = gameDB.games.map(game => {
    const fpsMap: Record<string, number> = {}
    const tierMap: Record<string, string> = {}
    const firstRes = calculateFPS(cpuScore, gpuScore, game.req_cpu, game.req_gpu, game.opt, 1.0)
    const primaryBottleneck = firstRes.bottleneck

    for (const [res, factor] of Object.entries(RES_FACTORS)) {
      const { fps } = calculateFPS(cpuScore, gpuScore, game.req_cpu, game.req_gpu, game.opt, factor)
      fpsMap[res] = fps
      tierMap[res] = classifyTier(fps)
    }

    return {
      game: game.name,
      gameCN: game.nameCN,
      fps: fpsMap as Record<Resolution, number>,
      tier: tierMap as Record<Resolution, string>,
      bottleneck: primaryBottleneck,
    }
  })

  return {
    cpu: cpuName,
    gpu: gpuName,
    cpuMatched: cpuMatch,
    gpuMatched: gpuMatch,
    results,
    analyzedAt: new Date().toISOString(),
    matched: (cpuMatch?.confidence !== 'low' && gpuMatch?.confidence !== 'low'),
  }
}

/** Export hardware database for picker UI */
export function getHardwareList(type: 'cpu' | 'gpu'): { name: string; score: number }[] {
  return type === 'cpu' ? [...gameDB.cpus] : [...gameDB.gpus]
}
