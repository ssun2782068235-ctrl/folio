#!/usr/bin/env python3
"""Static files plus a same-origin quote proxy. Prices come from public market endpoints, once per request."""

import csv
import datetime
import gzip
import io
import json
import os
import re
import ssl
import threading
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


def ssl_base():
    for path in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
        if os.path.isfile(path):
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


SSL_CTX = ssl_base()

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


CACHE = {}
CACHE_LOCK = threading.Lock()


ICBC_CTX = ssl_base()
ICBC_CTX.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
TW_CTX = ssl_base()
if hasattr(ssl, "VERIFY_X509_STRICT"):
    TW_CTX.verify_flags &= ~ssl.VERIFY_X509_STRICT

WEEK = 7 * 24 * 60 * 60

DEPOSIT_FIELDS = (
    ("demand", "huoQi"),
    ("call_1d", "tzOneDay"),
    ("call_7d", "tzSevenDay"),
    ("time_3m", "zczqThreeMonths"),
    ("time_6m", "zczqHalfYear"),
    ("time_1y", "zczqOneYear"),
    ("time_2y", "zczqTwoYears"),
    ("time_3y", "zczqThreeYears"),
    ("time_5y", "zczqFiveYears"),
    ("install_1y", "lczqOneYear"),
    ("install_3y", "lczqThreeYears"),
    ("install_5y", "lczqFiveYears"),
)


def fetch_bytes(url, ctx=None, referer=None, headers=None, ttl=60 * 60 * 12):
    with CACHE_LOCK:
        hit = CACHE.get(url)
        if hit and hit[0] > time.time():
            return hit[1]
    hdrs = {
        "User-Agent": UA,
        "Accept": "*/*",
        "Referer": referer or "https://finance.sina.com.cn",
    }
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    last = None
    for wait in (0, 0.8):
        if wait:
            time.sleep(wait)
        try:
            with urllib.request.urlopen(req, timeout=15, context=ctx or SSL_CTX) as res:
                data = res.read()
                with CACHE_LOCK:
                    CACHE[url] = (time.time() + ttl, data)
                return data
        except Exception as exc:
            last = exc
    raise last


def fetch_json(url):
    return json.loads(fetch_bytes(url).decode())


def num(value):
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None
    if n != n:
        return None
    return n


FUND_KINDS = {"22", "24", "201", "202", "203"}
STOCK_KINDS = {"11", "12", "31", "41", "103"}


def quote_symbol(kind, code, raw):
    code = (code or "").strip()
    raw_l = (raw or "").strip().lower()
    if kind in ("11", "12") or (kind == "203" and raw_l.startswith(("sh", "sz"))):
        if raw_l.startswith(("sh", "sz")):
            symbol = raw_l
        elif kind == "12":
            symbol = "sz" + code
        else:
            symbol = "sh" + code
        if symbol.startswith(("sh000", "sz399")):
            return ""
        return symbol
    if kind == "31":
        digits = "".join(ch for ch in code if ch.isdigit())
        if not digits:
            return ""
        return "hk" + digits.zfill(5)
    if kind in ("41", "103"):
        ticker = code.lower()
        if not re.fullmatch(r"[a-z0-9]{1,8}", ticker):
            return ""
        return "gb_" + ticker
    if kind in FUND_KINDS or raw_l.startswith("of"):
        digits = "".join(ch for ch in code if ch.isdigit())
        if len(digits) < 6:
            return ""
        return "of" + digits[-6:]
    return ""


def ticker_of(symbol):
    if symbol.startswith("gb_"):
        return symbol[3:].upper()
    if symbol.startswith(("sh", "sz", "hk")):
        return symbol[2:]
    if symbol.startswith("of"):
        return symbol[2:]
    return symbol.upper()


def market_of(symbol):
    if symbol.startswith("gb_"):
        return "美国", "USD"
    if symbol.startswith("hk"):
        return "香港", "HKD"
    if symbol.startswith("sh"):
        return "上海", "CNY"
    if symbol.startswith("sz"):
        return "深圳", "CNY"
    return "", "USD"


def parse_quote(symbol, text):
    body = text.split('"', 1)[-1].rsplit('"', 1)[0]
    p = body.split(",")
    if len(p) < 8 or not p[0]:
        return None
    exchange, currency = market_of(symbol)
    if symbol.startswith("gb_"):
        price, chg = num(p[1]), num(p[4])
        if price is None:
            return None
        return {
            "name": p[0],
            "price": price,
            "prev": round(price - chg, 4) if chg is not None else price,
            "exchange": exchange,
            "currency": currency,
        }
    if symbol.startswith("hk"):
        price, prev = num(p[6]), num(p[3])
        if price is None:
            return None
        return {
            "name": p[1] or p[0],
            "price": price,
            "prev": prev if prev is not None else price,
            "exchange": exchange,
            "currency": currency,
        }
    price, prev = num(p[3]), num(p[2])
    if price is None:
        return None
    return {
        "name": p[0],
        "price": price,
        "prev": prev if prev is not None else price,
        "exchange": exchange,
        "currency": currency,
    }


def history_points(symbol):
    try:
        if symbol.startswith("gb_"):
            raw = fetch_bytes("https://stock.finance.sina.com.cn/usstock/api/json.php/US_MinKService.getDailyK?symbol=" + urllib.parse.quote(symbol[3:]))
            rows = json.loads(raw.decode("utf-8", "replace"))
            return [round(float(row["c"]), 4) for row in rows[-130:] if row.get("c")]
        if symbol.startswith(("sh", "sz")):
            raw = fetch_bytes(
                "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?"
                + urllib.parse.urlencode({"symbol": symbol, "scale": 240, "ma": "no", "datalen": 130})
            )
            rows = json.loads(raw.decode("utf-8", "replace"))
            if not isinstance(rows, list):
                return []
            return [round(float(row["close"]), 4) for row in rows if row.get("close")]
    except Exception:
        return []
    return []


def fund_title(code):
    url = "https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=" + urllib.parse.quote(code)
    try:
        payload = json.loads(fetch_bytes(url, referer="https://fund.eastmoney.com/", ttl=60 * 60 * 6).decode())
    except Exception:
        return ""
    for row in payload.get("Datas") or []:
        if str(row.get("CODE") or "") == code:
            return str(row.get("NAME") or "")
    return ""


def fund_quote(code):
    if not re.fullmatch(r"\d{6}", code or ""):
        return None
    url = "https://api.fund.eastmoney.com/f10/lsjz?" + urllib.parse.urlencode({
        "fundCode": code,
        "pageIndex": 1,
        "pageSize": 40,
    })
    try:
        payload = json.loads(fetch_bytes(url, referer="https://fundf10.eastmoney.com/", ttl=60 * 60 * 6).decode())
    except Exception:
        return None
    block = payload.get("Data") or {}
    rows = [row for row in (block.get("LSJZList") or []) if num(row.get("DWJZ"))]
    if not rows:
        return None
    latest, prev = rows[0], rows[1] if len(rows) > 1 else rows[0]
    money = (block.get("SYType") or "") == "每万份收益"
    points = [num(row.get("DWJZ")) for row in reversed(rows)]
    dw = num(latest.get("DWJZ"))
    name = fund_title(code) or code
    if money:
        return {
            "symbol": "of" + code,
            "ticker": code,
            "name": name,
            "exchange": "基金",
            "currency": "CNY",
            "price": 1,
            "prev": None,
            "points": points,
            "source": "天天基金",
            "asOf": str(latest.get("FSRQ") or ""),
            "money": True,
            "yieldText": f"每万份收益 {dw:.4f}",
            "chartNote": "图上是每万份收益，不是份额价格。份额按 1 元记。",
        }
    return {
        "symbol": "of" + code,
        "ticker": code,
        "name": name,
        "exchange": "基金",
        "currency": "CNY",
        "price": round(dw, 4),
        "prev": round(num(prev.get("DWJZ")) or dw, 4),
        "points": points,
        "source": "天天基金",
        "asOf": str(latest.get("FSRQ") or ""),
        "money": False,
    }


def em_funds(keyword):
    url = "https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=" + urllib.parse.quote(keyword)
    try:
        payload = json.loads(fetch_bytes(url, referer="https://fund.eastmoney.com/", ttl=60 * 60).decode())
    except Exception:
        return []
    hits = []
    for row in payload.get("Datas") or []:
        code = str(row.get("CODE") or "")
        name = str(row.get("NAME") or "")
        if not re.fullmatch(r"\d{6}", code) or not name:
            continue
        hits.append({
            "symbol": "of" + code,
            "ticker": code,
            "name": name,
            "exchange": "基金",
            "kind": "基金",
            "classId": "fund",
        })
        if len(hits) >= 20:
            break
    return hits


def json_list(raw):
    text = raw.decode("utf-8", "replace")
    start = text.find("[")
    end = text.rfind("]")
    if start < 0 or end < start:
        return []
    try:
        data = json.loads(text[start:end + 1])
    except Exception:
        return []
    return data if isinstance(data, list) else []


