import { buildFacts, buildReport } from "./analysis.js"
import {
  ACCOUNTS, BANKS, CLASSES, COUNTRIES, COUNTRY_CCY, CURRENCIES, DEFAULT_ACCOUNT, DEPOSIT_REF,
  FX, FX_SOURCE, LIQ, POLICY, RISK, SUBTYPES, applyDepositBoard, applyMarketFx, bankBoard, bankProducts, classById, countryById, createDemo,
  depositProducts, displayName, findBank, sanitizeHolding, subtypeById,
} from "./data.js"
import { t } from "./i18n.js"
import { chartMark, classMark, subMark } from "./marks.js"
import { esc, formatMoney, formatPct, pnlOf, portfolioMove, priceMove, rateMap, toUSD, totals, valueOf } from "./money.js"
import { loadState, saveState } from "./store.js"

const GROUPS = [
  { zh: "现金与存款", en: "Cash & deposits", ids: ["cash", "deposit", "fx"] },
  { zh: "公开市场", en: "Public markets", ids: ["equity", "fund", "bond", "commodity"] },
  { zh: "房产与实物", en: "Property", ids: ["realestate", "collectible"] },
  { zh: "加密与衍生品", en: "Crypto & derivatives", ids: ["crypto", "derivative"] },
  { zh: "长期与非上市", en: "Long-term & private", ids: ["pension", "insurance", "private", "business"] },
  { zh: "其他", en: "Other", ids: ["other"] },
  { zh: "负债", en: "Debt", ids: ["liability"] },
]

const state = loadState()
const ui = {
  classId: null,
  sheet: false,
  draft: null,
  modal: null,
  query: "",
  assetQuery: "",
  rateQuery: "",
  rateTab: "policy",
  country: "ALL",
  step: "country",
  pickCountry: "",
  pickBank: "",
  err: "",
  focus: false,
  ask: 0,
  more: false,
  q: "",
  hits: [],
  symbol: "",
  quote: null,
  shares: "",
  quoteBusy: false,
  quoteError: "",
  range: "1d",
  house: { country: "", region: "", district: "", place: "" },
  houseStack: ["country"],
  houseItems: [],
  houseParent: null,
  houseQuote: null,
  houseNote: "",
  houseSource: "",
  houseBusy: false,
  houseError: "",
  houseManual: false,
  houseKind: "primary",
  area: "",
  shelf: "",
}

const STORY = 4

let renderKey = ""
let toastTimer = 0

const I = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"/></svg>`,
  grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>`,
  list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 7h12M8 12h12M8 17h12"/><circle cx="4.5" cy="7" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17" r="1" fill="currentColor"/></svg>`,
  me: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 19.2c1.4-3 3.8-4.5 7-4.5s5.6 1.5 7 4.5"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg>`,
  eye: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 3l18 18"/><path d="M10.5 6.2A10.7 10.7 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.2 3.8"/><path d="M6.1 6.1C3.6 7.8 2 12 2 12s3.5 6 10 6c1.3 0 2.5-.2 3.6-.6"/></svg>`,
}

function tt(key, vars) { return t(state.lang, key, vars) }
function persist() { saveState(state) }
function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36) }
function langOf(obj) { return obj?.[state.lang] || obj?.zh || "" }

function money(n, ccy = state.base) {
  if (state.mask) return "••••"
  return formatMoney(n, ccy, state.lang)
}
function clock() {
  return new Date().toLocaleTimeString(state.lang === "zh" ? "zh-CN" : "en-US", { hour: "numeric", minute: "2-digit" })
}
function regionLabel(id) {
  const c = countryById(id)
  if (c) return c[state.lang]
  if (id === "RU") return state.lang === "zh" ? "俄罗斯" : "Russia"
  return id || tt("unspecified")
}
function report() {
  return buildReport(state.holdings, state.base, state.lang, state.fxOverride, state.mask)
}
function classSum(classId) {
  let sum = 0
  let n = 0
  state.holdings.forEach((h) => {
    if (h.classId !== classId) return
    n += 1
    const v = valueOf(h, state.base, state.fxOverride)
    if (v != null) sum += v
  })
  return { sum, n }
}

function blankDraft(classId) {
  const id = SUBTYPES[classId] ? classId : "deposit"
  const sub = SUBTYPES[id][0]
  const baseOk = rateMap(state.fxOverride)[state.base]
  return {
    id: null,
    classId: id,
    subtype: sub.id,
    name: "",
    symbol: "",
    currency: baseOk ? state.base : "CNY",
    country: "",
    institution: "",
    account: DEFAULT_ACCOUNT[id] || "other",
    amount: "",
    cost: "",
    quantity: "",
    incomeYield: String(sub.yield ?? 0),
    growth: String(sub.growth ?? 0),
    notes: "",
  }
}
function applyMeta(d) {
  const sub = subtypeById(d.classId, d.subtype)
  d.subtype = sub.id
  d.incomeYield = String(sub.yield ?? 0)
  d.growth = String(sub.growth ?? 0)
  d.account = DEFAULT_ACCOUNT[d.classId] || d.account
}
function readDraft() {
  if (!ui.draft) return
  document.querySelectorAll("[data-field]").forEach((el) => {
    ui.draft[el.dataset.field] = el.value
  })
}

function toast(msg) {
  const el = document.getElementById("toast")
  el.textContent = msg
  el.classList.add("show")
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200)
}

function go(page) {
  state.page = page
  if (page !== "assets") ui.classId = null
  ui.sheet = false
  ui.draft = null
  persist()
  render()
}

function openCreate(classId, subtype) {
  if (!subtype && (classId === "deposit" || (!classId && ui.classId === "deposit"))) {
    ui.sheet = false
    ui.draft = null
    ui.step = "country"
    ui.pickCountry = ""
    ui.pickBank = ""
    if (state.page !== "rates") {
      state.page = "assets"
      ui.classId = "deposit"
    }
    render()
    return
  }
  ui.draft = blankDraft(classId || "deposit")
  if (classId && SUBTYPES[classId]) {
    ui.draft.classId = classId
    ui.draft.subtype = subtype || SUBTYPES[classId][0].id
    applyMeta(ui.draft)
    ui.sheet = "form"
    ui.more = false
    ui.focus = true
    ui.draft.name = langOf(subtypeById(classId, ui.draft.subtype))
    ui.draft.name = langOf(subtypeById(classId, ui.draft.subtype))
  } else {
    ui.sheet = "pick"
    ui.focus = false
  }
  ui.err = ""
  render()
}

function openPreset(partial) {
  ui.draft = blankDraft(partial.classId || "deposit")
  Object.assign(ui.draft, partial, {
    incomeYield: String(partial.incomeYield ?? ui.draft.incomeYield),
    growth: String(partial.growth ?? ui.draft.growth),
    amount: partial.amount ?? "",
    cost: partial.cost ?? "",
  })
  ui.sheet = "form"
  ui.more = false
  ui.focus = true
  ui.err = ""
  if (!ui.draft.name) ui.draft.name = langOf(subtypeById(ui.draft.classId, ui.draft.subtype))
  render()
}

function openEdit(id) {
  const h = state.holdings.find((x) => x.id === id)
  if (!h) return
  ui.draft = {
    ...h,
    name: displayName(h, state.lang),
    amount: String(h.amount),
    cost: h.cost ?? "",
    quantity: h.quantity ?? "",
    incomeYield: String(h.incomeYield ?? 0),
    growth: String(h.growth ?? 0),
  }
  ui.sheet = "form"
  ui.more = !!(h.notes || h.institution || h.cost)
  ui.focus = true
  ui.err = ""
  render()
}

function closeSheet() {
  ui.sheet = false
  ui.draft = null
  ui.err = ""
  render()
}

function commit() {
  if (state.demo) {
    persist()
    return
  }
  const usd = state.holdings.reduce((s, h) => {
    const u = toUSD(h.amount, h.currency, state.fxOverride)
    if (u == null) return s
    return s + (h.classId === "liability" ? -u : u)
  }, 0)
  const day = new Date().toISOString().slice(0, 10)
  const last = state.history[state.history.length - 1]
  if (last && String(last.t).slice(0, 10) === day) last.usd = usd
  else state.history.push({ t: new Date().toISOString(), usd })
  persist()
}

function saveDraft() {
  readDraft()
  const d = ui.draft
  if (!d) return
  let name = String(d.name || "").trim()
  if (!name) name = langOf(subtypeById(d.classId, d.subtype))
  const amount = Number(d.amount)
  if (!name) { ui.err = "err_name"; paintSheet(); return }
  if (!Number.isFinite(amount) || amount <= 0) { ui.err = "err_amount"; paintSheet(); return }
  const holding = sanitizeHolding({
    ...d,
    id: d.id || uid(),
    name,
    amount,
    cost: d.cost,
    quantity: d.quantity,
    incomeYield: d.incomeYield,
    growth: d.growth,
    nameZh: "",
    nameEn: "",
    updatedAt: new Date().toISOString(),
  })
  if (!holding) { ui.err = "err_amount"; paintSheet(); return }
  const idx = d.id ? state.holdings.findIndex((h) => h.id === d.id) : -1
  if (idx >= 0) state.holdings[idx] = holding
  else state.holdings.unshift(holding)
  ui.sheet = false
  ui.draft = null
  commit()
  toast(tt("saved"))
  render()
}

function ask(opts) {
  ui.modal = opts
  paintModal()
}

let beforeDemo = null

function loadDemo() {
  if (!state.demo) {
    beforeDemo = {
      holdings: state.holdings.map((h) => ({ ...h })),
      history: state.history.map((h) => ({ ...h })),
    }
  }
  const demo = createDemo(state.lang)
  state.holdings = demo.holdings
  state.history = demo.history
  state.demo = true
  state.page = "home"
  ui.classId = null
  ui.sheet = false
  ui.draft = null
  persist()
  toast(tt("demo_loaded"))
  render()
}

function exitDemo() {
  if (beforeDemo) {
    state.holdings = beforeDemo.holdings
    state.history = beforeDemo.history
    beforeDemo = null
  } else {
    state.holdings = []
    state.history = []
  }
  state.demo = false
  state.page = "home"
  ui.classId = null
  ui.sheet = false
  ui.draft = null
  ui.modal = null
  persist()
  toast(tt("exited_demo"))
  render()
}

function header() {
  const back = state.page === "analysis" || state.page === "rates" || (state.page === "assets" && ui.classId)
  const titles = {
    home: "FOLIO",
    assets: ui.classId ? langOf(classById(ui.classId)) : tt("tab_assets"),
    holdings: tt("holdings"),
    settings: tt("tab_me"),
    analysis: tt("analysis"),
    rates: state.lang === "zh" ? "利率" : "Rates",
  }
  const eyebrow = back
    ? `<button class="linkish" data-action="back" type="button">‹ ${esc(tt("back"))}</button>`
    : esc(state.page === "home" ? tt("brand_sub") : (state.demo ? tt("sample") : ""))
  const eye = state.page === "home"
    ? `<button class="icon-btn" type="button" data-action="mask" aria-label="${esc(state.mask ? tt("show") : tt("hide"))}">${state.mask ? I.eyeOff : I.eye}</button>`
    : ""
  const plus = state.page === "settings" || state.page === "rates" || state.page === "analysis"
    ? ""
    : `<button class="icon-btn mint" type="button" data-action="add" aria-label="${esc(tt("add"))}">${I.plus}</button>`
  return `<div class="top-title"><p class="eyebrow">${eyebrow}</p><h1>${esc(titles[state.page] || "FOLIO")}</h1></div><div class="top-actions">${eye}${plus}</div>`
}

function tabs() {
  const items = [
    ["home", I.home, tt("nav_home")],
    ["assets", I.grid, tt("tab_assets")],
    ["holdings", I.list, tt("nav_holdings")],
    ["settings", I.me, tt("tab_me")],
  ]
  return items.map(([id, icon, label]) => {
    const active = state.page === id || (id === "home" && state.page === "analysis") || (id === "assets" && state.page === "rates")
    return `<button class="tab ${active ? "on" : ""}" type="button" data-action="nav" data-page="${id}">${icon}<span>${esc(label)}</span></button>`
  }).join("")
}

const LIVE_CLASSES = new Set(["equity", "fund", "crypto", "commodity"])

function liveHolding(h) {
  return LIVE_CLASSES.has(h.classId) && Number(h.quantity) > 0 && Number(h.price) > 0
}

function rowHtml(h) {
  const meta = classById(h.classId)
  const bank = h.classId === "deposit" ? findBank(h.institution) : null
  const v = valueOf(h, state.base, state.fxOverride)
  const pnl = pnlOf(h)
  const move = priceMove(h)
  const live = liveHolding(h)
  const primary = v == null ? (state.lang === "zh" ? "缺汇率" : "No FX") : money(v)
  let pnlBit = ""
  if (live && !state.mask) {
    if (move) {
      const nowV = valueOf({ amount: move.now, currency: h.currency }, state.base, state.fxOverride)
      const wasV = valueOf({ amount: move.was, currency: h.currency }, state.base, state.fxOverride)
      const abs = nowV != null && wasV != null ? nowV - wasV : null
      const moneyBit = abs == null ? "" : `${abs >= 0 ? "+" : ""}${formatMoney(abs, state.base, state.lang)} · `
      pnlBit = `<span class="${move.pct >= 0 ? "up" : "down"}">${moneyBit}${formatPct(move.pct, 2, true)}</span>`
    } else pnlBit = `<span class="flat">${esc(state.lang === "zh" ? "涨跌未取到" : "No move")}</span>`
  } else if (move && !state.mask) {
    pnlBit = `<span class="${move.pct >= 0 ? "up" : "down"}">${formatPct(move.pct, 2, true)}</span>`
  } else if (pnl && !state.mask) {
    pnlBit = `<span class="${pnl.pct >= 0 ? "up" : "down"}">${formatPct(pnl.pct, 2, true)}</span>`
  }
  const native = !live && h.currency !== state.base && !state.mask ? formatMoney(h.amount, h.currency, state.lang) : ""
  const ticker = h.symbol?.startsWith("gb_") ? h.symbol.slice(3).toUpperCase() : (h.symbol?.startsWith("hk") || h.symbol?.startsWith("sh") || h.symbol?.startsWith("sz") ? h.symbol.slice(2) : h.symbol)
  const rateBit = h.classId === "deposit" && Number(h.incomeYield) >= 0 ? `${Number(h.incomeYield).toFixed(2)}%` : ""
  const sub = [langOf(subtypeById(h.classId, h.subtype)), rateBit, bank ? "" : h.institution, ticker].filter(Boolean).join(" · ")
  const mark = bank
    ? `<i class="mark face" style="background:${bank.color}">${esc(bank.mark)}</i>`
    : subMark(meta, subtypeById(h.classId, h.subtype))
  return `<button class="hrow" type="button" data-action="edit" data-id="${esc(h.id)}">
    ${mark}
    <span class="grow"><b>${esc(displayName(h, state.lang))}</b><span class="subline">${esc(sub)}</span></span>
    <span class="hright"><b class="${h.classId === "liability" ? "down" : ""}">${primary}</b><span>${pnlBit || esc(native)}</span></span>
  </button>`
}

function liveTapeHtml() {
  const rows = sortedHoldings(state.holdings.filter(liveHolding))
  if (!rows.length) return ""
  const zh = state.lang !== "en"
  const book = portfolioMove(rows, state.base, state.fxOverride)
  const sum = rows.reduce((s, h) => s + (valueOf(h, state.base, state.fxOverride) || 0), 0)
  const chg = !book || state.mask
    ? ""
    : `<span class="${book.abs >= 0 ? "up" : "down"}">${book.abs >= 0 ? "+" : ""}${formatMoney(book.abs, state.base, state.lang)} · ${formatPct(book.pct, 2, true)}</span>`
  return `<section class="card list-card">
    <div class="card-h"><span>${esc(zh ? "每日波动" : "Daily movers")}</span><b>${money(sum)} ${chg}</b></div>
    <p class="fine">${esc(zh ? "股票、基金、贵金属和虚拟货币的实时净值。涨跌用上一报价。" : "Live value of shares, funds, metals, and crypto, against the previous quote.")}</p>
    ${rows.map(rowHtml).join("")}
  </section>`
}

function sortedHoldings(list) {
  return [...list].sort((a, b) => {
    const as = a.classId === "liability" ? 1 : 0
    const bs = b.classId === "liability" ? 1 : 0
    if (as !== bs) return as - bs
    return (valueOf(b, state.base, state.fxOverride) || 0) - (valueOf(a, state.base, state.fxOverride) || 0)
  })
}

function chartSvg() {
  if (state.mask) return `<p class="fine">••••</p>`
  const map = rateMap(state.fxOverride)
  const unit = map[state.base]
  if (!unit || state.history.length < 2) {
    return `<p class="fine">${esc(state.demo ? tt("demo_history") : tt("empty_chart"))}</p>`
  }
  const pts = state.history.map((p) => ({ t: String(p.t).slice(0, 10), v: Number(p.usd) * unit }))
  const w = 640
  const h = 180
  const pad = 8
  const min = Math.min(...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v))
  const span = max - min || 1
  const coords = pts.map((p, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (p.v - min) / span) * (h - pad * 2)
    return [x, y]
  })
  const line = coords.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`
  const up = pts.at(-1).v >= pts[0].v
  const color = up ? "#7dcaa0" : "#e07b73"
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="nw" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.35"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#nw)"/><path d="${line}" fill="none" stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke"/>
  </svg><div class="chart-cap"><span>${esc(pts[0].t)}</span><span>${esc(pts.at(-1).t)}</span></div>
  ${state.demo ? `<p class="fine">${esc(tt("demo_history"))}</p>` : `<p class="fine">${esc(tt("history_hint"))}</p>`}`
}

