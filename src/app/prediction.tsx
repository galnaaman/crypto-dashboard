"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  TrendUp,
  TrendDown,
  Minus,
  ChartLineUp,
  Lightning,
  Gauge,
  ArrowFatUp,
  ArrowFatDown,
  Equals,
  Warning,
  Clock,
} from "@phosphor-icons/react";

/* ================================================================== */
/*  TYPES                                                              */
/* ================================================================== */
interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
}

interface Signal {
  name: string;
  value: string;
  direction: "bullish" | "bearish" | "neutral";
  strength: number; // -1 to 1
  description: string;
}

interface PredictionResult {
  signals: Signal[];
  overall: number; // -1 to 1
  label: string;
  confidence: number; // 0-100
}

/* ================================================================== */
/*  CACHE                                                              */
/* ================================================================== */
interface CacheEntry<T> { data: T; timestamp: number }
const predCache = new Map<string, CacheEntry<unknown>>();

async function cachedFetch<T>(url: string, ttl: number): Promise<T> {
  const cached = predCache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) return cached.data as T;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  predCache.set(url, { data, timestamp: Date.now() });
  return data as T;
}

/* ================================================================== */
/*  TECHNICAL ANALYSIS                                                 */
/* ================================================================== */
function calcSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    const slice = data.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