def round_px(n):
    return round(n, 2 if abs(n) >= 100 else 4)


def as_candle(t, o, h, l, c, v=0):
    o, h, l, c = num(o), num(h), num(l), num(c)
    if None in (o, h, l, c) or min(o, h, l, c) <= 0:
        return None
    vol = num(v) or 0
    return {
        "t": t,
        "o": round_px(o),
        "h": round_px(max(o, h, l, c)),
        "l": round_px(min(o, h, l, c)),
        "c": round_px(c),
        "v": round(vol, 4) if vol > 0 else 0,
    }


def tail(rows, count):
    if count and len(rows) > count:
        return rows[-count:]
    return rows


def paint_last(candles, price):
    if not candles or not price:
        return candles
    last = dict(candles[-1])
    last["c"] = round_px(price)
    last["h"] = round_px(max(last["h"], price))
    last["l"] = round_px(min(last["l"], price))
    return candles[:-1] + [last]


CRYPTO_RANGE = {
    "1d": (300, 86400),
    "1w": (3600, 7 * 86400),
    "1m": (21600, 30 * 86400),
    "3m": (86400, 92 * 86400),
    "1y": (86400, 370 * 86400),
}
METAL_RANGE = {
    "1d": ("15", 96),
    "1w": ("60", 120),
    "1m": ("day", 22),
    "3m": ("day", 66),
    "1y": ("day", 252),
}
KNOWN_SERIES = {
    "BTC": ("crypto", "btc", "比特币", "Bitcoin"),
    "ETH": ("crypto", "eth", "以太坊", "Ethereum"),
    "GOLD": ("commodity", "gold", "黄金", "Gold"),
    "SILVER": ("commodity", "silver", "白银", "Silver"),
}


def coinbase_ticker(product):
    ticker = json.loads(fetch_bytes(
        "https://api.exchange.coinbase.com/products/" + product + "/ticker",
        referer="https://www.coinbase.com",
        ttl=15,
    ).decode())
    stats = json.loads(fetch_bytes(
        "https://api.exchange.coinbase.com/products/" + product + "/stats",
        referer="https://www.coinbase.com",
        ttl=30,
    ).decode())
    price = num(ticker.get("price"))
    if price is None or price <= 0:
        return None
    return {
        "price": price,
        "open": num(stats.get("open")),
        "high": num(stats.get("high")),
        "low": num(stats.get("low")),
        "prev": num(stats.get("open")),
        "asOf": str(ticker.get("time") or "")[:19],
    }


def coinbase_candles(product, rng):
    gran, span = CRYPTO_RANGE[rng]
    now = int(time.time())
    now -= now % 30
    start = now - span
    step = gran * 290
    found = {}
    cursor = start
    while cursor < now:
        end = min(now, cursor + step)
        if end <= cursor:
            break
        raw = fetch_bytes(
            "https://api.exchange.coinbase.com/products/" + product + "/candles?"
            + urllib.parse.urlencode({"granularity": gran, "start": cursor, "end": end}),
            referer="https://www.coinbase.com",
            ttl=45,
        )
        rows = json.loads(raw.decode())
        if isinstance(rows, list):
            for row in rows:
                if not isinstance(row, list) or len(row) < 5:
                    continue
                item = as_candle(int(row[0]), row[3], row[2], row[1], row[4], row[5] if len(row) > 5 else 0)
                if item:
                    found[item["t"]] = item
        cursor = end
    return [found[key] for key in sorted(found)]


def metal_quote(code):
    raw = fetch_bytes("https://hq.sinajs.cn/list=hf_" + code, referer="https://finance.sina.com.cn", ttl=15)
    body = raw.decode("gbk", "replace").split('"', 1)[-1].rsplit('"', 1)[0]
    parts = body.split(",")
    price = num(parts[0]) if parts else None
    if price is None or price <= 0:
        return None
    as_of = ""
    if len(parts) > 12 and re.match(r"20\d{2}-\d{2}-\d{2}", parts[12]):
        as_of = parts[12][:10] + ((" " + parts[6]) if len(parts) > 6 and parts[6] else "")
    return {
        "price": price,
        "open": num(parts[8]) if len(parts) > 8 else None,
        "high": num(parts[4]) if len(parts) > 4 else None,
        "low": num(parts[5]) if len(parts) > 5 else None,
        "prev": num(parts[7]) if len(parts) > 7 else None,
        "asOf": as_of.strip(),
    }


def metal_candles(code, rng):
    kind, count = METAL_RANGE[rng]
    if kind == "day":
        raw = fetch_bytes(
            "https://stock2.finance.sina.com.cn/futures/api/json.php/GlobalFuturesService.getGlobalFuturesDailyKLine?symbol=" + code,
            referer="https://finance.sina.com.cn",
            ttl=600,
        )
        rows = json_list(raw)
        out = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            item = as_candle(str(row.get("date") or "")[:10], row.get("open"), row.get("high"), row.get("low"), row.get("close"), row.get("volume"))
            if item and item["t"]:
                out.append(item)
        return tail(out, count)
    raw = fetch_bytes(
        "https://gu.sina.cn/ft/api/jsonp.php/var%20_" + code + kind + "=/GlobalService.getMink?symbol=" + code + "&type=" + kind,
        referer="https://finance.sina.com.cn",
        ttl=45,
    )
    rows = json_list(raw)
    out = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        item = as_candle(str(row.get("d") or ""), row.get("o"), row.get("h"), row.get("l"), row.get("c"), row.get("v"))
        if item and item["t"]:
            out.append(item)
    return tail(out, count)


def build_series(symbol, rng):
    known = KNOWN_SERIES.get(symbol)
    if known and known[0] == "commodity":
        code = "GC" if symbol == "GOLD" else "SI"
        quote = metal_quote(code)
        try:
            candles = metal_candles(code, rng) if quote else []
        except Exception:
            candles = []
        source = "COMEX"
        change = "prev"
        unit = "oz"
        product = code
    else:
        product = symbol + "-USD"
        quote = coinbase_ticker(product)
        try:
            candles = coinbase_candles(product, rng) if quote else []
        except Exception:
            candles = []
        source = "Coinbase"
        change = "24h"
        unit = ""
        if not known:
            known = ("crypto", "alt", symbol, symbol)
    if not quote:
        return None
    candles = paint_last(candles, quote["price"])
    return {
        "symbol": symbol,
        "classId": known[0],
        "subtype": known[1],
        "name": known[2],
        "nameEn": known[3],
        "exchange": source,
        "source": source,
        "currency": "USD",
        "unit": unit,
        "change": change,
        "price": round_px(quote["price"]),
        "prev": round_px(quote["prev"]) if quote.get("prev") else 0,
        "open": round_px(quote["open"]) if quote.get("open") else 0,
        "high": round_px(quote["high"]) if quote.get("high") else 0,
        "low": round_px(quote["low"]) if quote.get("low") else 0,
        "asOf": quote.get("asOf") or "",
        "candles": candles,
    }


def coin_catalog():
    raw = fetch_bytes("https://api.exchange.coinbase.com/products", referer="https://www.coinbase.com", ttl=60 * 60 * 12)
    data = json.loads(raw.decode())
    hits = []
    if not isinstance(data, list):
        return hits
    for row in data:
        if not isinstance(row, dict):
            continue
        if row.get("quote_currency") != "USD" or row.get("status") != "online":
            continue
        if row.get("trading_disabled") or row.get("cancel_only"):
            continue
        base = str(row.get("base_currency") or "")
        if not re.fullmatch(r"[A-Z0-9]{2,12}", base):
            continue
        hits.append({
            "symbol": base,
            "ticker": base,
            "name": str(row.get("display_name") or base),
            "exchange": "Coinbase",
            "classId": "crypto",
        })
    return hits


LUMP = {
    "三个月": "time_3m", "六个月": "time_6m", "半年": "time_6m",
    "一年": "time_1y", "二年": "time_2y", "两年": "time_2y",
    "三年": "time_3y", "五年": "time_5y",
}
INSTALL = {"一年": "install_1y", "三年": "install_3y", "五年": "install_5y"}
CALL = {"一天": "call_1d", "七天": "call_7d"}
CMB_NAMES = {
    "活期": "demand",
    "通知存款 一天": "call_1d",
    "通知存款 七天": "call_7d",
    "整存整取 三个月": "time_3m",
    "整存整取 半年": "time_6m",
    "整存整取 一年": "time_1y",
    "整存整取 二年": "time_2y",
    "整存整取 三年": "time_3y",
    "整存整取 五年": "time_5y",
    "零存整取 一年": "install_1y",
    "零存整取 三年": "install_3y",
    "零存整取 五年": "install_5y",
}


BOARD_IDS = (
    "demand", "savings", "call_1d", "call_7d",
    "time_3m", "time_6m", "time_1y", "time_2y", "time_3y", "time_5y",
    "install_1y", "install_3y", "install_5y",
)