function homeHtml() {
  const tot = totals(state.holdings, state.base, state.fxOverride)
  const rep = report()
  if (!state.holdings.length) {
    const ids = state.picks.length ? state.picks : ["deposit", "equity", "crypto", "realestate"]
    const hello = state.nickname
      ? (state.lang === "zh" ? `你好，${state.nickname}` : `Hi, ${state.nickname}`)
      : (state.lang === "zh" ? "从一块开始" : "Start with one")
    return `<section class="empty soft">
      ${basePicker()}
      <h2>${esc(hello)}</h2>
      <p>${esc(state.lang === "zh" ? "点一块，填上金额就好。" : "Tap one, then enter the amount.")}</p>
    </section>
    <div class="bubble-grid">${ids.map((id) => {
      const c = classById(id)
      if (!c) return ""
      return `<button class="bubble" type="button" data-action="open-class" data-id="${id}">${classMark(c)}<b>${esc(langOf(c))}</b></button>`
    }).join("")}</div>
    <button class="btn ghost block" type="button" data-action="demo">${esc(tt("load_demo"))}</button>`
  }
  const book = portfolioMove(state.holdings, state.base, state.fxOverride)
  const pnl = !book ? "" : `<div class="hero-pnl ${book.abs >= 0 ? "up" : "down"}">${book.abs >= 0 ? "+" : ""}${state.mask ? "••••" : formatMoney(book.abs, state.base, state.lang)} · ${state.mask ? "••••" : formatPct(book.pct, 2, true)}</div><div class="hero-sub">${esc(state.lang === "zh" ? `按 ${book.n} 笔有报价的持仓，相对上一报价` : `Latest move across ${book.n} quoted holdings`)}</div>`
  const slices = (rep.classes || []).slice(0, 5)
  const bar = slices.length ? `<div class="stack">${slices.map((c) => `<i style="width:${c.weight}%;background:${c.color}"></i>`).join("")}</div>
    <div class="legend">${slices.map((c) => `<span><i class="dot" style="background:${c.color}"></i>${esc(c.name)} ${c.weight.toFixed(0)}%</span>`).join("")}</div>` : ""
  const teaser = rep.paragraphs?.[0] || ""
  return `${tot.missing ? `<button class="banner danger" type="button" data-action="nav" data-page="rates" data-tab="fx">${esc(tt("missing_fx", { n: tot.missing }))}</button>` : ""}
  ${basePicker()}
  <p class="fine">${esc(state.lang === "zh" ? `按今天的汇率折算${state.fxAsOf ? ` · ${state.fxAsOf}` : ""}` : `Converted at today’s rate${state.fxAsOf ? ` · ${state.fxAsOf}` : ""}`)}</p>
  <p class="fine">${esc(state.lang === "zh" ? "红绿是各资产自己的价格变化：股票、基金和贵金属用昨收，币用 24 小时，房价用最近公布的涨跌。存款和没报价的不计。" : "The change is each asset’s own price move. Shares, funds, and metals use the prior close. Coins use 24 hours. Property uses the latest published change.")}</p>
  <section class="hero">
    <div class="hero-label">${esc(tt("net_worth"))}${state.demo ? `<span class="pill">${esc(tt("sample"))}</span>` : ""}</div>
    <div class="hero-num">${money(tot.net)}</div>
    ${pnl}
  </section>
  <div class="stat3">
    <div><span>${esc(tt("gross_assets"))}</span><b>${money(tot.gross)}</b></div>
    <div><span>${esc(tt("debt"))}</span><b class="down">${money(tot.debt)}</b></div>
    <div><span>${esc(tt("yield_weighted"))}</span><b>${rep.cashYield == null ? "—" : formatPct(rep.cashYield, 2)}</b></div>
  </div>
  ${liveTapeHtml()}
  <section class="card">
    <div class="card-h"><span>${esc(tt("allocation"))}</span><button class="linkish" type="button" data-action="nav" data-page="assets">${esc(tt("tab_assets"))}</button></div>
    ${bar || `<p class="fine">${esc(tt("class_empty"))}</p>`}
  </section>
  <section class="card">
    <div class="kicker">${esc(tt("ai_teaser"))}</div>
    <p style="margin:8px 0 12px;font-size:14px;line-height:1.55">${esc(teaser)}</p>
    <button class="btn ghost block" type="button" data-action="nav" data-page="analysis">${esc(tt("ai_go"))}</button>
  </section>
  <section class="card">
    <div class="card-h"><span>${esc(tt("chart_title"))}</span></div>
    ${chartSvg()}
  </section>
  <section class="card list-card">
    <div class="card-h"><span>${esc(tt("top_positions"))}</span><button class="linkish" type="button" data-action="nav" data-page="holdings">${esc(tt("see_all"))}</button></div>
    ${sortedHoldings(state.holdings).slice(0, 4).map(rowHtml).join("")}
  </section>`
}

function groupsHtml() {
  return GROUPS.map((g) => {
    const ids = g.ids.filter((id) => classById(id))
    if (!ids.length) return ""
    const rows = ids.map((id) => {
      const c = classById(id)
      const { sum, n } = classSum(id)
      const right = n ? money(sum) : tt("not_yet")
      return `<button class="crow" type="button" data-action="open-class" data-id="${id}">
        ${classMark(c)}
        <span class="grow"><b>${esc(langOf(c))}</b></span>
        <span class="hright"><b class="${id === "liability" && n ? "down" : ""}">${esc(right)}</b><span>${n ? esc(tt("recorded_n", { n })) : ""}</span></span>
      </button>`
    }).join("")
    return `<p class="group-label">${esc(g[state.lang])}</p><section class="card list-card">${rows}</section>`
  }).join("")
}

function assetsHtml() {
  if (ui.classId) return classHtml()
  const mine = state.picks.length ? `<div class="bubble-grid" style="margin-bottom:8px">${state.picks.map((id) => {
    const c = classById(id)
    if (!c) return ""
    const { sum, n } = classSum(id)
    return `<button class="bubble" type="button" data-action="open-class" data-id="${id}">${classMark(c)}<b>${esc(langOf(c))}</b><span class="subline">${n ? esc(money(sum)) : ""}</span></button>`
  }).join("")}</div>` : ""
  const searching = !!ui.assetQuery.trim()
  return `<input id="asset-q" class="search" value="${esc(ui.assetQuery)}" placeholder="${esc(state.lang === "zh" ? "搜索全部，中英文都可以" : "Search everything, Chinese or English")}" autocomplete="off">
  <div id="global">${searching ? globalResultsHtml() : ""}</div>
  <div id="mine" ${searching ? "hidden" : ""}>${mine}</div>
  <div id="groups" ${searching ? "hidden" : ""}>${groupsHtml()}</div>`
}

function classHtml() {
  const c = classById(ui.classId)
  if (!c) return assetsHtml()
  if (ui.symbol && (c.id === "equity" || c.id === "fund" || c.id === "pension" || c.id === "crypto" || c.id === "commodity")) return quoteHtml()
  if (ui.shelf) return shelfHtml(c)
  if (c.id === "deposit") return depositFlowHtml(true)
  if (c.id === "realestate" && !ui.houseManual) return housingHtml()
  return classPickerHtml(c)
}

function houseMoney(item) {
  if (!item?.price) return state.lang === "zh" ? "未取到" : "—"
  const suffix = item.unit === "sqm" || item.basis === "sqm" ? (state.lang === "zh" ? "/㎡" : "/sqm") : ""
  return formatMoney(item.price, item.currency || "CNY", state.lang) + suffix
}

function houseLabel(item) {
  if (!item) return ""
  return state.lang === "en" ? (item.nameEn || item.name || "") : (item.name || item.nameEn || "")
}

function houseCards(items) {
  const zh = state.lang !== "en"
  const q = ui.q.trim().toLowerCase()
  const rows = items.filter((item) => !q || `${item.name || ""} ${item.nameEn || ""} ${item.id || ""}`.toLowerCase().includes(q))
  if (!rows.length) return `<p class="fine">${esc(zh ? "没有匹配的房价" : "No matching prices")}</p>`
  return `<div class="bank-list">${rows.map((item) => {
    const extra = item.count ? (zh ? `${item.count} 笔` : `${item.count}`) : ""
    return `<button class="bank-card" type="button" data-action="pick-house" data-id="${esc(item.id)}" data-next="${esc(item.next || "")}" data-name="${esc(houseLabel(item))}" data-price="${item.price || ""}" data-unit="${esc(item.unit || "")}">
      <span class="grow"><b>${esc(houseLabel(item))}</b>${extra ? `<span class="subline">${esc(extra)}</span>` : ""}</span>
      ${item.price ? `<span class="product-rate">${esc(houseMoney(item))}</span>` : (item.next === "quote" ? `<span class="product-rate">${esc(zh ? "未取到" : "—")}</span>` : "")}
    </button>`
  }).join("")}</div>`
}

function housingQuoteHtml() {
  const zh = state.lang !== "en"
  const q = ui.houseQuote
  if (!q?.price) return `<p class="fine">${esc(zh ? "这处的房价没取到" : "No price for this place")}</p>`
  const sqm = q.basis === "sqm" || q.unit === "sqm"
  const area = Number(ui.area)
  const total = sqm && area > 0 ? area * q.price : (sqm ? 0 : q.price)
  const kinds = [["primary", "自住", "Home"], ["invest_res", "投资", "Rental"]]
  return `<p class="quote-name">${esc(houseLabel(q))}</p>
  <p class="fine" style="margin-top:0">${esc(ui.houseSource || q.source || "")}${q.asOf ? esc(` · ${q.asOf}`) : ""}${q.mom ? esc(` · ${q.mom}`) : ""}</p>
  <div class="quote-px">${esc(houseMoney(q))}</div>
  <p class="fine">${esc(ui.houseNote || "")}</p>
  ${q.sqm ? `<p class="fine">${esc(zh ? `折合约 ${formatMoney(q.sqm, q.currency, state.lang)}/㎡` : `About ${formatMoney(q.sqm, q.currency, state.lang)}/sqm`)}</p>` : ""}
  <div class="ranges">${kinds.map(([id, z, e]) => `<button type="button" data-action="house-kind" data-id="${id}" class="${ui.houseKind === id ? "on" : ""}">${esc(zh ? z : e)}</button>`).join("")}</div>
  ${sqm ? `<p class="amount-kicker">${esc(zh ? "建筑面积" : "Floor area")}</p>
  <label class="amount-card plain">
    <input id="house-area" class="amount-xl" inputmode="decimal" value="${esc(ui.area)}" placeholder="0" autocomplete="off">
    <p class="amount-live" id="house-total">${esc(total ? amountLiveText(total, q.currency || "CNY") || ((zh ? "大约 " : "About ") + formatMoney(total, q.currency, state.lang)) : (zh ? "填面积后按挂牌单价算出总价" : "Enter the area to price it"))}</p>
  </label>` : `<p class="amount-live">${esc(zh ? "按这个公开价格记下" : "Saved at this published price")}</p>`}
  <p class="form-error">${ui.err ? esc(tt(ui.err)) : ""}</p>
  <button class="btn primary block" type="button" data-action="house-save">${esc(zh ? "记下来" : "Save")}</button>`
}

const HOUSE_IDS = ["CN", "TW", "HK", "US", "AU", "UK"]

function houseCountryBody() {
  const zh = state.lang !== "en"
  const q = ui.q.trim().toLowerCase()
  const rows = HOUSE_IDS.map((id) => COUNTRIES.find((c) => c.id === id)).filter((c) => c && (!q || `${c.zh} ${c.en}`.toLowerCase().includes(q)))
  if (!rows.length) return `<p class="fine">${esc(zh ? "没有匹配的房价" : "No matching prices")}</p>`
  return `<div class="bubble-grid">${rows.map((c) => `<button class="bubble" type="button" data-action="pick-house-country" data-id="${esc(c.id)}" data-live="1"><b>${esc(c[state.lang] || c.zh)}</b></button>`).join("")}</div>`
}

function paintHouseQuery() {
  const list = document.getElementById("house-list")
  if (!list) return
  if (ui.step === "country" || !ui.house.country) list.innerHTML = houseCountryBody()
  else if (!ui.houseBusy) list.innerHTML = houseCards(ui.houseItems)
}

function housingHtml() {
  const zh = state.lang !== "en"
  if (ui.step === "quote") return housingQuoteHtml()
  if (ui.step === "country" || !ui.house.country) {
    const saved = state.holdings.filter((h) => h.classId === "realestate")
    return `<input id="house-q" class="search" value="${esc(ui.q)}" placeholder="${esc(zh ? "搜索" : "Search")}" autocomplete="off">
    <p class="flow-lead">${esc(zh ? "先选国家" : "Choose a country")}</p>
    <p class="fine">${esc(zh ? "只保留中国、台湾、香港、美国、澳大利亚和英国。中国可以选到小区。澳大利亚先选城市，悉尼可以再选区。公开价格每周核对一次。" : "China, Taiwan, Hong Kong, the US, Australia, and the UK. China goes down to a neighborhood. Australia starts with a city, and Sydney goes on to a district. Prices are checked weekly.")}</p>
    <div id="house-list">${houseCountryBody()}</div>
    <button class="btn ghost block" type="button" data-action="house-manual">${esc(zh ? "商业、土地、车位没有公开房价，自己填" : "Commercial, land, and parking have no public price")}</button>
    ${saved.length ? `<p class="group-label">${esc(zh ? "已经记下" : "Saved")}</p><section class="card list-card">${sortedHoldings(saved).map(rowHtml).join("")}</section>` : ""}`
  }
  const titles = { region: ["选城市或地区", "Choose a region"], district: ["选区", "Choose a district"], place: ["这个区的小区", "Neighborhoods in this district"] }
  const title = titles[ui.step] || titles.region
  const parent = ui.houseParent
  const parentLine = parent?.price ? `<div class="quote-px" style="font-size:28px">${esc(houseMoney({ ...parent, currency: parent.currency || "CNY" }))}</div><p class="fine">${esc(`${houseLabel(parent)} ${parent.asOf || ""} ${parent.mom || ""}`.trim())}</p>` : ""
  return `<input id="house-q" class="search" value="${esc(ui.q)}" placeholder="${esc(zh ? "搜索" : "Search")}" autocomplete="off">
  <p class="flow-lead">${esc(zh ? title[0] : title[1])}</p>
  ${ui.houseNote ? `<p class="fine">${esc(ui.houseNote)}</p>` : ""}
  ${parentLine}
  ${ui.houseBusy ? `<p class="fine">${esc(zh ? "正在取房价" : "Loading prices")}</p>` : ""}
  ${ui.houseError ? `<p class="fine">${esc(zh ? "这一级的房价没取到" : "No prices at this level")}</p>` : ""}
  <div id="house-list">${ui.houseBusy ? "" : houseCards(ui.houseItems)}</div>`
}

let houseSeq = 0
const houseCache = new Map()
const houseInflight = new Map()

function houseKey(country, region, district, place) {
  return [country || "", region || "", district || "", place || ""].join("|")
}

function applyHouse(data) {
  ui.houseBusy = false
  ui.houseError = ""
  ui.houseItems = data.items || []
  ui.houseParent = data.parent || null
  ui.houseQuote = data.quote || null
  ui.houseNote = data.note || ""
  ui.houseSource = data.source || ""
  if (data.quote?.price) ui.step = "quote"
}

async function fetchHouse(country, region, district, place) {
  const key = houseKey(country, region, district, place)
  if (houseCache.has(key)) return houseCache.get(key)
  if (houseInflight.has(key)) return houseInflight.get(key)
  const params = new URLSearchParams({ country })
  if (region) params.set("region", region)
  if (district) params.set("district", district)
  if (place) params.set("place", place)
  const job = fetch(`/api/housing?${params}`).then(async (res) => {
    const data = await res.json()
    houseInflight.delete(key)
    if (res.ok && !data.error) houseCache.set(key, data)
    return { ok: res.ok, data }
  }).catch((err) => {
    houseInflight.delete(key)
    throw err
  })
  houseInflight.set(key, job)
  return job
}

async function loadHousing() {
  const seq = ++houseSeq
  const country = ui.house.country
  if (!country) return
  const region = ui.house.region
  const district = ui.house.district
  const place = ui.step === "quote" ? ui.house.place : ""
  const key = houseKey(country, region, district, place)
  if (houseCache.has(key)) {
    applyHouse(houseCache.get(key))
    render()
    return
  }
  ui.houseBusy = true
  ui.houseError = ""
  ui.houseItems = []
  ui.houseParent = null
  ui.houseNote = ""
  render()
  try {
    const { ok, data } = await fetchHouse(country, region, district, place)
    if (seq !== houseSeq) return
    if (!ok || (data.error && !data.items?.length && !data.quote && !data.parent?.price)) {
      ui.houseBusy = false
      ui.houseError = "missing"
      ui.houseItems = []
      ui.houseQuote = null
    } else applyHouse(data)
  } catch {
    if (seq !== houseSeq) return
    ui.houseBusy = false
    ui.houseError = "missing"
    ui.houseItems = []
  }
  render()
  const input = document.getElementById("house-q")
  if (input && ui.focusHouse) {
    const pos = ui.q.length
    input.focus()
    input.setSelectionRange(pos, pos)
  }
  ui.focusHouse = false
}