function calcRSI(data: number[], period = 14): number {
  if (data.length < period + 1) return 50;
  const changes: number[] = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i] - data[i - 1]);
  }
  const recent = changes.slice(-period);
  let gains = 0, losses = 0;
  recent.forEach((c) => {
    if (c > 0) gains += c;
    else losses += Math.abs(c);
  });
  gains /= period;
  losses /= period;
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function calcMACD(data: number[]): { macd: number; signal: number; histogram: number } {
  const ema12 = calcEMA(data, 12);
  const ema26 = calcEMA(data, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = calcEMA(macdLine, 9);
  const last = macdLine.length - 1;
  return {
    macd: macdLine[last],
    signal: signalLine[last],
    histogram: macdLine[last] - signalLine[last],
  };
}

function calcBollinger(data: number[], period = 20): { upper: number; middle: number; lower: number; position: number } {
  const sma = calcSMA(data, period);
  const last = data.length - 1;
  const middle = sma[last];
  const slice = data.slice(-period);
  const std = Math.sqrt(slice.reduce((s, v) => s + (v - middle) ** 2, 0) / period);
  const upper = middle + 2 * std;
  const lower = middle - 2 * std;
  const position = (data[last] - lower) / (upper - lower); // 0 = at lower, 1 = at upper
  return { upper, middle, lower, position };
}

function analyze(prices: number[], volumes: number[]): PredictionResult {
  const signals: Signal[] = [];

  // 1. RSI
  const rsi = calcRSI(prices);
  let rsiDir: Signal["direction"] = "neutral";
  let rsiStr = 0;
  if (rsi < 30) { rsiDir = "bullish"; rsiStr = 0.8; }
  else if (rsi < 40) { rsiDir = "bullish"; rsiStr = 0.4; }
  else if (rsi > 70) { rsiDir = "bearish"; rsiStr = -0.8; }
  else if (rsi > 60) { rsiDir = "bearish"; rsiStr = -0.4; }
  signals.push({
    name: "RSI (14)",
    value: rsi.toFixed(1),
    direction: rsiDir,
    strength: rsiStr,
    description: rsi < 30 ? "Oversold — bounce likely" : rsi > 70 ? "Overbought — correction likely" : rsi < 40 ? "Approaching oversold" : rsi > 60 ? "Approaching overbought" : "Neutral zone",
  });

  // 2. SMA Cross
  const sma20 = calcSMA(prices, 20);
  const sma50 = calcSMA(prices, 50);
  const last = prices.length - 1;
  const smaDiff = sma20[last] - sma50[last];
  const smaRatio = smaDiff / sma50[last];
  const smaPrev = sma20[last - 1] - sma50[last - 1];
  let smaDir: Signal["direction"] = smaDiff > 0 ? "bullish" : "bearish";
  let smaStr = Math.min(Math.abs(smaRatio) * 10, 1) * (smaDiff > 0 ? 1 : -1);
  const crossedUp = smaPrev <= 0 && smaDiff > 0;
  const crossedDown = smaPrev >= 0 && smaDiff < 0;
  signals.push({
    name: "SMA 20/50",
    value: crossedUp ? "Golden Cross" : crossedDown ? "Death Cross" : smaDiff > 0 ? "Bullish" : "Bearish",
    direction: smaDir,
    strength: smaStr,
    description: crossedUp ? "Golden cross just formed — strong buy signal" : crossedDown ? "Death cross just formed — strong sell signal" : smaDiff > 0 ? `SMA20 is ${((smaRatio) * 100).toFixed(2)}% above SMA50` : `SMA20 is ${((Math.abs(smaRatio)) * 100).toFixed(2)}% below SMA50`,
  });

  // 3. MACD
  const macd = calcMACD(prices);
  let macdDir: Signal["direction"] = macd.histogram > 0 ? "bullish" : "bearish";
  let macdStr = Math.min(Math.abs(macd.histogram) / (prices[last] * 0.002), 1) * (macd.histogram > 0 ? 1 : -1);
  signals.push({
    name: "MACD",
    value: macd.histogram > 0 ? "Bullish" : "Bearish",
    direction: macdDir,
    strength: macdStr,
    description: macd.histogram > 0
      ? `MACD above signal line — momentum is positive`
      : `MACD below signal line — momentum is negative`,
  });

  // 4. Bollinger Bands
  const bb = calcBollinger(prices);
  let bbDir: Signal["direction"] = "neutral";
  let bbStr = 0;
  if (bb.position < 0.15) { bbDir = "bullish"; bbStr = 0.7; }
  else if (bb.position < 0.3) { bbDir = "bullish"; bbStr = 0.3; }
  else if (bb.position > 0.85) { bbDir = "bearish"; bbStr = -0.7; }
  else if (bb.position > 0.7) { bbDir = "bearish"; bbStr = -0.3; }
  signals.push({
    name: "Bollinger Bands",
    value: `${(bb.position * 100).toFixed(0)}%`,
    direction: bbDir,
    strength: bbStr,
    description: bb.position < 0.15 ? "Near lower band — oversold" : bb.position > 0.85 ? "Near upper band — overbought" : "Within normal range",
  });

  // 5. Volume trend
  const recentVol = volumes.slice(-7).reduce((a, b) => a + b, 0) / 7;
  const prevVol = volumes.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
  const volChange = (recentVol - prevVol) / prevVol;
  const priceChange = (prices[last] - prices[last - 7]) / prices[last - 7];
  let volDir: Signal["direction"] = "neutral";
  let volStr = 0;
  if (volChange > 0.1 && priceChange > 0) { volDir = "bullish"; volStr = 0.5; }
  else if (volChange > 0.1 && priceChange < 0) { volDir = "bearish"; volStr = -0.5; }
  signals.push({
    name: "Volume Trend",
    value: `${volChange > 0 ? "+" : ""}${(volChange * 100).toFixed(0)}%`,
    direction: volDir,
    strength: volStr,
    description: volDir === "bullish" ? "Rising volume + rising price — confirms uptrend" : volDir === "bearish" ? "Rising volume + falling price — confirms downtrend" : "Volume is stable",
  });

  // Overall
  const weights = [0.25, 0.2, 0.2, 0.2, 0.15];
  const overall = signals.reduce((s, sig, i) => s + sig.strength * weights[i], 0);
  const absOverall = Math.abs(overall);
  const confidence = Math.round(absOverall * 100);
  let label: string;
  if (overall > 0.4) label = "Strong Buy";
  else if (overall > 0.15) label = "Buy";
  else if (overall > -0.15) label = "Neutral";
  else if (overall > -0.4) label = "Sell";
  else label = "Strong Sell";

  return { signals, overall, label, confidence };
}

/* ================================================================== */
/*  GAUGE                                                              */
/* ================================================================== */
function PredictionGauge({ value, label }: { value: number; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = 260;
    const H = 150;
    canvasRef.current!.width = W * dpr;
    canvasRef.current!.height = H * dpr;
    ctx.scale(dpr, dpr);

    const cx = W / 2;
    const cy = H - 20;
    const r = 100;
    const startAngle = Math.PI;
    const endAngle = 2 * Math.PI;

    // Background arc
    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    // Gradient segments: red → yellow → green → yellow → red
    const segments = [
      { start: 0, end: 0.2, color: "#ef4444" },
      { start: 0.2, end: 0.35, color: "#f97316" },
      { start: 0.35, end: 0.45, color: "#eab308" },
      { start: 0.45, end: 0.55, color: "#a3a3a3" },
      { start: 0.55, end: 0.65, color: "#eab308" },
      { start: 0.65, end: 0.8, color: "#22c55e" },
      { start: 0.8, end: 1, color: "#059669" },
    ];

    segments.forEach((seg) => {
      ctx.beginPath();
      ctx.strokeStyle = seg.color + "30";
      ctx.arc(cx, cy, r, startAngle + seg.start * Math.PI, startAngle + seg.end * Math.PI);
      ctx.stroke();
    });

    // Active arc
    const normalized = (value + 1) / 2; // -1..1 → 0..1
    const activeAngle = startAngle + normalized * Math.PI;

    // Find color for current position
    const activeColor = normalized > 0.65 ? "#059669" : normalized > 0.55 ? "#22c55e" : normalized > 0.45 ? "#a3a3a3" : normalized > 0.35 ? "#eab308" : normalized > 0.2 ? "#f97316" : "#ef4444";

    // Needle
    const nx = cx + (r - 5) * Math.cos(activeAngle);
    const ny = cy + (r - 5) * Math.sin(activeAngle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = activeColor;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = activeColor;
    ctx.fill();

    // Glow
    ctx.beginPath();
    ctx.arc(nx, ny, 4, 0, Math.PI * 2);
    ctx.fillStyle = activeColor;
    ctx.shadowColor = activeColor;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // Labels
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "9px monospace";
    ctx.textAlign = "left";
    ctx.fillText("SELL", 15, cy + 5);
    ctx.textAlign = "right";
    ctx.fillText("BUY", W - 15, cy + 5);
    ctx.textAlign = "center";
    ctx.fillText("NEUTRAL", cx, 25);
  }, [value]);

  const color = value > 0.15 ? "#059669" : value < -0.15 ? "#ef4444" : "#a1a1aa";

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} style={{ width: 260, height: 150 }} className="block" />
      <p className="mt-1 text-xl font-bold tracking-tight" style={{ color }}>{label}</p>
    </div>
  );
}