def products_from_rates(rates):
    products = []
    for pid in BOARD_IDS:
        if pid in rates and rates[pid] is not None:
            products.append({"id": pid, "rate": rates[pid]})
    return products


def pack_board(key, source, as_of, rates):
    products = products_from_rates(rates)
    if not products:
        return None
    return key, {"asOf": as_of or "", "source": source, "products": products}


def tenor_key(table, pending):
    label = pending[:-1] if pending.endswith("期") else pending
    return table.get(label) or table.get(pending)


def rates_from_cells(cells):
    section = ""
    pending = ""
    rates = {}
    for raw in cells:
        cell = re.sub(r"\s+", "", raw or "")
        if not cell:
            continue
        if "外币" in cell and "demand" in rates and "time_1y" in rates:
            break
        if any(word in cell for word in ("零存整取", "整存零取", "存本取息")):
            section, pending = "install", ""
            continue
        if "定活" in cell or "协定" in cell:
            section, pending = "other", ""
            continue
        if "整存整取" in cell or ("定期" in cell and "通知" not in cell):
            section, pending = "lump", ""
            continue
        if "通知" in cell:
            section, pending = "call", ""
            continue
        if "活期" in cell:
            pending = "demand"
            continue
        if re.fullmatch(r"\d+\.\d+", cell):
            key = None
            if pending == "demand":
                key = "demand"
            elif section == "lump":
                key = tenor_key(LUMP, pending)
            elif section == "install":
                key = tenor_key(INSTALL, pending)
            elif section == "call":
                key = tenor_key(CALL, pending)
            if key and key not in rates:
                rates[key] = float(cell)
            pending = ""
            continue
        pending = cell
    return rates


def html_cells(html):
    cells = []
    for table in re.findall(r"<table[\s\S]*?</table>", html, re.I):
        for cell in re.findall(r"<t[dh][^>]*>([\s\S]*?)</t[dh]>", table, re.I):
            text = re.sub(r"<[^>]+>", "", cell).replace("&nbsp;", " ")
            text = re.sub(r"\s+", " ", text).strip()
            if text:
                cells.append(text)
    return cells


def fetch_icbc_board():
    raw_dates = fetch_bytes(
        "https://papi.icbc.com.cn/interestRate/deposit/queryRMBDepositDateList?type=CH",
        ICBC_CTX,
        "https://www.icbc.com.cn/",
    )
    dates = json.loads(raw_dates.decode())
    as_of = (dates.get("data") or [""])[0]
    if dates.get("code") != 0 or not as_of:
        return None
    raw_info = fetch_bytes(
        "https://papi.icbc.com.cn/interestRate/deposit/queryRMBDepositInfo?type=CH&date=" + urllib.parse.quote(as_of),
        ICBC_CTX,
        "https://www.icbc.com.cn/",
    )
    info = json.loads(raw_info.decode())
    if info.get("code") != 0:
        return None
    data = info.get("data") or {}
    rates = {}
    for pid, key in DEPOSIT_FIELDS:
        rate = num(data.get(key))
        if rate is not None:
            rates[pid] = rate
    return pack_board("ICBC", "中国工商银行", as_of, rates)


def fetch_cmb_board():
    raw = fetch_bytes(
        "https://m.cmbchina.com/api/rate/deposit-interest?currency=10",
        referer="https://m.cmbchina.com/interestrate.html",
        headers={"X-B3-BusinessId": "LB5010CmbMobileBff"},
    )
    body = json.loads(raw.decode()).get("body") or {}
    rates = {}
    for row in body.get("data") or []:
        pid = CMB_NAMES.get(row.get("rateName") or "")
        rate = num(row.get("rate"))
        if pid and rate is not None:
            rates[pid] = rate
    found = re.search(r"20\d{2}-\d{2}-\d{2}", body.get("createTime") or "")
    return pack_board("CMB", "招商银行", found.group(0) if found else "", rates)


def plain_text(html):
    text = re.sub(r"<script[\s\S]*?</script>", " ", html, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
    return re.sub(r"\s+", " ", text)


def board_date(html):
    text = plain_text(html)
    anchor = -1
    for word in ("整存整取", "活期存款", "活期"):
        anchor = text.find(word)
        if anchor >= 0:
            break
    text = text[max(0, anchor - 160):anchor + 40] if anchor >= 0 else ""
    patterns = (
        r"适用日期[:：\s]*(20\d{2})\s*[-年/.]\s*(\d{1,2})\s*[-月/.]\s*(\d{1,2})",
        r"自\s*(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日",
        r"(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*起",
        r"(20\d{2})-(\d{2})-(\d{2})\s*生效",
    )
    for pat in patterns:
        found = re.search(pat, text)
        if not found:
            continue
        year, month, day = int(found.group(1)), int(found.group(2)), int(found.group(3))
        if 1 <= month <= 12 and 1 <= day <= 31:
            return f"{year:04d}-{month:02d}-{day:02d}"
    return ""


def fetch_html_board(key, source, url, ctx=None):
    html = fetch_bytes(url, ctx, url).decode("utf-8", "replace")
    return pack_board(key, source, board_date(html), rates_from_cells(html_cells(html)))


def fetch_cib_board():
    url = "https://www.cib.com.cn/cn/personal/depositServer/rates/data.json"
    raw = fetch_bytes(url, referer="https://www.cib.com.cn/cn/personal/depositServer/rates/index.html")
    rows = json.loads(raw.decode()).get("data") or []

    def dated(row):
        found = re.search(r"(20\d{2})-(\d{2})-(\d{2})", row.get("title") or "")
        return found.group(0) if found else ""

    if not rows:
        return None
    row = max(rows, key=dated)
    return pack_board("Industrial Bank", "兴业银行", dated(row), rates_from_cells(html_cells(row.get("content") or "")))


def english_date(text):
    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
    }
    found = re.search(
        r"(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(20\d{2})",
        text,
        re.I,
    )
    if not found:
        return ""
    month = months[found.group(2)[:3].lower()]
    day = int(found.group(1))
    if not 1 <= day <= 31:
        return ""
    return f"{found.group(3)}-{month:02d}-{day:02d}"


def fetch_hsbc_hk_board():
    url = "https://www.hsbc.com.hk/investments/market-information/hk/deposit-rate/"
    text = plain_text(fetch_bytes(url, referer=url).decode("utf-8", "replace"))
    start = text.find("Hong Kong dollar")
    if start < 0:
        return None
    end = len(text)
    for name in ("United States dollar", "Renminbi", "Australian dollar", "Euro (", "Sterling", "Japanese yen", "Singapore dollar"):
        found = text.find(name, start + 40)
        if 0 < found < end:
            end = found
    block = text[start:end]
    rates = {}
    savings = re.search(r"HKD5,000 to HKD9,999\s+(\d+\.\d+)%", block)
    if savings:
        rates["savings"] = float(savings.group(1))
    for label, pid in (("3 months", "time_3m"), ("6 months", "time_6m"), ("12 months", "time_1y"), ("24 months", "time_2y")):
        found = re.search(rf"{label}\s+(\d+\.\d+)%", block)
        if found:
            rates[pid] = float(found.group(1))
    time_at = block.find("Time Deposit")
    as_of = english_date(block[time_at:]) if time_at >= 0 else ""
    return pack_board("HSBC Hong Kong", "汇丰香港", as_of or english_date(block), rates)


def fetch_boc_board():
    index = "https://www.boc.cn/fimarkets/lilv/fd31/"
    html = fetch_bytes(index, referer=index).decode("utf-8", "replace")
    found = re.search(r'href="(\./20\d{4}/t\d+_\d+\.html)"[^>]*>\s*人民币存款利率表(20\d{2}-\d{2}-\d{2})', html)
    if not found:
        return None
    page = urllib.parse.urljoin(index, found.group(1))
    table = fetch_bytes(page, referer=index).decode("utf-8", "replace")
    return pack_board("Bank of China", "中国银行", found.group(2), rates_from_cells(html_cells(table)))


MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"

