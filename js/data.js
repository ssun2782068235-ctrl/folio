// 政策利率整理日 2026-10-15。尚未召开的 10 月例会不预填。
// 人民币存款按每家银行自己公布的挂牌，产品分开。每天分别核对，没取到的银行不借用别家的数字。
// 汇率：欧央行 2026-10-14 欧元参考价，折成每 1 美元。AED 为联系汇率。

export const FX = {
  USD: 1,
  EUR: 0.8933,
  GBP: 0.7538,
  JPY: 158.45,
  CNY: 6.6927,
  CHF: 0.8334,
  AUD: 1.4266,
  CAD: 1.4219,
  HKD: 7.8481,
  SGD: 1.2826,
  KRW: 1336.79,
  INR: 95.16,
  BRL: 5.0242,
  MXN: 18.3653,
  NZD: 1.7812,
  THB: 33.5748,
  AED: 3.6725,
  TWD: null,
}

export const FX_SOURCE = {
  AED: "peg",
  TWD: "none",
}

export const CURRENCIES = ["CNY", "USD", "EUR", "GBP", "HKD", "JPY", "AUD", "CAD", "SGD", "CHF", "KRW", "INR", "AED", "NZD", "THB", "BRL", "MXN", "TWD"]

export const INFLATION = {
  USD: 2.6, CNY: 0.8, EUR: 2.1, GBP: 2.5, JPY: 1.8, AUD: 2.8, CAD: 2.1,
  CHF: 0.4, HKD: 1.5, SGD: 1.4, KRW: 2.0, INR: 4.0, AED: 2.0, BRL: 4.2,
  NZD: 2.4, THB: 1.0, MXN: 3.8, TWD: 1.5,
}

export const COUNTRIES = [
  { id: "CN", zh: "中国", en: "China" },
  { id: "US", zh: "美国", en: "United States" },
  { id: "EU", zh: "欧元区", en: "Euro area" },
  { id: "UK", zh: "英国", en: "United Kingdom" },
  { id: "JP", zh: "日本", en: "Japan" },
  { id: "AU", zh: "澳大利亚", en: "Australia" },
  { id: "CA", zh: "加拿大", en: "Canada" },
  { id: "CH", zh: "瑞士", en: "Switzerland" },
  { id: "HK", zh: "中国香港", en: "Hong Kong" },
  { id: "SG", zh: "新加坡", en: "Singapore" },
  { id: "KR", zh: "韩国", en: "Korea" },
  { id: "IN", zh: "印度", en: "India" },
  { id: "AE", zh: "阿联酋", en: "UAE" },
  { id: "BR", zh: "巴西", en: "Brazil" },
  { id: "NZ", zh: "新西兰", en: "New Zealand" },
  { id: "TW", zh: "中国台湾", en: "Taiwan" },
  { id: "TH", zh: "泰国", en: "Thailand" },
  { id: "MX", zh: "墨西哥", en: "Mexico" },
  { id: "RU", zh: "俄罗斯", en: "Russia" },
]

export const COUNTRY_CCY = {
  CN: "CNY", US: "USD", EU: "EUR", UK: "GBP", JP: "JPY", AU: "AUD", CA: "CAD",
  CH: "CHF", HK: "HKD", SG: "SGD", KR: "KRW", IN: "INR", AE: "AED", BR: "BRL",
  NZ: "NZD", TW: "TWD", TH: "THB", MX: "MXN",
}

export const DEPOSIT_REF = {
  CN: { savings: 0.05, time: 0.95 },
  US: { savings: 3.9, time: 3.7 },
  EU: { savings: 1.7, time: 2.0 },
  UK: { savings: 3.5, time: 3.7 },
  JP: { savings: 0.2, time: 0.45 },
  AU: { savings: 4.1, time: 3.9 },
  CA: { savings: 2.0, time: 2.1 },
  CH: { savings: 0.05, time: 0.15 },
  HK: { savings: 0.3, time: 2.6 },
  SG: { savings: 1.8, time: 2.2 },
  KR: { savings: 1.5, time: 2.9 },
  IN: { savings: 2.75, time: 6.4 },
  AE: { savings: 1.2, time: 3.8 },
  BR: { savings: 0.5, time: 13 },
  NZ: { savings: 2.5, time: 3.3 },
  TW: { savings: 0.4, time: 1.55 },
}

