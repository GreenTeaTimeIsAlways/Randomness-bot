import { postChannelMessage } from "./discord.js";
import { getMonthlyEventCount, getPendingEventsForDate, markEventPosted, replaceMonthlyEvents } from "./db.js";
import {
  dateFromMonthAndDay,
  getDaysInMonth,
  hasReachedPostingTime,
  getLocalDayKey,
  getLocalMonthKey,
  nowIso,
} from "./utils.js";

const EVENT_KIND_LABELS = {
  question_roulette: "Ruletka pytan",
  glitch_event: "Glitch event",
  pattern_hunt: "Polowanie na wzor",
};

const QUESTION_EVENTS = [
  {
    title: "Pytanie z innej szuflady",
    body:
      "Dzisiejsza ruletka: opisz rzecz, ktora wydaje sie zwyczajna, ale wedlug Ciebie ma ukryty klimat albo dziwna magie.",
    cta: "Wrzuc jedna odpowiedz i zobacz, kto pojdzie w najbardziej nieoczywista strone.",
  },
  {
    title: "Mini teoria dnia",
    body:
      "Wybierz dowolny przedmiot z pokoju i wymysl teorie, dlaczego moglby byc centrum tajnego uniwersum.",
    cta: "Najlepsza teoria to ta, ktora brzmi absurdalnie, ale prawie da sie w nia uwierzyc.",
  },
  {
    title: "Losowy zwrot akcji",
    body:
      "Napisz jedno zdanie, ktore zaczyna sie normalnie, ale konczy tak, jakby narracja nagle skrecila w bok.",
    cta: "Niech kazdy dorzuci swoj zwrot akcji pod ta wiadomoscia.",
  },
  {
    title: "Mapa skojarzen",
    body:
      "Podaj 3 slowa, ktore kompletnie do siebie nie pasuja, a potem wyjasnij w jednym zdaniu, co je laczy.",
    cta: "Im dziwniejszy most miedzy slowami, tym lepiej.",
  },
];

const GLITCH_EVENTS = [
  {
    title: "Zaklocenie sygnalu",
    body:
      "SYSTEM//GLITCH: `papier -> echo -> latarnia -> papier -> echo -> ?` Bot udaje, ze to przypadek. Czy na pewno?",
    cta: "Dopisz brakujacy element albo wytlumacz, czemu schemat klamie.",
  },
  {
    title: "Zgubiony komunikat",
    body:
      "ALERT: znaleziono wiadomosc bez nadawcy: `Nie ufaj trzeciemu kolorowi, chyba ze pierwszy milczy.`",
    cta: "Napisz, co to moze znaczyc. Najbardziej spojna interpretacja wygrywa respekt.",
  },
  {
    title: "Bot mowi bokiem",
    body:
      "BZZT. Dzisiejszy kod brzmi: `KSIEZYC / KLUCZ / KROK / KSIEZYC / KLUCZ / ...`",
    cta: "Znajdz rytm, kontynuacje albo najlepsza absurdalna teorie.",
  },
  {
    title: "Nieplanowany blad",
    body:
      "Komunikat serwera: `Jesli widzisz ten tekst, to znaczy, ze przypadek probuje cos powiedziec.`",
    cta: "Odpowiedz jednym zdaniem, co przypadek mial na mysli.",
  },
];

const PATTERN_EVENTS = [
  {
    title: "Polowanie na rytm",
    body:
      "Chaos dnia: `2, 4, 8, 16, 15, 30, 60`. Gdzies tu jest regula, ale cos peklo po drodze.",
    cta: "Wskaz wzor albo moment, w ktorym schemat zaczyna udawac.",
  },
  {
    title: "Gra w kolory",
    body:
      "Sekwencja: `zielony, niebieski, zielony, czerwony, zielony, niebieski, ?`. To moze byc rytm, zart albo pulapka.",
    cta: "Podaj nastepny element i uzasadnij swoja logike.",
  },
  {
    title: "Ukryty algorytm",
    body:
      "Masz zestaw: `kot, most, 7, kot, most, 14, kot, most, ?`. Znajdz brakujacy element albo obron inna wersje.",
    cta: "Liczy sie nie tylko odpowiedz, ale tez sposob myslenia.",
  },
  {
    title: "Nierowny wzor",
    body:
      "Dzisiejszy schemat: `A1, B2, C3, E5, H8`. Czy to blad, skok, czy ukryta zasada?",
    cta: "Napisz hipoteze w 2-4 zdaniach.",
  },
];