HDB_TOWNS = (
    ("ANG MO KIO", "宏茂桥"), ("BEDOK", "勿洛"), ("BISHAN", "碧山"), ("BUKIT BATOK", "武吉巴督"),
    ("BUKIT MERAH", "红山"), ("BUKIT PANJANG", "武吉班让"), ("BUKIT TIMAH", "武吉知马"),
    ("CENTRAL AREA", "中区"), ("CHOA CHU KANG", "蔡厝港"), ("CLEMENTI", "金文泰"),
    ("GEYLANG", "芽笼"), ("HOUGANG", "后港"), ("JURONG EAST", "裕廊东"), ("JURONG WEST", "裕廊西"),
    ("KALLANG/WHAMPOA", "加冷/黄埔"), ("MARINE PARADE", "马林百列"), ("PASIR RIS", "巴西立"),
    ("PUNGGOL", "榜鹅"), ("QUEENSTOWN", "女皇镇"), ("SEMBAWANG", "三巴旺"), ("SENGKANG", "盛港"),
    ("SERANGOON", "实龙岗"), ("TAMPINES", "淡滨尼"), ("TOA PAYOH", "大巴窑"),
    ("WOODLANDS", "兀兰"), ("YISHUN", "义顺"),
)
UK_REGIONS = (
    ("london", "伦敦", True),
    ("south-east", "英格兰东南", False),
    ("south-west", "英格兰西南", False),
    ("east-of-england", "英格兰东部", False),
    ("east-midlands", "东米德兰", False),
    ("west-midlands", "西米德兰", False),
    ("yorkshire-and-the-humber", "约克郡和亨伯", False),
    ("north-west", "英格兰西北", False),
    ("north-east", "英格兰东北", False),
    ("england", "英格兰", False),
    ("scotland", "苏格兰", False),
    ("wales", "威尔士", False),
    ("northern-ireland", "北爱尔兰", False),
)
LONDON_BOROUGHS = (
    ("barking-and-dagenham", "巴金和达格纳姆"), ("barnet", "巴尼特"), ("bexley", "贝克斯利"),
    ("brent", "布伦特"), ("bromley", "布罗姆利"), ("camden", "卡姆登"),
    ("city-of-london", "伦敦金融城"), ("croydon", "克罗伊登"), ("ealing", "伊灵"),
    ("enfield", "恩菲尔德"), ("greenwich", "格林尼治"), ("hackney", "哈克尼"),
    ("hammersmith-and-fulham", "哈默史密斯和富勒姆"), ("haringey", "哈林盖"), ("harrow", "哈罗"),
    ("havering", "黑弗灵"), ("hillingdon", "希灵登"), ("hounslow", "豪恩斯洛"),
    ("islington", "伊斯灵顿"), ("kensington-and-chelsea", "肯辛顿和切尔西"),
    ("kingston-upon-thames", "泰晤士河畔金斯顿"), ("lambeth", "兰贝斯"), ("lewisham", "刘易舍姆"),
    ("merton", "默顿"), ("newham", "纽汉"), ("redbridge", "雷德布里奇"),
    ("richmond-upon-thames", "泰晤士河畔里士满"), ("southwark", "萨瑟克"), ("sutton", "萨顿"),
    ("tower-hamlets", "陶尔哈姆莱茨"), ("waltham-forest", "沃尔瑟姆福雷斯特"),
    ("wandsworth", "旺兹沃思"), ("westminster", "威斯敏斯特"),
)
HDB_ID = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc"


def housing_text(url, referer):
    raw = fetch_bytes(
        url,
        referer=referer,
        ttl=60 * 60 * 6,
        headers={"User-Agent": MOBILE_UA, "Accept-Language": "zh-CN,zh;q=0.9"},
    )
    if b"authcodeForm" in raw[:4000]:
        with CACHE_LOCK:
            CACHE.pop(url, None)
        return ""
    return raw.decode("utf-8", "replace")


def housing_month(text):
    found = re.search(r"（(\d{4})年(\d{1,2})月挂牌）", text or "")
    if not found:
        return ""
    return f"{found.group(1)}-{int(found.group(2)):02d}"


def housing_sqm(text):
    found = re.search(
        r"平均房价<span[^>]*>（\d{4}年\d{1,2}月挂牌）</span></p>\s*<div class=\"fl\">\s*<span[^>]*>\s*([0-9,]+)\s*</span>\s*元/㎡",
        text or "",
    )
    if not found:
        return None
    return num(found.group(1).replace(",", ""))


def housing_mom(text):
    found = re.search(r"环比：<em[^>]*>\s*([^<]+)", text or "")
    if not found:
        return ""
    return re.sub(r"\s+", "", found.group(1))[:16]


def cn_cities():
    text = housing_text("https://m.creprice.cn/", "https://m.creprice.cn/")
    items = []
    seen = set()
    for code, name in re.findall(r'href="/city/([a-z0-9]+)\.html"[^>]*>([^<]{1,8})</a>', text):
        name = re.sub(r"\s+", "", name)
        if code in seen or not re.search(r"[\u4e00-\u9fff]", name) or len(name) > 6:
            continue
        seen.add(code)
        items.append({"id": code, "name": name, "next": "district"})
    return items


def cn_city(city):
    if not re.fullmatch(r"[a-z0-9]{1,12}", city or ""):
        return None
    text = housing_text(f"https://m.creprice.cn/city/{city}.html", "https://m.creprice.cn/")
    if not text:
        return None
    heading = re.search(r"<h1[^>]*>\s*([^<]{1,8})房价", text)
    city_name = heading.group(1).strip() if heading else city
    districts = []
    seen = set()
    for code, name in re.findall(rf'href="/district/([A-Za-z0-9]+)\.html\?city={re.escape(city)}"[^>]*>([^<]+)</a>', text):
        name = re.sub(r"\s+", "", name)
        if code in seen or not name:
            continue
        seen.add(code)
        districts.append({"id": code, "name": name, "next": "place"})
    return {
        "name": city_name,
        "price": housing_sqm(text),
        "asOf": housing_month(text),
        "mom": housing_mom(text),
        "items": districts,
    }


def cn_district(city, district):
    if not re.fullmatch(r"[A-Za-z0-9]{1,16}", city or "") or not re.fullmatch(r"[A-Za-z0-9]{1,16}", district or ""):
        return None
    text = housing_text(
        f"https://m.creprice.cn/district/{district}.html?city={city}",
        f"https://m.creprice.cn/city/{city}.html",
    )
    if not text:
        return None
    title = re.search(r"<title>([^_<]+)", text)
    district_name = re.sub(r"最新房价$", "", re.sub(r"\s+", "", title.group(1))) if title else district
    places = []
    seen = set()
    for code, name, price in re.findall(
        r'href="/community/([A-Za-z0-9]+)\.html\?city=[A-Za-z0-9]+"[^>]*>([^<]+)</a>[\s\S]{0,220}?<span class="(?:green|red)">\s*([0-9,]+)\s*</span>',
        text,
    ):
        if code in seen:
            continue
        seen.add(code)
        px = num(price.replace(",", ""))
        if not px:
            continue
        places.append({
            "id": code,
            "name": re.sub(r"\s+", "", name),
            "price": px,
            "unit": "sqm",
            "currency": "CNY",
            "basis": "sqm",
            "next": "quote",
        })
    return {
        "name": district_name,
        "price": housing_sqm(text),
        "asOf": housing_month(text),
        "mom": housing_mom(text),
        "items": places[:6],
    }


def hdb_rows(filters):
    rows = []
    offset = 0
    while offset < 800:
        url = "https://data.gov.sg/api/action/datastore_search?" + urllib.parse.urlencode({
            "resource_id": HDB_ID,
            "limit": 100,
            "offset": offset,
            "filters": json.dumps(filters, ensure_ascii=False),
            "fields": "month,town,street_name,resale_price,floor_area_sqm",
        })
        try:
            payload = json.loads(fetch_bytes(url, referer="https://data.gov.sg/", ttl=60 * 60 * 6).decode())
        except Exception:
            break
        batch = ((payload.get("result") or {}).get("records") or [])
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < 100:
            break
        offset += 100
    return rows


def hdb_latest_month(town=None):
    filters = {"town": town} if town else {}
    url = "https://data.gov.sg/api/action/datastore_search?" + urllib.parse.urlencode({
        "resource_id": HDB_ID,
        "limit": 1,
        "sort": "month desc",
        "fields": "month",
        **({"filters": json.dumps(filters)} if filters else {}),
    })
    payload = json.loads(fetch_bytes(url, referer="https://data.gov.sg/", ttl=60 * 60 * 6).decode())
    records = (payload.get("result") or {}).get("records") or []
    if not records:
        return ""
    return str(records[0].get("month") or "")[:7]


def median(values):
    vals = sorted(v for v in values if v and v > 0)
    if not vals:
        return None
    mid = len(vals) // 2
    if len(vals) % 2:
        return vals[mid]
    return (vals[mid - 1] + vals[mid]) / 2


def sg_streets(town):
    month = hdb_latest_month(town)
    if not month:
        return [], ""
    grouped = {}
    for row in hdb_rows({"town": town, "month": month}):
        street = str(row.get("street_name") or "").strip()
        price = num(row.get("resale_price"))
        area = num(row.get("floor_area_sqm"))
        if not street or not price:
            continue
        bucket = grouped.setdefault(street, {"prices": [], "sqm": []})
        bucket["prices"].append(price)
        if area:
            bucket["sqm"].append(price / area)
    items = []
    for street, bucket in grouped.items():
        px = median(bucket["prices"])
        per = median(bucket["sqm"])
        if not px:
            continue
        items.append({
            "id": street,
            "name": street,
            "price": round(px),
            "unit": "dwelling",
            "basis": "dwelling",
            "currency": "SGD",
            "sqm": round(per) if per else None,
            "count": len(bucket["prices"]),
            "next": "quote",
        })
    items.sort(key=lambda item: (-item["count"], item["name"]))
    return items[:6], month