export const CLASSES = [
  { id: "cash", zh: "现金", en: "Cash", color: "#8b97a3", blurbZh: "手头和支付账户里随时能用的钱。", blurbEn: "Money you can spend immediately." },
  { id: "deposit", zh: "银行存款", en: "Bank deposits", color: "#3d8bfd", blurbZh: "先选国家，再选银行。活期、通知、整存整取、零存整取分开列，利率用最新挂牌。", blurbEn: "Pick a country, then a bank. Demand, notice, and term products are listed apart, with the latest posted rate." },
  { id: "bond", zh: "债券", en: "Bonds", color: "#7aa2ff", blurbZh: "不预填票息。页面上只放带来源和日期的官方利率。", blurbEn: "No coupon is filled in. Only an official rate with its source and date is shown." },
  { id: "equity", zh: "股票", en: "Equities", color: "#7f9cc4", blurbZh: "搜索个股，按当天价格计入，之后每天核对。", blurbEn: "Search a share. It is saved at today’s price and checked again each day." },
  { id: "fund", zh: "基金 / ETF", en: "Funds / ETFs", color: "#6f9e96", blurbZh: "搜索基金或 ETF。能取到行情的按当天价格计入。", blurbEn: "Search a fund or ETF. A quote, when found, is saved at today’s price." },
  { id: "realestate", zh: "房产", en: "Property", color: "#f0b90b", blurbZh: "中国可以选到小区。澳大利亚先选城市，悉尼可以再选区。公开房价每周核对一次。", blurbEn: "China goes down to a neighborhood. Australia starts with a city, and Sydney goes on to a district. Published prices are checked weekly." },
  { id: "crypto", zh: "加密资产", en: "Crypto", color: "#a78bfa", blurbZh: "比特币和以太坊用当天报价。其他代币没有统一报价，金额由你填。", blurbEn: "Bitcoin and Ethereum use today’s quote. Other tokens have no single quote, so you enter the amount." },
  { id: "commodity", zh: "商品与贵金属", en: "Commodities", color: "#e0b15a", blurbZh: "黄金、白银用当天国际报价，单位是盎司。其他商品金额由你填。", blurbEn: "Gold and silver use today’s international quote, per troy ounce. You enter other amounts." },
  { id: "fx", zh: "外汇", en: "Foreign currency", color: "#38bdf8", blurbZh: "外币金额由你填。汇总时用最近一次公开参考汇率。", blurbEn: "You enter the foreign-currency amount. Totals use the latest published reference rate." },
  { id: "insurance", zh: "保险现金价值", en: "Insurance cash value", color: "#fb7185", blurbZh: "只记能拿回来的现金价值，不记已交保费。", blurbEn: "Cash value you can recover, not premiums already paid." },
  { id: "private", zh: "私募与另类", en: "Private markets", color: "#c084fc", blurbZh: "私募股权、创投、对冲和私募债。流动性通常很差。", blurbEn: "PE, venture, hedge funds, and private credit. Usually illiquid." },
  { id: "pension", zh: "养老金与公积金", en: "Pension", color: "#34d399", blurbZh: "公积金、年金、401k、养老金。若已拆成股债，不要再整笔记一次。", blurbEn: "Provident funds, annuities, 401(k), pensions. Don't double-count the underlying." },
  { id: "business", zh: "企业股权", en: "Business equity", color: "#fb923c", blurbZh: "非上市股权、个体经营净值和经营应收。", blurbEn: "Private company stakes, sole-prop equity, and receivables." },
  { id: "collectible", zh: "收藏与车辆", en: "Collectibles", color: "#f472b6", blurbZh: "艺术、表、酒、珠宝和车。车默认按贬值。", blurbEn: "Art, watches, wine, jewelry, and cars. Cars default to depreciation." },
  { id: "derivative", zh: "衍生品净值", en: "Derivatives", color: "#f6465d", blurbZh: "期权、期货和保证金账户。只记净值。", blurbEn: "Options, futures, and margin accounts. Equity only, not notional." },
  { id: "other", zh: "其他资产", en: "Other assets", color: "#94a3b8", blurbZh: "上面没覆盖、但你认为有价值的东西。", blurbEn: "Anything valuable that does not fit above." },
  { id: "liability", zh: "负债", en: "Liabilities", color: "#f6465d", blurbZh: "只记还剩多少。不预填贷款利率。", blurbEn: "Record what is still owed. No loan rate is filled in." },
]

export const MODEL = {
  cash: 5, deposit: 8, bond: 14, equity: 22, fund: 10, realestate: 16,
  crypto: 3, commodity: 4, fx: 2, insurance: 3, private: 3, pension: 6,
  business: 2, collectible: 1, derivative: 0, other: 1,
}

const S = (id, zh, en, liquidity, risk) => ({ id, zh, en, liquidity, risk, yield: 0, growth: 0 })