const SPOTS = {
  btc: { classId: "crypto", subtype: "btc", symbol: "BTC", zh: "比特币", en: "Bitcoin", unitZh: "数量", unitEn: "Amount", account: "exchange" },
  eth: { classId: "crypto", subtype: "eth", symbol: "ETH", zh: "以太坊", en: "Ethereum", unitZh: "数量", unitEn: "Amount", account: "exchange" },
  gold: { classId: "commodity", subtype: "gold", symbol: "GOLD", zh: "黄金", en: "Gold", unitZh: "盎司", unitEn: "Ounces", account: "broker" },
  silver: { classId: "commodity", subtype: "silver", symbol: "SILVER", zh: "白银", en: "Silver", unitZh: "盎司", unitEn: "Ounces", account: "broker" },
}
const SPOT_BY_SYMBOL = Object.fromEntries(Object.entries(SPOTS).map(([id, meta]) => [meta.symbol, { id, ...meta }]))

function spotPriceText(row) {
  if (!row?.price) return ""
  const zh = state.lang !== "en"
  const unit = row.unit === "oz" ? (zh ? "/盎司" : "/oz") : ""
  return `${formatMoney(row.price, row.currency, state.lang)}${unit}`
}

function marketStrip(classId) {
  const zh = state.lang !== "en"
  const m = state.markets || {}
  if (classId === "crypto" || classId === "commodity") {
    const bits = Object.entries(SPOTS).filter(([, meta]) => meta.classId === classId).map(([id, meta]) => {
      const text = spotPriceText(m.spots?.[id])
      return text ? `${zh ? meta.zh : meta.en} ${text}` : ""
    }).filter(Boolean)
    const source = classId === "crypto" ? "Coinbase" : "COMEX"
    if (!bits.length) return `<p class="fine">${esc(zh ? "今天的报价没取到" : "No quote today")}</p>`
    return `<p class="fine">${esc(`${bits.join(" · ")} · ${source}`)}</p>`
  }
  if (classId !== "bond" && classId !== "liability") return ""
  const lines = []
  if (m.lpr && (m.lpr.oneYear != null || m.lpr.fiveYear != null)) {
    const parts = []
    if (m.lpr.oneYear != null) parts.push(`${zh ? "1年期 LPR" : "1Y LPR"} ${Number(m.lpr.oneYear).toFixed(2)}%`)
    if (m.lpr.fiveYear != null) parts.push(`${zh ? "5年期 LPR" : "5Y LPR"} ${Number(m.lpr.fiveYear).toFixed(2)}%`)
    lines.push(`${parts.join(" · ")}${m.lpr.asOf ? ` · ${m.lpr.asOf}` : ""} · ${m.lpr.source || ""}`)
  }
  if (m.effr?.rate != null) {
    const range = m.effr.low != null && m.effr.high != null ? `（${Number(m.effr.low).toFixed(2)}–${Number(m.effr.high).toFixed(2)}）` : ""
    lines.push(`${zh ? "美国有效联邦基金利率" : "US effective fed funds"} ${Number(m.effr.rate).toFixed(2)}%${range}${m.effr.asOf ? ` · ${m.effr.asOf}` : ""} · ${m.effr.source || "New York Fed"}`)
  }
  if (!lines.length) return `<p class="fine">${esc(zh ? "官方利率今天没取到" : "Official rates were not available today")}</p>`
  return lines.map((line) => `<p class="fine">${esc(line)}</p>`).join("")
}

function typeBubbles(classId) {
  const q = ui.q.trim().toLowerCase()
  const c = classById(classId)
  return (SUBTYPES[classId] || []).filter((s) => !q || queryHits(`${s.zh} ${s.en}`, q)).map((s) => {
    const spotId = Object.keys(SPOTS).find((id) => SPOTS[id].classId === classId && SPOTS[id].subtype === s.id)
    const px = spotId ? spotPriceText(state.markets?.spots?.[spotId]) : ""
    return `<button class="bubble" type="button" data-action="add-sub" data-id="${esc(s.id)}">${subMark(c, s)}<b>${esc(langOf(s))}</b>${px ? `<span class="product-rate">${esc(px)}</span>` : ""}</button>`
  }).join("")
}

function classPickerHtml(c) {
  const { sum, n } = classSum(c.id)
  const list = state.holdings.filter((h) => h.classId === c.id)
  const live = c.id === "equity" || c.id === "fund" || c.id === "pension" || c.id === "crypto"
  const shelf = SHELF_CLASSES.includes(c.id)
  const q = ui.q.trim()
  const placeholder = c.id === "crypto"
    ? (state.lang === "zh" ? "中文或英文，如 比特币、bitcoin、BTC" : "Chinese or English, like 比特币 or BTC")
    : (state.lang === "zh" ? "中文或英文搜索" : "Search in Chinese or English")
  const quotedShelf = QUOTE_CLASSES.includes(c.id)
  const hint = quotedShelf
    ? (state.lang === "zh" ? "点开分类先看几只常见的。没看到的直接搜索，选中以后再填数量。" : "Open a type for a few common names. Search for the rest, then enter the amount.")
    : (shelf
      ? (state.lang === "zh" ? "这一类没有公开每日价格。点进去以后再填金额。" : "This category has no public daily price.")
      : (state.lang === "zh" ? "选一个产品，再填金额" : "Pick a product, then the amount"))
  return `<input id="sym-q" class="search" value="${esc(ui.q)}" placeholder="${esc(placeholder)}" autocomplete="off">
  ${live ? `<div id="hits">${q ? hitsHtml(ui.hits, q) : ""}</div>` : ""}
  ${shelf ? `<p class="fine">${esc(hint)}</p>` : ""}
  <section class="class-hero" style="--c:${c.color}">
    <div class="hero-num ${c.id === "liability" ? "down" : ""}">${n ? money(sum) : "—"}</div>
    <div class="hero-sub">${n ? esc(tt("recorded_n", { n })) : esc(hint)}</div>
  </section>
  ${marketStrip(c.id)}
  <div class="bubble-grid" id="types">${typeBubbles(c.id)}</div>
  ${list.length ? `<p class="group-label">${esc(state.lang === "zh" ? "已经记下" : "Saved")}</p><section class="card list-card">${sortedHoldings(list).map(rowHtml).join("")}</section>` : ""}`
}

function globalResultsHtml() {
  const q = ui.assetQuery.trim().toLowerCase()
  const zh = state.lang !== "en"
  if (!q) return ""
  const classes = CLASSES.filter((c) => queryHits(`${c.zh} ${c.en}`, q))
  const subs = []
  CLASSES.forEach((c) => {
    ;(SUBTYPES[c.id] || []).forEach((s) => {
      if (queryHits(`${s.zh} ${s.en} ${c.zh} ${c.en}`, q)) subs.push({ c, s })
    })
  })
  const banks = BANKS.filter((b) => queryHits(`${b.zh} ${b.en} ${regionLabel(b.country)}`, q)).slice(0, 8)
  const held = state.holdings.filter((h) => queryHits([displayName(h, state.lang), h.symbol, h.institution, langOf(classById(h.classId)), langOf(subtypeById(h.classId, h.subtype))].join(" "), q))
  const block = (title, body) => body ? `<p class="group-label">${esc(title)}</p>${body}` : ""
  const classRows = classes.map((c) => `<button class="hrow" type="button" data-action="open-found" data-kind="class" data-id="${esc(c.id)}">${classMark(c)}<span class="grow"><b>${esc(langOf(c))}</b></span></button>`).join("")
  const subRows = subs.slice(0, 12).map(({ c, s }) => `<button class="hrow" type="button" data-action="open-found" data-kind="sub" data-class="${esc(c.id)}" data-id="${esc(s.id)}">${subMark(c, s)}<span class="grow"><b>${esc(langOf(s))}</b><span class="subline">${esc(langOf(c))}</span></span></button>`).join("")
  const bankRows = banks.map((b) => `<button class="hrow" type="button" data-action="open-found" data-kind="bank" data-id="${esc(b.id)}"><i class="mark face" style="background:${b.color}">${esc(b.mark)}</i><span class="grow"><b>${esc(langOf(b))}</b><span class="subline">${esc(zh ? "银行存款" : "Bank deposits")} · ${esc(regionLabel(b.country))}</span></span></button>`).join("")
  const heldRows = held.slice(0, 8).map((h) => rowHtml(h)).join("")
  const live = ui.hits.length ? hitsHtml(ui.hits, ui.assetQuery.trim()) : ""
  const any = classRows || subRows || bankRows || heldRows || ui.hits.length
  return `${block(zh ? "板块" : "Categories", classRows && `<section class="card list-card">${classRows}</section>`)}
    ${block(zh ? "分类" : "Types", subRows && `<section class="card list-card">${subRows}</section>`)}
    ${block(zh ? "银行" : "Banks", bankRows && `<section class="card list-card">${bankRows}</section>`)}
    ${block(zh ? "行情" : "Markets", live)}
    ${block(zh ? "已经记下" : "Saved", heldRows && `<section class="card list-card">${heldRows}</section>`)}
    ${any ? "" : `<p class="fine">${esc(ui.searching && !ui.hits.length ? (zh ? "正在查找" : "Searching") : (zh ? "没有找到" : "Nothing found"))}</p>`}`
}

function depositCountries() {
  const ids = [...new Set(BANKS.map((b) => b.country))]
  return COUNTRY_ORDER.filter((id) => ids.includes(id))
}

const COUNTRY_ORDER = ["CN", "HK", "TW", "US", "UK", "EU", "JP", "SG", "AU", "CA", "KR", "IN", "CH", "AE", "NZ", "BR"]

function shownRate(rate, missing) {
  if (rate == null || !Number.isFinite(Number(rate))) return missing
  const n = Number(rate)
  const digits = Math.abs(Math.round(n * 100) - n * 100) > 0.0001 ? 3 : 2
  return `${n.toFixed(digits)}%`
}

function productGroupsHtml(products) {
  const zh = state.lang !== "en"
  const groups = []
  products.forEach((p) => {
    const id = p.group || "all"
    let g = groups.find((x) => x.id === id)
    if (!g) {
      g = { id, label: zh ? (p.gzh || "") : (p.gen || ""), items: [] }
      groups.push(g)
    }
    g.items.push(p)
  })
  return groups.map((g) => `${g.label ? `<p class="group-label">${esc(g.label)}</p>` : ""}<div class="bubble-grid">${g.items.map((p) => {
    const rate = shownRate(p.rate, zh ? "未取到" : "—")
    return `<button class="bubble" type="button" data-action="pick-product" data-id="${esc(p.id)}"><b>${esc(langOf(p))}</b><span class="product-rate">${esc(rate)}</span></button>`
  }).join("")}</div>`).join("")
}

function depositFlowHtml(withSaved) {
  const zh = state.lang !== "en"
  if (ui.step === "fx") return fxHtml()
  if (ui.step === "bank") {
    const q = ui.q.trim().toLowerCase()
    const rows = BANKS.filter((b) => b.country === ui.pickCountry && (!q || `${b.zh} ${b.en}`.toLowerCase().includes(q)))
    return `${searchField()}<p class="flow-lead">${esc(zh ? "选银行" : "Choose a bank")}</p>
    <div class="bank-list">${rows.map((b) => `<button class="bank-card" type="button" data-action="pick-bank" data-id="${esc(b.id)}">
        <i class="mark face" style="background:${b.color}">${esc(b.mark)}</i>
        <span class="grow"><b>${esc(langOf(b))}</b></span>
      </button>`).join("")}</div>`
  }
  if (ui.step === "product") {
    const bank = BANKS.find((b) => b.id === ui.pickBank)
    if (!bank) ui.step = "country"
    else {
      const q = ui.q.trim().toLowerCase()
      const products = bankProducts(bank).filter((p) => !q || `${p.zh} ${p.en} ${p.gzh || ""} ${p.gen || ""}`.toLowerCase().includes(q))
      const board = bankBoard(bank)
      const line = board
        ? (zh ? `${board.source || langOf(bank)}挂牌${board.asOf ? ` · ${board.asOf}` : ""} · 每天核对` : `${board.source || langOf(bank)}${board.asOf ? ` · ${board.asOf}` : ""} · checked daily`)
        : (zh ? "这家的挂牌今天没取到" : "This bank’s board was not available today")
      return `${searchField()}<div class="pick-head">
      <i class="mark face lg" style="background:${bank.color}">${esc(bank.mark)}</i>
      <div><b>${esc(langOf(bank))}</b><span class="subline">${esc(zh ? "选产品，利率已经标好" : "Pick a product. The rate is set.")}</span></div>
    </div>
    ${line ? `<p class="fine">${esc(line)}</p>` : ""}
    ${productGroupsHtml(products)}`
    }
  }
  const saved = withSaved ? state.holdings.filter((h) => h.classId === "deposit") : []
  const q = ui.q.trim().toLowerCase()
  const countries = depositCountries().filter((id) => !q || regionLabel(id).toLowerCase().includes(q))
  const banks = q ? BANKS.filter((b) => `${b.zh} ${b.en}`.toLowerCase().includes(q)).slice(0, 8) : []
  return `${searchField()}<p class="flow-lead">${esc(zh ? "先选国家" : "Choose a country")}</p>
  <p class="fine">${esc(zh ? "每家用自己的挂牌，每天分别核对。" : "Each bank uses its own board, checked once a day.")}</p>
  <div class="bubble-grid" id="types">${countries.map((id) => `<button class="bubble" type="button" data-action="pick-country" data-id="${esc(id)}"><b>${esc(regionLabel(id))}</b></button>`).join("")}</div>
  ${banks.length ? `<div class="bank-list">${banks.map((b) => `<button class="bank-card" type="button" data-action="pick-bank" data-id="${esc(b.id)}"><i class="mark face" style="background:${b.color}">${esc(b.mark)}</i><span class="grow"><b>${esc(langOf(b))}</b><span class="subline">${esc(regionLabel(b.country))}</span></span></button>`).join("")}</div>` : ""}
  ${saved.length ? `<p class="group-label">${esc(zh ? "已经记下" : "Saved")}</p><section class="card list-card">${sortedHoldings(saved).map(rowHtml).join("")}</section>` : ""}`
}

function fxHtml() {
  const map = rateMap(state.fxOverride)
  const dated = state.fxAsOf ? `${tt("fx_lead")} ${state.fxAsOf}` : tt("fx_lead")
  return `<p class="fine">${esc(dated)}</p>
  <button class="btn ghost block" type="button" data-action="reset-fx">${esc(tt("fx_reset"))}</button>
  <div style="height:10px"></div>
  ${CURRENCIES.map((code) => {
    const custom = state.fxOverride[code] != null && Number(state.fxOverride[code]) > 0
    const src = custom ? "user" : (FX_SOURCE[code] || "ecb")
    const val = map[code] || ""
    return `<label class="fx-row"><span>${esc(code)}</span><input data-fx="${esc(code)}" inputmode="decimal" value="${esc(val)}" placeholder="${esc(tt("sourced_none"))}"><span class="tag">${esc(tt("sourced_" + (src === "none" && !custom ? "none" : src === "peg" && !custom ? "peg" : custom ? "user" : "ecb")))}</span></label>`
  }).join("")}`
}

function factBars(rows) {
  return `<div class="bars">${rows.map((row) => `<div class="bar-row" style="grid-template-columns:108px 1fr auto"><span>${esc(row.name)}</span><div class="track"><i style="width:${Math.min(100, row.weight)}%;background:#e4c07a"></i></div><b>${row.weight.toFixed(0)}%</b></div>`).join("")}</div>`
}