def uk_quote(slug):
    if not re.fullmatch(r"[a-z0-9-]{2,40}", slug or ""):
        return None
    listing = json.loads(fetch_bytes(
        f"https://landregistry.data.gov.uk/data/ukhpi/region/{slug}.json?_pageSize=1",
        referer="https://landregistry.data.gov.uk/",
        ttl=WEEK,
    ).decode())
    items = (listing.get("result") or {}).get("items") or []
    if not items or not isinstance(items[0], str):
        return None
    month = items[0].rstrip("/").split("/")[-1]
    if not re.fullmatch(r"\d{4}-\d{2}", month):
        return None
    detail = json.loads(fetch_bytes(
        f"https://landregistry.data.gov.uk/data/ukhpi/region/{slug}/month/{month}.json",
        referer="https://landregistry.data.gov.uk/",
        ttl=WEEK,
    ).decode())
    topic = (detail.get("result") or {}).get("primaryTopic") or {}
    price = num(topic.get("averagePrice"))
    if not price:
        return None
    return {"price": round(price), "asOf": month, "currency": "GBP", "unit": "dwelling", "basis": "dwelling"}


XLSX_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
AU_CITIES = (
    ("sydney", "悉尼", "Sydney", True),
    ("melbourne", "墨尔本", "Melbourne", False),
    ("brisbane", "布里斯班", "Brisbane", False),
    ("adelaide", "阿德莱德", "Adelaide", False),
    ("perth", "珀斯", "Perth", False),
    ("hobart", "霍巴特", "Hobart", False),
    ("darwin", "达尔文", "Darwin", False),
    ("canberra", "堪培拉", "Canberra", False),
)
SYDNEY_ZH = {
    "Bayside": "贝赛德", "Blacktown": "黑镇", "Blue Mountains": "蓝山", "Burwood": "伯伍德",
    "Camden": "卡姆登", "Campbelltown": "坎贝尔敦", "Canada Bay": "加拿大湾",
    "Canterbury-Bankstown": "坎特伯雷-班克斯敦", "Cumberland": "坎伯兰", "Fairfield": "费尔菲尔德",
    "Georges River": "乔治河", "Hawkesbury": "霍克斯伯里", "Hornsby": "霍恩斯比",
    "Hunters Hill": "猎人山", "Inner West": "内西区", "Ku-ring-gai": "库林盖",
    "Lane Cove": "连恩湾", "Liverpool": "利物浦", "Mosman": "莫斯曼", "North Sydney": "北悉尼",
    "Northern Beaches": "北滩", "Parramatta": "帕拉马塔", "Penrith": "彭里斯",
    "Randwick": "兰德威克", "Ryde": "赖德", "Strathfield": "斯特拉斯菲尔德",
    "Sutherland": "萨瑟兰", "Sutherland Shire": "萨瑟兰", "Sydney": "悉尼市",
    "The Hills": "希尔斯", "The Hills Shire": "希尔斯", "Waverley": "韦弗利",
    "Willoughby": "威洛比", "Woollahra": "伍拉勒", "Ku-Ring-Gai": "库林盖",
    "Central Coast": "中央海岸", "Wollondilly": "伍伦迪利",
}
HK_REGIONS = (
    ("hk", "香港岛", "Hong Kong Island", "Class B Hong Kong"),
    ("kln", "九龙", "Kowloon", "Class B Kowloon"),
    ("nt", "新界", "New Territories", "Class B New Territories"),
)


def xlsx_col(ref):
    letters = "".join(ch for ch in ref if ch.isalpha())
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def xlsx_rows(data, sheet_name):
    book = zipfile.ZipFile(io.BytesIO(data))
    shared = []
    if "xl/sharedStrings.xml" in book.namelist():
        root = ET.fromstring(book.read("xl/sharedStrings.xml"))
        for si in root.findall("m:si", XLSX_NS):
            shared.append("".join(node.text or "" for node in si.iter("{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t")))
    workbook = ET.fromstring(book.read("xl/workbook.xml"))
    rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    targets = {}
    for rel in rels:
        targets[rel.attrib.get("Id")] = rel.attrib.get("Target")
    path = ""
    for sheet in workbook.findall("m:sheets/m:sheet", XLSX_NS):
        if sheet.attrib.get("name") != sheet_name:
            continue
        rid = sheet.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
        target = targets.get(rid) or ""
        path = target if target.startswith("xl/") else "xl/" + target.lstrip("/")
        break
    if not path or path not in book.namelist():
        return []
    root = ET.fromstring(book.read(path))
    rows = []
    for row in root.findall("m:sheetData/m:row", XLSX_NS):
        vals = {}
        for cell in row.findall("m:c", XLSX_NS):
            value = cell.find("m:v", XLSX_NS)
            if value is None or value.text is None:
                continue
            text = shared[int(value.text)] if cell.attrib.get("t") == "s" else value.text
            vals[xlsx_col(cell.attrib.get("r", ""))] = text
        if not vals:
            continue
        width = max(vals) + 1
        rows.append([vals.get(i, "") for i in range(width)])
    return rows


def excel_day(serial):
    try:
        days = int(float(serial))
    except (TypeError, ValueError):
        return ""
    try:
        return (datetime.date(1899, 12, 30) + datetime.timedelta(days=days)).isoformat()
    except OverflowError:
        return ""


def thousands(text):
    raw = str(text or "").replace(",", "").strip()
    if not re.fullmatch(r"\d+(?:\.\d+)?", raw):
        return None
    return float(raw) * 1000


def slug_id(name):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", str(name or "").lower())).strip("-")[:40]


def abs_cities():
    page = "https://www.abs.gov.au/statistics/economy/price-indexes-and-inflation/total-value-dwellings/latest-release"
    html = fetch_bytes(page, referer=page, ttl=WEEK).decode("utf-8", "replace")
    found = re.search(r'href="([^"]*643202\.xlsx)"', html)
    if not found:
        return {}
    url = urllib.parse.urljoin(page, found.group(1))
    rows = xlsx_rows(fetch_bytes(url, referer=page, ttl=WEEK), "Data1")
    if not rows:
        return {}
    columns = {}
    for index, cell in enumerate(rows[0]):
        if "Median Price of Established House Transfers" not in cell or "Rest of" in cell:
            continue
        parts = [part.strip(" ;") for part in cell.split(";")]
        city = parts[1] if len(parts) > 1 else ""
        if city:
            columns[city] = index
    series = []
    for row in rows[1:]:
        if not row or not re.fullmatch(r"\d{4,6}", str(row[0]).split(".", 1)[0]):
            continue
        series.append(row)
    if not series:
        return {}
    latest = series[-1]
    prev = series[-2] if len(series) > 1 else None
    as_of = excel_day(latest[0])
    out = {}
    for city, index in columns.items():
        price = thousands(latest[index] if index < len(latest) else "")
        if not price:
            continue
        before = thousands(prev[index]) if prev and index < len(prev) else None
        out[city] = {"price": round(price), "prev": round(before) if before else None, "asOf": as_of}
    return out


def sydney_districts():
    page = "https://dcj.nsw.gov.au/about-us/families-and-communities-statistics/housing-rent-and-sales/rent-and-sales-report.html"
    html = fetch_bytes(page, referer=page, ttl=WEEK).decode("utf-8", "replace")
    found = re.search(r'href="([^"]*sales-tables-[^"]+\.xlsx)"', html)
    if not found:
        return [], ""
    url = urllib.parse.urljoin("https://dcj.nsw.gov.au/", found.group(1))
    rows = xlsx_rows(fetch_bytes(url, referer=page, ttl=WEEK), "LGA")
    header = next((row for row in rows if any("Mean Sales Price" in str(cell) for cell in row)), None)
    if not header:
        return [], ""
    def col(label):
        for index, cell in enumerate(header):
            if label in str(cell):
                return index
        return -1
    area_at = col("Local Government Area")
    sydney_at = col("Greater Sydney")
    ring_at = col("Rings")
    kind_at = col("DwellingType")
    mean_at = col("Mean Sales Price")
    if min(area_at, sydney_at, ring_at, kind_at, mean_at) < 0:
        return [], ""
    period = ""
    for row in rows:
        text = " ".join(row)
        found_period = re.search(r"Reporting period:\s*([A-Za-z]+)\s*-\s*([A-Za-z]+)\s*(\d{4})", text)
        if found_period:
            months = {"january": "01", "march": "03", "april": "04", "june": "06", "july": "07", "september": "09", "october": "10", "december": "12"}
            period = f"{found_period.group(3)}-{months.get(found_period.group(2).lower(), '')}"
            break
    items = []
    for row in rows:
        if len(row) <= mean_at:
            continue
        if row[0] != "Total" or row[sydney_at] != "Greater Sydney" or row[ring_at] != "Total" or row[kind_at] != "Total":
            continue
        name = str(row[area_at]).strip()
        if not name or name == "Total":
            continue
        price = thousands(row[mean_at])
        if not price:
            continue
        item_id = slug_id(name)
        if any(item["id"] == item_id for item in items):
            continue
        items.append({
            "id": slug_id(name),
            "name": SYDNEY_ZH.get(name, name),
            "nameEn": name,
            "price": round(price),
            "unit": "dwelling",
            "basis": "dwelling",
            "currency": "AUD",
            "next": "quote",
        })
    items.sort(key=lambda item: item["nameEn"])
    return items, period


