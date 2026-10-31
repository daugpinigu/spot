// Spot kainu proxy: Yahoo Finance v8 chart -> kompaktiskas JSON su CORS.
// GET /api/quotes?symbols=TSLA,AMZN,AMZ3.L
// Atsakymas: { ts, quotes: { SYM: { price, prevClose, change, changePct, currency, exchange, name, time, ext: {price,time}|null } }, errors: { SYM: msg } }

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-^=]{0,19}$/i;
const MAX_SYMBOLS = 60;
const UA = { "User-Agent": "Mozilla/5.0 (spot-portfolio; +https://daugpinigu.github.io/spot/)", "Accept": "application/json" };

async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=15m&range=1d&includePrePost=true`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!r.ok) throw new Error(`yahoo http ${r.status}`);
    const j = await r.json();
    const res = j?.chart?.result?.[0];
    if (!res) throw new Error(j?.chart?.error?.description || "no result");
    const m = res.meta || {};
    const price = m.regularMarketPrice;
    if (typeof price !== "number") throw new Error("no price");
    const prevClose = (typeof m.chartPreviousClose === "number" ? m.chartPreviousClose : m.previousClose) ?? null;
    // Extended hours: paskutinis ne-null 15m baras po regularMarketTime
    let ext = null;
    const ts = res.timestamp || [];
    const closes = res.indicators?.quote?.[0]?.close || [];
    for (let i = ts.length - 1; i >= 0; i--) {
      if (closes[i] != null) {
        if (m.regularMarketTime && ts[i] > m.regularMarketTime) ext = { price: closes[i], time: ts[i] };
        break;
      }
    }
    const change = prevClose != null ? price - prevClose : null;
    return {
      price,
      prevClose,
      change,
      changePct: change != null && prevClose ? (change / prevClose) * 100 : null,
      currency: m.currency || null,
      exchange: m.exchangeName || null,
      name: m.longName || m.shortName || null,
      time: m.regularMarketTime || null,
      ext,
    };
  } finally {
    clearTimeout(t);
  }
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "GET only" });

  const raw = String(req.query.symbols || "");
  const symbols = [...new Set(raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean))];
  if (!symbols.length) return res.status(400).json({ error: "symbols required" });
  if (symbols.length > MAX_SYMBOLS) return res.status(400).json({ error: `max ${MAX_SYMBOLS} symbols` });
  const bad = symbols.filter((s) => !SYMBOL_RE.test(s));
  if (bad.length) return res.status(400).json({ error: "bad symbols", bad });

  const quotes = {};
  const errors = {};
  await Promise.all(
    symbols.map(async (s) => {
      try {
        quotes[s] = await fetchYahoo(s);
      } catch (e) {
        errors[s] = String(e && e.message ? e.message : e);
      }
    })
  );
  // CDN cache: 15 s sviezumas, 45 s stale-while-revalidate (vienas URL = vienas rinkinys)
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=45, max-age=0");
  res.status(200).json({ ts: Math.floor(Date.now() / 1000), quotes, errors });
};
