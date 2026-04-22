import { postChannelMessage } from "./discord.js";
import { getMonthlyEventCount, getPendingEventsForDate, markEventPosted, replaceMonthlyEvents } from "./db.js";
import { describeGeminiError, generateMonthlyEventsWithGemini } from "./gemini.js";
import {
  dateFromMonthAndDay,
  getDaysInMonth,
  getLocalDayKey,
  getLocalMonthKey,
  isWithinPostingWindow,
  nowIso,
} from "./utils.js";

const EVENT_KIND_LABELS = {
  question_roulette: "Ruletka pytan",
  glitch_event: "Glitch event",
  pattern_hunt: "Polowanie na wzor",
};

function normalizeEventItem(item, monthKey, daysInMonth) {
  const day = Number(item?.day);
  const kind = String(item?.kind || "").trim();
  const title = String(item?.title || "").trim();
  const body = String(item?.body || "").trim();
  const cta = String(item?.cta || "").trim();

  if (!Number.isInteger(day) || day < 1 || day > daysInMonth) {
    throw new Error("Gemini zwrocilo event z nieprawidlowym dniem.");
  }
  if (!EVENT_KIND_LABELS[kind]) {
    throw new Error(`Nieobslugiwany typ eventu: ${kind}`);
  }
  if (!title || !body) {
    throw new Error("Gemini zwrocilo niepelny event.");
  }

  return {
    day,
    kind,
    title,
    body,
    cta,
    eventDate: dateFromMonthAndDay(monthKey, day),
  };
}

function deduplicateAndSort(items, monthKey, daysInMonth, desiredCount) {
  const map = new Map();
  for (const rawItem of items) {
    const item = normalizeEventItem(rawItem, monthKey, daysInMonth);
    if (!map.has(item.day)) {
      map.set(item.day, item);
    }
  }

  return Array.from(map.values())
    .sort((left, right) => left.day - right.day)
    .slice(0, desiredCount);
}

function buildFallbackItems(monthKey, daysInMonth, desiredCount) {
  const usedDays = new Set();
  const fallbackItems = [];
  const kinds = ["question_roulette", "glitch_event", "pattern_hunt"];

  while (fallbackItems.length < desiredCount) {
    const day = Math.floor(Math.random() * daysInMonth) + 1;
    if (usedDays.has(day)) {
      continue;
    }
    usedDays.add(day);

    const kind = kinds[fallbackItems.length % kinds.length];
    if (kind === "question_roulette") {
      fallbackItems.push({
        day,
        kind,
        title: "Ruletka pytan",
        body:
          "Dzisiejszy temat: opowiedz o czyms, co ostatnio Cie zaskoczylo, nauczylo albo kompletnie rozwalilo Ci schemat myslenia.",
        cta: "Wrzuc 1 odpowiedz pod ta wiadomoscia i zobacz, co napisza inni.",
        eventDate: dateFromMonthAndDay(monthKey, day),
      });
    } else if (kind === "glitch_event") {
      fallbackItems.push({
        day,
        kind,
        title: "Glitch event",
        body:
          "SYSTEM//BLAD? Oto komunikat: `KOT | LASER | DESZCZ | KOT | LASER | ?` Znajdz rytm albo dopisz najbardziej sensowna kontynuacje.",
        cta: "Kto pierwszy odkryje logike albo stworzy najlepsza teorie, wygrywa chwalebny respekt.",
        eventDate: dateFromMonthAndDay(monthKey, day),
      });
    } else {
      fallbackItems.push({
        day,
        kind,
        title: "Polowanie na wzor",
        body:
          "Chaos na dzis: `3, 6, 12, 24, 21, 42, 84`. Jest tu ukryta regula, ale cos tez nie gra. Znajdz wzor albo wskaz moment, gdzie wszystko sie sypie.",
        cta: "Napisz swoja hipoteze i uzasadnij ja w 2-4 zdaniach.",
        eventDate: dateFromMonthAndDay(monthKey, day),
      });
    }
  }

  return fallbackItems.sort((left, right) => left.day - right.day);
}

async function buildMonthlyPlan(config, monthKey) {
  const daysInMonth = getDaysInMonth(monthKey);

  try {
    const rawPlan = await generateMonthlyEventsWithGemini(
      config,
      monthKey,
      daysInMonth,
      config.monthlyEventCount,
    );
    const rawItems = Array.isArray(rawPlan?.items) ? rawPlan.items : [];
    const normalized = deduplicateAndSort(rawItems, monthKey, daysInMonth, config.monthlyEventCount);
    if (normalized.length === config.monthlyEventCount) {
      return {
        overview: String(rawPlan?.overview || "").trim(),
        items: normalized,
        source: "gemini",
      };
    }
  } catch (error) {
    console.error("Nie udalo sie wygenerowac planu eventow przez Gemini:", error);
    console.error(describeGeminiError(error));
  }

  return {
    overview: "Plan awaryjny wygenerowany lokalnie.",
    items: buildFallbackItems(monthKey, daysInMonth, config.monthlyEventCount),
    source: "fallback",
  };
}

export async function ensureMonthlyPlan(env, config, currentDate = new Date()) {
  const monthKey = getLocalMonthKey(currentDate, config.resetTimezone);
  const existingCount = await getMonthlyEventCount(env, monthKey);
  if (existingCount >= config.monthlyEventCount) {
    return {
      monthKey,
      created: false,
      count: existingCount,
    };
  }

  const plan = await buildMonthlyPlan(config, monthKey);
  await replaceMonthlyEvents(env, monthKey, plan.items, nowIso());
  return {
    monthKey,
    created: true,
    count: plan.items.length,
    source: plan.source,
    overview: plan.overview,
  };
}

function buildEventMessage(item) {
  return {
    content: "",
    embeds: [
      {
        title: `${EVENT_KIND_LABELS[item.kind]}: ${item.title}`,
        description: item.body,
        color: item.kind === "glitch_event" ? 16729344 : item.kind === "pattern_hunt" ? 3447003 : 3066993,
        footer: {
          text: item.cta || "Dolacz do zabawy pod ta wiadomoscia.",
        },
      },
    ],
  };
}

export async function postTodayEventsIfNeeded(env, config, currentDate = new Date(), force = false) {
  if (!force && !isWithinPostingWindow(currentDate, config.resetTimezone, config.eventPostHourLocal, 15)) {
    return { posted: 0, reason: "outside_window" };
  }

  const dayKey = getLocalDayKey(currentDate, config.resetTimezone);
  const pending = await getPendingEventsForDate(env, dayKey);
  if (pending.length === 0) {
    return { posted: 0, reason: "no_event" };
  }

  let posted = 0;
  for (const event of pending) {
    await postChannelMessage(config, config.eventChannelId, buildEventMessage(event));
    await markEventPosted(env, event.id, nowIso());
    posted += 1;
  }

  return { posted, reason: "posted", dayKey };
}