/* ================================================================== */
/*  SIGNAL ROW                                                         */
/* ================================================================== */
function SignalRow({ signal }: { signal: Signal }) {
  const Icon = signal.direction === "bullish" ? ArrowFatUp : signal.direction === "bearish" ? ArrowFatDown : Equals;
  const color = signal.direction === "bullish" ? "#059669" : signal.direction === "bearish" ? "#ef4444" : "#a1a1aa";
  const bg = signal.direction === "bullish" ? "rgba(5,150,105,0.06)" : signal.direction === "bearish" ? "rgba(239,68,68,0.06)" : "rgba(161,161,170,0.06)";

  return (
    <div className="flex items-center gap-3 border-b border-black/[0.03] py-3 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: bg }}>
        <Icon weight="fill" size={14} style={{ color }} />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-800">{signal.name}</span>
          <span className="font-mono text-sm font-semibold tabular-nums" style={{ color }}>
            {signal.value}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-zinc-400">{signal.description}</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export function BitcoinPrediction() {
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState("");

  const fetchAndAnalyze = useCallback(async () => {
    try {
      setLoading(true);
      // Get 90 days of daily data
      const data = await cachedFetch<{ prices: [number, number][]; total_volumes: [number, number][] }>(
        "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=90&interval=daily",
        300_000 // 5 min cache
      );

      const prices = data.prices.map((p) => p[1]);
      const volumes = data.total_volumes.map((v) => v[1]);

      const prediction = analyze(prices, volumes);
      setResult(prediction);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch {
      setError("Failed to fetch data — CoinGecko rate limit");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAndAnalyze();
    const interval = setInterval(fetchAndAnalyze, 300_000); // 5 min
    return () => clearInterval(interval);
  }, [fetchAndAnalyze]);

  return (
    <div className="rounded-[1.5rem] bg-white/60 p-1.5 ring-1 ring-black/[0.04] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)]">
      <div className="rounded-[calc(1.5rem-0.375rem)] bg-white p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 ring-1 ring-amber-200/30">
              <Gauge weight="bold" size={16} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-zinc-900">Bitcoin Prediction</h2>
              <p className="text-xs text-zinc-400">Technical analysis based on 90-day data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastUpdate && (
              <div className="flex items-center gap-1 rounded-full bg-zinc-50 px-2.5 py-1 ring-1 ring-black/[0.04]">
                <Clock weight="regular" size={10} className="text-zinc-300" />
                <span className="font-mono text-[9px] tracking-wider text-zinc-300">{lastUpdate}</span>
              </div>
            )}
          </div>
        </div>

        {loading && !result && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-[150px] w-[260px] rounded-xl bg-zinc-50 animate-pulse" />
            <div className="h-4 w-32 rounded bg-zinc-100 animate-pulse" />
          </div>
        )}

        {error && !result && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200/50">
            <Warning weight="bold" size={16} /> {error}
          </div>
        )}

        {result && (
          <>
            {/* Gauge */}
            <div className="mb-6 flex justify-center">
              <PredictionGauge value={result.overall} label={result.label} />
            </div>

            {/* Confidence */}
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-2 rounded-full bg-zinc-50 px-4 py-2 ring-1 ring-black/[0.04]">
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">Confidence</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                    style={{
                      width: `${result.confidence}%`,
                      backgroundColor: result.overall > 0.15 ? "#059669" : result.overall < -0.15 ? "#ef4444" : "#a1a1aa",
                    }}
                  />
                </div>
                <span className="font-mono text-xs font-semibold tabular-nums text-zinc-600">{result.confidence}%</span>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mb-5 rounded-xl bg-amber-50/50 px-4 py-2.5 text-center">
              <p className="font-mono text-[9px] tracking-wider text-amber-600/70">
                TECHNICAL ANALYSIS ONLY — NOT FINANCIAL ADVICE — PAST PERFORMANCE ≠ FUTURE RESULTS
              </p>
            </div>

            {/* Signals */}
            <div className="flex flex-col">
              {result.signals.map((s) => (
                <SignalRow key={s.name} signal={s} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