export const SUBTYPES = {
  cash: [
    S("physical", "库存现金", "Physical cash", "instant", 1, 0, 0),
    S("wallet", "支付账户", "Payment wallet", "instant", 1, 0, 0),
    S("broker_cash", "券商现金", "Broker cash", "instant", 1, 0.3, 0),
  ],
  deposit: [
    S("demand", "活期", "Demand deposit", "instant", 1, 0.05, 0),
    S("savings", "储蓄", "Savings", "instant", 1, 0.05, 0),
    S("call_1d", "通知存款一天", "1-day notice", "days", 1, 0.10, 0),
    S("call_7d", "通知存款七天", "7-day notice", "days", 1, 0.30, 0),
    S("time_3m", "三个月整存整取", "3-month term", "month", 1, 0.65, 0),
    S("time_6m", "六个月整存整取", "6-month term", "month", 1, 0.85, 0),
    S("time_1y", "一年整存整取", "1-year term", "locked", 1, 0.95, 0),
    S("time_2y", "二年整存整取", "2-year term", "locked", 1, 1.05, 0),
    S("time_3y", "三年整存整取", "3-year term", "locked", 1, 1.25, 0),
    S("time_5y", "五年整存整取", "5-year term", "locked", 1, 1.30, 0),
    S("install_1y", "一年零存整取", "1-year installment", "locked", 1, 0.65, 0),
    S("install_3y", "三年零存整取", "3-year installment", "locked", 1, 0.85, 0),
    S("install_5y", "五年零存整取", "5-year installment", "locked", 1, 0.85, 0),
    S("structured", "结构性存款", "Structured deposit", "locked", 2, 0, 0),
  ],
  bond: [
    S("tbill", "国库券 / 短债", "T-bills", "month", 2, 0, 0),
    S("gov", "国债", "Government bonds", "year", 2, 0, 1),
    S("ig", "投资级信用债", "Investment-grade credit", "year", 3, 0, 1),
    S("hy", "高收益债", "High yield", "month", 4, 0, 2),
    S("bond_fund", "债券基金", "Bond fund", "days", 2, 0, 1),
    S("linker", "通胀挂钩债", "Inflation-linked", "year", 2, 0, 1),
  ],
  equity: [
    S("us", "美股", "US equity", "days", 4, 1.3, 7),
    S("cn", "沪深股票", "China A-shares", "days", 4, 1.8, 7),
    S("hk", "港股", "Hong Kong equity", "days", 4, 2.5, 6),
    S("jp", "日股", "Japan equity", "days", 4, 1.8, 6),
    S("eu", "欧股", "Europe equity", "days", 4, 2.5, 6),
    S("em", "其他市场股票", "Other equity markets", "days", 4, 2, 7),
    S("single", "单一个股", "Single stock", "days", 5, 0.8, 7),
    S("rsu", "股权激励", "RSU / ESOP", "locked", 5, 0, 0),
  ],
  fund: [
    S("broad", "宽基 ETF", "Broad ETF", "days", 3, 1.5, 6.5),
    S("sector", "行业 ETF", "Sector ETF", "days", 4, 1, 6),
    S("active", "主动基金", "Active fund", "days", 3, 1, 5),
    S("money", "货币基金", "Money market fund", "instant", 1, 1.3, 0),
    S("target", "目标日期基金", "Target-date fund", "days", 3, 1.5, 5),
    S("reit_fund", "REITs 基金", "REIT fund", "days", 3, 4, 2),
  ],
  realestate: [
    S("primary", "自住房", "Primary home", "locked", 3, 0, 3),
    S("invest_res", "投资住宅", "Rental residential", "locked", 3, 2.5, 2),
    S("commercial", "商业地产", "Commercial", "locked", 4, 4, 2),
    S("land", "土地", "Land", "locked", 4, 0, 3),
    S("parking", "车位 / 储藏", "Parking / storage", "locked", 3, 0, 1),
  ],
  crypto: [
    S("btc", "比特币", "Bitcoin", "days", 5, 0, 0),
    S("eth", "以太坊", "Ethereum", "days", 5, 0, 0),
    S("stable", "稳定币", "Stablecoin", "days", 2, 0, 0),
    S("alt", "其他代币", "Altcoin", "days", 5, 0, 0),
    S("defi", "链上理财", "DeFi position", "days", 5, 0, 0),
    S("nft", "NFT", "NFT", "locked", 5, 0, 0),
  ],
  commodity: [
    S("gold", "黄金", "Gold", "days", 3, 0, 3),
    S("silver", "白银", "Silver", "days", 4, 0, 3),
    S("metal", "其他贵金属", "Other metals", "days", 4, 0, 2),
    S("energy", "能源", "Energy", "days", 4, 0, 2),
    S("agri", "农产品", "Agriculture", "month", 4, 0, 2),
  ],
  fx: [
    S("foreign_cash", "外币现金", "Foreign cash", "instant", 2, 0, 0),
    S("fx_book", "外汇头寸", "FX position", "days", 3, 0, 0),
  ],
  insurance: [
    S("whole", "储蓄 / 增额寿现金价值", "Cash-value life", "locked", 2, 2, 0),
    S("annuity", "年金", "Annuity", "locked", 2, 3, 0),
    S("ul", "万能险现金价值", "Universal life", "locked", 2, 2, 0),
  ],
  private: [
    S("pe", "私募股权", "Private equity", "locked", 5, 0, 8),
    S("vc", "风险投资", "Venture capital", "locked", 5, 0, 0),
    S("hedge", "对冲基金", "Hedge fund", "month", 4, 0, 5),
    S("credit", "私募债", "Private credit", "locked", 4, 6, 0),
    S("alt", "其他另类", "Other alternative", "locked", 4, 0, 4),
  ],
  pension: [
    S("housing_fund", "住房公积金", "Housing provident fund", "locked", 1, 1.5, 0),
    S("enterprise", "企业年金", "Enterprise annuity", "locked", 2, 0, 4),
    S("social", "社保个人权益", "Social insurance (personal)", "locked", 2, 0, 0),
    S("pension_acct", "养老金账户", "IRA / 401(k) / pension", "locked", 3, 0, 5),
    S("super", "超级年金", "Superannuation", "locked", 3, 0, 5),
  ],
  business: [
    S("stake", "非上市公司股权", "Private company stake", "locked", 5, 0, 0),
    S("sole", "个体经营净值", "Sole-prop equity", "locked", 4, 0, 0),
    S("receivable", "经营应收", "Receivables", "month", 3, 0, 0),
  ],
  collectible: [
    S("art", "艺术品", "Art", "locked", 4, 0, 0),
    S("watch", "名表", "Watches", "locked", 4, 0, 0),
    S("wine", "酒类", "Wine", "locked", 4, 0, 0),
    S("car", "车辆", "Vehicle", "month", 3, 0, -8),
    S("jewelry", "珠宝", "Jewelry", "locked", 3, 0, 0),
    S("other_col", "其他收藏", "Other collectible", "locked", 4, 0, 0),
  ],
  derivative: [
    S("margin", "保证金账户净值", "Margin equity", "days", 5, 0, 0),
    S("options", "期权市值", "Options value", "days", 5, 0, 0),
    S("futures", "期货账户净值", "Futures equity", "days", 5, 0, 0),
  ],
  other: [
    S("custom", "其他", "Other", "month", 3, 0, 0),
  ],
  liability: [
    S("mortgage", "住房贷款", "Mortgage", "locked", 2, 3, 0),
    S("car_loan", "车贷", "Auto loan", "year", 2, 4.5, 0),
    S("consumer", "消费贷 / 信用贷", "Consumer loan", "month", 2, 7.5, 0),
    S("credit_card", "信用卡余额", "Credit card", "month", 2, 18, 0),
    S("margin_loan", "融资融券", "Securities financing", "days", 4, 6.5, 0),
    S("other_debt", "其他借款", "Other debt", "month", 3, 6, 0),
    S("tax", "应缴税款", "Tax payable", "month", 2, 0, 0),
  ],
}

export const ACCOUNTS = [
  { id: "bank", zh: "银行", en: "Bank" },
  { id: "broker", zh: "券商", en: "Broker" },
  { id: "exchange", zh: "加密交易所", en: "Crypto exchange" },
  { id: "wallet", zh: "支付账户", en: "Wallet" },
  { id: "property", zh: "房产", en: "Property" },
  { id: "retirement", zh: "养老金账户", en: "Retirement account" },
  { id: "insurance", zh: "保险", en: "Insurance" },
  { id: "private", zh: "私募 / 非上市", en: "Private" },
  { id: "physical", zh: "实物", en: "Physical" },
  { id: "other", zh: "其他", en: "Other" },
]

export const DEFAULT_ACCOUNT = {
  cash: "wallet", deposit: "bank", bond: "broker", equity: "broker", fund: "broker",
  realestate: "property", crypto: "exchange", commodity: "broker", fx: "bank",
  insurance: "insurance", private: "private", pension: "retirement", business: "private",
  collectible: "physical", derivative: "broker", other: "other", liability: "bank",
}

