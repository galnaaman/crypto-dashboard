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
  X,
  ArrowSquareOut,
  Clock,
  CaretUp,
  CaretDown,
  Database,
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

interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  image: { large: string };
  description: { en: string };
  links: { homepage: string[]; blockchain_site: string[]; subreddit_url: string };
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    high_24h: { usd: number };
    low_24h: { usd: number };
    price_change_percentage_1h_in_currency: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    price_change_percentage_1y: number;
    ath: { usd: number };
    ath_change_percentage: { usd: number };
    ath_date: { usd: string };
    atl: { usd: number };
    atl_date: { usd: string };
    circulating_supply: number;
    total_supply: number | null;
    max_supply: number | null;
    fully_diluted_valuation: { usd: number };
    sparkline_7d: { price: number[] };
  };
  market_cap_rank: number;
}

interface GlobalData {
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
  active_cryptocurrencies: number;
}

/* ================================================================== */
/*  CACHE                                                              */
/* ================================================================== */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_LIST = 60_000;       // 1 min for coin list
const CACHE_TTL_GLOBAL = 120_000;    // 2 min for global
const CACHE_TTL_DETAIL = 300_000;    // 5 min for coin detail

async function cachedFetch<T>(url: string, ttl: number): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data as T;
}

/* ================================================================== */
/*  HELPERS                                                            */
/* ================================================================== */
function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(decimals)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(decimals)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(decimals)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(decimals)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(6)}`;
}

function pctColor(pct: number | null | undefined): string {
  if (pct == null) return "#71717a";
  return pct >= 0 ? "#059669" : "#dc2626";
}

function pctBg(pct: number): string {
  return pct >= 0 ? "rgba(5,150,105,0.06)" : "rgba(220,38,38,0.06)";
}

function pctStr(pct: number | null | undefined): string {
  if (pct == null) return "—";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").slice(0, 300);
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
/*  STAT CARD                                                          */
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

/* ================================================================== */
/*  DETAIL DRAWER                                                      */
/* ================================================================== */
function DetailDrawer({ coinId, onClose }: { coinId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    cachedFetch<CoinDetail>(
      `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`,
      CACHE_TTL_DETAIL
    )
      .then((d) => { setDetail(d); setLoading(false); })
      .catch(() => { setError("Rate limited — try again in a moment"); setLoading(false); });
  }, [coinId]);

  // close on escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const md = detail?.market_data;
  const sparkData = md?.sparkline_7d?.price || [];
  const sampled = sparkData.length > 60
    ? sparkData.filter((_, i) => i % Math.floor(sparkData.length / 60) === 0)
    : sparkData;
  const pct24 = md?.price_change_percentage_24h ?? 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[520px] flex-col border-l border-black/[0.04] bg-[#FAFAFA] shadow-[-20px_0_60px_-10px_rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/[0.04] bg-white px-6 py-4">
          {detail ? (
            <div className="flex items-center gap-3">
              <img src={detail.image.large} alt={detail.name} width={36} height={36} className="rounded-full ring-1 ring-black/[0.04]" />
              <div>
                <h2 className="text-lg font-bold tracking-tight text-zinc-900">{detail.name}</h2>
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
                  {detail.symbol} · Rank #{detail.market_cap_rank}
                </p>
              </div>
            </div>
          ) : (
            <div className="h-9 w-40 rounded bg-zinc-100 animate-pulse" />
          )}
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-50 ring-1 ring-black/[0.04] transition-all hover:bg-zinc-100 active:scale-[0.94]"
          >
            <X weight="bold" size={14} className="text-zinc-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {loading && (
            <div className="flex flex-col gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-white animate-pulse" />
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200/50">
              {error}
            </div>
          )}

          {detail && md && (
            <div className="flex flex-col gap-5">
              {/* Price + Change */}
              <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
                <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">Current Price</p>
                  <div className="mt-1 flex items-baseline gap-3">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-zinc-900">
                      {fmtPrice(md.current_price.usd)}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-medium tabular-nums"
                      style={{ color: pctColor(pct24), backgroundColor: pctBg(pct24) }}
                    >
                      {pct24 >= 0 ? <CaretUp weight="fill" size={10} /> : <CaretDown weight="fill" size={10} />}
                      {Math.abs(pct24).toFixed(2)}%
                    </span>
                  </div>
                  {/* Sparkline large */}
                  {sampled.length > 2 && (
                    <div className="mt-4">
                      <Sparkline data={sampled} color={pctColor(pct24)} width={440} height={100} />
                      <p className="mt-1 text-right font-mono text-[9px] text-zinc-300">7 DAY</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Price changes grid */}
              <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
                <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">Price Change</p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: "1h", val: md.price_change_percentage_1h_in_currency?.usd },
                      { label: "24h", val: md.price_change_percentage_24h },
                      { label: "7d", val: md.price_change_percentage_7d },
                      { label: "30d", val: md.price_change_percentage_30d },
                    ].map((p) => (
                      <div key={p.label} className="text-center">
                        <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-300">{p.label}</p>
                        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums" style={{ color: pctColor(p.val) }}>
                          {pctStr(p.val)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Market Data */}
              <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
                <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                  <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">Market Data</p>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { label: "Market Cap", value: fmt(md.market_cap.usd) },
                      { label: "24h Volume", value: fmt(md.total_volume.usd) },
                      { label: "FDV", value: fmt(md.fully_diluted_valuation?.usd) },
                      { label: "24h High", value: fmtPrice(md.high_24h.usd) },
                      { label: "24h Low", value: fmtPrice(md.low_24h.usd) },
                      { label: "Circulating Supply", value: fmtNum(md.circulating_supply) },
                      { label: "Total Supply", value: md.total_supply ? fmtNum(md.total_supply) : "—" },
                      { label: "Max Supply", value: md.max_supply ? fmtNum(md.max_supply) : "Unlimited" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-center justify-between border-b border-black/[0.02] pb-2 last:border-0 last:pb-0">
                        <span className="text-xs text-zinc-400">{row.label}</span>
                        <span className="font-mono text-xs font-medium tabular-nums text-zinc-700">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ATH / ATL */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
                  <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-emerald-500">All-Time High</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900">{fmtPrice(md.ath.usd)}</p>
                    <p className="font-mono text-[10px] tabular-nums text-red-400">{pctStr(md.ath_change_percentage.usd)}</p>
                    <p className="font-mono text-[9px] text-zinc-300">{new Date(md.ath_date.usd).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
                  <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-4">
                    <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-red-400">All-Time Low</p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-zinc-900">{fmtPrice(md.atl.usd)}</p>
                    <p className="font-mono text-[9px] text-zinc-300">{new Date(md.atl_date.usd).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {detail.description?.en && (
                <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
                  <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-400">About</p>
                    <p className="text-sm leading-relaxed text-zinc-500">
                      {stripHtml(detail.description.en)}
                      {detail.description.en.length > 300 && "..."}
                    </p>
                  </div>
                </div>
              )}

              {/* Links */}
              {detail.links && (
                <div className="flex flex-wrap gap-2">
                  {detail.links.homepage?.filter(Boolean).slice(0, 1).map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-mono text-[10px] tracking-wider text-zinc-500 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08]"
                    >
                      <ArrowSquareOut weight="regular" size={12} /> Website
                    </a>
                  ))}
                  {detail.links.subreddit_url && (
                    <a
                      href={detail.links.subreddit_url}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-mono text-[10px] tracking-wider text-zinc-500 ring-1 ring-black/[0.04] transition-all hover:ring-black/[0.08]"
                    >
                      <ArrowSquareOut weight="regular" size={12} /> Reddit
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cache indicator */}
        <div className="border-t border-black/[0.04] bg-white px-6 py-3">
          <div className="flex items-center gap-2">
            <Database weight="regular" size={12} className="text-zinc-300" />
            <span className="font-mono text-[9px] tracking-wider text-zinc-300">
              CACHED {cache.size} ENTRIES · {Math.round([...cache.values()].reduce((s, e) => s + JSON.stringify(e.data).length, 0) / 1024)}KB IN MEMORY
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ================================================================== */
/*  COIN ROW                                                           */
/* ================================================================== */
function CoinRow({ coin, rank, onClick }: { coin: Coin; rank: number; onClick: () => void }) {
  const pct = coin.price_change_percentage_24h || 0;
  const up = pct >= 0;
  const sparkData = coin.sparkline_in_7d?.price || [];
  const sampled = sparkData.length > 30
    ? sparkData.filter((_, i) => i % Math.floor(sparkData.length / 30) === 0)
    : sparkData;

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-4 border-b border-black/[0.03] px-5 py-4 transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] last:border-0 hover:bg-zinc-50/60"
    >
      <span className="w-6 font-mono text-[11px] tabular-nums text-zinc-300">{rank}</span>
      <div className="flex items-center gap-3 w-[180px]">
        <img src={coin.image} alt={coin.name} width={28} height={28} className="rounded-full ring-1 ring-black/[0.04]" />
        <div>
          <p className="text-sm font-semibold tracking-tight text-zinc-900 group-hover:text-zinc-700">{coin.name}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">{coin.symbol}</p>
        </div>
      </div>
      <div className="w-[120px] text-right">
        <p className="font-mono text-sm font-semibold tabular-nums text-zinc-900">{fmtPrice(coin.current_price)}</p>
      </div>
      <div className="w-[90px] flex justify-end">
        <span
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-xs font-medium tabular-nums"
          style={{ color: pctColor(pct), backgroundColor: pctBg(pct) }}
        >
          {up ? <TrendUp weight="bold" size={12} /> : <TrendDown weight="bold" size={12} />}
          {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
      <div className="hidden w-[120px] md:flex justify-end">
        {sampled.length > 2 && <Sparkline data={sampled} color={pctColor(pct)} width={100} height={32} />}
      </div>
      <div className="hidden w-[100px] lg:block text-right">
        <p className="font-mono text-xs tabular-nums text-zinc-500">{fmt(coin.market_cap, 1)}</p>
      </div>
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
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [coinsData, globalWrapper] = await Promise.all([
        cachedFetch<Coin[]>(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h",
          CACHE_TTL_LIST
        ),
        cachedFetch<{ data: GlobalData }>(
          "https://api.coingecko.com/api/v3/global",
          CACHE_TTL_GLOBAL
        ),
      ]);

      setCoins(coinsData);
      setGlobal(globalWrapper.data);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
      setLoading(false);
    } catch {
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
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-30 opacity-[0.018]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Detail drawer */}
      {selectedCoin && (
        <DetailDrawer coinId={selectedCoin} onClose={() => setSelectedCoin(null)} />
      )}

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
              Live data from CoinGecko — top 20 by market cap · click any coin for details
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-black/[0.04]">
              <Database weight="regular" size={12} className="text-zinc-300" />
              <span className="font-mono text-[9px] tracking-wider text-zinc-300">
                {cache.size} CACHED
              </span>
            </div>
            {lastUpdate && (
              <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 ring-1 ring-black/[0.04]">
                <Clock weight="regular" size={12} className="text-zinc-300" />
                <span className="font-mono text-[9px] tracking-wider text-zinc-300">
                  {lastUpdate}
                </span>
              </div>
            )}
            <button
              onClick={() => { cache.clear(); fetchData(); }}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white ring-1 ring-black/[0.06] transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:ring-black/[0.1] active:scale-[0.94]"
              title="Clear cache & refresh"
            >
              <ArrowsClockwise weight="regular" size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700 ring-1 ring-amber-200/50">{error}</div>
        )}

        {/* Global stats */}
        {global && (
          <div className="mb-10 grid gap-3 grid-cols-2 md:grid-cols-4">
            <StatCard icon={Globe} label="Market Cap" value={fmt(global.total_market_cap?.usd || 0, 2)}
              sub={`${global.market_cap_change_percentage_24h_usd >= 0 ? "+" : ""}${global.market_cap_change_percentage_24h_usd?.toFixed(2)}% (24h)`} />
            <StatCard icon={Lightning} label="24h Volume" value={fmt(global.total_volume?.usd || 0, 1)} />
            <StatCard icon={CurrencyBtc} label="BTC Price" value={coins[0] ? fmtPrice(coins[0].current_price) : "..."}
              sub={coins[0] ? `${coins[0].price_change_percentage_24h >= 0 ? "+" : ""}${coins[0].price_change_percentage_24h?.toFixed(2)}%` : ""} />
            <StatCard icon={ChartLineUp} label="Active Coins" value={global.active_cryptocurrencies?.toLocaleString() || "..."} />
          </div>
        )}

        {/* Gainers & Losers */}
        {coins.length > 0 && (
          <div className="mb-10 grid gap-3 md:grid-cols-2">
            <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
              <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-600">
                  <TrendUp weight="bold" size={12} /> Top gainers 24h
                </p>
                <div className="flex flex-col gap-3">
                  {topGainers.map((c) => (
                    <div key={c.id} onClick={() => setSelectedCoin(c.id)} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50">
                      <div className="flex items-center gap-2.5">
                        <img src={c.image} alt={c.name} width={24} height={24} className="rounded-full" />
                        <span className="text-sm font-medium text-zinc-800">{c.name}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-emerald-600">+{(c.price_change_percentage_24h || 0).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-[1.25rem] bg-white/60 p-1 ring-1 ring-black/[0.04]">
              <div className="rounded-[calc(1.25rem-0.25rem)] bg-white p-5">
                <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-500">
                  <TrendDown weight="bold" size={12} /> Top losers 24h
                </p>
                <div className="flex flex-col gap-3">
                  {topLosers.map((c) => (
                    <div key={c.id} onClick={() => setSelectedCoin(c.id)} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-zinc-50">
                      <div className="flex items-center gap-2.5">
                        <img src={c.image} alt={c.name} width={24} height={24} className="rounded-full" />
                        <span className="text-sm font-medium text-zinc-800">{c.name}</span>
                      </div>
                      <span className="font-mono text-sm font-semibold tabular-nums text-red-500">{(c.price_change_percentage_24h || 0).toFixed(2)}%</span>
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
            <div className="flex items-center gap-4 border-b border-black/[0.04] px-5 py-3">
              <span className="w-6 font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">#</span>
              <span className="w-[180px] font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Coin</span>
              <span className="w-[120px] text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Price</span>
              <span className="w-[90px] text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">24h</span>
              <span className="hidden w-[120px] md:block text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">7d Chart</span>
              <span className="hidden w-[100px] lg:block text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Mkt Cap</span>
              <span className="hidden w-[100px] xl:block text-right font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-300">Volume</span>
            </div>

            {loading && (
              <div className="flex flex-col">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.02]">
                    <div className="h-3 w-4 rounded bg-zinc-100 animate-pulse" />
                    <div className="flex items-center gap-3 w-[180px]">
                      <div className="h-7 w-7 rounded-full bg-zinc-100 animate-pulse" />
                      <div><div className="h-3 w-16 rounded bg-zinc-100 animate-pulse mb-1" /><div className="h-2 w-8 rounded bg-zinc-50 animate-pulse" /></div>
                    </div>
                    <div className="w-[120px] flex justify-end"><div className="h-3 w-20 rounded bg-zinc-100 animate-pulse" /></div>
                    <div className="w-[90px] flex justify-end"><div className="h-5 w-16 rounded-full bg-zinc-50 animate-pulse" /></div>
                  </div>
                ))}
              </div>
            )}

            {!loading && coins.map((coin, i) => (
              <CoinRow key={coin.id} coin={coin} rank={i + 1} onClick={() => setSelectedCoin(coin.id)} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <p className="font-mono text-[9px] tracking-[0.15em] text-zinc-300">DATA: COINGECKO API // AUTO-REFRESH 60s // CACHE TTL 1-5min</p>
          <p className="font-mono text-[9px] tracking-[0.15em] text-zinc-300">BUILT BY AI AGENT // ZERO HUMAN CODE</p>
        </div>
      </div>
    </div>
  );
}
