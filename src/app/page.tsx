"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  TrendUp,
  TrendDown,
  CurrencyBtc,
  Lightning,
  ChartLineUp,
  ArrowsClockwise,
  Globe,
} from "@phosphor-icons/react";

/* ================================================================== */
/*  TYPES                                                              */
/* ================================================================== */
interface Coin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  sparkline_in_7d: { price: number[] };
  market_cap_rank: number;
  high_24h: number;
  low_24h: number;
}

interface GlobalData {
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
  active_cryptocurrencies: number;
}

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */
function fmt(n: number, decimals = 2): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

function pctColor(pct: number): string {
  return pct >= 0 ? "#059669" : "#dc2626";
}

function pctBg(pct: number): string {
  return pct >= 0 ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)";
}

/* ================================================================== */
/*  SPARKLINE                                                          */
/* ================================================================== */
function Sparkline({ data, color, width = 120, height = 40 }: { data: number[]; color: string; width?: number; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !data.length) return;
    const dpr = window.devicePixelRatio || 1;
    const canvas = canvasRef.current!;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const step = width / (data.length - 1);

    // gradient fill
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, color + "18");
    grad.addColorStop(1, color + "00");

    ctx.beginPath();
    ctx.moveTo(0, height);
    data.forEach((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height * 0.85) - height * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // line
    ctx.beginPath();
    data.forEach((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * (height * 0.85) - height * 0.05;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.stroke();
  }, [data, color, width, height]);

  return <canvas ref={canvasRef} style={{ width, height }} className="block" />;
}

/* ================================================================== */
/*  COMPONENTS                                                         */
/* ================================================================== */
function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Globe; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
      <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-50 ring-1 ring-black/[0.04]">
          <Icon weight="regular" size={18} className="text-zinc-400" />
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">{label}</p>
        <p className="mt-0.5 text-xl font-bold tracking-tight text-zinc-900">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
      </div>
    </div>
  );
}