def hk_series():
    raw = fetch_bytes("http://www.rvd.gov.hk/datagovhk/1.2M.csv", referer="https://data.gov.hk/", ttl=WEEK)
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8", "replace"))))
    if len(rows) < 3:
        return [], {}
    header = rows[1]
    indexes = {name: index for index, name in enumerate(header)}
    data = [row for row in rows[2:] if row and re.fullmatch(r"\d{2}-\d{4}", row[0])]
    return data, indexes


def hk_region_quote(region):
    meta = next((item for item in HK_REGIONS if item[0] == region), None)
    if not meta:
        return None
    data, indexes = hk_series()
    column = indexes.get(meta[3])
    if column is None:
        return None
    picked = []
    for row in data:
        if column >= len(row):
            continue
        price = num(str(row[column]).replace(",", ""))
        if price:
            month, year = row[0].split("-")
            picked.append((f"{year}-{month}", price))
    if not picked:
        return None
    as_of, price = picked[-1]
    prev = picked[-2][1] if len(picked) > 1 else None
    return {
        "id": meta[0],
        "name": meta[1],
        "nameEn": meta[2],
        "price": round(price),
        "prev": round(prev) if prev else None,
        "asOf": as_of,
        "currency": "HKD",
        "unit": "sqm",
        "basis": "sqm",
        "source": "香港差饷物业估价署",
        "ref": f"hs:HK:{meta[0]}",
    }


def roc_day(text):
    digits = re.sub(r"\D", "", str(text or ""))
    if len(digits) == 7:
        year, month, day = int(digits[:3]) + 1911, int(digits[3:5]), int(digits[5:])
    elif len(digits) == 8:
        year, month, day = int(digits[:4]), int(digits[4:6]), int(digits[6:])
    else:
        return ""
    try:
        return datetime.date(year, month, day).isoformat()
    except ValueError:
        return ""


def tw_quote():
    raw = fetch_bytes(
        "https://plvr.land.moi.gov.tw/Download?type=zip&fileName=lvr_landcsv.zip",
        ctx=TW_CTX,
        referer="https://data.gov.tw/dataset/77051",
        ttl=WEEK,
    )
    book = zipfile.ZipFile(io.BytesIO(raw))
    prices = []
    latest = ""
    for name in book.namelist():
        if not re.fullmatch(r"[a-z]_lvr_land_a\.csv", name):
            continue
        rows = list(csv.reader(io.StringIO(book.read(name).decode("utf-8-sig"))))
        if len(rows) < 2:
            continue
        header = {cell: index for index, cell in enumerate(rows[0])}
        needed = ("交易標的", "建物型態", "建物移轉總面積平方公尺", "總價元", "交易年月日")
        if any(key not in header for key in needed):
            continue
        start = 2 if rows[1] and rows[1][0] and all(ord(ch) < 128 for ch in rows[1][0]) else 1
        for row in rows[start:]:
            if len(row) <= header["總價元"]:
                continue
            if "房地" not in row[header["交易標的"]] or "店面" in row[header["建物型態"]]:
                continue
            area = num(str(row[header["建物移轉總面積平方公尺"]]).replace(",", ""))
            total = num(str(row[header["總價元"]]).replace(",", ""))
            if not area or area < 1 or not total or total <= 0:
                continue
            prices.append(total)
            day = roc_day(row[header["交易年月日"]])
            if day > latest:
                latest = day
    if not prices:
        return None
    return {
        "id": "tw",
        "name": "台湾",
        "nameEn": "Taiwan",
        "price": round(sum(prices) / len(prices)),
        "asOf": latest,
        "currency": "TWD",
        "unit": "dwelling",
        "basis": "dwelling",
        "count": len(prices),
        "source": "内政部不动产交易实价",
        "ref": "hs:TW",
    }


def us_quote():
    raw = fetch_bytes(
        "https://redfin-public-data.s3.us-west-2.amazonaws.com/redfin_market_tracker/us_national_market_tracker.tsv000.gz",
        referer="https://www.redfin.com/",
        ttl=WEEK,
    )
    rows = csv.DictReader(io.StringIO(gzip.decompress(raw).decode("utf-8", "replace")), delimiter="\t")
    picked = []
    for row in rows:
        if (row.get("PROPERTY_TYPE") or "").strip() != "All Residential":
            continue
        if (row.get("REGION") or "").strip() != "National":
            continue
        if (row.get("IS_SEASONALLY_ADJUSTED") or "").strip() != "false":
            continue
        price = num(row.get("MEDIAN_SALE_PRICE"))
        period = (row.get("PERIOD_END") or "").strip()
        if price and re.fullmatch(r"\d{4}-\d{2}-\d{2}", period):
            picked.append((period, price))
    if not picked:
        return None
    picked.sort()
    as_of, price = picked[-1]
    prev = picked[-2][1] if len(picked) > 1 else None
    return {
        "id": "us",
        "name": "美国",
        "nameEn": "United States",
        "price": round(price),
        "prev": round(prev) if prev else None,
        "asOf": as_of,
        "currency": "USD",
        "unit": "dwelling",
        "basis": "dwelling",
        "source": "Redfin",
        "ref": "hs:US",
    }


def housing_payload(country, region, district, place, query):
    country = (country or "").upper()
    note = ""
    source = ""
    parent = None
    items = []
    quote = None
    if country == "CN":
        source = "中国房价行情"
        if place and region and district:
            board = cn_district(region, district) or {}
            hit = next((item for item in board.get("items") or [] if item["id"] == place), None)
            if hit:
                quote = {
                    **hit,
                    "asOf": board.get("asOf") or "",
                    "mom": board.get("mom") or "",
                    "source": source,
                    "ref": f"hs:CN:{region}:{district}:{place}"[:160],
                }
        elif district and region:
            board = cn_district(region, district) or {}
            parent = {
                "name": board.get("name") or district,
                "price": board.get("price"),
                "unit": "sqm",
                "basis": "sqm",
                "currency": "CNY",
                "asOf": board.get("asOf") or "",
                "mom": board.get("mom") or "",
            }
            items = board.get("items") or []
        elif region:
            board = cn_city(region) or {}
            parent = {
                "name": board.get("name") or region,
                "price": board.get("price"),
                "unit": "sqm",
                "basis": "sqm",
                "currency": "CNY",
                "asOf": board.get("asOf") or "",
                "mom": board.get("mom") or "",
            }
            items = board.get("items") or []
        else:
            items = cn_cities()
    elif country == "SG":
        source = "新加坡建屋发展局"
        note = "组屋转售成交登记。按镇再按街道，价格是最近一个月成交价的中位数。"
        if place and region:
            streets, month = sg_streets(region)
            hit = next((item for item in streets if item["id"] == place), None)
            if hit:
                quote = {**hit, "asOf": month, "source": source, "ref": f"hs:SG:{region}:{place}"[:160]}
        elif region:
            streets, month = sg_streets(region)
            town = next((zh for code, zh in HDB_TOWNS if code == region), region)
            parent = {"name": town, "asOf": month, "currency": "SGD"}
            items = streets
        else:
            items = [{"id": code, "name": zh, "next": "place"} for code, zh in HDB_TOWNS]
    elif country == "UK":
        source = "英国土地注册处"
        note = "平均成交价，按月公布。这里每周核对一次。"
        slug = district or region
        if slug and slug != "united-kingdom":
            got = uk_quote(slug)
            name = next((zh for code, zh in LONDON_BOROUGHS if code == slug), None)
            if name is None:
                name = next((zh for code, zh, _deeper in UK_REGIONS if code == slug), slug)
            if got:
                quote = {**got, "id": slug, "name": name, "source": source, "ref": f"hs:UK:{region}:{district}".strip(":")[:160] if district else f"hs:UK:{slug}"}
        else:
            got = uk_quote("united-kingdom")
            if got:
                quote = {**got, "id": "united-kingdom", "name": "英国", "nameEn": "United Kingdom", "source": source, "ref": "hs:UK"}
    elif country == "AU":
        source = "澳大利亚统计局"
        note = "独立屋成交价中位数。悉尼可以再选区，用的是该区平均成交价。墨尔本各区的成交表没取到。每周核对一次。"
        cities = abs_cities()
        picked = district or place
        if region == "sydney" and not picked:
            areas, period = sydney_districts()
            board = cities.get("Sydney") or {}
            parent = {"name": "悉尼", "nameEn": "Sydney", "price": board.get("price"), "prev": board.get("prev"), "asOf": board.get("asOf") or "", "currency": "AUD", "unit": "dwelling", "basis": "dwelling"}
            items = areas
            source = "新南威尔士社区司法厅"
            note = "这一区的平均成交价。" + (f"统计期 {period}。" if period else "") + "每周核对一次。"
        elif region == "sydney" and picked:
            areas, period = sydney_districts()
            hit = next((item for item in areas if item["id"] == picked), None)
            if hit:
                quote = {**hit, "asOf": period, "source": "新南威尔士社区司法厅", "ref": f"hs:AU:sydney:{hit['id']}"}
                note = "平均成交价。每周核对一次。"
        elif picked or region:
            city_id = picked or region
            meta = next((item for item in AU_CITIES if item[0] == city_id), None)
            board = cities.get(meta[2]) if meta else None
            if meta and board:
                quote = {
                    "id": meta[0], "name": meta[1], "nameEn": meta[2],
                    "price": board["price"], "prev": board.get("prev"), "asOf": board.get("asOf") or "",
                    "currency": "AUD", "unit": "dwelling", "basis": "dwelling",
                    "source": source, "ref": f"hs:AU:{meta[0]}",
                }
        else:
            items = []
            for code, zh, en, deeper in AU_CITIES:
                board = cities.get(en) or {}
                items.append({
                    "id": code, "name": zh, "nameEn": en,
                    "price": board.get("price"), "prev": board.get("prev"),
                    "currency": "AUD", "unit": "dwelling", "basis": "dwelling",
                    "next": "district" if deeper else "quote",
                })
    elif country == "HK":
        source = "香港差饷物业估价署"
        note = "没有全港一个总数。下面是 B 类私人住宅（约 40–69.9 平方米）的平均楼价，港元/平方米。每周核对一次。"
        key = district or place or region
        if key:
            found = hk_region_quote(key)
            if found:
                quote = found
                note = "B 类私人住宅平均楼价，约 40–69.9 平方米。每周核对一次。"
        else:
            items = []
            for code, zh, en, _col in HK_REGIONS:
                found = hk_region_quote(code) or {}
                items.append({
                    "id": code, "name": zh, "nameEn": en, "price": found.get("price"),
                    "currency": "HKD", "unit": "sqm", "basis": "sqm", "next": "quote",
                })
    elif country == "TW":
        source = "内政部不动产交易实价"
        note = "本期公布的房地买卖平均总价，不含店面。不是每坪单价。每周核对一次。"
        found = tw_quote()
        if found:
            quote = found
            if found.get("count"):
                note = f"本期 {found['count']} 笔房地买卖的平均总价，不含店面。每周核对一次。"
    elif country == "US":
        source = "Redfin"
        note = "全美住宅成交价中位数，按月公布。这里每周核对一次。"
        found = us_quote()
        if found:
            quote = found
    else:
        return {"error": "country", "items": []}
    if query and country != "CN":
        needle = query.strip().lower()
        items = [item for item in items if needle in f"{item.get('name','')} {item.get('id','')}".lower()]
    level = "quote" if quote else ("place" if district or (country == "SG" and region) else ("district" if region else "region"))
    return {
        "level": level,
        "source": source,
        "note": note,
        "parent": parent,
        "items": items,
        "quote": quote,
    }