function holdingsHtml() {
  const zh = state.lang !== "en"
  const facts = buildFacts(state.holdings, state.base, state.lang, state.fxOverride, state.mask)
  const q = ui.query.trim().toLowerCase()
  const list = sortedHoldings(state.holdings.filter((h) => {
    if (!q) return true
    const blob = [displayName(h, state.lang), h.symbol, h.institution, h.currency, langOf(classById(h.classId)), langOf(subtypeById(h.classId, h.subtype))].join(" ").toLowerCase()
    return blob.includes(q)
  }))
  const analysis = facts.empty ? "" : `<p class="group-label">${esc(zh ? "汇总" : "Summary")}</p>
  <section class="card">${facts.lines.map((line) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.55">${esc(line)}</p>`).join("")}
  <p class="fine">${esc(zh ? "预估风险是按品种估算的压力损失，不是历史回撤。" : "Estimated risk is a category stress loss, not a historical drawdown.")}</p></section>
  <div class="stat2">
    <div><span>${esc(zh ? "资产总年化" : "Total yield")}</span><b>${formatPct(facts.yieldPct, 2)}</b></div>
    <div><span>${esc(zh ? "预计年化收益金额" : "Expected annual amount")}</span><b>${money(facts.yieldAmount || 0)}</b></div>
    <div><span>${esc(zh ? "预估风险" : "Estimated risk")}</span><b>${facts.stressPct == null ? "—" : formatPct(facts.stressPct, 0)}</b></div>
    <div><span>${esc(zh ? "外汇头寸" : "FX exposure")}</span><b>${facts.fxPct.toFixed(0)}%</b></div>
  </div>
  <p class="fine">${esc(zh ? "资产总年化是记下的收益率按金额加权。预计金额是它乘上总资产，不是对后市的预测。" : "Total yield weights the recorded rates by value. The amount is that rate times total assets, not a market forecast.")}</p>`
  return `${analysis}${liveTapeHtml()}<p class="fine" style="margin-top:0">${esc(tt("edit_hint"))} · ${esc(tt("page_sub", { n: state.holdings.length }))}</p>
  <input id="q" class="search" value="${esc(ui.query)}" placeholder="${esc(tt("search"))}">
  <section class="card list-card" id="list">${list.length ? list.map(rowHtml).join("") : `<p class="fine">${esc(state.holdings.length ? tt("no_match") : tt("class_empty"))}</p>`}</section>`
}

function analysisHtml() {
  const rep = report()
  if (rep.empty) return `<section class="empty"><h2>${esc(tt("analysis"))}</h2><p>${esc(tt("analysis_empty"))}</p><button class="btn primary block" type="button" data-action="add">${esc(tt("add_first"))}</button></section>`
  const ringR = 36
  const circ = 2 * Math.PI * ringR
  const len = (rep.score / 100) * circ
  const color = rep.score >= 80 ? "#e4c07a" : rep.score >= 65 ? "#d7a35a" : "#e07b73"
  return `<section class="card">
    <div class="score-row">
      <svg class="ring" viewBox="0 0 92 92" aria-hidden="true">
        <circle cx="46" cy="46" r="${ringR}" fill="none" stroke="#2a3344" stroke-width="8"/>
        <circle cx="46" cy="46" r="${ringR}" fill="none" stroke="${color}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${len} ${circ - len}" transform="rotate(-90 46 46)"/>
        <text x="46" y="52" text-anchor="middle" fill="#f4efe6" font-size="22" font-family="Inter, sans-serif">${rep.score}</text>
      </svg>
      <div>
        <div class="kicker">${esc(tt("score"))}</div>
        <b>${esc(tt("band_" + rep.band))}</b>
        <p class="fine">${esc(tt("score_explain"))}</p>
      </div>
    </div>
  </section>
  <section class="card">${rep.paragraphs.map((p) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6">${esc(p)}</p>`).join("")}</section>
  <div class="stat3">
    <div><span>${esc(tt("cash_yield"))}</span><b>${formatPct(rep.cashYield, 2)}</b></div>
    <div><span>${esc(tt("debt_cost"))}</span><b class="down">${money(rep.debtCost)}</b></div>
    <div><span>${esc(tt("net_cash"))}</span><b class="${rep.income - rep.debtCost >= 0 ? "up" : "down"}">${money(rep.income - rep.debtCost)}</b></div>
  </div>
  ${rep.flags.length ? `<p class="group-label">${esc(tt("flags"))}</p>${rep.flags.map((f) => `<article class="flag ${f.level}"><b>${esc(f.title)}</b><p>${esc(f.detail)}</p></article>`).join("")}` : ""}
  <p class="group-label">${esc(tt("alloc_title"))}</p>
  <section class="card"><div class="bars">${rep.gaps.map((g) => `<div class="bar-row"><span>${esc(g.name)}</span><div class="track"><i style="width:${Math.min(100, g.yours)}%;background:${g.color}"></i></div><b>${g.yours.toFixed(0)}%</b></div>`).join("")}</div><p class="fine">${esc(tt("model_note"))}</p></section>
  <p class="fine">${esc(tt("disclaimer"))}</p>`
}

function rateListHtml() {
  const q = ui.rateQuery.trim().toLowerCase()
  const countryOk = (id) => ui.country === "ALL" || id === ui.country
  if (ui.rateTab === "policy") {
    const rows = POLICY.filter((p) => countryOk(p.country) && (!q || `${p.zh} ${p.en} ${p.izh} ${p.ien}`.toLowerCase().includes(q)))
    if (!rows.length) return `<p class="fine">${esc(tt("no_rate_match"))}</p>`
    return rows.map((p) => {
      const can = COUNTRY_CCY[p.country] && DEPOSIT_REF[p.country]
      return `<article class="rate-card">
        <div class="top-line"><b>${esc(langOf(p))}</b><span class="rate-num">${p.rate == null ? esc(tt("policy_na")) : `${Number(p.rate).toFixed(2)}%`}</span></div>
        <div class="subline">${esc(state.lang === "zh" ? p.izh : p.ien)}</div>
        <p class="fine">${esc(state.lang === "zh" ? p.szh : p.sen)} · ${esc(p.asOf)}</p>
        ${can ? `<button class="linkish" type="button" data-action="add-policy" data-country="${esc(p.country)}">${esc(tt("record"))}</button>` : ""}
      </article>`
    }).join("")
  }
  if (ui.rateTab === "retail") {
    const rows = depositProducts().filter((r) => countryOk(r.country) && (!q || regionLabel(r.country).toLowerCase().includes(q) || r.kind.includes(q)))
    if (!rows.length) return `<p class="fine">${esc(tt("no_rate_match"))}</p>`
    return rows.map((r) => `<button class="rate-card" type="button" data-action="add-retail" data-country="${esc(r.country)}" data-kind="${esc(r.kind)}">
      <div class="top-line"><b>${esc(regionLabel(r.country))}</b><span class="rate-num">${r.rate.toFixed(2)}%</span></div>
      <div class="subline">${esc(r.kind === "time" ? tt("kind_time") : tt("kind_savings"))} · ${esc(r.currency)}</div>
      <p class="fine">${esc(tt("your_rate"))}</p>
    </button>`).join("")
  }
  if (ui.rateTab === "banks") {
    const rows = BANKS.map((b, i) => ({ b, i })).filter(({ b }) => countryOk(b.country) && (!q || `${b.zh} ${b.en} ${regionLabel(b.country)}`.toLowerCase().includes(q)))
    if (!rows.length) return `<p class="fine">${esc(tt("no_rate_match"))}</p>`
    return rows.map(({ b, i }) => {
      const r = bankProducts(b).find((p) => p.id === "time_1y")?.rate
      const shown = shownRate(r, "—")
      return `<button class="rate-card" type="button" data-action="add-bank" data-i="${i}">
      <div class="top-line"><b>${esc(langOf(b))}</b><span class="rate-num">${shown}</span></div>
      <div class="subline">${esc(regionLabel(b.country))} · ${esc(b.kind === "time" ? tt("kind_time") : tt("kind_savings"))}</div>
      <p class="fine">${esc(tt("ref"))} · ${esc(tt("your_rate"))}</p>
    </button>`
    }).join("")
  }
  const map = rateMap(state.fxOverride)
  return `<p class="fine">${esc(tt("fx_lead"))}</p>
  <button class="btn ghost block" type="button" data-action="reset-fx">${esc(tt("fx_reset"))}</button>
  <div style="height:10px"></div>
  ${CURRENCIES.map((code) => {
    const custom = state.fxOverride[code] != null && Number(state.fxOverride[code]) > 0
    const src = custom ? "user" : (FX_SOURCE[code] || "ecb")
    const val = map[code] || ""
    return `<label class="fx-row"><span>${esc(code)}</span><input data-fx="${esc(code)}" inputmode="decimal" value="${esc(val)}" placeholder="${esc(tt("sourced_none"))}"><span class="tag">${esc(tt("sourced_" + (src === "none" && !custom ? "none" : src === "peg" && !custom ? "peg" : custom ? "user" : "ecb")))}</span></label>`
  }).join("")}`
}

function ratesHtml() {
  return depositFlowHtml(true)
}

function countryChips(ids) {
  const uniq = [...new Set(ids)]
  return `<div class="scroller"><button class="chip ${ui.country === "ALL" ? "on" : ""}" type="button" data-action="country" data-id="ALL">${esc(tt("all_countries"))}</button>${uniq.map((id) => `<button class="chip ${ui.country === id ? "on" : ""}" type="button" data-action="country" data-id="${esc(id)}">${esc(regionLabel(id))}</button>`).join("")}</div>`
}

function settingsHtml() {
  const bases = entryCurrencies(state.base)
  return `<p class="group-label">${esc(tt("settings_lang"))}</p>
  <section class="card set-group"><div class="set-row"><b>${esc(tt("settings_lang"))}</b><div class="seg">
    <button type="button" class="${state.lang === "zh" ? "on" : ""}" data-action="lang" data-lang="zh">中文</button>
    <button type="button" class="${state.lang === "en" ? "on" : ""}" data-action="lang" data-lang="en">EN</button>
  </div></div></section>
  <p class="group-label">${esc(tt("settings_display"))}</p>
  <section class="card set-group">
    <label class="set-row"><b>${esc(tt("base_label"))}</b>
      <select id="base" class="select" style="width:auto;padding:8px 10px">${bases.map((c) => `<option value="${c}" ${c === state.base ? "selected" : ""}>${c}</option>`).join("")}</select>
    </label>
    <button class="set-row" type="button" data-action="mask"><b>${esc(state.mask ? tt("show") : tt("hide"))}</b><span class="chev">${state.mask ? I.eyeOff : I.eye}</span></button>
  </section>
  <p class="group-label">${esc(tt("data"))}</p>
  <section class="card set-group">
    <button class="set-row" type="button" data-action="nav" data-page="rates"><span class="grow"><b>${esc(tt("open_rates"))}</b><span class="subline">${esc(tt("lead_rates"))}</span></span><span class="chev">›</span></button>
    <button class="set-row" type="button" data-action="replay"><b>${esc(state.lang === "zh" ? "再看一遍开场" : "Replay the intro")}</b></button>
    <button class="set-row" type="button" data-action="demo"><b>${esc(tt("demo"))}</b></button>
    <button class="set-row" type="button" data-action="export"><b>${esc(tt("export"))}</b></button>
    <button class="set-row" type="button" data-action="import"><b>${esc(tt("import"))}</b></button>
    <button class="set-row" type="button" data-action="clear"><b class="down">${esc(tt("clear"))}</b></button>
  </section>
  <p class="fine">${esc(tt("about_line"))} ${esc(tt("local_note"))}</p>`
}

function demoBar() {
  if (!state.demo || ui.sheet) return ""
  return `<div class="demo-bar"><span>${esc(tt("demo_banner"))}</span><button type="button" data-action="exit-demo">${esc(tt("exit_demo"))}</button></div>`
}

function storyDots() {
  return `<div class="dots">${Array.from({ length: STORY }, (_, i) => `<i class="${i === ui.ask ? "on" : i < ui.ask ? "done" : ""}"></i>`).join("")}</div>`
}

function storyFoot(label) {
  const zh = state.lang !== "en"
  const back = ui.ask > 0
    ? `<button class="btn ghost block" type="button" data-action="story-back">${zh ? "上一步" : "Back"}</button>`
    : ""
  return `<div class="story-foot">${storyDots()}<button class="btn primary block" type="button" data-action="story-next">${esc(label)}</button>${back}</div>`
}

function gateHtml() {
  const zh = state.lang !== "en"
  const page = Math.min(ui.ask, STORY - 1)
  if (page === 0) {
    return `<section class="gate story">
      <div class="story-stage">
        <div class="folio-stage" aria-hidden="true">
          <span class="float-chip c1">${zh ? "存款" : "Deposits"}</span>
          <span class="float-chip c2">${zh ? "股票" : "Stocks"}</span>
          <span class="float-chip c3">${zh ? "房产" : "Property"}</span>
          <span class="folio-ring"></span>
          <span class="folio-core">F</span>
        </div>
        <p class="story-kicker">FOLIO</p>
        <h1>${zh ? "你的财富管家" : "Your wealth, looked after"}</h1>
        <p class="story-copy">${zh ? "现金、存款、股票、房产和负债，放在一起看清。" : "Cash, deposits, stocks, property, and debt, in one place."}</p>
      </div>
      ${storyFoot(zh ? "下一步" : "Next")}
    </section>`
  }
  if (page === 1) {
    const steps = zh
      ? [
          ["选一个板块", "从资产页点进去，股票、存款、房产都在。"],
          ["选产品，填金额", "利率和价格不用自己写，选好再填数字。"],
          ["自动进总览", "记下来的会汇进净值和分布。"],
        ]
      : [
          ["Pick a category", "Open it from Assets: stocks, deposits, property."],
          ["Choose a product, enter the amount", "Rates and prices are already filled in."],
          ["It joins the overview", "What you save shows up in net worth and allocation."],
        ]
    return `<section class="gate story">
      <div class="story-stage">
        <p class="story-kicker">${zh ? "怎么用" : "How it works"}</p>
        <h1>${zh ? "三步记下来" : "Three steps"}</h1>
        <div class="guide">${steps.map((s, i) => `<div class="guide-step"><i>${i + 1}</i><div><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div></div>`).join("")}</div>
      </div>
      ${storyFoot(zh ? "下一步" : "Next")}
    </section>`
  }
  if (page === 2) {
    return `<section class="gate story">
      <div class="story-stage">
        <p class="story-kicker">${zh ? "分析" : "Analysis"}</p>
        <h1>${zh ? "帮你看清结构" : "See the shape of it"}</h1>
        <p class="story-copy">${zh ? "根据你记下的金额，在这台设备上整理分布、收益和负债成本。" : "From the amounts you enter, this device sums allocation, yield, and the cost of debt."}</p>
        <div class="mock">
          <span>${zh ? "示意" : "Example"}</span>
          <div class="mock-bar"><i style="width:46%;background:#e4c07a"></i><i style="width:28%;background:#7f9cc4"></i><i style="width:16%;background:#c4a15a"></i><i style="width:10%;background:#e07b73"></i></div>
          <p>${zh ? "存款、股票、房产和负债，各占多少，一眼能看出来。" : "Deposits, stocks, property, and debt, each with its share."}</p>
        </div>
      </div>
      ${storyFoot(zh ? "下一步" : "Next")}
    </section>`
  }
  return `<section class="gate story">
    <div class="story-stage">
      <p class="story-kicker">FOLIO</p>
      <h1>${zh ? "开始之前" : "Before you start"}</h1>
      <div class="note-card">
        <b>${zh ? "不做任何投资建议" : "Not investment advice"}</b>
        <p>${zh ? "分析只是按你填的数字算出来的，不是预测，也不是买卖推荐。" : "The write-up is math on the numbers you entered. It is not a forecast, and not a recommendation to buy or sell."}</p>
      </div>
      <div class="note-card">
        <b>${zh ? "数据只存在这台设备" : "Data stays on this device"}</b>
        <p>${zh ? "金额、持仓和设置都写在本地，不会上传。" : "Amounts, holdings, and settings are stored locally. Nothing is uploaded."}</p>
      </div>
    </div>
    ${storyFoot(zh ? "进入" : "Enter")}
  </section>`
}

function searchField() {
  return `<input id="sym-q" class="search" value="${esc(ui.q)}" placeholder="${esc(state.lang === "zh" ? "搜索" : "Search")}" autocomplete="off">`
}

function queryHits(text, q) {
  const blob = String(text || "").toLowerCase()
  const needle = String(q || "").trim().toLowerCase()
  if (!needle) return true
  if (blob.includes(needle)) return true
  return ALIAS_GROUPS.some((group) => {
    const keys = group.map((item) => item.toLowerCase())
    const asked = keys.some((key) => key === needle || (needle.length >= 2 && key.startsWith(needle)))
    return asked && keys.some((key) => hasToken(blob, key))
  })
}

function hasToken(blob, key) {
  if (/[\u4e00-\u9fff]/.test(key)) return blob.includes(key)
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`).test(blob)
}

const ALIAS_GROUPS = [
  ["比特币", "bitcoin", "btc"],
  ["以太坊", "ethereum", "eth"],
  ["黄金", "gold", "xau"],
  ["白银", "silver", "xag"],
  ["苹果", "apple", "aapl"],
  ["微软", "microsoft", "msft"],
  ["英伟达", "nvidia", "nvda"],
  ["特斯拉", "tesla", "tsla"],
  ["亚马逊", "amazon", "amzn"],
  ["贵州茅台", "茅台", "moutai", "600519"],
  ["腾讯", "tencent", "00700"],
  ["阿里巴巴", "阿里", "alibaba", "9988"],
  ["美团", "meituan"],
  ["小米", "xiaomi"],
  ["宁德时代", "catl", "300750"],
  ["余额宝", "yuebao"],
  ["沪深300", "csi 300", "510300"],
  ["狗狗币", "狗狗", "dogecoin", "doge"],
  ["索拉纳", "solana", "sol"],
  ["瑞波", "ripple", "xrp"],
]