export const LIQ = {
  instant: { zh: "随时可取", en: "Instant" },
  days: { zh: "数日内", en: "A few days" },
  month: { zh: "约一个月", en: "About a month" },
  year: { zh: "一年内", en: "Within a year" },
  locked: { zh: "锁定，难变现", en: "Locked" },
}

export const RISK = {
  1: { zh: "低", en: "Low" },
  2: { zh: "中低", en: "Guarded" },
  3: { zh: "中等", en: "Medium" },
  4: { zh: "中高", en: "High" },
  5: { zh: "高", en: "Very high" },
}

export const POLICY = [
  { id: "fed", country: "US", zh: "美联储", en: "Federal Reserve", izh: "联邦基金目标上沿", ien: "Fed funds upper bound", rate: 4, range: "3.75–4.00", szh: "2026-09 加息 25bp", sen: "Hiked 25bp in Sep 2026", asOf: "2026-09-16" },
  { id: "ecb", country: "EU", zh: "欧洲央行", en: "ECB", izh: "存款便利利率", ien: "Deposit facility", rate: 2.5, range: "", szh: "2026-09-16 起 2.50%（主要再融资利率为 2.65%）", sen: "2.50% from 16 Sep 2026 (MRO is 2.65%)", asOf: "2026-09-16" },
  { id: "pboc", country: "CN", zh: "中国人民银行", en: "PBOC", izh: "1 年期 LPR", ien: "1-year LPR", rate: 3, range: "", szh: "2026-09-20 维持。5 年期请以当月公告为准，此处不猜测", sen: "Held on 20 Sep 2026. 5-year LPR is not estimated here", asOf: "2026-09-20" },
  { id: "boe", country: "UK", zh: "英格兰银行", en: "Bank of England", izh: "银行利率", ien: "Bank Rate", rate: 3.75, range: "", szh: "2026-09-17 维持", sen: "Held on 17 Sep 2026", asOf: "2026-09-17" },
  { id: "boj", country: "JP", zh: "日本银行", en: "Bank of Japan", izh: "短期政策利率", ien: "Short-term policy rate", rate: 1.25, range: "", szh: "2026-09-18 加息 25bp", sen: "Hiked 25bp on 18 Sep 2026", asOf: "2026-09-18" },
  { id: "rba", country: "AU", zh: "澳大利亚储备银行", en: "RBA", izh: "现金利率", ien: "Cash rate", rate: 4.6, range: "", szh: "2026-09-29 加息 25bp", sen: "Hiked 25bp on 29 Sep 2026", asOf: "2026-09-29" },
  { id: "boc", country: "CA", zh: "加拿大银行", en: "Bank of Canada", izh: "隔夜目标利率", ien: "Overnight target", rate: 2.25, range: "", szh: "最近一次调整在 2025-10-29，整理时仍为该水平", sen: "Last change 29 Oct 2025; unchanged at compilation", asOf: "2025-10-29" },
  { id: "rbnz", country: "NZ", zh: "新西兰储备银行", en: "RBNZ", izh: "官方现金利率", ien: "Official cash rate", rate: 2.75, range: "", szh: "2026-09-02 加息 25bp", sen: "Hiked 25bp on 2 Sep 2026", asOf: "2026-09-02" },
  { id: "snb", country: "CH", zh: "瑞士国家银行", en: "SNB", izh: "政策利率", ien: "Policy rate", rate: 0, range: "", szh: "2025-06-19 下调后维持 0", sen: "Cut on 19 Jun 2025; still 0", asOf: "2025-06-19" },
  { id: "bok", country: "KR", zh: "韩国银行", en: "Bank of Korea", izh: "基准利率", ien: "Base rate", rate: 3, range: "", szh: "2026-08-27 加息 25bp", sen: "Hiked 25bp on 27 Aug 2026", asOf: "2026-08-27" },
  { id: "rbi", country: "IN", zh: "印度储备银行", en: "RBI", izh: "政策回购利率", ien: "Policy repo rate", rate: 5.5, range: "", szh: "2026-10-07 加息 25bp", sen: "Hiked 25bp on 7 Oct 2026", asOf: "2026-10-07" },
  { id: "bcb", country: "BR", zh: "巴西央行", en: "BCB", izh: "Selic", ien: "Selic", rate: 13.75, range: "", szh: "2026-09-16 降息 25bp", sen: "Cut 25bp on 16 Sep 2026", asOf: "2026-09-16" },
  { id: "cbr", country: "RU", zh: "俄罗斯央行", en: "Bank of Russia", izh: "关键利率", ien: "Key rate", rate: 14, range: "", szh: "2026-07-24 降息 25bp。10 月 23 日例会尚未召开", sen: "Cut 25bp on 24 Jul 2026. 23 Oct meeting not yet held", asOf: "2026-07-24" },
  { id: "cbc", country: "TW", zh: "台湾央行", en: "CBC Taiwan", izh: "重贴现率", ien: "Rediscount rate", rate: 2, range: "", szh: "2026-09-17 维持", sen: "Held on 17 Sep 2026", asOf: "2026-09-17" },
  { id: "hkma", country: "HK", zh: "香港金管局", en: "HKMA", izh: "基本利率（参考）", ien: "Base rate (reference)", rate: 4.25, range: "", szh: "联系汇率下通常为联邦基金下沿 + 0.50%。以金管局当日公布为准", sen: "Under the peg, often the Fed lower bound + 0.50%. Check the HKMA figure", asOf: "2026-09-16" },
  { id: "mas", country: "SG", zh: "新加坡金管局", en: "MAS", izh: "汇率政策框架", ien: "Exchange-rate framework", rate: null, range: "", szh: "不设单一政策利率，以新元名义有效汇率区间操作", sen: "No single policy rate; operates an S$NEER band", asOf: "2026-10-15" },
]