def load_suggest(q):
    url = "https://suggest3.sinajs.cn/suggest/type=&key=" + urllib.parse.quote(q) + "&name=suggestdata"
    try:
        return fetch_bytes(url).decode("gbk", "replace")
    except Exception:
        return ""


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/search":
            self.serve_search(urllib.parse.parse_qs(parsed.query))
            return
        if parsed.path == "/api/quote":
            self.serve_quote(urllib.parse.parse_qs(parsed.query))
            return
        if parsed.path == "/api/fx":
            self.serve_fx()
            return
        if parsed.path == "/api/deposits":
            self.serve_deposits()
            return
        if parsed.path == "/api/markets":
            self.serve_markets()
            return
        if parsed.path == "/api/series":
            self.serve_series(urllib.parse.parse_qs(parsed.query))
            return
        if parsed.path == "/api/housing":
            self.serve_housing(urllib.parse.parse_qs(parsed.query))
            return
        if parsed.path == "/api/coins":
            self.serve_coins(urllib.parse.parse_qs(parsed.query))
            return
        super().do_GET()

    def send_json(self, payload, status=200):
        raw = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def serve_search(self, qs):
        q = (qs.get("q") or [""])[0].strip()[:80]
        market = (qs.get("market") or ["all"])[0].strip()
        if market not in ("equity", "fund", "pension", "all"):
            market = "all"
        if len(q) < 1:
            self.send_json({"hits": []})
            return
        want_funds = market in ("fund", "pension", "all")
        with ThreadPoolExecutor(max_workers=2) as pool:
            sina_job = pool.submit(load_suggest, q)
            fund_job = pool.submit(em_funds, q) if want_funds else None
            text = sina_job.result()
            fund_hits = fund_job.result() if fund_job else []
        body = text.split('"', 1)[-1].rsplit('"', 1)[0] if '"' in text else ""
        hits = []
        seen = set()
        for row in body.split(";"):
            parts = row.split(",")
            if len(parts) < 4:
                continue
            kind = parts[1]
            symbol = quote_symbol(kind, parts[2], parts[3])
            if not symbol or symbol in seen:
                continue
            if kind in STOCK_KINDS or (kind == "203" and symbol.startswith(("sh", "sz"))):
                if market == "fund" or market == "pension":
                    if kind not in FUND_KINDS:
                        continue
                class_id = "fund" if kind in FUND_KINDS else "equity"
            elif kind in FUND_KINDS or symbol.startswith("of"):
                if market == "equity":
                    continue
                class_id = "fund"
            else:
                continue
            if market == "equity" and class_id != "equity":
                continue
            seen.add(symbol)
            exchange, _currency = market_of(symbol)
            if class_id == "fund" and not exchange:
                exchange = "基金"
            hits.append({
                "symbol": symbol,
                "ticker": ticker_of(symbol),
                "name": parts[0] or ticker_of(symbol),
                "exchange": exchange,
                "kind": "基金" if class_id == "fund" else "股票",
                "classId": "pension" if market == "pension" else class_id,
            })
        if want_funds:
            for extra in fund_hits:
                if extra["symbol"] in seen:
                    continue
                seen.add(extra["symbol"])
                if market == "pension":
                    extra = {**extra, "classId": "pension"}
                hits.append(extra)
        by_code = {}
        for hit in hits:
            code = "".join(ch for ch in hit["ticker"] if ch.isdigit())
            key = code[-6:] if len(code) >= 6 else hit["symbol"]
            prev = by_code.get(key)
            if prev and prev["symbol"].startswith(("sh", "sz", "hk", "gb_")) and hit["symbol"].startswith("of"):
                continue
            if prev and hit["symbol"].startswith(("sh", "sz")) and prev["symbol"].startswith("of"):
                by_code[key] = hit
                continue
            if key not in by_code:
                by_code[key] = hit
        compact = list(by_code.values())[:20]
        if not compact and not text and market == "equity":
            self.send_json({"hits": [], "error": "search"}, 502)
            return
        self.send_json({"hits": compact})

    def serve_quote(self, qs):
        symbol = (qs.get("symbol") or [""])[0].strip()[:40]
        if not symbol:
            self.send_json({"error": "symbol"}, 400)
            return
        if symbol.startswith("of") and re.fullmatch(r"of\d{6}", symbol):
            parsed = fund_quote(symbol[2:])
            if not parsed:
                self.send_json({"error": "quote"}, 502)
                return
            self.send_json(parsed)
            return
        if not symbol.startswith(("gb_", "hk", "sh", "sz")):
            self.send_json({"error": "symbol"}, 400)
            return
        try:
            raw = fetch_bytes("https://hq.sinajs.cn/list=" + urllib.parse.quote(symbol), ttl=15)
            parsed = parse_quote(symbol, raw.decode("gbk", "replace"))
        except Exception:
            parsed = None
        if not parsed:
            self.send_json({"error": "quote"}, 502)
            return
        points = [] if (qs.get("live") or [""])[0] == "1" else history_points(symbol)
        self.send_json({
            "symbol": symbol,
            "ticker": ticker_of(symbol),
            "name": parsed["name"],
            "exchange": parsed["exchange"],
            "currency": parsed["currency"],
            "price": round(parsed["price"], 4),
            "prev": round(parsed["prev"], 4),
            "points": points,
            "source": "新浪财经",
        })

    def serve_deposits(self):
        banks = {}
        jobs = (
            fetch_icbc_board,
            fetch_cmb_board,
            lambda: fetch_html_board("ABC", "中国农业银行", "https://www.abchina.com/cn/PersonalServices/Quotation/bwbll/"),
            fetch_boc_board,
            lambda: fetch_html_board("CCB", "中国建设银行", "https://www.ccb.com/chn/2025-05/19/article_2025051919535715176.shtml", ICBC_CTX),
            lambda: fetch_html_board("PSBC", "中国邮政储蓄银行", "https://www.psbc.com/cn/gyyc/zygg/202505/t20250519_331570.html"),
            lambda: fetch_html_board("Bank of Communications", "交通银行", "https://www.bankcomm.com/BankCommSite/shtml/jyjr/cn/7158/7825/5063992.shtml", ICBC_CTX),
            lambda: fetch_html_board("Ping An Bank", "平安银行", "https://bank.pingan.com/geren/cunkuanlilv/index.shtml"),
            lambda: fetch_html_board("SPD Bank", "浦发银行", "https://per.spdb.com.cn/rate_query/201511/t20151119_23933.shtml", ICBC_CTX),
            fetch_cib_board,
            fetch_hsbc_hk_board,
        )

        def run(job):
            try:
                return job()
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=6) as pool:
            for item in pool.map(run, jobs):
                if item:
                    banks[item[0]] = item[1]
        if not banks:
            self.send_json({"error": "deposits"}, 502)
            return
        self.send_json({"banks": banks})

    def serve_housing(self, qs):
        ref = (qs.get("ref") or [""])[0].strip()[:160]
        if ref.startswith("hs:"):
            parts = ref.split(":")
            country = parts[1] if len(parts) > 1 else ""
            region = parts[2] if len(parts) > 2 else ""
            try:
                if country == "UK":
                    slug = parts[3] if len(parts) > 3 else region
                    got = uk_quote(slug)
                    payload = {"quote": {**(got or {}), "source": "英国土地注册处", "ref": ref}} if got else None
                else:
                    district = parts[3] if len(parts) > 3 else ""
                    place = ":".join(parts[4:]) if len(parts) > 4 else (parts[3] if country == "SG" and len(parts) > 3 else "")
                    if country == "SG":
                        district = ""
                        place = ":".join(parts[3:])
                    payload = housing_payload(country, region, district, place, "")
            except Exception:
                payload = None
            quote = (payload or {}).get("quote")
            if not quote or not quote.get("price"):
                self.send_json({"error": "housing"}, 502)
                return
            self.send_json(payload)
            return
        country = (qs.get("country") or [""])[0].strip()[:8]
        region = (qs.get("region") or [""])[0].strip()[:40]
        district = (qs.get("district") or [""])[0].strip()[:40]
        place = (qs.get("place") or [""])[0].strip()[:80]
        query = (qs.get("q") or [""])[0].strip()[:20]
        try:
            payload = housing_payload(country, region, district, place, query)
        except Exception:
            payload = None
        if not payload or (not payload.get("items") and not payload.get("quote") and not (payload.get("parent") or {}).get("price")):
            self.send_json({"error": "housing", "items": []}, 502)
            return
        self.send_json(payload)

    def serve_series(self, qs):
        symbol = (qs.get("symbol") or [""])[0].strip().upper()[:12]
        rng = (qs.get("range") or ["1d"])[0]
        if rng not in CRYPTO_RANGE:
            rng = "1d"
        if not re.fullmatch(r"[A-Z0-9]{2,12}", symbol):
            self.send_json({"error": "symbol"}, 400)
            return
        try:
            payload = build_series(symbol, rng)
        except Exception:
            payload = None
        if not payload or not payload.get("price"):
            self.send_json({"error": "quote"}, 502)
            return
        self.send_json(payload)

    def serve_coins(self, qs):
        q = (qs.get("q") or [""])[0].strip()[:40]
        if len(q) < 1:
            self.send_json({"hits": []})
            return
        aliases = {
            "比特币": "BTC", "比特": "BTC", "bitcoin": "BTC", "btc": "BTC",
            "以太坊": "ETH", "以太": "ETH", "ethereum": "ETH", "eth": "ETH",
            "索拉纳": "SOL", "solana": "SOL", "sol": "SOL",
            "狗狗币": "DOGE", "狗狗": "DOGE", "dogecoin": "DOGE", "doge": "DOGE",
            "瑞波": "XRP", "ripple": "XRP", "xrp": "XRP",
            "艾达": "ADA", "cardano": "ADA", "ada": "ADA",
            "币安币": "BNB", "bnb": "BNB",
            "莱特币": "LTC", "litecoin": "LTC", "ltc": "LTC",
            "比特币现金": "BCH", "bch": "BCH",
            "雪崩": "AVAX", "avalanche": "AVAX", "avax": "AVAX",
            "波卡": "DOT", "polkadot": "DOT", "dot": "DOT",
            "柴犬": "SHIB", "shib": "SHIB",
            "链环": "LINK", "chainlink": "LINK", "link": "LINK",
        }
        needles = {q.upper()}
        folded = q.lower()
        for label, symbol in aliases.items():
            if folded == label.lower() or (len(folded) >= 2 and label.lower().startswith(folded)):
                needles.add(symbol)
        try:
            catalog = coin_catalog()
        except Exception:
            self.send_json({"hits": [], "error": "search"}, 502)
            return
        hits = []
        for row in catalog:
            blob = f"{row['symbol']} {row['name']}".upper()
            if not any(needle in blob or needle in row["symbol"] for needle in needles):
                continue
            sym = row["symbol"]
            labels = [label.lower() for label, symbol in aliases.items() if symbol == sym]
            labels.append(sym.lower())
            if folded in labels:
                rank = (0, 0)
            else:
                prefixes = [label for label in labels if len(folded) >= 2 and label.startswith(folded)]
                rank = (1, min((len(label) for label in prefixes), default=99)) if prefixes else (2, 99)
            shown = dict(row)
            if shown.get("name", "").endswith("-USD"):
                shown["name"] = sym
            hits.append((rank, sym, shown))
        hits.sort(key=lambda item: (item[0], item[1]))
        self.send_json({"hits": [item[2] for item in hits[:20]]})

    def serve_markets(self):
        payload = {"spots": {}}

        def coinbase(pair, key):
            quote = coinbase_ticker(pair)
            if not quote:
                return
            row = {
                "price": quote["price"],
                "currency": "USD",
                "source": "Coinbase",
                "asOf": str(quote.get("asOf") or "")[:10],
                "move": "24h",
            }
            if quote.get("prev") and quote["prev"] > 0:
                row["prev"] = quote["prev"]
            payload["spots"][key] = row

        def comex(symbol, key):
            raw = fetch_bytes("https://hq.sinajs.cn/list=" + symbol, referer="https://finance.sina.com.cn")
            body = raw.decode("gbk", "replace").split('"', 1)[-1].rsplit('"', 1)[0]
            parts = body.split(",")
            price = num(parts[0]) if parts else None
            prev = num(parts[7]) if len(parts) > 7 else None
            as_of = parts[12][:10] if len(parts) > 12 and re.match(r"20\d{2}-\d{2}-\d{2}", parts[12]) else ""
            if price is None or price <= 0:
                return
            row = {"price": price, "currency": "USD", "unit": "oz", "source": "COMEX", "asOf": as_of, "move": "day"}
            if prev and prev > 0:
                row["prev"] = prev
            payload["spots"][key] = row

        def lpr():
            raw = fetch_bytes(
                "https://www.chinamoney.com.cn/ags/ms/cm-u-bk-currency/LprHis",
                referer="https://www.chinamoney.com.cn/",
            )
            records = json.loads(raw.decode()).get("records") or []
            if not records:
                return
            row = records[0]
            one, five = num(row.get("1Y")), num(row.get("5Y"))
            if one is None and five is None:
                return
            payload["lpr"] = {
                "oneYear": one,
                "fiveYear": five,
                "asOf": str(row.get("showDateCN") or "")[:10],
                "source": "中国货币网",
            }

        def effr():
            data = fetch_json("https://markets.newyorkfed.org/api/rates/all/latest.json")
            for row in data.get("refRates") or []:
                if row.get("type") != "EFFR":
                    continue
                rate = num(row.get("percentRate"))
                if rate is None:
                    return
                payload["effr"] = {
                    "rate": rate,
                    "low": num(row.get("targetRateFrom")),
                    "high": num(row.get("targetRateTo")),
                    "asOf": str(row.get("effectiveDate") or "")[:10],
                    "source": "New York Fed",
                }
                return

        jobs = (
            lambda: coinbase("BTC-USD", "btc"),
            lambda: coinbase("ETH-USD", "eth"),
            lambda: comex("hf_GC", "gold"),
            lambda: comex("hf_SI", "silver"),
            lpr,
            effr,
        )

        def run(job):
            try:
                job()
            except Exception:
                return None

        with ThreadPoolExecutor(max_workers=6) as pool:
            list(pool.map(run, jobs))
        if not payload["spots"] and "lpr" not in payload and "effr" not in payload:
            self.send_json({"error": "markets"}, 502)
            return
        self.send_json(payload)

    def serve_fx(self):
        try:
            data = fetch_json("https://api.frankfurter.app/latest?from=USD")
        except Exception:
            self.send_json({"error": "fx"}, 502)
            return
        rates = {"USD": 1}
        for code, value in (data.get("rates") or {}).items():
            if isinstance(value, (int, float)) and value > 0:
                rates[code] = value
        self.send_json({"date": data.get("date") or "", "rates": rates})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5173"))
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