const KNOWN_HITS = [
  { keys: ["比特币", "bitcoin", "btc"], symbol: "BTC", classId: "crypto", zh: "比特币", en: "Bitcoin", ticker: "BTC", exchange: "Coinbase" },
  { keys: ["以太坊", "ethereum", "eth"], symbol: "ETH", classId: "crypto", zh: "以太坊", en: "Ethereum", ticker: "ETH", exchange: "Coinbase" },
  { keys: ["黄金", "gold", "xau"], symbol: "GOLD", classId: "commodity", zh: "黄金", en: "Gold", ticker: "GOLD", exchange: "COMEX" },
  { keys: ["白银", "silver", "xag"], symbol: "SILVER", classId: "commodity", zh: "白银", en: "Silver", ticker: "SILVER", exchange: "COMEX" },
  { keys: ["苹果", "apple", "aapl"], symbol: "gb_aapl", classId: "equity", zh: "苹果", en: "Apple", ticker: "AAPL", exchange: "美国" },
  { keys: ["微软", "microsoft", "msft"], symbol: "gb_msft", classId: "equity", zh: "微软", en: "Microsoft", ticker: "MSFT", exchange: "美国" },
  { keys: ["英伟达", "nvidia", "nvda"], symbol: "gb_nvda", classId: "equity", zh: "英伟达", en: "NVIDIA", ticker: "NVDA", exchange: "美国" },
  { keys: ["特斯拉", "tesla", "tsla"], symbol: "gb_tsla", classId: "equity", zh: "特斯拉", en: "Tesla", ticker: "TSLA", exchange: "美国" },
  { keys: ["亚马逊", "amazon", "amzn"], symbol: "gb_amzn", classId: "equity", zh: "亚马逊", en: "Amazon", ticker: "AMZN", exchange: "美国" },
  { keys: ["贵州茅台", "茅台", "moutai", "600519"], symbol: "sh600519", classId: "equity", zh: "贵州茅台", en: "Kweichow Moutai", ticker: "600519", exchange: "上海" },
  { keys: ["腾讯", "tencent", "00700"], symbol: "hk00700", classId: "equity", zh: "腾讯控股", en: "Tencent", ticker: "00700", exchange: "香港" },
  { keys: ["宁德时代", "catl", "300750"], symbol: "sz300750", classId: "equity", zh: "宁德时代", en: "CATL", ticker: "300750", exchange: "深圳" },
  { keys: ["狗狗币", "狗狗", "dogecoin", "doge"], symbol: "DOGE", classId: "crypto", zh: "狗狗币", en: "Dogecoin", ticker: "DOGE", exchange: "Coinbase" },
  { keys: ["索拉纳", "solana", "sol"], symbol: "SOL", classId: "crypto", zh: "索拉纳", en: "Solana", ticker: "SOL", exchange: "Coinbase" },
  { keys: ["瑞波", "ripple", "xrp"], symbol: "XRP", classId: "crypto", zh: "瑞波币", en: "XRP", ticker: "XRP", exchange: "Coinbase" },
]

function knownHits(q) {
  const needle = String(q || "").trim().toLowerCase()
  if (needle.length < 2 && !/^[a-z0-9]{2,}$/i.test(needle)) return []
  const zh = state.lang !== "en"
  return KNOWN_HITS.filter((item) => item.keys.some((key) => {
    const label = key.toLowerCase()
    return label === needle || label.startsWith(needle) || (needle.length >= 2 && label.includes(needle))
  })).map((item) => ({
    symbol: item.symbol,
    ticker: item.ticker,
    name: zh ? item.zh : item.en,
    exchange: item.exchange,
    classId: item.classId,
  }))
}

function mergeHits(groups) {
  const seen = new Set()
  const rows = []
  groups.flat().forEach((hit) => {
    if (!hit?.symbol || seen.has(hit.symbol)) return
    seen.add(hit.symbol)
    rows.push(hit)
  })
  return rows.slice(0, 20)
}

function hitsHtml(hits, q) {
  if (!String(q || "").trim()) return ""
  if (!hits.length) return `<p class="fine">${esc(state.lang === "zh" ? "没有找到相关行情" : "No matching quotes")}</p>`
  return `<section class="card list-card">${hits.map((h) => {
    const klass = classById(h.classId)
    const sector = klass ? langOf(klass) : (h.kind || "")
    const ticker = String(h.symbol || "").startsWith("of") ? h.symbol.slice(2) : (h.ticker || h.symbol)
    return `<button class="hrow" type="button" data-action="pick-symbol" data-symbol="${esc(h.symbol)}" data-class="${esc(h.classId || "")}">
    ${chartMark()}
    <span class="grow"><b>${esc(h.name)}</b><span class="subline">${esc([sector, ticker, h.exchange].filter(Boolean).join(" · "))}</span></span>
  </button>`
  }).join("")}</section>`
}

function equitySubtype(exchange, symbol) {
  const s = String(symbol || "")
  if (s.startsWith("hk")) return "hk"
  if (s.startsWith("sh") || s.startsWith("sz")) return "cn"
  if (s.startsWith("gb_")) return "us"
  const blob = `${exchange} ${symbol}`.toUpperCase()
  if (blob.includes("东京") || blob.includes("TOKYO")) return "jp"
  if (blob.includes("香港")) return "hk"
  return "em"
}

const QUOTE_CLASSES = ["equity", "fund", "pension"]
const SHELF_CLASSES = ["equity", "fund", "pension", "insurance", "private", "business", "collectible"]
const PENSION_FUNDS = [["of017403", "广发养老目标2050"], ["of019966", "易方达汇裕积极养老"], ["of017381", "鹏华养老2045"], ["sh516560", "养老ETF"]]
const SHELVES = {
  equity: {
    us: [["gb_aapl", "苹果"], ["gb_msft", "微软"], ["gb_nvda", "英伟达"], ["gb_tsla", "特斯拉"], ["gb_amzn", "亚马逊"]],
    cn: [["sh600519", "贵州茅台"], ["sz300750", "宁德时代"], ["sh601318", "中国平安"], ["sh600036", "招商银行"], ["sz000858", "五粮液"]],
    hk: [["hk00700", "腾讯控股"], ["hk09988", "阿里巴巴"], ["hk03690", "美团"], ["hk01810", "小米集团"], ["hk00941", "中国移动"]],
    jp: [],
    eu: [],
    em: [],
    single: [["sh600519", "贵州茅台"], ["gb_aapl", "苹果"], ["hk00700", "腾讯控股"]],
    rsu: [["gb_aapl", "苹果"], ["gb_msft", "微软"], ["gb_nvda", "英伟达"], ["hk00700", "腾讯控股"], ["hk09988", "阿里巴巴"]],
  },
  fund: {
    broad: [["sh510300", "沪深300ETF"], ["sh510500", "中证500ETF"], ["sh510050", "上证50ETF"], ["sz159915", "创业板ETF"], ["sh513500", "标普500ETF"], ["sh513100", "纳指ETF"]],
    sector: [["sh512480", "半导体ETF"], ["sh512690", "酒ETF"]],
    active: [["of005827", "易方达蓝筹精选"], ["of110011", "易方达优质精选"], ["of163406", "兴全合润"], ["of000001", "华夏成长"]],
    money: [["of000198", "天弘余额宝"]],
    target: [["of017403", "广发养老目标2050"], ["of017381", "鹏华养老2045"]],
    reit_fund: [["sh508000", "张江REIT"], ["sz180101", "蛇口产园"]],
  },
  pension: {
    pension_acct: PENSION_FUNDS,
    enterprise: PENSION_FUNDS,
    housing_fund: PENSION_FUNDS,
    social: PENSION_FUNDS,
    super: PENSION_FUNDS,
  },
}
const SHELF_NOTES = {
  "equity.jp": "东京交易所的价格没取到。可以直接搜索，在美国上市的同名公司能搜到。",
  "equity.eu": "欧洲交易所的价格没取到。可以直接搜索。",
  "equity.em": "这一组没有单独的交易所行情。没看到的直接搜索。",
  "pension.enterprise": "企业年金账户本身没有交易所价格。下面是公开的养老基金。",
  "pension.housing_fund": "公积金没有每日价格。下面是公开的养老基金，不是公积金余额。",
  "pension.social": "社保个人权益没有每日价格。下面是公开的养老基金。",
  "pension.super": "超级年金没有接到当地行情。下面是公开的养老基金。",
}

function shelfTicker(symbol) {
  if (symbol.startsWith("gb_")) return symbol.slice(3).toUpperCase()
  if (symbol.startsWith("of")) return symbol.slice(2)
  if (symbol.startsWith("hk")) return symbol.slice(2)
  return symbol.replace(/^sh|^sz/, "")
}

function inferFundSubtype(q) {
  const name = `${q?.name || ""} ${q?.symbol || ""}`
  if (q?.money || /货币|余额宝/.test(name)) return "money"
  if (/养老|目标日期|目标风险/.test(name)) return "target"
  if (/REIT|reit|产园/.test(name) || /^(sh508|sz180)/.test(q?.symbol || "")) return "reit_fund"
  if (/ETF|etf/.test(name) && /半导体|酒|医药|新能源|军工|券商|银行|消费|光伏|芯片/.test(name)) return "sector"
  if (/ETF|etf/.test(name) || /^(sh51|sz15|sh56)/.test(q?.symbol || "")) return "broad"
  return "active"
}

function shelfHtml(c) {
  const zh = state.lang !== "en"
  const sub = subtypeById(c.id, ui.shelf)
  const items = (SHELVES[c.id] || {})[ui.shelf] || []
  const quoted = QUOTE_CLASSES.includes(c.id)
  const note = SHELF_NOTES[`${c.id}.${ui.shelf}`] || ""
  const reminder = quoted
    ? "没列出来的直接搜索。公开行情里对得上的名称都能搜到。选中以后再填数量。"
    : "这一类没有公开的每日价格，所以这里不放行情。要记一笔没有价格的，再自己填金额。"
  const cards = items.map(([symbol, name]) => `<button class="bank-card" type="button" data-action="pick-symbol" data-symbol="${esc(symbol)}" data-class="${esc(c.id)}">${chartMark()}<span class="grow"><b>${esc(name)}</b><span class="subline">${esc(shelfTicker(symbol))}</span></span></button>`).join("")
  return `<input id="sym-q" class="search" value="${esc(ui.q)}" placeholder="${esc(zh ? "中文或英文搜索" : "Search in Chinese or English")}" autocomplete="off">
  <p class="flow-lead">${esc(sub ? langOf(sub) : "")}</p>
  <p class="fine">${esc(zh ? reminder : (quoted ? "Search for anything that is not listed. Enter the amount after you pick one." : "This category has no public daily price."))}</p>
  ${note ? `<p class="fine">${esc(zh ? note : "")}</p>` : ""}
  ${cards ? `<div class="bank-list">${cards}</div>` : ""}
  ${quoted ? `<div id="hits">${ui.q.trim() ? hitsHtml(ui.hits, ui.q) : ""}</div>` : ""}
  ${quoted ? "" : `<button class="btn ghost block" type="button" data-action="shelf-manual">${esc(zh ? "没有公开价格，自己填金额" : "No public price, enter the amount")}</button>`}`
}

const CHART_RANGES = [
  ["1d", "1日", "1D"],
  ["1w", "1周", "1W"],
  ["1m", "1月", "1M"],
  ["3m", "3月", "3M"],
  ["1y", "1年", "1Y"],
]

function pxText(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return ""
  const digits = Math.abs(v) >= 100 ? 2 : 4
  return v.toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits })
}

