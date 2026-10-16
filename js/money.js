import { FX } from "./data.js"

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]))
}

export function rateMap(override) {
  const map = {}
  Object.entries(FX).forEach(([k, v]) => {
    if (typeof v === "number" && v > 0) map[k] = v
  })
  Object.entries(override || {}).forEach(([k, v]) => {
    const n = Number(v)
    if (n > 0) map[k] = n
  })
  return map
}

export function valueOf(holding, base, override) {
  const map = rateMap(override)
  const from = map[holding.currency]
  const to = map[base]
  if (!from || !to || !Number.isFinite(holding.amount)) return null
  return (holding.amount / from) * to
}

export function toUSD(amount, currency, override) {
  const map = rateMap(override)
  const from = map[currency]
  if (!from || !Number.isFinite(amount)) return null
  return amount / from
}

export function formatMoney(n, currency, lang) {
  if (!Number.isFinite(n)) return "—"
  const locale = lang === "zh" ? "zh-CN" : "en-US"
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(n)
  } catch {
    return `${n.toFixed(2)} ${currency}`
  }
}

export function formatPct(n, digits = 2, signed = false) {
  if (!Number.isFinite(n)) return "—"
  const body = `${n.toFixed(digits)}%`
  if (signed && n > 0) return `+${body}`
  return body
}

export function priceMove(holding) {
  const price = Number(holding.price)
  const prev = Number(holding.prev)
  if (!(price > 0) || !(prev > 0)) return null
  const qty = Number(holding.quantity)
  const now = qty > 0 ? qty * price : Number(holding.amount)
  const was = qty > 0 ? qty * prev : (price ? Number(holding.amount) * prev / price : 0)
  if (!(now > 0) || !(was > 0)) return null
  return {
    now,
    was,
    abs: now - was,
    pct: ((now - was) / was) * 100,
    currency: holding.currency,
    move: holding.move || "day",
  }
}

export function portfolioMove(holdings, base, override) {
  let abs = 0
  let was = 0
  let n = 0
  holdings.forEach((h) => {
    if (h.classId === "liability") return
    const move = priceMove(h)
    if (!move) return
    const nowV = valueOf({ amount: move.now, currency: h.currency }, base, override)
    const wasV = valueOf({ amount: move.was, currency: h.currency }, base, override)
    if (nowV == null || wasV == null) return
    abs += nowV - wasV
    was += wasV
    n += 1
  })
  if (!n || !(was > 0)) return null
  return { abs, pct: (abs / was) * 100, n }
}

export function pnlOf(holding) {
  if (holding.classId === "liability") return null
  if (holding.cost == null || !(holding.cost > 0)) return null
  const abs = holding.amount - holding.cost
  return { abs, pct: (abs / holding.cost) * 100, currency: holding.currency }
}

export function totals(holdings, base, override) {
  let gross = 0
  let debt = 0
  let missing = 0
  let pnl = 0
  let cost = 0
  let income = 0
  let debtCost = 0
  let growth = 0
  holdings.forEach((h) => {
    const v = valueOf(h, base, override)
    if (v == null) {
      missing += 1
      return
    }
    const y = Number(h.incomeYield) || 0
    const g = Number(h.growth) || 0
    if (h.classId === "liability") {
      debt += v
      debtCost += v * y / 100
    } else {
      gross += v
      income += v * y / 100
      growth += v * g / 100
      if (h.cost > 0) {
        const costV = valueOf({ ...h, amount: h.cost }, base, override)
        const nowV = v
        if (costV != null) {
          cost += costV
          pnl += nowV - costV
        }
      }
    }
  })
  return {
    gross, debt, net: gross - debt, missing, pnl, cost, income, debtCost, growth,
    pnlPct: cost > 0 ? (pnl / cost) * 100 : null,
  }
}