const BANK_SEED = [
  ["CN", "中国工商银行", "ICBC", "time"],
  ["CN", "中国建设银行", "CCB", "time"],
  ["CN", "中国农业银行", "ABC", "time"],
  ["CN", "中国银行", "Bank of China", "time"],
  ["CN", "交通银行", "Bank of Communications", "time"],
  ["CN", "招商银行", "CMB", "time"],
  ["CN", "中国邮政储蓄银行", "PSBC", "time"],
  ["CN", "兴业银行", "Industrial Bank", "time"],
  ["CN", "中信银行", "CITIC Bank", "time"],
  ["CN", "平安银行", "Ping An Bank", "time"],
  ["CN", "浦发银行", "SPD Bank", "time"],
  ["CN", "民生银行", "CMBC", "savings"],
  ["US", "JPMorgan Chase", "JPMorgan Chase", "savings"],
  ["US", "Bank of America", "Bank of America", "savings"],
  ["US", "Wells Fargo", "Wells Fargo", "savings"],
  ["US", "Citibank", "Citibank", "savings"],
  ["US", "Capital One", "Capital One", "savings"],
  ["US", "Ally", "Ally", "savings"],
  ["US", "Goldman Sachs Marcus", "Marcus", "savings"],
  ["US", "Charles Schwab Bank", "Schwab Bank", "savings"],
  ["EU", "Deutsche Bank", "Deutsche Bank", "time"],
  ["EU", "Commerzbank", "Commerzbank", "time"],
  ["EU", "BNP Paribas", "BNP Paribas", "time"],
  ["EU", "Société Générale", "Société Générale", "time"],
  ["EU", "Crédit Agricole", "Crédit Agricole", "savings"],
  ["EU", "Santander", "Santander", "time"],
  ["EU", "BBVA", "BBVA", "time"],
  ["EU", "ING", "ING", "savings"],
  ["EU", "UniCredit", "UniCredit", "time"],
  ["EU", "Intesa Sanpaolo", "Intesa Sanpaolo", "time"],
  ["UK", "Barclays", "Barclays", "savings"],
  ["UK", "HSBC UK", "HSBC UK", "savings"],
  ["UK", "Lloyds", "Lloyds", "time"],
  ["UK", "NatWest", "NatWest", "savings"],
  ["UK", "Nationwide", "Nationwide", "savings"],
  ["UK", "Monzo", "Monzo", "savings"],
  ["UK", "Revolut", "Revolut", "savings"],
  ["JP", "三菱 UFJ 银行", "MUFG", "time"],
  ["JP", "三井住友银行", "SMBC", "time"],
  ["JP", "瑞穗银行", "Mizuho", "time"],
  ["JP", "邮贮银行", "Japan Post Bank", "savings"],
  ["AU", "Commonwealth Bank", "Commonwealth Bank", "savings"],
  ["AU", "Westpac", "Westpac", "time"],
  ["AU", "NAB", "NAB", "savings"],
  ["AU", "ANZ", "ANZ", "time"],
  ["AU", "Macquarie", "Macquarie", "savings"],
  ["CA", "RBC", "RBC", "savings"],
  ["CA", "TD", "TD", "savings"],
  ["CA", "Scotiabank", "Scotiabank", "time"],
  ["CA", "BMO", "BMO", "savings"],
  ["CA", "CIBC", "CIBC", "savings"],
  ["CH", "UBS", "UBS", "savings"],
  ["CH", "PostFinance", "PostFinance", "savings"],
  ["CH", "Raiffeisen", "Raiffeisen", "time"],
  ["HK", "汇丰香港", "HSBC Hong Kong", "savings"],
  ["HK", "中银香港", "BOCHK", "time"],
  ["HK", "恒生银行", "Hang Seng", "savings"],
  ["HK", "渣打香港", "Standard Chartered HK", "time"],
  ["HK", "东亚银行", "Bank of East Asia", "savings"],
  ["SG", "DBS", "DBS", "savings"],
  ["SG", "OCBC", "OCBC", "time"],
  ["SG", "UOB", "UOB", "savings"],
  ["KR", "KB 国民银行", "KB Kookmin", "time"],
  ["KR", "新韩银行", "Shinhan", "time"],
  ["KR", "友利银行", "Woori", "savings"],
  ["KR", "韩亚银行", "Hana", "time"],
  ["IN", "SBI", "SBI", "time"],
  ["IN", "HDFC Bank", "HDFC Bank", "savings"],
  ["IN", "ICICI Bank", "ICICI Bank", "time"],
  ["IN", "Axis Bank", "Axis Bank", "time"],
  ["AE", "Emirates NBD", "Emirates NBD", "time"],
  ["AE", "First Abu Dhabi Bank", "FAB", "time"],
  ["AE", "ADCB", "ADCB", "savings"],
  ["BR", "Itaú", "Itaú", "time"],
  ["BR", "Bradesco", "Bradesco", "time"],
  ["BR", "Banco do Brasil", "Banco do Brasil", "savings"],
  ["BR", "Nubank", "Nubank", "savings"],
  ["NZ", "ANZ New Zealand", "ANZ New Zealand", "time"],
  ["NZ", "ASB", "ASB", "savings"],
  ["NZ", "Westpac New Zealand", "Westpac New Zealand", "time"],
  ["TW", "中国信托", "CTBC", "time"],
  ["TW", "国泰世华", "Cathay United", "time"],
  ["TW", "台湾银行", "Bank of Taiwan", "savings"],
  ["TW", "玉山银行", "E.SUN", "savings"],
]

const TENORS = [
  { id: "demand", zh: "活期", en: "Demand", group: "demand", gzh: "活期", gen: "Demand" },
  { id: "savings", zh: "储蓄", en: "Savings", group: "savings", gzh: "储蓄", gen: "Savings" },
  { id: "time_3m", zh: "三个月", en: "3 months", group: "term", gzh: "定期", gen: "Term" },
  { id: "time_6m", zh: "六个月", en: "6 months", group: "term", gzh: "定期", gen: "Term" },
  { id: "time_1y", zh: "一年", en: "1 year", group: "term", gzh: "定期", gen: "Term" },
  { id: "time_2y", zh: "二年", en: "2 years", group: "term", gzh: "定期", gen: "Term" },
  { id: "time_3y", zh: "三年", en: "3 years", group: "term", gzh: "定期", gen: "Term" },
  { id: "time_5y", zh: "五年", en: "5 years", group: "term", gzh: "定期", gen: "Term" },
]