function fmtAsOf(v) {
  const s = String(v || "")
  if (!s.includes("T")) return s
  const d = new Date(s.endsWith("Z") ? s : `${s}Z`)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString(state.lang === "zh" ? "zh-CN" : "en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtBarTime(t) {
  if (typeof t === "number") {
    const d = new Date(t * 1000)
    const p = (n) => String(n).padStart(2, "0")
    if (ui.range === "1d" || ui.range === "1w") return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const s = String(t || "")
  if (ui.range === "1d" || ui.range === "1w") return s.slice(5, 16)
  return s.slice(0, 10)
}

function legendHtml(bar) {
  if (!bar) return ""
  const zh = state.lang !== "en"
  const parts = [
    ["", fmtBarTime(bar.t)],
    [zh ? "开" : "O", pxText(bar.o)],
    [zh ? "高" : "H", pxText(bar.h)],
    [zh ? "低" : "L", pxText(bar.l)],
    [zh ? "收" : "C", pxText(bar.c)],
  ]
  return parts.map(([k, v]) => `<span>${k ? `${esc(k)} ` : ""}${esc(v)}</span>`).join("")
}

function candleChart(candles) {
  if (!candles || candles.length < 2) return `<p class="fine">${esc(state.lang === "zh" ? "这段 K 线没取到" : "No bars for this range")}</p>`
  const w = 640
  const h = 280
  const top = 8
  const bottom = 8
  const showVol = candles.some((c) => c.v > 0)
  const plotH = h - top - bottom
  const priceH = showVol ? plotH * 0.74 : plotH
  let min = Math.min(...candles.map((c) => c.l))
  let max = Math.max(...candles.map((c) => c.h))
  const pad = (max - min) * 0.08 || Math.abs(max) * 0.002 || 1
  min -= pad
  max += pad
  const span = max - min || 1
  const y = (v) => top + (1 - (v - min) / span) * priceH
  const slot = w / candles.length
  const bw = Math.max(1.4, slot * 0.62)
  let body = ""
  candles.forEach((c, i) => {
    const x = i * slot + slot / 2
    const up = c.c >= c.o
    const color = up ? "#7dcaa0" : "#e07b73"
    const y1 = y(Math.max(c.o, c.c))
    const y2 = y(Math.min(c.o, c.c))
    body += `<line x1="${x.toFixed(2)}" y1="${y(c.h).toFixed(2)}" x2="${x.toFixed(2)}" y2="${y(c.l).toFixed(2)}" stroke="${color}" stroke-width="1.3" vector-effect="non-scaling-stroke"/>`
    body += `<rect x="${(x - bw / 2).toFixed(2)}" y="${y1.toFixed(2)}" width="${bw.toFixed(2)}" height="${Math.max(1.2, y2 - y1).toFixed(2)}" fill="${color}"/>`
  })
  if (showVol) {
    const volMax = Math.max(...candles.map((c) => c.v)) || 1
    const volTop = top + priceH + 10
    const volH = h - bottom - volTop
    candles.forEach((c, i) => {
      const x = i * slot + slot / 2
      const bh = (c.v / volMax) * volH
      const color = c.c >= c.o ? "rgba(14,203,129,.45)" : "rgba(246,70,93,.45)"
      body += `<rect x="${(x - bw / 2).toFixed(2)}" y="${(volTop + volH - bh).toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" fill="${color}"/>`
    })
  }
  let grid = ""
  for (let i = 0; i < 4; i++) {
    const yy = top + (priceH * i) / 3
    grid += `<line x1="0" y1="${yy.toFixed(1)}" x2="${w}" y2="${yy.toFixed(1)}" stroke="rgba(255,255,255,.06)" stroke-width="1" vector-effect="non-scaling-stroke"/>`
  }
  const last = candles.at(-1)
  const ly = y(last.c)
  const lastColor = last.c >= last.o ? "#7dcaa0" : "#e07b73"
  const scale = [max, min + (max - min) * 2 / 3, min + (max - min) / 3, min].map((v) => `<span>${esc(pxText(v))}</span>`).join("")
  const scaleH = showVol ? "74%" : "100%"
  return `<div class="chart-plot">
    <svg class="chart candle" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${grid}<line x1="0" y1="${ly.toFixed(1)}" x2="${w}" y2="${ly.toFixed(1)}" stroke="${lastColor}" stroke-dasharray="5 4" stroke-width="1.2" vector-effect="non-scaling-stroke"/>${body}</svg>
    <div class="chart-scale" style="height:${scaleH}">${scale}</div>
  </div>
  <div class="chart-times"><span>${esc(fmtBarTime(candles[0].t))}</span><span>${esc(fmtBarTime(last.t))}</span></div>`
}

function quoteChart(points) {
  if (!points || points.length < 2) return ""
  const w = 640
  const h = 180
  const pad = 8
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const coords = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2)
    const y = pad + (1 - (v - min) / span) * (h - pad * 2)
    return [x, y]
  })
  const line = coords.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const area = `${line} L${coords.at(-1)[0].toFixed(1)},${h} L${coords[0][0].toFixed(1)},${h} Z`
  const up = points.at(-1) >= points[0]
  const color = up ? "#7dcaa0" : "#e07b73"
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${area}" fill="${color}" opacity="0.18"/><path d="${line}" fill="none" stroke="${color}" stroke-width="3" vector-effect="non-scaling-stroke"/>
  </svg>`
}

function equityHtml() {
  if (ui.symbol) return quoteHtml()
  const c = classById("equity")
  return classPickerHtml(c)
}

function quoteHtml() {
  const zh = state.lang !== "en"
  if (ui.quoteBusy || !ui.quote) {
    const hit = ui.hits.find((h) => h.symbol === ui.symbol)
    return `<p class="flow-lead">${esc(hit?.name || hit?.ticker || "")}</p><p class="fine">${esc(ui.quoteError ? (zh ? "今天的价格没取到" : "No price today") : (zh ? "正在取今天的价格" : "Loading today’s price"))}</p>`
  }
  const q = ui.quote
  const spot = SPOT_BY_SYMBOL[q.symbol]
  const series = Array.isArray(q.candles)
  const chg = q.prev ? q.price - q.prev : 0
  const pct = q.prev ? (chg / q.prev) * 100 : 0
  const up = chg >= 0
  const shares = Number(ui.shares)
  const total = Number.isFinite(shares) && shares > 0 ? shares * q.price : 0
  const unit = spot
    ? (zh ? spot.unitZh : spot.unitEn)
    : (q.money ? (zh ? "持有金额" : "Balance") : (q.classId === "commodity" ? (zh ? "盎司" : "Ounces") : ((ui.classId === "fund" || ui.classId === "pension" || String(q.symbol || "").startsWith("of")) ? (zh ? "持有份额" : "Units") : (zh ? "持有股数" : "Shares"))))
  const unitSuffix = q.unit === "oz" || spot?.symbol === "GOLD" || spot?.symbol === "SILVER" ? (zh ? "/盎司" : "/oz") : ""
  const chgTag = q.change === "24h" ? "24h" : (zh ? "较昨收" : "vs prior close")
  const ranges = series ? `<div class="ranges">${CHART_RANGES.map(([id, z, e]) => `<button type="button" data-action="chart-range" data-range="${id}" class="${ui.range === id ? "on" : ""}">${esc(zh ? z : e)}</button>`).join("")}</div>` : ""
  const lastBar = series && q.candles.length ? q.candles.at(-1) : null
  const lineChart = quoteChart(q.points)
  const chart = series
    ? `<section class="card chart-card">${ranges}<p class="chart-legend" id="chart-legend">${legendHtml(lastBar)}</p><div class="chart-frame" id="chart-box">${candleChart(q.candles)}</div></section>`
    : (lineChart ? `<section class="card" style="margin-top:14px">${lineChart}${q.chartNote ? `<p class="fine">${esc(q.chartNote)}</p>` : ""}</section>` : (q.chartNote ? `<p class="fine">${esc(q.chartNote)}</p>` : ""))
  const ohlc = series && (q.open || q.high || q.low) ? `<div class="ohlc">
    <div><span>${esc(zh ? "开" : "Open")}</span><b>${esc(q.open ? pxText(q.open) : "—")}</b></div>
    <div><span>${esc(zh ? "高" : "High")}</span><b>${esc(q.high ? pxText(q.high) : "—")}</b></div>
    <div><span>${esc(zh ? "低" : "Low")}</span><b>${esc(q.low ? pxText(q.low) : "—")}</b></div>
    <div><span>${esc(zh ? "收" : "Last")}</span><b id="ohlc-last">${esc(pxText(q.price))}</b></div>
  </div>` : ""
  return `<p class="quote-name">${esc(q.name)}</p>
  <p class="fine" style="margin-top:0">${esc(q.ticker || q.symbol)} · ${esc(q.exchange)}${q.source ? esc(` · ${q.source}`) : ""}${q.asOf ? esc(` · ${fmtAsOf(q.asOf)}`) : ""}</p>
  <div class="quote-px" id="quote-px">${esc(formatMoney(q.price, q.currency, state.lang))}${esc(unitSuffix)}</div>
  ${q.yieldText ? `<p class="fine">${esc(q.yieldText)}</p>` : ""}
  ${q.prev ? `<div id="quote-chg" class="${up ? "up" : "down"}">${up ? "+" : ""}${esc(pxText(chg))} · ${up ? "+" : ""}${pct.toFixed(2)}% ${esc(chgTag)}</div>` : `<div id="quote-chg"></div>`}
  ${ohlc}
  ${chart}
  <p class="amount-kicker">${esc(unit)}</p>
  <label class="amount-card plain">
    <input id="shares" class="amount-xl" inputmode="decimal" value="${esc(ui.shares)}" placeholder="0" autocomplete="off">
    <p class="amount-live quote-total">${esc(total ? amountLiveText(total, q.currency) : (series ? (zh ? "按现在的价格计入" : "Saved at the live price") : (zh ? "按今天的价格计入，明天自动更新" : "Saved at today’s price, refreshed tomorrow")))}</p>
  </label>
  <p class="form-error">${ui.err ? esc(tt(ui.err)) : ""}</p>
  <button class="btn primary block" type="button" data-action="save-quote">${esc(zh ? "记下来" : "Save")}</button>`
}

function localDay() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function daysSince(stamp) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(stamp || "")) return 99
  const then = new Date(`${stamp}T00:00:00`)
  const now = new Date(`${localDay()}T00:00:00`)
  return Math.round((now - then) / 86400000)
}

let searchTimer = 0
let searchSeq = 0
let searchAbort = null
let marketStarted = false

function paintGlobal() {
  const q = ui.assetQuery.trim()
  const global = document.getElementById("global")
  const mine = document.getElementById("mine")
  const groups = document.getElementById("groups")
  if (mine) mine.hidden = !!q
  if (groups) groups.hidden = !!q
  if (global) global.innerHTML = q ? globalResultsHtml() : ""
}

function paintSearch(scope) {
  if (scope === "global") {
    paintGlobal()
    return
  }
  const q = ui.q.trim()
  const box = document.getElementById("hits")
  if (box) {
    if (!q) box.innerHTML = ""
    else if (!ui.hits.length && ui.searching) box.innerHTML = `<p class="fine">${esc(state.lang === "zh" ? "正在查找" : "Searching")}</p>`
    else box.innerHTML = hitsHtml(ui.hits, q)
  }
  const types = document.getElementById("types")
  if (types && ui.classId && !ui.symbol) types.innerHTML = typeBubbles(ui.classId)
}

function searchJson(url, signal) {
  return fetch(url, { signal }).then((res) => res.json()).catch((err) => {
    if (err?.name === "AbortError") throw err
    return { hits: [] }
  })
}

async function runSearch(scope) {
  const q = (scope === "global" ? ui.assetQuery : ui.q).trim()
  const seq = ++searchSeq
  if (searchAbort) searchAbort.abort()
  if (!q) {
    ui.hits = []
    ui.searching = false
    paintSearch(scope)
    return
  }
  const seeded = knownHits(q)
  ui.hits = seeded
  ui.searching = true
  paintSearch(scope)
  const ctrl = new AbortController()
  searchAbort = ctrl
  try {
    const coin = scope === "global" || (scope === "class" && (ui.classId === "crypto" || ui.classId === "commodity"))
    const market = scope === "global" ? "all" : (ui.classId || "all")
    const listedJob = searchJson(`/api/search?market=${encodeURIComponent(market === "crypto" || market === "commodity" ? "all" : market)}&q=${encodeURIComponent(q)}`, ctrl.signal)
    const coinJob = coin ? searchJson(`/api/coins?q=${encodeURIComponent(q)}`, ctrl.signal) : null
    const listed = await listedJob
    if (seq !== searchSeq) return
    const rows = listed?.hits || []
    ui.hits = mergeHits([seeded, rows])
    ui.searching = !!coinJob
    paintSearch(scope)
    if (!coinJob) {
      ui.searching = false
      return
    }
    const coins = await coinJob
    if (seq !== searchSeq) return
    ui.hits = mergeHits([seeded, coins?.hits || [], rows])
    ui.searching = false
    paintSearch(scope)
  } catch (err) {
    if (err?.name === "AbortError" || seq !== searchSeq) return
    ui.searching = false
    ui.hits = seeded
    paintSearch(scope)
  }
}

let seriesSeq = 0
let pollTimer = 0

function stopPoll() {
  clearInterval(pollTimer)
  pollTimer = 0
}

function quoteName(data) {
  return state.lang === "en" ? (data.nameEn || data.name) : (data.name || data.nameEn)
}

function rememberSpot(data) {
  const spot = SPOT_BY_SYMBOL[data.symbol]
  if (!spot || !data.price) return
  state.markets = state.markets || {}
  state.markets.spots = state.markets.spots || {}
  state.markets.spots[spot.id] = {
    price: data.price,
    prev: data.prev || 0,
    currency: data.currency,
    unit: data.unit || "",
    source: data.source || "",
    asOf: String(data.asOf || "").slice(0, 10),
  }
}

function paintLive() {
  const q = ui.quote
  if (!q) return
  const px = document.getElementById("quote-px")
  const zh = state.lang !== "en"
  const unitSuffix = q.unit === "oz" ? (zh ? "/盎司" : "/oz") : ""
  if (px) px.textContent = formatMoney(q.price, q.currency, state.lang) + unitSuffix
  const chgEl = document.getElementById("quote-chg")
  if (chgEl && q.prev) {
    const chg = q.price - q.prev
    const pct = (chg / q.prev) * 100
    const up = chg >= 0
    const tag = q.change === "24h" ? "24h" : (zh ? "较昨收" : "vs prior close")
    chgEl.className = up ? "up" : "down"
    chgEl.textContent = `${up ? "+" : ""}${pxText(chg)} · ${up ? "+" : ""}${pct.toFixed(2)}% ${tag}`
  }
  const last = document.getElementById("ohlc-last")
  if (last) last.textContent = pxText(q.price)
  const box = document.getElementById("chart-box")
  if (box && Array.isArray(q.candles)) box.innerHTML = candleChart(q.candles)
  const legend = document.getElementById("chart-legend")
  if (legend && q.candles?.length && !box?.querySelector(".hair")) legend.innerHTML = legendHtml(q.candles.at(-1))
  const note = document.querySelector(".quote-total")
  const shares = Number(ui.shares)
  if (note && shares > 0) note.textContent = amountLiveText(shares * q.price, q.currency)
}

function startPoll(symbol) {
  stopPoll()
  pollTimer = setInterval(() => {
    if (ui.symbol !== symbol) { stopPoll(); return }
    loadSeries(symbol, ui.range || "1d", true)
  }, 15000)
}

async function loadSeries(symbol, range, quiet) {
  const seq = ++seriesSeq
  if (!quiet) ui.chartBusy = true
  try {
    const res = await fetch(`/api/series?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`)
    const data = await res.json()
    if (seq !== seriesSeq || ui.symbol !== symbol) return
    if (!res.ok || !data.price) {
      if (!quiet) {
        ui.quoteError = "quote"
        ui.quoteBusy = false
        render()
      }
      return
    }
    data.candles = Array.isArray(data.candles) ? data.candles : []
    data.name = quoteName(data)
    data.ticker = data.symbol
    ui.quote = data
    ui.range = range
    ui.quoteBusy = false
    ui.quoteError = ""
    rememberSpot(data)
    if (quiet) {
      if (ui.symbol === symbol && document.getElementById("quote-px")) paintLive()
      return
    }
    render()
    startPoll(symbol)
  } catch {
    if (seq !== seriesSeq || ui.symbol !== symbol) return
    if (!quiet) {
      ui.quoteError = "quote"
      ui.quoteBusy = false
      render()
    }
  }
}

async function loadQuote(symbol) {
  if (SPOT_BY_SYMBOL[symbol] || ui.classId === "crypto" || ui.classId === "commodity") {
    return loadSeries(symbol, ui.range || "1d")
  }
  ui.quoteBusy = true
  ui.quoteError = ""
  ui.quote = null
  try {
    const res = await fetch(`/api/quote?symbol=${encodeURIComponent(symbol)}`)
    const data = await res.json()
    if (ui.symbol !== symbol) return
    if (!data.price) ui.quoteError = "quote"
    else ui.quote = data
  } catch {
    if (ui.symbol === symbol) ui.quoteError = "quote"
  }
  ui.quoteBusy = false
  if (ui.symbol === symbol) render()
}

function momPrev(price, mom) {
  const text = String(mom || "")
  const found = text.match(/-?\d+(?:\.\d+)?/)
  if (!found || !(Number(price) > 0)) return null
  let n = Number(found[0])
  if (!Number.isFinite(n)) return null
  if ((text.includes("▼") || text.includes("跌")) && n > 0) n = -n
  if (n <= -100) return null
  const prev = Number(price) / (1 + n / 100)
  return prev > 0 ? prev : null
}

function applyLive(h, price, prev, currency, move) {
  if (!(Number(price) > 0)) return false
  h.price = Number(price)
  if (Number(prev) > 0) {
    h.prev = Number(prev)
    h.move = move || "day"
  }
  if (h.quantity) h.amount = h.quantity * h.price
  else if (h.classId === "realestate") h.amount = h.price
  h.quoteDay = localDay()
  if (currency) h.currency = currency
  return true
}

async function refreshMarket() {
  const day = localDay()
  let changed = false
  try {
    if (!state.markets?.spots || state.marketsDay !== day || !state.markets.spots.btc?.prev) {
      try {
        const res = await fetch("/api/markets")
        const data = await res.json()
        if (data.spots) {
          state.markets = data
          state.marketsDay = day
          changed = true
          state.holdings.forEach((h) => {
            const spot = SPOT_BY_SYMBOL[h.symbol]
            const row = spot && data.spots[spot.id]
            if (!row?.price || !h.quantity) return
            if (applyLive(h, row.price, row.prev, row.currency, row.move || (spot.classId === "crypto" ? "24h" : "day"))) changed = true
          })
        }
      } catch {
        /* 报价没取到时，页面不填估算数字 */
      }
    }
    const alts = state.holdings.filter((h) => h.classId === "crypto" && h.symbol && !SPOT_BY_SYMBOL[h.symbol] && h.quantity).slice(0, 8)
    const houses = daysSince(state.houseChecked) >= 7
      ? state.holdings.filter((h) => h.classId === "realestate" && String(h.symbol || "").startsWith("hs:")).slice(0, 8)
      : []
    for (const h of houses) {
      try {
        const res = await fetch(`/api/housing?ref=${encodeURIComponent(h.symbol)}`)
        const data = await res.json()
        const quote = data.quote
        if (!quote?.price) continue
        const prev = quote.prev || momPrev(quote.price, quote.mom)
        const sqm = quote.basis === "sqm" || quote.unit === "sqm"
        if (sqm && h.quantity) {
          applyLive(h, quote.price, prev, quote.currency, prev ? "month" : "")
        } else if (applyLive(h, quote.price, prev, quote.currency, prev ? "month" : "")) {
          h.amount = quote.price
        }
        changed = true
      } catch {
        /* 这处房价今天没取到，就保持上次记下的价格 */
      }
    }
    if (daysSince(state.houseChecked) >= 7) {
      state.houseChecked = day
      persist()
    }
    for (const h of alts) {
      try {
        const res = await fetch(`/api/series?symbol=${encodeURIComponent(h.symbol)}&range=1d`)
        const data = await res.json()
        if (!data.price) continue
        if (applyLive(h, data.price, data.prev, data.currency, "24h")) changed = true
      } catch {
        /* 这只币今天没取到，就保持上次记下的价格 */
      }
    }
    if (state.fxDay !== day) {
      const res = await fetch("/api/fx")
      const data = await res.json()
      if (data.rates) {
        state.fxMarket = data.rates
        state.fxDay = day
        if (data.date) state.fxAsOf = String(data.date).slice(0, 10)
        applyMarketFx(data.rates)
        changed = true
      }
    }
    if (state.depositDay !== day || state.depositRev !== 2 || !state.depositBoard?.banks) {
      try {
        const res = await fetch("/api/deposits")
        const data = await res.json()
        if (data.banks && Object.keys(data.banks).length) {
          state.depositBoard = { banks: data.banks }
          state.depositDay = day
          state.depositRev = 2
          applyDepositBoard(state.depositBoard)
          state.holdings.forEach((h) => {
            if (h.classId !== "deposit") return
            const bank = findBank(h.institution)
            if (!bank) return
            const product = bankProducts(bank).find((p) => p.id === h.subtype)
            if (!product || product.rate == null || h.incomeYield === product.rate) return
            h.incomeYield = product.rate
          })
          changed = true
        }
      } catch {
        /* 挂牌没取到时，页面仍用上一次核对到的利率 */
      }
    }
    const due = state.holdings.filter((h) => (h.classId === "equity" || h.classId === "fund" || h.classId === "pension") && h.symbol && h.quantity)
    for (const h of due) {
      const res = await fetch(`/api/quote?symbol=${encodeURIComponent(h.symbol)}`)
      const data = await res.json()
      if (!data.price) continue
      if (applyLive(h, data.price, data.prev, data.currency, "day")) changed = true
    }
  } catch {
    return
  }
  if (!changed) return
  commit()
  toast(state.lang === "zh" ? "行情和存款利率已核对" : "Prices and deposit rates checked")
  render()
}

let bookTimer = 0

function armBookPoll() {
  if (bookTimer) return
  bookTimer = setInterval(() => { refreshLiveBook() }, 15000)
}

async function refreshLiveBook() {
  if (!state.onboarded || (state.page !== "home" && state.page !== "holdings")) return
  const lives = state.holdings.filter(liveHolding)
  if (!lives.length) return
  let changed = false
  try {
    const market = await fetch("/api/markets").then((res) => res.json()).catch(() => null)
    if (market?.spots) {
      state.markets = market
      lives.forEach((h) => {
        const spot = SPOT_BY_SYMBOL[h.symbol]
        const row = spot && market.spots[spot.id]
        if (!row?.price) return
        if (applyLive(h, row.price, row.prev, row.currency, row.move || (spot.classId === "crypto" ? "24h" : "day"))) changed = true
      })
    }
  } catch {
    /* 行情这次没取到，就保持屏幕上的净值 */
  }
  for (const h of lives) {
    if (SPOT_BY_SYMBOL[h.symbol]) continue
    try {
      const url = h.classId === "crypto"
        ? `/api/series?symbol=${encodeURIComponent(h.symbol)}&range=1d`
        : `/api/quote?symbol=${encodeURIComponent(h.symbol)}&live=1`
      const data = await fetch(url).then((res) => res.json())
      if (!data.price) continue
      const move = h.classId === "crypto" ? "24h" : "day"
      if (applyLive(h, data.price, data.prev, data.currency, move)) changed = true
    } catch {
      /* 这一笔这次没取到 */
    }
  }
  if (!changed) return
  persist()
  const typing = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")
  if (!typing) render()
}

function finishIntro() {
  state.onboarded = true
  state.page = "home"
  ui.classId = null
  persist()
  render()
}

function replayIntro() {
  state.onboarded = false
  ui.ask = 0
  ui.sheet = false
  persist()
  render()
}

function viewHtml() {
  const bar = demoBar()
  if (state.page === "assets") return bar + assetsHtml()
  if (state.page === "holdings") return bar + holdingsHtml()
  if (state.page === "settings") return bar + settingsHtml()
  if (state.page === "analysis") return bar + analysisHtml()
  if (state.page === "rates") return bar + ratesHtml()
  return bar + homeHtml()
}

function sheetHtml() {
  if (!ui.sheet || !ui.draft) return ""
  if (ui.sheet === "pick") {
    return `<div class="sheet"><div class="sheet-top"><button type="button" data-action="close-sheet">${esc(tt("cancel"))}</button><h2>${esc(tt("pick_class"))}</h2><span></span></div>
    <div class="sheet-body"><div class="bubble-grid">${CLASSES.map((c) => `<button class="bubble" type="button" data-action="pick-class" data-id="${c.id}">${classMark(c)}<b>${esc(langOf(c))}</b></button>`).join("")}</div></div></div>`
  }
  const d = ui.draft
  const isDebt = d.classId === "liability"
  const sub = subtypeById(d.classId, d.subtype)
  const bank = d.classId === "deposit" ? findBank(d.institution) : null
  const y = Number(d.incomeYield)
  const quick = entryCurrencies(d.currency)
  const head = bank
    ? `<div class="pick-head"><i class="mark face" style="background:${bank.color}">${esc(bank.mark)}</i><div><b>${esc(langOf(bank))}</b><span class="subline">${esc(langOf(sub))}</span></div></div>`
    : ""
  const rateLine = Number.isFinite(y) && (bank || y > 0)
    ? `<p class="rate-lock">${shownRate(y, "")}<span>${esc(state.lang === "zh" ? "按这家挂牌计入" : "Using this posted rate")}</span></p>`
    : ""
  const typed = Number(d.amount)
  return `<form id="holding-form" class="sheet simple-sheet">
    <button class="sheet-scrim" type="button" data-action="close-sheet" aria-label="${esc(state.lang === "zh" ? "关闭" : "Close")}"></button>
    <div class="sheet-panel">
      <div class="sheet-grab"></div>
      <div class="sheet-top"><button type="button" data-action="close-sheet">${esc(tt("cancel"))}</button><h2>${esc(isDebt ? (state.lang === "zh" ? "还剩多少" : "What's left") : langOf(sub))}</h2><span></span></div>
      <div class="sheet-body">
        ${head}
        ${rateLine}
        <label class="amount-card">
          <span class="amount-mark">${esc(ccyMark(d.currency))}</span>
          <input class="amount-xl" data-field="amount" inputmode="decimal" value="${esc(d.amount)}" placeholder="0" autocomplete="off">
          <p class="amount-live">${esc(amountLiveText(typed, d.currency))}</p>
        </label>
        <div class="ccy-pills">${quick.map((code) => `<button type="button" class="${d.currency === code ? "on" : ""}" data-action="set-ccy" data-ccy="${code}">${esc(ccyMark(code))} ${esc(code)}</button>`).join("")}</div>
        <p class="form-error">${ui.err ? esc(tt(ui.err)) : ""}</p>
      </div>
      <div class="sheet-foot">
        <button class="btn primary block" type="submit">${esc(state.lang === "zh" ? "记下来" : "Save")}</button>
        ${d.id ? `<button class="btn ghost block" type="button" data-action="delete">${esc(tt("delete_btn"))}</button>` : ""}
      </div>
    </div>
  </form>`
}

function ccyMark(code) {
  return {
    CNY: "¥", USD: "$", HKD: "HK$", EUR: "€", GBP: "£", JPY: "¥",
    SGD: "S$", AUD: "A$", CAD: "C$", CHF: "Fr", KRW: "₩", INR: "₹",
  }[code] || code
}

const ENTRY_CCY = ["CNY", "USD", "EUR", "GBP", "HKD", "JPY", "AUD", "CAD", "SGD", "CHF"]

function entryCurrencies(current) {
  return current && !ENTRY_CCY.includes(current) ? [current, ...ENTRY_CCY] : ENTRY_CCY
}

function fxHint(amount, currency) {
  const n = Number(amount)
  const zh = state.lang !== "en"
  if (!Number.isFinite(n) || n <= 0 || !currency || currency === state.base) return ""
  const converted = valueOf({ amount: n, currency }, state.base, state.fxOverride)
  if (converted == null) return zh ? "这个汇率没取到，总览先不折算" : "No rate for the overview"
  const asOf = state.fxAsOf ? ` · ${state.fxAsOf}` : ""
  return `${zh ? "总览约 " : "Overview "}${formatMoney(converted, state.base, state.lang)}${asOf}`
}

function amountLiveText(amount, currency) {
  const n = Number(amount)
  if (!Number.isFinite(n) || n <= 0) return ""
  const own = formatMoney(n, currency, state.lang)
  const hint = fxHint(n, currency)
  return hint ? `${own} · ${hint}` : own
}

function basePicker() {
  const codes = entryCurrencies(state.base)
  return `<div class="scroller">${codes.map((code) => `<button type="button" class="chip ${state.base === code ? "on" : ""}" data-action="set-base" data-ccy="${esc(code)}">${esc(ccyMark(code))} ${esc(code)}</button>`).join("")}</div>`
}

function countryOptions(current) {
  const ids = ["CN", "US", "EU", "UK", "JP", "AU", "CA", "CH", "HK", "SG", "KR", "IN", "AE", "BR", "NZ", "TW", "TH", "MX"]
  const extra = current && !countryById(current) ? `<option value="${esc(current)}" selected>${esc(current)}</option>` : ""
  return extra + ids.map((id) => {
    const c = countryById(id)
    if (!c) return ""
    return `<option value="${c.id}" ${c.id === current ? "selected" : ""}>${esc(c[state.lang])}</option>`
  }).join("")
}

function modalHtml() {
  if (!ui.modal) return ""
  const m = ui.modal
  return `<div class="modal-back"><div class="modal" role="dialog"><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p><div class="modal-actions">
    <button class="btn ghost" type="button" data-action="modal-no">${esc(tt("cancel"))}</button>
    <button class="btn ${m.danger ? "danger" : "primary"}" type="button" data-action="modal-yes">${esc(m.confirm)}</button>
  </div></div></div>`
}

function paintSheet() {
  document.getElementById("sheet").innerHTML = sheetHtml()
  document.getElementById("phone").classList.toggle("locked", !!(ui.sheet || ui.modal))
}
function paintModal() {
  document.getElementById("modal").innerHTML = modalHtml()
  document.getElementById("phone").classList.toggle("locked", !!(ui.sheet || ui.modal))
}

function render() {
  const gating = !state.onboarded
  const view = document.getElementById("view")
  const key = gating
    ? `gate:${ui.ask}`
    : `${state.page}:${ui.classId || ""}:${ui.sheet || ""}:${state.lang}:${state.base}:${state.mask}`
  const prev = view.scrollTop
  document.getElementById("phone").classList.toggle("gating", gating)
  document.getElementById("top").innerHTML = gating ? "" : header()
  view.innerHTML = gating ? gateHtml() : viewHtml()
  document.getElementById("tabs").innerHTML = gating ? "" : tabs()
  paintSheet()
  paintModal()
  if (key === renderKey) view.scrollTop = prev
  renderKey = key
  document.documentElement.lang = state.lang === "en" ? "en" : "zh-CN"
  document.title = "FOLIO"
  const note = document.getElementById("stage-note")
  const local = location.hostname === "localhost" || location.hostname === "127.0.0.1"
  const extra = local
    ? (state.lang === "zh" ? "手机和电脑连同一个 Wi-Fi，用 Safari 打开终端里的局域网地址，不要用 localhost。" : "On a phone, use the LAN address printed in the terminal, not localhost.")
    : tt("stage_url", { url: location.origin })
  note.innerHTML = `${esc(tt("stage_note"))}<br><strong>${esc(extra)}</strong>`
  const clk = document.getElementById("clock")
  if (clk) clk.textContent = clock()
  if (!gating && ui.focus) {
    const field = document.querySelector("[data-field=amount]")
    field?.focus()
    ui.focus = false
  }
  if (!gating && !marketStarted) {
    marketStarted = true
    if (state.fxMarket) applyMarketFx(state.fxMarket)
    if (state.depositBoard) applyDepositBoard(state.depositBoard)
    refreshMarket()
  }
  if (!gating) armBookPoll()
}

function exportBackup() {
  const payload = {
    app: "folio",
    version: 1,
    exportedAt: new Date().toISOString(),
    base: state.base,
    lang: state.lang,
    holdings: state.holdings,
    history: state.history,
    fxOverride: state.fxOverride,
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `folio-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(a.href)
  toast(tt("exported"))
}