function CoinRow({ coin, rank }: { coin: Coin; rank: number }) {
  const pct = coin.price_change_percentage_24h || 0;
  const up = pct >= 0;
  const sparkData = coin.sparkline_in_7d?.price || [];
  // sample sparkline to ~30 points
  const sampled = sparkData.length > 30
    ? sparkData.filter((_, i) => i % Math.floor(sparkData.length / 30) === 0)
    : sparkData;

  return (
    <div className="group flex items-center gap-4 border-b border-black/[0.03] px-5 py-4 transition-colors duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] last:border-0 hover:bg-zinc-50/60">
      {/* Rank */}
      <span className="w-6 font-mono text-[11px] tabular-nums text-zinc-300">{rank}</span>

      {/* Icon + Name */}
      <div className="flex items-center gap-3 w-[180px]">
        <img src={coin.image} alt={coin.name} width={28} height={28} className="rounded-full ring-1 ring-black/[0.04]" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-zinc-900">{coin.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{coin.symbol}</p>
        </div>
      </div>

      {/* Price */}
      <div className="w-[120px] text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900">{fmtPrice(coin.current_price)}</p>
      </div>

      {/* 24h change */}
      <div className="w-[90px] flex justify-end">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-medium tabular-nums"
          style={{ color: pctColor(pct), backgroundColor: pctBg(pct) }}
        >
          {up ? <TrendUp weight="bold" size={12} /> : <TrendDown weight="bold" size={12} />}
          {Math.abs(pct).toFixed(2)}%
        </span>
      </div>

      {/* Sparkline */}
      <div className="hidden w-[120px] md:flex justify-end">
        {sampled.length > 2 && (
          <Sparkline data={sampled} color={pctColor(pct)} width={100} height={32} />
        )}
      </div>

      {/* Market cap */}
      <div className="hidden w-[100px] lg:block text-right">
        <p className="font-mono text-xs tabular-nums text-zinc-500">{fmt(coin.market_cap, 1)}</p>
      </div>

      {/* Volume */}
      <div className="hidden w-[100px] xl:block text-right">
        <p className="font-mono text-xs tabular-nums text-zinc-400">{fmt(coin.total_volume, 1)}</p>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  PAGE                                                               */
/* ================================================================== */
export default function CryptoDashboard() {
  const [coins, setCoins] = useState<Coin[]>([]);
  const [global, setGlobal] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [coinsRes, globalRes] = await Promise.all([
        fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h"
        ),
        fetch("https://api.coingecko.com/api/v3/global"),
      ]);

      if (!coinsRes.ok || !globalRes.ok) throw new Error("API rate limited");

      const coinsData = await coinsRes.json();
      const globalData = await globalRes.json();

      setCoins(coinsData);
      setGlobal(globalData.data);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
      setLoading(false);
    } catch (e) {
      setError("CoinGecko rate limit — retrying in 30s");
      setTimeout(fetchData, 30000);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const topGainers = [...coins].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)).slice(0, 3);
  const topLosers = [...coins].sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)).slice(0, 3);

  return (
    <div className="min-h-[100dvh] bg-[#FAFAFA]">
      {/* Subtle noise */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1400px] px-6 py-8 md:px-10 lg:py-12">
        {/* Header */}
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
                <ChartLineUp weight="bold" size={16} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold tracking-tighter text-zinc-900 sm:text-3xl">
                Crypto Market
              </h1>
            </div>
            <p className="text-sm text-zinc-400">
              Live data from CoinGecko — top 20 by market cap
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="font-mono text-[10px] tracking-wider text-zinc-300">
                Updated {lastUpdate}
              </span>
            )}
            <button
              onClick={fetchData}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-black/[0.06] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:ring-black/[0.1] active:scale-[0.94]"
            >
              <ArrowsClockwise weight="regular" size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200/50">
            {error}
          </div>
        )}

        {/* Global stats — bento */}
        {global && (
          <div className="mb-10 grid gap-3 grid-cols-2 md:grid-cols-4">
            <StatCard
              icon={Globe}
              label="Market Cap"
              value={fmt(global.total_market_cap?.usd || 0, 2)}
              sub={`${global.market_cap_change_percentage_24h_usd >= 0 ? "+" : ""}${global.market_cap_change_percentage_24h_usd?.toFixed(2)}% (24h)`}
            />
            <StatCard
              icon={Lightning}
              label="24h Volume"
              value={fmt(global.total_volume?.usd || 0, 1)}
            />
            <StatCard
              icon={CurrencyBtc}
              label="BTC Price"
              value={coins[0] ? fmtPrice(coins[0].current_price) : "..."}
              sub={coins[0] ? `${coins[0].price_change_percentage_24h >= 0 ? "+" : ""}${coins[0].price_change_percentage_24h?.toFixed(2)}%` : ""}
            />
            <StatCard
              icon={ChartLineUp}
              label="Active Coins"
              value={global.active_cryptocurrencies?.toLocaleString() || "..."}
            />
          </div>
        )}

        {/* Gainers & Losers */}
        {coins.length > 0 && (
          <div className="mb-10 grid gap-3 md:grid-cols-2">
            {/* Gainers */}
            <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
              <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-600">
                  <TrendUp weight="bold" size={12} /> Top gainers 24h
                </p>
                <div className="flex flex-col gap-3">
                  {topGainers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img src={c.image} alt={c.name} width={24} height={24} className="rounded-full" />
                        <span className="text-sm font-medium text-zinc-800">{c.name}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600">
                        +{(c.price_change_percentage_24h || 0).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Losers */}
            <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
              <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-500">
                  <TrendDown weight="bold" size={12} /> Top losers 24h
                </p>
                <div className="flex flex-col gap-3">
                  {topLosers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <img src={c.image} alt={c.name} width={24} height={24} className="rounded-full" />
                        <span className="text-sm font-medium text-zinc-800">{c.name}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-red-500">
                        {(c.price_change_percentage_24h || 0).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Coin table */}
        <div className="rounded-[1.5rem] bg-white/60 p-1.5 ring-1 ring-black/[0.04] shadow-[0_4px_24px_-4px_rgba(0,0,0,0.04)]">
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            {/* Table header */}
            <div className="flex items-center gap-4 border-b border-black/[0.04] px-5 py-3">
              <span className="w-6 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">#</span>
              <span className="w-[180px] font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Coin</span>
              <span className="w-[120px] text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Price</span>
              <span className="w-[90px] text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">24h</span>
              <span className="hidden w-[120px] md:block text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">7d Chart</span>
              <span className="hidden w-[100px] lg:block text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Mkt Cap</span>
              <span className="hidden w-[100px] xl:block text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Volume</span>
            </div>

            {/* Loading skeleton */}
            {loading && (
              <div className="flex flex-col">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.02]">
                    <div className="h-3 w-4 rounded bg-zinc-100 animate-pulse" />
                    <div className="flex items-center gap-3 w-[180px]">
                      <div className="h-7 w-7 rounded-full bg-zinc-100 animate-pulse" />
                      <div>
                        <div className="h-3 w-16 rounded bg-zinc-100 animate-pulse mb-1" />
                        <div className="h-2 w-8 rounded bg-zinc-50 animate-pulse" />
                      </div>
                    </div>
                    <div className="w-[120px] flex justify-end"><div className="h-3 w-20 rounded bg-zinc-100 animate-pulse" /></div>
                    <div className="w-[90px] flex justify-end"><div className="h-5 w-16 rounded-full bg-zinc-50 animate-pulse" /></div>
                  </div>
                ))}
              </div>
            )}

            {/* Coins */}
            {!loading &&
              coins.map((coin, i) => (
                <CoinRow key={coin.id} coin={coin} rank={i + 1} />
              ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <p className="font-mono text-[9px] tracking-[0.15em] text-zinc-300">
            DATA: COINGECKO API // REFRESHES EVERY 60s
          </p>
          <p className="font-mono text-[9px] tracking-[0.15em] text-zinc-300">
            BUILT BY AI AGENT // ZERO HUMAN CODE
          </p>
        </div>
      </div>
    </div>
  );
}