export const CN_DEPOSIT_PRODUCTS = [
  { id: "demand", zh: "活期", en: "Demand", group: "demand", gzh: "活期", gen: "Demand" },
  { id: "call_1d", zh: "一天", en: "1 day", group: "call", gzh: "通知存款", gen: "Notice" },
  { id: "call_7d", zh: "七天", en: "7 days", group: "call", gzh: "通知存款", gen: "Notice" },
  { id: "time_3m", zh: "三个月", en: "3 months", group: "lump", gzh: "整存整取", gen: "Term deposit" },
  { id: "time_6m", zh: "六个月", en: "6 months", group: "lump", gzh: "整存整取", gen: "Term deposit" },
  { id: "time_1y", zh: "一年", en: "1 year", group: "lump", gzh: "整存整取", gen: "Term deposit" },
  { id: "time_2y", zh: "二年", en: "2 years", group: "lump", gzh: "整存整取", gen: "Term deposit" },
  { id: "time_3y", zh: "三年", en: "3 years", group: "lump", gzh: "整存整取", gen: "Term deposit" },
  { id: "time_5y", zh: "五年", en: "5 years", group: "lump", gzh: "整存整取", gen: "Term deposit" },
  { id: "install_1y", zh: "一年", en: "1 year", group: "install", gzh: "零存整取", gen: "Installment" },
  { id: "install_3y", zh: "三年", en: "3 years", group: "install", gzh: "零存整取", gen: "Installment" },
  { id: "install_5y", zh: "五年", en: "5 years", group: "install", gzh: "零存整取", gen: "Installment" },
]

const FACE = {
  ICBC: ["工", "#c4161c", "CN"],
  CCB: ["建", "#004b87", "CN"],
  ABC: ["农", "#00915a", "CN"],
  "Bank of China": ["中", "#b11116", "CN"],
  "Bank of Communications": ["交", "#1c3f94", "CN"],
  CMB: ["招", "#e60012", "CN_PLUS"],
  PSBC: ["邮", "#007a3d", "CN"],
  "Industrial Bank": ["兴", "#0047bb", "CN_PLUS"],
  "CITIC Bank": ["信", "#e10600", "CN_PLUS"],
  "Ping An Bank": ["平", "#e85d04", "CN_PLUS"],
  "SPD Bank": ["浦", "#0b3d91", "CN_PLUS"],
  CMBC: ["民", "#00a651", "CN_PLUS"],
  "JPMorgan Chase": ["JP", "#117aca", "US_BRANCH"],
  "Bank of America": ["BA", "#e31837", "US_BRANCH"],
  "Wells Fargo": ["WF", "#d71e28", "US_BRANCH"],
  Citibank: ["C", "#003b70", "US_BRANCH"],
  "Capital One": ["C1", "#d03027", "US_HY"],
  Ally: ["A", "#6e2585", "US_HY"],
  Marcus: ["M", "#5b7c99", "US_HY"],
  "Schwab Bank": ["S", "#00a0df", "US_BRANCH"],
  "Deutsche Bank": ["DB", "#0018a8", "EU"],
  Commerzbank: ["CB", "#0b3a5b", "EU"],
  "BNP Paribas": ["BN", "#00915a", "EU"],
  "Société Générale": ["SG", "#e60028", "EU"],
  "Crédit Agricole": ["CA", "#007d4a", "EU"],
  Santander: ["SA", "#ec0000", "EU"],
  BBVA: ["BB", "#004481", "EU"],
  ING: ["IN", "#ff6200", "EU"],
  UniCredit: ["UC", "#e30613", "EU"],
  "Intesa Sanpaolo": ["IS", "#00685f", "EU"],
  Barclays: ["BX", "#00aeef", "UK"],
  "HSBC UK": ["HS", "#db0011", "UK"],
  Lloyds: ["LL", "#006a4d", "UK"],
  NatWest: ["NW", "#42145f", "UK"],
  Nationwide: ["NA", "#003087", "UK"],
  Monzo: ["MO", "#ff4d6a", "UK_DIGITAL"],
  Revolut: ["RE", "#191c1f", "UK_DIGITAL"],
  MUFG: ["三", "#e60012", "JP"],
  SMBC: ["井", "#006b3f", "JP"],
  Mizuho: ["瑞", "#003da5", "JP"],
  "Japan Post Bank": ["邮", "#007a3d", "JP"],
  "Commonwealth Bank": ["CB", "#c9a000", "AU"],
  Westpac: ["W", "#d5002b", "AU"],
  NAB: ["N", "#e31c23", "AU"],
  ANZ: ["AZ", "#007dba", "AU"],
  Macquarie: ["MQ", "#000000", "AU"],
  RBC: ["RB", "#005daa", "CA"],
  TD: ["TD", "#008a00", "CA"],
  Scotiabank: ["SC", "#ec111a", "CA"],
  BMO: ["BM", "#0079c1", "CA"],
  CIBC: ["CI", "#c41230", "CA"],
  UBS: ["UB", "#e60000", "CH"],
  PostFinance: ["PF", "#c9a000", "CH"],
  Raiffeisen: ["RF", "#e30613", "CH"],
  "HSBC Hong Kong": ["汇", "#db0011", "HK"],
  BOCHK: ["中", "#b11116", "HK"],
  "Hang Seng": ["恒", "#00843d", "HK"],
  "Standard Chartered HK": ["渣", "#0072aa", "HK"],
  "Bank of East Asia": ["东", "#c41230", "HK"],
  DBS: ["DB", "#c41230", "SG"],
  OCBC: ["OC", "#e31837", "SG"],
  UOB: ["UO", "#003da5", "SG"],
  "KB Kookmin": ["KB", "#c49000", "KR"],
  Shinhan: ["新", "#0046ff", "KR"],
  Woori: ["友", "#0067ac", "KR"],
  Hana: ["韩", "#009490", "KR"],
  SBI: ["SB", "#22409a", "IN"],
  "HDFC Bank": ["HD", "#004c8f", "IN"],
  "ICICI Bank": ["IC", "#f37f20", "IN"],
  "Axis Bank": ["AX", "#97144d", "IN"],
  "Emirates NBD": ["EN", "#0033a0", "AE"],
  FAB: ["FA", "#0033a0", "AE"],
  ADCB: ["AD", "#e31c23", "AE"],
  "Itaú": ["IT", "#ec7000", "BR"],
  Bradesco: ["BR", "#cc092f", "BR"],
  "Banco do Brasil": ["BB", "#c9a000", "BR"],
  Nubank: ["NU", "#820ad1", "BR"],
  "ANZ New Zealand": ["AZ", "#007dba", "NZ"],
  ASB: ["AS", "#c9a000", "NZ"],
  "Westpac New Zealand": ["W", "#d5002b", "NZ"],
  CTBC: ["信", "#d71920", "TW"],
  "Cathay United": ["国", "#00843d", "TW"],
  "Bank of Taiwan": ["台", "#003087", "TW"],
  "E.SUN": ["玉", "#4f8f12", "TW"],
}

