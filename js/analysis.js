import { classById, displayName, MODEL, subtypeById } from "./data.js"
import { formatMoney, formatPct, valueOf } from "./money.js"

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n))
}

export function buildReport(holdings, base, lang, fxOverride, mask) {
  if (!holdings.length) return { empty: true }

  const money = (n) => (mask ? "••••" : formatMoney(n, base, lang))
  const assets = []
  const debts = []
  holdings.forEach((h) => {
    const v = valueOf(h, base, fxOverride)
    if (v == null) return
    ;(h.classId === "liability" ? debts : assets).push({ h, v })
  })

  const gross = assets.reduce((s, x) => s + x.v, 0)
  const debt = debts.reduce((s, x) => s + x.v, 0)
  const net = gross - debt
  const income = assets.reduce((s, x) => s + x.v * (Number(x.h.incomeYield) || 0) / 100, 0)
  const debtCost = debts.reduce((s, x) => s + x.v * (Number(x.h.incomeYield) || 0) / 100, 0)
  const cashYield = gross > 0 ? (income / gross) * 100 : 0

  const byClass = new Map()
  assets.forEach(({ h, v }) => {
    const cur = byClass.get(h.classId) || { value: 0, primary: 0 }
    cur.value += v
    if (h.subtype === "primary") cur.primary += v
    byClass.set(h.classId, cur)
  })

  const classes = [...byClass.entries()]
    .map(([id, row]) => {
      const meta = classById(id)
      return {
        id,
        name: meta ? meta[lang] : id,
        color: meta?.color || "#888",
        value: row.value,
        weight: gross > 0 ? (row.value / gross) * 100 : 0,
        primary: row.primary,
      }
    })
    .sort((a, b) => b.value - a.value)

  const positions = assets
    .map(({ h, v }) => ({
      id: h.id,
      name: displayName(h, lang),
      subtype: h.subtype,
      classId: h.classId,
      value: v,
      weight: gross > 0 ? (v / gross) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const top = positions[0]
  const topClass = classes[0]
  const primary = byClass.get("realestate")?.primary || 0
  const homeBias = top?.subtype === "primary"
  const liquidCut = new Set(["instant", "days"])
  let liquid = 0
  assets.forEach(({ h, v }) => {
    if (liquidCut.has(subtypeById(h.classId, h.subtype).liquidity)) liquid += v
  })
  const liquidW = gross > 0 ? liquid / gross : 0
  const lev = gross > 0 ? debt / gross : debt > 0 ? 1 : 0
  const hhi = classes.reduce((s, c) => s + (c.weight / 100) ** 2, 0)
  const classCount = classes.filter((c) => c.weight >= 0.5).length

  let div = gross > 0 ? clamp(Math.round((1 - Math.max(0, hhi - 0.08) / 0.92) * 100), 0, 100) : 0
  let liq = 40
  if (liquidW < 0.08) liq = Math.round((liquidW / 0.08) * 70)
  else if (liquidW <= 0.32) liq = 100 - Math.round((Math.abs(liquidW - 0.18) / 0.14) * 12)
  else liq = clamp(Math.round(88 - (liquidW - 0.32) * 90), 20, 88)

  let conc = 100
  if (top) {
    const w = top.weight / 100
    if (w > 0.5) conc -= homeBias ? 16 : 42
    else if (w > 0.35) conc -= homeBias ? 8 : 24
    else if (w > 0.22 && !homeBias) conc -= 10
  }
  if (topClass) {
    const w = topClass.weight / 100
    const house = homeBias && topClass.id === "realestate"
    if (w > 0.7) conc -= house ? 8 : 28
    else if (w > 0.55) conc -= house ? 5 : 14
  }
  conc = clamp(conc, 0, 100)

  let balance = 50
  if (gross > 0) {
    const ids = new Set([...Object.keys(MODEL), ...classes.map((c) => c.id)])
    let tv = 0
    ids.forEach((id) => {
      if (id === "liability") return
      const yours = (byClass.get(id)?.value || 0) / gross
      const model = (MODEL[id] || 0) / 100
      tv += Math.abs(yours - model)
    })
    balance = clamp(Math.round((1 - tv / 2) * 100), 0, 100)
  }

  let levScore = 100
  if (lev > 0.6) levScore = 28
  else if (lev > 0.4) levScore = 55
  else if (lev > 0.22) levScore = 78

  const score = gross <= 0 ? 8 : Math.round(div * 0.28 + liq * 0.14 + conc * 0.24 + balance * 0.22 + levScore * 0.12)
  const band = score >= 80 ? "robust" : score >= 65 ? "fair" : score >= 50 ? "weak" : "fragile"

  const gaps = Object.keys(MODEL)
    .map((id) => {
      const meta = classById(id)
      const yours = gross > 0 ? ((byClass.get(id)?.value || 0) / gross) * 100 : 0
      const model = MODEL[id]
      return { id, name: meta ? meta[lang] : id, yours, model, gap: yours - model, color: meta?.color }
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))
    .slice(0, 4)

  const flags = []
  const add = (level, title, detail) => flags.push({ level, title, detail })
  const zh = lang !== "en"

  if (gross <= 0) {
    add("risk", zh ? "目前只有负债" : "Only debt is recorded", zh ? "补上资产之后，净资产和分析才有意义。" : "Add assets before the net-worth figure means much.")
  }
  if (top && top.weight > 35) {
    add(
      homeBias ? "info" : top.weight > 50 ? "risk" : "warn",
      zh ? `${top.name} 占 ${top.weight.toFixed(0)}%` : `${top.name} is ${top.weight.toFixed(0)}%`,
      homeBias
        ? (zh ? "这是自住，更接近居住消费，不是可以随时再平衡的仓位。" : "This is a home. Treat it as somewhere you live, not a position you rebalance.")
        : (zh ? "单笔太高时，这一笔的波动就是组合的波动。" : "When one line is this large, its swings are the portfolio's swings.")
    )
  }
  if (debtCost > income && debtCost > 0) {
    add(
      "warn",
      zh ? "利息支出高于现金收入" : "Interest costs more than cash income",
      zh
        ? `按你填的利率，每年大约付出 ${money(debtCost)}，资产现金收入大约 ${money(income)}。`
        : `At the rates you entered, interest is about ${money(debtCost)} a year and cash income about ${money(income)}.`
    )
  }
  if (liquidW < 0.05 && gross > 0) {
    add("warn", zh ? "随时能用的钱很少" : "Very little is easy to spend", zh ? "先留一笔数日内能取出的现金或货币基金。" : "Keep some cash or a money fund you can reach within days.")
  }
  const cryptoW = classes.find((c) => c.id === "crypto")?.weight || 0
  if (cryptoW > 15) {
    add("warn", zh ? "加密资产占比不低" : "Crypto is a large slice", zh ? "默认没有把涨幅算进规划。只放你接受大幅波动的金额。" : "Growth is not assumed. Keep it to an amount you can watch swing.")
  }
  if (primary / (gross || 1) > 0.45) {
    add("info", zh ? "自住拉高了房产占比" : "Your home dominates property", zh ? "看结构时把自住和可调整的金融资产分开。" : "Read the mix with the home separate from assets you can actually change.")
  }
  if (holdings.some((h) => Math.abs(Number(h.incomeYield) || 0) > 80)) {
    add("warn", zh ? "有一笔利率看起来异常" : "A rate looks off", zh ? "确认没有把 3% 写成 300。" : "Check that a percent was not entered as a multiple.")
  }

  const nClass = classCount
  const p1 = zh
    ? `净资产 ${money(net)}，总资产 ${money(gross)}，负债 ${money(debt)}。记了 ${holdings.length} 笔，分布在 ${nClass} 个板块。`
    : `Net worth ${money(net)}. Assets ${money(gross)}, debt ${money(debt)}. ${holdings.length} holdings across ${nClass} categories.`
  const p2 = zh
    ? (topClass
      ? `最大的板块是${topClass.name}，大约 ${topClass.weight.toFixed(0)}%。${primary > 0 ? "其中自住不要和股票、存款放在同一个再平衡动作里看。" : ""}现金收益率 ${formatPct(cashYield, 1)}，只用你记下的利率。`
      : "")
    : (topClass
      ? `The largest category is ${topClass.name}, about ${topClass.weight.toFixed(0)}%.${primary > 0 ? " Don't treat the home as something you rebalance alongside stocks and deposits." : ""} Cash yield is ${formatPct(cashYield, 1)}, using only the rates you saved.`
      : "")

  return {
    empty: false,
    score,
    band,
    paragraphs: [p1, p2].filter(Boolean),
    flags: flags.slice(0, 6),
    classes,
    gaps,
    income,
    debtCost,
    net,
    gross,
    debt,
    cashYield,
    primary,
    liquidW: liquidW * 100,
  }
}

function horizonOf(liquidity) {
  if (liquidity === "instant" || liquidity === "days") return "short"
  if (liquidity === "month" || liquidity === "year") return "mid"
  return "long"
}

export function buildFacts(holdings, base, lang, fxOverride, mask) {
  const zh = lang !== "en"
  const money = (n) => (mask ? "••••" : formatMoney(n, base, lang))
  const assets = []
  const debts = []
  let missing = 0
  holdings.forEach((h) => {
    const v = valueOf(h, base, fxOverride)
    if (v == null) {
      missing += 1
      return
    }
    ;(h.classId === "liability" ? debts : assets).push({ h, v, sub: subtypeById(h.classId, h.subtype) })
  })
  const gross = assets.reduce((s, x) => s + x.v, 0)
  const debt = debts.reduce((s, x) => s + x.v, 0)
  if (gross <= 0 && debt <= 0) return { empty: true }
  const weight = (part) => (gross > 0 ? (part / gross) * 100 : 0)
  const sumWhere = (pred) => assets.reduce((s, x) => s + (pred(x) ? x.v : 0), 0)

  const short = sumWhere((x) => horizonOf(x.sub.liquidity) === "short")
  const long = sumWhere((x) => horizonOf(x.sub.liquidity) === "long")
  const high = sumWhere((x) => x.sub.risk >= 4)
  const income = assets.reduce((s, x) => s + x.v * (Number(x.h.incomeYield) || 0) / 100, 0)
  const yieldPct = gross > 0 ? (income / gross) * 100 : 0
  const riskIndex = gross > 0 ? assets.reduce((s, x) => s + x.v * (Number(x.sub.risk) || 3), 0) / gross : null
  const positions = assets
    .map((x) => ({ name: displayName(x.h, lang), value: x.v, weight: weight(x.v) }))
    .sort((a, b) => b.value - a.value)
  const top = positions[0]

  const ccyName = {
    CNY: zh ? "人民币" : "CNY", USD: zh ? "美元" : "USD", EUR: zh ? "欧元" : "EUR",
    GBP: zh ? "英镑" : "GBP", HKD: zh ? "港币" : "HKD", JPY: zh ? "日元" : "JPY",
    AUD: zh ? "澳元" : "AUD", CAD: zh ? "加元" : "CAD", SGD: zh ? "新加坡元" : "SGD",
    CHF: zh ? "瑞士法郎" : "CHF",
  }
  const stressOf = { 1: 2, 2: 8, 3: 18, 4: 35, 5: 55 }
  const stressPct = gross > 0
    ? assets.reduce((s, x) => s + x.v * (stressOf[x.sub.risk] || 18), 0) / gross
    : null
  const isFx = (x) => x.h.classId === "fx" || (x.h.currency && x.h.currency !== base)
  const fxValue = sumWhere(isFx)
  const fxByCcy = new Map()
  assets.forEach((x) => {
    if (!isFx(x)) return
    const code = x.h.currency || base
    fxByCcy.set(code, (fxByCcy.get(code) || 0) + x.v)
  })
  const fxParts = [...fxByCcy.entries()]
    .filter(([code]) => code !== base)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, value]) => `${ccyName[code] || code} ${weight(value).toFixed(0)}%`)

  const lines = []
  let lead = zh ? `净资产 ${money(gross - debt)}。` : `Net worth ${money(gross - debt)}. `
  if (weight(high) >= 30) lead += zh ? `高风险占 ${weight(high).toFixed(0)}%。` : `Higher-risk holdings are ${weight(high).toFixed(0)}%. `
  lines.push(lead.trim())
  if (top && top.weight >= 35) {
    lines.push(zh
      ? `最大一笔是${top.name}，占 ${top.weight.toFixed(0)}%。`
      : `${top.name} is ${top.weight.toFixed(0)}%.`)
  }
  if (weight(long) >= 50) {
    lines.push(zh ? `长期锁定占 ${weight(long).toFixed(0)}%。` : `Locked holdings are ${weight(long).toFixed(0)}%.`)
  }
  if (fxValue > 0) {
    const named = fxParts.length ? (zh ? `，其中${fxParts.join("、")}` : `, including ${fxParts.join(", ")}`) : ""
    lines.push(zh
      ? `外汇头寸占 ${weight(fxValue).toFixed(0)}%${named}。`
      : `FX exposure is ${weight(fxValue).toFixed(0)}%${named}.`)
  }
  if (gross > 0 && debt / gross >= 0.4) {
    lines.push(zh
      ? `负债相当于总资产的 ${((debt / gross) * 100).toFixed(0)}%。`
      : `Debt is ${((debt / gross) * 100).toFixed(0)}% of assets.`)
  }
  if (missing) {
    lines.push(zh ? `${missing} 笔没有汇率，没放进占比。` : `${missing} holdings have no FX rate and are left out.`)
  }

  return {
    empty: false,
    lines,
    yieldPct,
    yieldAmount: income,
    riskIndex,
    stressPct,
    fxPct: weight(fxValue),
    shortPct: weight(short),
    longPct: weight(long),
  }
}