function onClick(e) {
  const el = e.target.closest("[data-action]")
  if (!el) return
  const action = el.dataset.action
  if (action === "nav") {
    if (el.dataset.page === "rates") {
      ui.step = el.dataset.tab === "fx" ? "fx" : "country"
      if (ui.step === "country") { ui.pickCountry = ""; ui.pickBank = "" }
    }
    if (el.dataset.tab) ui.rateTab = el.dataset.tab
    if (el.dataset.page === "assets" && state.page === "assets") ui.classId = null
    go(el.dataset.page)
    return
  }
  if (action === "back") {
    if (state.page === "assets" && ui.classId === "realestate" && !ui.houseManual && !ui.symbol) {
      const stack = ui.houseStack
      if (stack.length > 1) {
        stack.pop()
        ui.step = stack.at(-1) || "country"
        if (ui.step === "country") ui.house.country = ""
        if (ui.step === "region") { ui.house.region = ""; ui.house.district = ""; ui.house.place = "" }
        if (ui.step === "district") { ui.house.district = ""; ui.house.place = "" }
        if (ui.step === "place") ui.house.place = ""
        ui.houseQuote = null
        ui.q = ""
        if (ui.step === "country") render()
        else loadHousing()
        return
      }
    }
    if (state.page === "assets" && ui.classId === "realestate" && ui.houseManual) {
      ui.houseManual = false
      ui.step = "country"
      render()
      return
    }
    if (state.page === "assets" && ui.classId === "realestate" && !ui.houseManual && !ui.symbol) {
      const stack = ui.houseStack
      if (stack.length > 1) {
        stack.pop()
        ui.step = stack.at(-1) || "country"
        if (ui.step === "country") ui.house.country = ""
        if (ui.step === "region") { ui.house.region = ""; ui.house.district = ""; ui.house.place = "" }
        if (ui.step === "district") { ui.house.district = ""; ui.house.place = "" }
        if (ui.step === "place") ui.house.place = ""
        ui.houseQuote = null
        ui.q = ""
        if (ui.step === "country") render()
        else loadHousing()
        return
      }
    }
    if (state.page === "assets" && ui.classId === "realestate" && ui.houseManual) {
      ui.houseManual = false
      ui.step = "country"
      render()
      return
    }
    if (state.page === "assets" && ui.symbol) {
      ui.symbol = ""
      ui.quote = null
      ui.quoteError = ""
      ui.shares = ""
      stopPoll()
      render()
      return
    }
    if (state.page === "assets" && ui.shelf) {
      ui.shelf = ""
      ui.q = ""
      ui.hits = []
      render()
      return
    }
    if ((state.page === "assets" && ui.classId === "deposit") || state.page === "rates") {
      if (ui.step === "product") { ui.step = "bank"; render(); return }
      if (ui.step === "bank" || ui.step === "fx") { ui.step = "country"; ui.pickBank = ""; render(); return }
    }
    if (state.page === "assets" && ui.classId) { ui.classId = null; ui.step = "country"; render(); return }
    go(state.page === "rates" ? "home" : "home")
    return
  }
  if (action === "add") {
    if (state.page === "assets" && ui.classId === "equity") {
      ui.symbol = ""
      ui.quote = null
      ui.q = ""
      render()
      document.getElementById("sym-q")?.focus()
      return
    }
    openCreate(state.page === "assets" ? ui.classId : null)
    return
  }
  if (action === "open-class") {
    state.page = "assets"
    ui.classId = el.dataset.id
    ui.q = ""
    ui.hits = []
    ui.symbol = ""
    ui.quote = null
    ui.shelf = ""
    if (el.dataset.id === "deposit") {
      ui.step = "country"
      ui.pickCountry = ""
      ui.pickBank = ""
    }
    if (el.dataset.id === "realestate") {
      ui.step = "country"
      ui.houseManual = false
      ui.house = { country: "", region: "", district: "", place: "" }
      ui.houseStack = ["country"]
      ui.houseItems = []
      ui.houseParent = null
      ui.houseQuote = null
      ui.houseError = ""
      ui.q = ""
      ui.area = ""
    }
    persist()
    render()
    if (el.dataset.id === "realestate") fetchHouse("CN", "", "", "")
    return
  }
  if (action === "open-found") {
    const kind = el.dataset.kind
    ui.assetQuery = ""
    ui.hits = []
    if (kind === "class") {
      state.page = "assets"
      ui.classId = el.dataset.id
      ui.q = ""
      if (el.dataset.id === "deposit") ui.step = "country"
      render()
      return
    }
    if (kind === "sub") {
      state.page = "assets"
      ui.classId = el.dataset.class
      openCreate(el.dataset.class, el.dataset.id)
      return
    }
    if (kind === "bank") {
      const bank = BANKS.find((b) => b.id === el.dataset.id)
      if (!bank) return
      state.page = "assets"
      ui.classId = "deposit"
      ui.step = "product"
      ui.pickCountry = bank.country
      ui.pickBank = bank.id
      ui.q = ""
      render()
      return
    }
    return
  }
  if (action === "pick-house-country") {
    const id = el.dataset.id
    if (el.dataset.live !== "1") {
      ui.houseManual = true
      openCreate("realestate", "primary")
      if (ui.draft) {
        ui.draft.country = id
        ui.draft.currency = COUNTRY_CCY[id] || ui.draft.currency
        ui.draft.name = state.lang === "zh" ? `${regionLabel(id)}房产` : `${regionLabel(id)} property`
      }
      render()
      return
    }
    ui.house = { country: id, region: "", district: "", place: "" }
    ui.houseStack = ["country", "region"]
    ui.step = "region"
    ui.q = ""
    ui.houseQuote = null
    ui.houseItems = []
    ui.houseError = ""
    ui.err = ""
    ui.houseBusy = true
    render()
    loadHousing()
    return
  }
  if (action === "house-manual") {
    ui.houseManual = true
    ui.q = ""
    render()
    return
  }
  if (action === "pick-house") {
    const next = el.dataset.next
    const id = el.dataset.id
    if (next === "quote" && !el.dataset.price) {
      toast(state.lang === "zh" ? "这处的单价没取到" : "No unit price for this place")
      return
    }
    if (next === "district") {
      ui.house.region = id
      ui.house.district = ""
      ui.house.place = ""
      ui.step = "district"
    } else if (next === "place") {
      ui.house.district = id
      ui.house.place = ""
      ui.step = "place"
    } else {
      ui.house.place = id
      ui.step = "quote"
    }
    ui.houseStack.push(ui.step)
    ui.q = ""
    ui.area = ""
    ui.err = ""
    ui.houseBusy = true
    ui.houseItems = []
    render()
    loadHousing()
    return
  }
  if (action === "house-kind") {
    ui.houseKind = el.dataset.id === "invest_res" ? "invest_res" : "primary"
    ui.area = document.getElementById("house-area")?.value || ui.area
    render()
    return
  }
  if (action === "house-save") {
    const q = ui.houseQuote
    ui.area = document.getElementById("house-area")?.value || ui.area
    const area = Number(ui.area)
    const sqm = q && (q.basis === "sqm" || q.unit === "sqm")
    if (!q?.price || (sqm && !(area > 0))) {
      ui.err = "err_amount"
      render()
      return
    }
    const amount = sqm ? area * q.price : q.price
    const holding = sanitizeHolding({
      classId: "realestate",
      subtype: ui.houseKind === "invest_res" ? "invest_res" : "primary",
      name: q.name,
      symbol: q.ref || "",
      currency: q.currency || "CNY",
      country: ui.house.country,
      amount,
      quantity: sqm ? area : null,
      price: q.price,
      prev: q.prev || momPrev(q.price, q.mom),
      move: q.prev || q.mom ? "month" : "",
      quoteDay: localDay(),
      cost: amount,
      incomeYield: 0,
      growth: 0,
      account: "property",
      institution: q.source || ui.houseSource || "",
    })
    if (!holding) {
      ui.err = "err_amount"
      render()
      return
    }
    state.holdings.unshift(holding)
    ui.step = "country"
    ui.house = { country: "", region: "", district: "", place: "" }
    ui.houseStack = ["country"]
    ui.houseQuote = null
    ui.area = ""
    ui.q = ""
    commit()
    toast(tt("saved"))
    render()
    return
  }
  if (action === "pick-country") {
    ui.pickCountry = el.dataset.id
    ui.pickBank = ""
    ui.step = "bank"
    render()
    return
  }
  if (action === "pick-bank") {
    const bank = BANKS.find((b) => b.id === el.dataset.id)
    if (bank) ui.pickCountry = bank.country
    ui.pickBank = el.dataset.id
    ui.step = "product"
    ui.q = ""
    render()
    return
  }
  if (action === "pick-product") {
    const bank = BANKS.find((b) => b.id === ui.pickBank)
    const product = bank ? bankProducts(bank).find((p) => p.id === el.dataset.id) : null
    if (!bank || !product) return
    if (product.rate == null) {
      toast(state.lang === "zh" ? "这家的挂牌今天没取到" : "This bank’s board was not available today")
      return
    }
    const productLabel = product.gzh && product.group !== "demand" && langOf(product) !== (state.lang === "en" ? product.gen : product.gzh)
      ? `${state.lang === "en" ? product.gen : product.gzh} ${langOf(product)}`
      : langOf(product)
    openPreset({
      classId: "deposit",
      subtype: product.id,
      currency: bank.currency,
      country: bank.country,
      institution: langOf(bank),
      incomeYield: product.rate,
      growth: 0,
      account: "bank",
      name: `${langOf(bank)} ${productLabel}`,
    })
    return
  }
  if (action === "add-sub") {
    const spot = Object.values(SPOTS).find((item) => item.classId === ui.classId && item.subtype === el.dataset.id)
    if (spot) {
      ui.symbol = spot.symbol
      ui.range = "1d"
      ui.shares = ""
      ui.err = ""
      ui.quote = null
      ui.quoteBusy = true
      render()
      loadQuote(spot.symbol)
      return
    }
    if (SHELF_CLASSES.includes(ui.classId)) {
      ui.shelf = el.dataset.id
      ui.q = ""
      ui.hits = []
      ui.symbol = ""
      ui.quote = null
      ui.err = ""
      render()
      return
    }
    openCreate(ui.classId, el.dataset.id)
    return
  }
  if (action === "shelf-manual") {
    openCreate(ui.classId, ui.shelf)
    return
  }
  if (action === "edit") { openEdit(el.dataset.id); return }
  if (action === "close-sheet") { closeSheet(); return }
  if (action === "pick-class") {
    if (el.dataset.id === "deposit") {
      ui.sheet = false
      ui.draft = null
      state.page = "assets"
      ui.classId = "deposit"
      ui.step = "country"
      ui.pickCountry = ""
      ui.pickBank = ""
      render()
      return
    }
    ui.draft = ui.draft || blankDraft(el.dataset.id)
    ui.draft.classId = el.dataset.id
    ui.draft.subtype = SUBTYPES[el.dataset.id][0].id
    applyMeta(ui.draft)
    ui.draft.name = langOf(subtypeById(el.dataset.id, ui.draft.subtype))
    ui.more = false
    ui.sheet = "form"
    ui.focus = true
    render()
    return
  }
  if (action === "change-class") {
    readDraft()
    ui.sheet = "pick"
    render()
    return
  }
  if (action === "mask") {
    state.mask = !state.mask
    persist()
    render()
    return
  }
  if (action === "lang") {
    state.lang = el.dataset.lang === "en" ? "en" : "zh"
    persist()
    render()
    return
  }
  if (action === "rate-tab") {
    ui.rateTab = el.dataset.tab
    ui.country = "ALL"
    render()
    return
  }
  if (action === "country") {
    ui.country = el.dataset.id
    render()
    return
  }
  if (action === "add-policy") {
    const country = el.dataset.country
    const ref = DEPOSIT_REF[country]
    openPreset({
      classId: "deposit",
      subtype: "savings",
      currency: COUNTRY_CCY[country],
      country,
      incomeYield: ref?.savings ?? 0,
      growth: 0,
      account: "bank",
      name: regionLabel(country),
    })
    return
  }
  if (action === "add-retail") {
    const country = el.dataset.country
    const kind = el.dataset.kind
    const ref = DEPOSIT_REF[country]
    openPreset({
      classId: "deposit",
      subtype: kind === "time" ? "time_1y" : "savings",
      currency: COUNTRY_CCY[country],
      country,
      incomeYield: kind === "time" ? ref.time : ref.savings,
      growth: 0,
      account: "bank",
      name: `${regionLabel(country)} ${kind === "time" ? (state.lang === "zh" ? "定期" : "term") : (state.lang === "zh" ? "储蓄" : "savings")}`,
    })
    return
  }
  if (action === "add-bank") {
    const b = BANKS[Number(el.dataset.i)]
    if (!b) return
    const products = bankProducts(b)
    const preferred = b.kind === "savings" ? "savings" : "time_1y"
    const picked = products.find((p) => p.id === preferred && p.rate != null) || products.find((p) => p.rate != null)
    if (!picked) {
      toast(state.lang === "zh" ? "这家的挂牌今天没取到" : "This bank’s board was not available today")
      return
    }
    openPreset({
      classId: "deposit",
      subtype: picked.id,
      currency: b.currency,
      country: b.country,
      institution: langOf(b),
      incomeYield: picked.rate,
      growth: 0,
      account: "bank",
      name: langOf(b),
    })
    return
  }
  if (action === "reset-fx") {
    state.fxOverride = {}
    persist()
    toast(tt("fx_saved"))
    render()
    return
  }
  if (action === "exit-demo") { exitDemo(); return }
  if (action === "replay") { replayIntro(); return }
  if (action === "story-next") {
    if (ui.ask >= STORY - 1) finishIntro()
    else {
      ui.ask += 1
      render()
    }
    return
  }
  if (action === "story-back") {
    if (ui.ask > 0) {
      ui.ask -= 1
      render()
    }
    return
  }
  if (action === "chart-range") {
    const range = el.dataset.range
    if (!ui.symbol || !range || range === ui.range) return
    ui.range = range
    loadSeries(ui.symbol, range)
    return
  }
  if (action === "pick-symbol") {
    state.page = "assets"
    if (el.dataset.class) ui.classId = el.dataset.class
    else ui.classId = ui.classId || "equity"
    ui.symbol = el.dataset.symbol
    ui.range = "1d"
    ui.shares = ""
    ui.err = ""
    ui.quote = null
    ui.quoteBusy = true
    render()
    loadQuote(ui.symbol)
    return
  }
  if (action === "save-quote") {
    const q = ui.quote
    ui.shares = document.getElementById("shares")?.value || ui.shares
    const shares = Number(ui.shares)
    if (!q || !Number.isFinite(shares) || shares <= 0) {
      ui.err = "err_amount"
      render()
      return
    }
    const spot = SPOT_BY_SYMBOL[q.symbol]
    const series = q.classId === "crypto" || q.classId === "commodity"
    const classId = !series && QUOTE_CLASSES.includes(ui.classId) ? ui.classId : (spot?.classId || q.classId || "equity")
    const subtype = classId === "fund"
      ? inferFundSubtype(q)
      : (classId === "pension"
        ? (SUBTYPES.pension.some((s) => s.id === ui.shelf) ? ui.shelf : "pension_acct")
        : (ui.shelf === "rsu" ? "rsu" : (spot?.subtype || q.subtype || equitySubtype(q.exchange, q.symbol))))
    const holding = sanitizeHolding(series || spot ? {
      classId: spot?.classId || q.classId,
      subtype: spot?.subtype || q.subtype,
      name: q.name,
      symbol: q.symbol,
      currency: q.currency,
      amount: shares * q.price,
      quantity: shares,
      price: q.price,
      prev: q.prev || null,
      move: q.change === "24h" ? "24h" : "day",
      quoteDay: localDay(),
      cost: shares * q.price,
      incomeYield: 0,
      growth: 0,
      account: spot?.account || (q.classId === "crypto" ? "exchange" : "broker"),
    } : {
      classId,
      subtype,
      name: q.name,
      symbol: q.symbol,
      currency: q.currency,
      amount: shares * q.price,
      quantity: shares,
      price: q.price,
      prev: q.prev || null,
      move: "day",
      quoteDay: localDay(),
      cost: shares * q.price,
      incomeYield: 0,
      growth: 0,
      account: classId === "pension" ? "retirement" : "broker",
    })
    if (!holding) {
      ui.err = "err_amount"
      render()
      return
    }
    state.holdings.unshift(holding)
    ui.symbol = ""
    ui.quote = null
    ui.shares = ""
    ui.q = ""
    ui.hits = []
    commit()
    toast(tt("saved"))
    render()
    return
  }
  if (action === "set-ccy") {
    readDraft()
    ui.draft.currency = el.dataset.ccy
    ui.focus = false
    paintSheet()
    return
  }
  if (action === "set-base") {
    const code = el.dataset.ccy
    if (!entryCurrencies(state.base).includes(code)) return
    state.base = code
    persist()
    render()
    return
  }
  if (action === "toggle-more") {
    readDraft()
    ui.more = !ui.more
    ui.focus = false
    paintSheet()
    return
  }
  if (action === "demo") {
    if (!state.holdings.length) { loadDemo(); return }
    ask({ title: tt("confirm_demo"), body: tt("confirm_demo_body"), confirm: tt("yes_replace"), onYes: loadDemo })
    return
  }
  if (action === "clear") {
    ask({
      title: tt("confirm_clear"), body: tt("confirm_clear_body"), confirm: tt("yes_clear"), danger: true,
      onYes: () => {
        state.holdings = []
        state.history = []
        state.demo = false
        persist()
        toast(tt("cleared"))
        render()
      },
    })
    return
  }
  if (action === "delete") {
    const id = ui.draft?.id
    if (!id) return
    ask({
      title: tt("confirm_delete"), body: tt("confirm_delete_body"), confirm: tt("yes_delete"), danger: true,
      onYes: () => {
        state.holdings = state.holdings.filter((h) => h.id !== id)
        ui.sheet = false
        ui.draft = null
        commit()
        toast(tt("deleted"))
        render()
      },
    })
    return
  }
  if (action === "export") { exportBackup(); return }
  if (action === "import") { document.getElementById("file").click(); return }
  if (action === "modal-no") { ui.modal = null; paintModal(); return }
  if (action === "modal-yes") {
    const fn = ui.modal?.onYes
    ui.modal = null
    paintModal()
    fn?.()
  }
}

