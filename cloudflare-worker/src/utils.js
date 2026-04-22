const PART_KEY_MAP = {
  year: "year",
  month: "month",
  day: "day",
  hour: "hour",
  minute: "minute",
};

export function nowIso() {
  return new Date().toISOString();
}

export function toInt(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

export function splitCsv(value, fallback = []) {
  if (!value) {
    return fallback.slice();
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function pickRandom(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Nie mozna losowac z pustej listy.");
  }

  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return items[random[0] % items.length];
}

export function randomIntInclusive(min, max) {
  const lower = Math.ceil(Math.min(min, max));
  const upper = Math.floor(Math.max(min, max));
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return lower + (random[0] % (upper - lower + 1));
}

export function makeId(prefix = "") {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}${hex}`;
}

export function truncate(text, limit) {
  if (typeof text !== "string") {
    return "";
  }
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit - 1).trimEnd()}...`;
}

export function safeJsonParse(value, fallback = null) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Brakuje pola tekstowego: ${name}`);
  }
  return value.trim();
}

export function getZonedDateParts(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const mapped = {};
  for (const part of formatter.formatToParts(date)) {
    const key = PART_KEY_MAP[part.type];
    if (key) {
      mapped[key] = part.value;
    }
  }

  return {
    year: Number(mapped.year),
    month: Number(mapped.month),
    day: Number(mapped.day),
    hour: Number(mapped.hour),
    minute: Number(mapped.minute),
  };
}

export function getLocalDayKey(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getLocalMonthKey(date, timeZone) {
  const parts = getZonedDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}`;
}

export function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  if (!year || !month) {
    throw new Error(`Nieprawidlowy monthKey: ${monthKey}`);
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function dateFromMonthAndDay(monthKey, dayNumber) {
  const [year, month] = monthKey.split("-").map((part) => Number(part));
  return `${year}-${String(month).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
}

export function isWithinPostingWindow(date, timeZone, targetHour, windowMinutes = 15) {
  const parts = getZonedDateParts(date, timeZone);
  return parts.hour === targetHour && parts.minute < windowMinutes;
}

export function diffMinutesFromNow(isoString) {
  const target = new Date(isoString);
  const diffMs = target.getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs <= 0) {
    return 0;
  }
  return Math.max(1, Math.floor(diffMs / 60000));
}

export function normalizeShortAnswer(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function mentionUser(userId) {
  return `<@${userId}>`;
}