function getDistributedDays(daysInMonth, desiredCount) {
  if (desiredCount >= daysInMonth) {
    return Array.from({ length: daysInMonth }, (_, index) => index + 1);
  }

  const days = [];
  const used = new Set();
  for (let index = 0; index < desiredCount; index += 1) {
    let day = Math.round(((index + 0.5) * daysInMonth) / desiredCount);
    day = Math.min(daysInMonth, Math.max(1, day));

    while (used.has(day) && day < daysInMonth) {
      day += 1;
    }
    while (used.has(day) && day > 1) {
      day -= 1;
    }

    used.add(day);
    days.push(day);
  }

  return days.sort((left, right) => left - right);
}

function pickTemplate(kind, day, index) {
  if (kind === "question_roulette") {
    return QUESTION_EVENTS[(day + index) % QUESTION_EVENTS.length];
  }
  if (kind === "glitch_event") {
    return GLITCH_EVENTS[(day + index) % GLITCH_EVENTS.length];
  }
  return PATTERN_EVENTS[(day + index) % PATTERN_EVENTS.length];
}

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
  const kinds = ["question_roulette", "glitch_event", "pattern_hunt"];
  return getDistributedDays(daysInMonth, desiredCount).map((day, index) => {
    const kind = kinds[index % kinds.length];
    const template = pickTemplate(kind, day, index);
    return {
      day,
      kind,
      title: template.title,
      body: template.body,
      cta: template.cta,
      eventDate: dateFromMonthAndDay(monthKey, day),
    };
  });
}

async function buildMonthlyPlan(config, monthKey) {
  const daysInMonth = getDaysInMonth(monthKey);
  const desiredCount = Math.min(config.monthlyEventCount, daysInMonth);

  return {
    overview: "Plan eventow wygenerowany lokalnie, bez ciezkiego zapytania do AI.",
    items: buildFallbackItems(monthKey, daysInMonth, desiredCount),
    source: "local",
  };
}

export async function ensureMonthlyPlan(env, config, currentDate = new Date()) {
  const monthKey = getLocalMonthKey(currentDate, config.resetTimezone);
  const desiredCount = Math.min(config.monthlyEventCount, getDaysInMonth(monthKey));
  const existingCount = await getMonthlyEventCount(env, monthKey);
  if (existingCount >= desiredCount) {
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
  const dayKey = getLocalDayKey(currentDate, config.resetTimezone);

  if (
    !force &&
    !hasReachedPostingTime(
      currentDate,
      config.resetTimezone,
      config.eventPostHourLocal,
      config.eventPostMinuteLocal,
    )
  ) {
    return { posted: 0, reason: "before_post_time", dayKey };
  }

  const pending = await getPendingEventsForDate(env, dayKey);
  if (pending.length === 0) {
    return { posted: 0, reason: "no_event", dayKey };
  }

  let posted = 0;
  for (const event of pending) {
    await postChannelMessage(config, config.eventChannelId, buildEventMessage(event));
    await markEventPosted(env, event.id, nowIso());
    posted += 1;
  }

  return { posted, reason: "posted", dayKey };
}

export async function runMonthlyEventAutomation(env, config, options = {}) {
  const currentDate = options.currentDate || new Date();
  const source = options.source || "cron";
  const scheduledAt = options.scheduledAt || null;
  const dayKey = getLocalDayKey(currentDate, config.resetTimezone);
  const monthKey = getLocalMonthKey(currentDate, config.resetTimezone);

  const plan = await ensureMonthlyPlan(env, config, currentDate);
  const postResult = await postTodayEventsIfNeeded(env, config, currentDate, false);

  console.log(
    JSON.stringify({
      message: "monthly_event_automation",
      source,
      scheduledAt,
      checkedAt: currentDate.toISOString(),
      timezone: config.resetTimezone,
      dayKey,
      monthKey,
      postTime: `${String(config.eventPostHourLocal).padStart(2, "0")}:${String(
        config.eventPostMinuteLocal,
      ).padStart(2, "0")}`,
      planCreated: plan.created,
      plannedCount: plan.count,
      posted: postResult.posted,
      reason: postResult.reason,
    }),
  );

  return { plan, postResult };
}