let liveBoards = {}

export function applyDepositBoard(payload) {
  const banks = payload?.banks
  if (!banks || typeof banks !== "object") return
  const next = {}
  Object.entries(banks).forEach(([key, board]) => {
    if (!board || !Array.isArray(board.products)) return
    const rates = {}
    board.products.forEach((p) => {
      const n = Number(p?.rate)
      if (p?.id && Number.isFinite(n) && n >= 0) rates[p.id] = n
    })
    if (!Object.keys(rates).length) return
    next[key] = {
      asOf: String(board.asOf || "").slice(0, 10),
      source: String(board.source || "").slice(0, 40),
      rates,
    }
  })
  if (Object.keys(next).length) liveBoards = next
}

export function bankBoard(bank) {
  return liveBoards[bank?.en] || null
}

export const BANKS = BANK_SEED.map(([country, zh, en, kind], i) => {
  const face = FACE[en] || [zh.slice(0, 1), "#3d8bfd", country]
  return {
    id: `b${i}`,
    country,
    zh,
    en,
    kind,
    currency: COUNTRY_CCY[country],
    mark: face[0],
    color: face[1],
    profile: face[2] || country,
    rate: 0,
  }
})

export function bankProducts(bank) {
  const catalog = bank?.country === "CN" ? CN_DEPOSIT_PRODUCTS : TENORS
  const rates = liveBoards[bank?.en]?.rates
  return catalog.map((p) => ({
    ...p,
    rate: rates && Number.isFinite(rates[p.id]) ? rates[p.id] : null,
  }))
}

BANKS.forEach((bank) => {
  const year = bankProducts(bank).find((p) => p.id === "time_1y")
  bank.rate = year && year.rate != null ? year.rate : 0
})

export function findBank(name) {
  if (!name) return null
  return BANKS.find((b) => b.zh === name || b.en === name) || null
}

export function depositProducts() {
  const rows = []
  COUNTRIES.forEach((c) => {
    const ref = DEPOSIT_REF[c.id]
    if (!ref) return
    const currency = COUNTRY_CCY[c.id]
    if (ref.savings != null) rows.push({ country: c.id, kind: "savings", rate: ref.savings, currency })
    if (ref.time != null) rows.push({ country: c.id, kind: "time", rate: ref.time, currency })
  })
  return rows
}

export function applyMarketFx(rates) {
  Object.entries(rates || {}).forEach(([code, value]) => {
    const n = Number(value)
    if (n > 0) FX[code] = n
  })
}

export function classById(id) {
  return CLASSES.find((c) => c.id === id) || null
}

export function subtypeById(classId, subtypeId) {
  const list = SUBTYPES[classId] || []
  return list.find((s) => s.id === subtypeId) || list[0] || { id: "custom", zh: "", en: "", liquidity: "month", risk: 3, yield: 0, growth: 0 }
}

export function countryById(id) {
  return COUNTRIES.find((c) => c.id === id) || null
}

export function displayName(h, lang) {
  if (lang === "en" && h.nameEn) return h.nameEn
  if (lang === "zh" && h.nameZh) return h.nameZh
  return h.name || ""
}

export function sanitizeHolding(raw) {
  if (!raw || typeof raw !== "object") return null
  if (!classById(raw.classId)) return null
  const sub = subtypeById(raw.classId, raw.subtype)
  if (!SUBTYPES[raw.classId].some((s) => s.id === raw.subtype)) return null
  const amount = Number(raw.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const currency = CURRENCIES.includes(raw.currency) || /^[A-Z]{3}$/.test(String(raw.currency || "")) ? raw.currency : "CNY"
  const cost = Number(raw.cost)
  const qty = Number(raw.quantity)
  const y = Number(raw.incomeYield)
  const g = Number(raw.growth)
  const country = countryById(raw.country) ? raw.country : ""
  const account = ACCOUNTS.some((a) => a.id === raw.account) ? raw.account : DEFAULT_ACCOUNT[raw.classId]
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `h${Date.now().toString(36)}`,
    classId: raw.classId,
    subtype: sub.id,
    name: String(raw.name || "").trim().slice(0, 80) || sub.zh,
    nameZh: typeof raw.nameZh === "string" ? raw.nameZh.slice(0, 80) : "",
    nameEn: typeof raw.nameEn === "string" ? raw.nameEn.slice(0, 80) : "",
    symbol: String(raw.symbol || "").trim().slice(0, 160),
    currency,
    country,
    institution: String(raw.institution || "").trim().slice(0, 80),
    account,
    amount,
    cost: Number.isFinite(cost) && cost > 0 ? cost : null,
    quantity: Number.isFinite(qty) && qty > 0 ? qty : null,
    price: Number.isFinite(Number(raw.price)) && Number(raw.price) > 0 ? Number(raw.price) : null,
    prev: Number.isFinite(Number(raw.prev)) && Number(raw.prev) > 0 ? Number(raw.prev) : null,
    move: raw.move === "24h" || raw.move === "month" || raw.move === "day" ? raw.move : "",
    quoteDay: typeof raw.quoteDay === "string" ? raw.quoteDay.slice(0, 10) : "",
    incomeYield: Number.isFinite(y) ? y : 0,
    growth: raw.classId === "liability" ? 0 : (Number.isFinite(g) ? g : 0),
    notes: String(raw.notes || "").trim().slice(0, 500),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
  }
}

