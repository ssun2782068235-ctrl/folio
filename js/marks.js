const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

const ICONS = {
  cash: svg(`<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.2"/>`),
  bank: svg(`<path d="M4 10h16M6 10v7M10 10v7M14 10v7M18 10v7M3 17h18M12 4l9 6H3l9-6z"/>`),
  chart: svg(`<path d="M4 16l5-5 3 3 8-8"/><path d="M14 6h6v6"/>`),
  fund: svg(`<path d="M12 4a8 8 0 1 0 8 8h-8V4z"/><path d="M13 3.2A8 8 0 0 1 20.8 11H13V3.2z"/>`),
  bond: svg(`<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M8 10h8M8 14h5"/>`),
  house: svg(`<path d="M4 11.5 12 5l8 6.5V20H4v-8.5z"/><path d="M10 20v-6h4v6"/>`),
  coin: svg(`<ellipse cx="12" cy="7" rx="7" ry="3"/><path d="M5 7v5c0 1.7 3.1 3 7 3s7-1.3 7-3V7"/><path d="M5 12v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5"/>`),
  gold: svg(`<circle cx="12" cy="12" r="7"/><path d="M12 8v8M9.5 10.5h5M9.5 13.5h5"/>`),
  fx: svg(`<path d="M7 7h8l-2-2M17 17H9l2 2"/><path d="M16 7v4H8M8 17v-4h8"/>`),
  shield: svg(`<path d="M12 3l7 3v6c0 4.5-3 7-7 9-4-2-7-4.5-7-9V6l7-3z"/>`),
  brief: svg(`<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2"/>`),
  building: svg(`<path d="M5 20V6h8v14M13 20v-8h6v8M8 9h2M8 13h2M16 14h2"/>`),
  gem: svg(`<path d="M3 9l4-5h10l4 5-9 11L3 9z"/><path d="M3 9h18"/>`),
  card: svg(`<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18"/>`),
  car: svg(`<path d="M4 15h16M6 15l2-5h8l2 5"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="16.5" cy="16.5" r="1.5"/>`),
  frame: svg(`<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 15l4-4 3 3 2-2 5 5"/>`),
  box: svg(`<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v8"/>`),
  umbrella: svg(`<path d="M12 4a8 8 0 0 1 8 8H4a8 8 0 0 1 8-8z"/><path d="M12 12v6a2 2 0 0 0 4 0"/>`),
}

const CLASS_ICON = {
  cash: "cash",
  deposit: "bank",
  bond: "bond",
  equity: "chart",
  fund: "fund",
  realestate: "house",
  crypto: "coin",
  commodity: "gold",
  fx: "fx",
  insurance: "shield",
  private: "brief",
  pension: "umbrella",
  business: "building",
  collectible: "gem",
  derivative: "chart",
  other: "box",
  liability: "card",
}

const SUB = {
  btc: { text: "₿", bg: "#f7931a" },
  eth: { text: "Ξ", bg: "#627eea" },
  stable: { text: "$", bg: "#26a17b" },
  gold: { icon: "gold", bg: "#c9a227" },
  silver: { icon: "gold", bg: "#9aa3ad" },
  nft: { icon: "frame", bg: "#a78bfa" },
  primary: { icon: "house" },
  invest_res: { icon: "house" },
  car: { icon: "car" },
  credit_card: { icon: "card" },
}

function shell(bg, inner, word) {
  return `<i class="mark sig${word ? " word" : ""}" style="background:${bg}">${inner}</i>`
}

export function classMark(item) {
  const icon = ICONS[CLASS_ICON[item?.id] || "box"] || ICONS.box
  return shell(item?.color || "#3d8bfd", icon, false)
}

export function subMark(item, sub) {
  const special = SUB[sub?.id]
  if (special?.text) return shell(special.bg, special.text, true)
  if (special?.icon) return shell(special.bg || item?.color || "#3d8bfd", ICONS[special.icon] || ICONS.box, false)
  return classMark(item)
}

export function chartMark() {
  return shell("#3a4660", ICONS.chart, false)
}
