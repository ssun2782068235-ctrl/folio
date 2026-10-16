import { classById, sanitizeHolding } from "./data.js"

const KEY = "folio.v1"

export function blankState() {
  return {
    version: 1,
    lang: "zh",
    base: "CNY",
    mask: false,
    page: "home",
    demo: false,
    onboarded: false,
    nickname: "",
    picks: [],
    holdings: [],
    history: [],
    fxOverride: {},
    fxMarket: {},
    fxDay: "",
    fxAsOf: "",
    markets: null,
    marketsDay: "",
    depositBoard: null,
    depositDay: "",
    depositRev: 0,
    houseChecked: "",
  }
}

function cleanBoards(raw) {
  if (!raw || typeof raw !== "object" || !raw.banks || typeof raw.banks !== "object") return null
  const banks = {}
  Object.entries(raw.banks).slice(0, 40).forEach(([key, board]) => {
    if (typeof key !== "string" || !board || !Array.isArray(board.products)) return
    const products = board.products
      .filter((p) => p && typeof p.id === "string" && Number.isFinite(Number(p.rate)) && Number(p.rate) >= 0)
      .slice(0, 20)
      .map((p) => ({ id: p.id.slice(0, 20), rate: Number(p.rate) }))
    if (!products.length) return
    banks[key.slice(0, 40)] = {
      asOf: typeof board.asOf === "string" ? board.asOf.slice(0, 10) : "",
      source: typeof board.source === "string" ? board.source.slice(0, 40) : "",
      products,
    }
  })
  return Object.keys(banks).length ? { banks } : null
}

export function loadState() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null")
    if (!raw || raw.version !== 1) return blankState()
    const next = { ...blankState(), ...raw }
    next.holdings = Array.isArray(raw.holdings) ? raw.holdings.map(sanitizeHolding).filter(Boolean) : []
    next.history = Array.isArray(raw.history)
      ? raw.history.filter((p) => p && Number.isFinite(Number(p.usd)) && typeof p.t === "string")
        .map((p) => ({ t: p.t, usd: Number(p.usd) }))
      : []
    next.fxOverride = raw.fxOverride && typeof raw.fxOverride === "object" ? raw.fxOverride : {}
    next.fxMarket = raw.fxMarket && typeof raw.fxMarket === "object" ? raw.fxMarket : {}
    next.fxDay = typeof raw.fxDay === "string" ? raw.fxDay.slice(0, 10) : ""
    next.fxAsOf = typeof raw.fxAsOf === "string" ? raw.fxAsOf.slice(0, 10) : ""
    next.marketsDay = typeof raw.marketsDay === "string" ? raw.marketsDay.slice(0, 10) : ""
    next.markets = raw.markets && typeof raw.markets === "object" ? raw.markets : null
    next.depositDay = typeof raw.depositDay === "string" ? raw.depositDay.slice(0, 10) : ""
    next.depositRev = Number.isFinite(Number(raw.depositRev)) ? Number(raw.depositRev) : 0
    next.houseChecked = typeof raw.houseChecked === "string" ? raw.houseChecked.slice(0, 10) : ""
    next.depositBoard = cleanBoards(raw.depositBoard)
    next.onboarded = !!raw.onboarded
    next.nickname = typeof raw.nickname === "string" ? raw.nickname.slice(0, 24) : ""
    next.picks = Array.isArray(raw.picks) ? raw.picks.filter((id) => classById(id)) : []
    if (!["zh", "en"].includes(next.lang)) next.lang = "zh"
    if (!["home", "assets", "holdings", "settings", "analysis", "rates"].includes(next.page)) next.page = "home"
    return next
  } catch {
    return blankState()
  }
}

export function saveState(state) {
  const copy = {
    version: 1,
    lang: state.lang,
    base: state.base,
    mask: state.mask,
    page: state.page,
    demo: state.demo,
    onboarded: !!state.onboarded,
    nickname: state.nickname || "",
    picks: state.picks || [],
    holdings: state.holdings,
    history: state.history,
    fxOverride: state.fxOverride,
    fxMarket: state.fxMarket || {},
    fxDay: state.fxDay || "",
    fxAsOf: state.fxAsOf || "",
    markets: state.markets || null,
    marketsDay: state.marketsDay || "",
    depositBoard: state.depositBoard || null,
    depositDay: state.depositDay || "",
    depositRev: state.depositRev || 0,
    houseChecked: state.houseChecked || "",
  }
  localStorage.setItem(KEY, JSON.stringify(copy))
}