function onInput(e) {
  if (e.target.id === "house-area") {
    ui.area = e.target.value
    const q = ui.houseQuote
    const area = Number(ui.area)
    const note = document.getElementById("house-total")
    if (note && q?.price) {
      const zh = state.lang !== "en"
      note.textContent = area > 0 ? amountLiveText(area * q.price, q.currency || "CNY") : (zh ? "填面积后按挂牌单价算出总价" : "Enter the area to price it")
    }
    return
  }
  if (e.target.id === "house-q") {
    ui.q = e.target.value
    paintHouseQuery()
    return
  }
  if (e.target.id === "sym-q") {
    ui.q = e.target.value
    const types = document.getElementById("types")
    if (types && ui.classId && !ui.symbol) types.innerHTML = typeBubbles(ui.classId)
    clearTimeout(searchTimer)
    if (!ui.q.trim()) {
      ui.hits = []
      ui.searching = false
      paintSearch("class")
      return
    }
    if (ui.classId === "equity" || ui.classId === "fund" || ui.classId === "pension" || ui.classId === "crypto") searchTimer = setTimeout(() => runSearch("class"), 280)
    return
  }
  if (e.target.id === "shares") {
    ui.shares = e.target.value
    const q = ui.quote
    const shares = Number(ui.shares)
    const note = document.querySelector(".quote-total")
    if (note && q && shares > 0) note.textContent = amountLiveText(shares * q.price, q.currency)
    return
  }
  if (e.target.id === "q") {
    ui.query = e.target.value
    const list = document.getElementById("list")
    if (!list) return
    const q = ui.query.trim().toLowerCase()
    const rows = sortedHoldings(state.holdings.filter((h) => {
      if (!q) return true
      return queryHits([displayName(h, state.lang), displayName(h, state.lang === "zh" ? "en" : "zh"), h.symbol, h.institution, h.currency, langOf(classById(h.classId)), langOf(subtypeById(h.classId, h.subtype))].join(" "), q)
    }))
    list.innerHTML = rows.length ? rows.map(rowHtml).join("") : `<p class="fine">${esc(tt("no_match"))}</p>`
    return
  }
  if (e.target.id === "asset-q") {
    ui.assetQuery = e.target.value
    ui.hits = []
    ui.searching = !!ui.assetQuery.trim()
    paintGlobal()
    clearTimeout(searchTimer)
    if (ui.assetQuery.trim()) searchTimer = setTimeout(() => runSearch("global"), 280)
    return
  }
  if (e.target.id === "rate-q") {
    ui.rateQuery = e.target.value
    const box = document.getElementById("rate-list")
    if (box) box.innerHTML = rateListHtml()
    return
  }
  const field = e.target.dataset.field
  if (field && ui.draft) {
    ui.draft[field] = e.target.value
    if (field === "amount") {
      const live = document.querySelector(".sheet .amount-live")
      if (live) live.textContent = amountLiveText(ui.draft.amount, ui.draft.currency)
    }
  }
}

function onChange(e) {
  if (e.target.id === "base") {
    state.base = e.target.value
    persist()
    render()
    return
  }
  if (e.target.dataset.fx) {
    const n = Number(e.target.value)
    if (n > 0) state.fxOverride[e.target.dataset.fx] = n
    else delete state.fxOverride[e.target.dataset.fx]
    persist()
    toast(tt("fx_saved"))
    return
  }
  const field = e.target.dataset.field
  if (!field || !ui.draft) return
  ui.draft[field] = e.target.value
  if (field === "amount") {
    const live = document.querySelector(".amount-live")
    if (live) live.textContent = amountLiveText(ui.draft.amount, ui.draft.currency)
    return
  }
  if (field === "subtype") {
    applyMeta(ui.draft)
    ui.focus = false
    paintSheet()
  }
}

const narrow = window.matchMedia("(max-width: 560px)")
function syncFrame() {
  const full = new URLSearchParams(location.search).has("full")
  document.body.classList.toggle("full", full || narrow.matches)
}
syncFrame()
narrow.addEventListener("change", syncFrame)

function onChartPoint(e) {
  const frame = e.target.closest?.(".chart-frame")
  if (!frame || !ui.quote?.candles?.length) return
  const svg = frame.querySelector("svg")
  if (!svg) return
  const box = svg.getBoundingClientRect()
  const x = e.clientX - box.left
  if (x < 0 || x > box.width) return
  const n = ui.quote.candles.length
  const i = Math.min(n - 1, Math.max(0, Math.floor((x / box.width) * n)))
  const legend = document.getElementById("chart-legend")
  if (legend) legend.innerHTML = legendHtml(ui.quote.candles[i])
  let hair = frame.querySelector(".hair")
  if (!hair) {
    hair = document.createElement("i")
    hair.className = "hair"
    frame.appendChild(hair)
  }
  hair.style.left = `${x}px`
}

function resetChartPoint(e) {
  const frame = e.target.closest?.(".chart-frame")
  if (!frame || e.relatedTarget?.closest?.(".chart-frame")) return
  frame.querySelector(".hair")?.remove()
  const legend = document.getElementById("chart-legend")
  const last = ui.quote?.candles?.at?.(-1)
  if (legend && last) legend.innerHTML = legendHtml(last)
}

document.body.addEventListener("pointerdown", onChartPoint)
document.body.addEventListener("pointermove", onChartPoint)
document.body.addEventListener("pointerout", resetChartPoint)
document.body.addEventListener("click", onClick)
document.body.addEventListener("input", onInput)
document.body.addEventListener("change", onChange)
document.body.addEventListener("submit", (e) => {
  if (e.target.id === "holding-form") {
    e.preventDefault()
    saveDraft()
  }
})
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return
  if (ui.modal) { ui.modal = null; paintModal(); return }
  if (ui.sheet) closeSheet()
})
document.getElementById("file").addEventListener("change", async (e) => {
  const file = e.target.files?.[0]
  e.target.value = ""
  if (!file) return
  try {
    const data = JSON.parse(await file.text())
    if (data.app !== "folio" || !Array.isArray(data.holdings)) throw new Error("bad")
    const apply = () => {
      const holdings = data.holdings.map(sanitizeHolding).filter(Boolean)
      if (!holdings.length) { toast(tt("bad_file")); return }
      state.holdings = holdings
      state.history = Array.isArray(data.history) ? data.history.filter((p) => p && Number.isFinite(Number(p.usd))).map((p) => ({ t: p.t, usd: Number(p.usd) })) : []
      state.demo = false
      if (CURRENCIES.includes(data.base)) state.base = data.base
      if (data.fxOverride && typeof data.fxOverride === "object") state.fxOverride = data.fxOverride
      if (data.lang === "en" || data.lang === "zh") state.lang = data.lang
      persist()
      toast(tt("imported", { n: holdings.length }))
      render()
    }
    if (!state.holdings.length) apply()
    else ask({ title: tt("confirm_import"), body: tt("confirm_import_body", { n: data.holdings.length }), confirm: tt("yes_replace"), onYes: apply })
  } catch {
    toast(tt("bad_file"))
  }
})

setInterval(() => {
  const el = document.getElementById("clock")
  if (el) el.textContent = clock()
}, 15000)

render()