function usdOf(amount, currency) {
  const fx = FX[currency]
  if (!fx) return 0
  return amount / fx
}

export function createDemo(lang) {
  const now = "2026-10-15T00:00:00.000Z"
  const row = (p) => ({
    symbol: "", country: "", institution: "", notes: "", cost: null, quantity: null, updatedAt: now, ...p,
    name: lang === "en" ? p.nameEn : p.nameZh,
  })
  const holdings = [
    row({ id: "d1", classId: "realestate", subtype: "primary", nameZh: "自住住宅", nameEn: "Primary residence", currency: "CNY", country: "CN", amount: 3200000, cost: 2100000, incomeYield: 0, growth: 3, account: "property" }),
    row({ id: "d2", classId: "liability", subtype: "mortgage", nameZh: "住房按揭", nameEn: "Home mortgage", currency: "CNY", country: "CN", institution: "招商银行", amount: 1180000, incomeYield: 3.05, growth: 0, account: "bank" }),
    row({ id: "d3", classId: "deposit", subtype: "demand", nameZh: "工商银行活期", nameEn: "ICBC demand deposit", currency: "CNY", country: "CN", institution: "中国工商银行", amount: 42000, incomeYield: 0.05, growth: 0, account: "bank" }),
    row({ id: "d4", classId: "deposit", subtype: "time_1y", nameZh: "招商银行整存整取一年", nameEn: "CMB 1-year term", currency: "CNY", country: "CN", institution: "招商银行", amount: 250000, incomeYield: 0.95, growth: 0, account: "bank" }),
    row({ id: "d5", classId: "fund", subtype: "money", nameZh: "货币基金", nameEn: "Money market fund", currency: "CNY", country: "CN", amount: 86000, incomeYield: 1.35, growth: 0, account: "wallet" }),
    row({ id: "d6", classId: "equity", subtype: "cn", nameZh: "沪深股票", nameEn: "China A-shares", currency: "CNY", country: "CN", amount: 180000, cost: 210000, incomeYield: 1.2, growth: 7, account: "broker" }),
    row({ id: "d7", classId: "fund", subtype: "broad", nameZh: "全球股票 ETF", nameEn: "Global equity ETF", symbol: "VWRA", currency: "USD", country: "US", amount: 28000, cost: 22000, incomeYield: 1.4, growth: 6.5, account: "broker" }),
    row({ id: "d8", classId: "equity", subtype: "hk", nameZh: "港股", nameEn: "Hong Kong stocks", currency: "HKD", country: "HK", amount: 150000, cost: 168000, incomeYield: 2.8, growth: 6, account: "broker" }),
    row({ id: "d9", classId: "crypto", subtype: "btc", nameZh: "比特币", nameEn: "Bitcoin", symbol: "BTC", currency: "USD", amount: 18500, cost: 14200, incomeYield: 0, growth: 0, account: "exchange" }),
    row({ id: "d10", classId: "crypto", subtype: "eth", nameZh: "以太坊", nameEn: "Ethereum", symbol: "ETH", currency: "USD", amount: 6200, cost: 7000, incomeYield: 0, growth: 0, account: "exchange" }),
    row({ id: "d11", classId: "commodity", subtype: "gold", nameZh: "黄金", nameEn: "Gold", currency: "CNY", country: "CN", amount: 46000, cost: 39000, incomeYield: 0, growth: 3, account: "broker" }),
    row({ id: "d12", classId: "pension", subtype: "housing_fund", nameZh: "住房公积金", nameEn: "Housing provident fund", currency: "CNY", country: "CN", amount: 220000, incomeYield: 1.5, growth: 0, account: "retirement" }),
    row({ id: "d13", classId: "pension", subtype: "enterprise", nameZh: "企业年金", nameEn: "Enterprise annuity", currency: "CNY", country: "CN", amount: 75000, incomeYield: 0, growth: 4, account: "retirement" }),
    row({ id: "d14", classId: "cash", subtype: "wallet", nameZh: "美元现金", nameEn: "US dollar cash", currency: "USD", country: "US", amount: 8000, incomeYield: 0, growth: 0, account: "wallet" }),
    row({ id: "d15", classId: "fx", subtype: "foreign_cash", nameZh: "欧元现金", nameEn: "Euro cash", currency: "EUR", country: "EU", amount: 4000, incomeYield: 0, growth: 0, account: "bank" }),
    row({ id: "d16", classId: "private", subtype: "pe", nameZh: "私募股权基金", nameEn: "Private equity fund", currency: "CNY", country: "CN", amount: 100000, incomeYield: 0, growth: 8, account: "private" }),
    row({ id: "d17", classId: "insurance", subtype: "whole", nameZh: "储蓄险现金价值", nameEn: "Insurance cash value", currency: "CNY", country: "CN", amount: 90000, incomeYield: 2.2, growth: 0, account: "insurance" }),
    row({ id: "d18", classId: "liability", subtype: "credit_card", nameZh: "信用卡", nameEn: "Credit card", currency: "CNY", country: "CN", amount: 6200, incomeYield: 13.8, growth: 0, account: "bank" }),
    row({ id: "d19", classId: "deposit", subtype: "savings", nameZh: "新加坡银行储蓄", nameEn: "Singapore savings", currency: "SGD", country: "SG", institution: "DBS", amount: 15000, incomeYield: 1.8, growth: 0, account: "bank" }),
  ].map(sanitizeHolding)

  const net = holdings.reduce((s, h) => {
    const sign = h.classId === "liability" ? -1 : 1
    return s + sign * usdOf(h.amount, h.currency)
  }, 0)
  const factors = [0.9, 0.93, 0.91, 0.95, 0.97, 0.985, 1]
  const days = ["2026-04-15", "2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15"]
  const history = days.map((d, i) => ({ t: `${d}T00:00:00.000Z`, usd: net * factors[i] }))
  return { holdings, history }
}
