import { truncate } from "./utils.js";

const GENERATE_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function buildHeaders(config) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "x-goog-api-key": config.geminiApiKey,
    "x-goog-api-client": "discord-verification-worker/1.0",
  };
}

function extractCandidateText(responseJson) {
  const candidate = responseJson?.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  const text = parts
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini nie zwrocilo tresci odpowiedzi.");
  }

  return text;
}

async function callGeminiStructured(config, prompt, schema, temperature = 0.7) {
  const response = await fetch(`${GENERATE_ENDPOINT}/${config.geminiModel}:generateContent`, {
    method: "POST",
    headers: buildHeaders(config),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const text = extractCandidateText(payload);

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Gemini zwrocilo niepoprawny JSON: ${truncate(text, 400)}`, { cause: error });
  }
}

export function describeGeminiError(error) {
  const message = String(error?.message || "");

  if (message.includes("429")) {
    return (
      "Gemini odrzucilo zapytanie z powodu limitu Free Tier albo chwilowego rate limitu. " +
      "Poczekaj chwile albo zmniejsz dzienny limit weryfikacji."
    );
  }

  if (message.includes("403")) {
    return (
      "Gemini odrzucilo zapytanie. Sprawdz, czy klucz API jest poprawny i czy Gemini API jest " +
      "wlaczone dla tego projektu w Google AI Studio."
    );
  }

  if (message.includes("400")) {
    return (
      "Gemini zwrocilo blad konfiguracji zapytania. Najczesciej oznacza to problem z modelem " +
      "albo formatem odpowiedzi."
    );
  }

  return "Wystapil blad podczas komunikacji z Gemini.";
}

function buildChallengePrompt(mode, interest, reflexSeconds) {
  return `
Tworzysz losowy etap weryfikacji wejscia na serwer Discord.

Wymagania ogolne:
- Pisz tylko po polsku.
- Zwroc tylko dane zgodne ze schema JSON.
- Zainteresowanie uzytkownika: "${interest}".
- Tryb, ktory masz przygotowac: "${mode}".
- Zawsze przygotuj dokladnie 3 pytania.
- Pytania maja byc bezpieczne, nieobraźliwe i bez tresci seksualnych.
- Ton ma byc naturalny, lekko internetowy, ale czytelny.

Opis trybow:
- knowledge: sprawdza podstawowa wiedze i zrozumienie tematu.
- absurd: pytania sa dziwne lub lekko surrealistyczne, ale nadal oceniasz kreatywnosc i sens odpowiedzi.
- bluff: do kazdego pytania dajesz 3 krotkie odpowiedzi bota oznaczone A, B, C, z czego dokladnie jedna jest zmyslona. Uzytkownik wskazuje litere falszywej odpowiedzi.
- reflex: pytania maja byc bardzo krotkie i odpowiedz powinna dac sie wpisac w 1-5 slowach. Limit czasu dla calego etapu ma wynosic ${reflexSeconds} sekund.
- paradox: pytania nie maja jednej poprawnej odpowiedzi; oceniasz spojność, logike i uczciwe uzasadnienie.

Zasady struktury:
- modeLabel ma byc naturalna nazwa po polsku.
- interestSummary ma skrotowo nazwac klimat pytan.
- introText ma w jednym zdaniu wyjasnic, co czeka uzytkownika.
- deadlineSeconds ustaw tylko dla reflex, w innych trybach daj null.
- Dla knowledge, absurd, reflex i paradox ustaw answerFormat = "text".
- Dla bluff ustaw answerFormat = "choice", dodaj 3 opcje A/B/C i poprawne pole correctOption.
- scoringFocus ma jasno mowic, co bedzie oceniane.
- referencePoints wypelniaj dla pytan tekstowych. Dla bluff mozesz dac pusta tablice.
- explanation w bluff ma krotko wyjasnic, dlaczego dana opcja jest zmyslona. W innych trybach daj pusty string.
`.trim();
}

const CHALLENGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["mode", "modeLabel", "interestSummary", "introText", "deadlineSeconds", "questions"],
  properties: {
    mode: { type: "string" },
    modeLabel: { type: "string" },
    interestSummary: { type: "string" },
    introText: { type: "string" },
    deadlineSeconds: { type: ["integer", "null"] },
    questions: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "prompt",
          "answerFormat",
          "scoringFocus",
          "referencePoints",
          "options",
          "correctOption",
          "explanation",
        ],
        properties: {
          prompt: { type: "string" },
          answerFormat: { type: "string" },
          scoringFocus: { type: "string" },
          referencePoints: {
            type: "array",
            items: { type: "string" },
          },
          options: {
            type: ["array", "null"],
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "text"],
              properties: {
                id: { type: "string" },
                text: { type: "string" },
              },
            },
          },
          correctOption: { type: ["string", "null"] },
          explanation: { type: "string" },
        },
      },
    },
  },
};

const GRADING_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "answers"],
  properties: {
    summary: { type: "string" },
    answers: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["questionIndex", "score", "feedback", "strengths", "missingPoints"],
        properties: {
          questionIndex: { type: "integer" },
          score: { type: "integer" },
          feedback: { type: "string" },
          strengths: {
            type: "array",
            items: { type: "string" },
          },
          missingPoints: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
};

const MONTHLY_EVENTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overview", "items"],
  properties: {
    overview: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "kind", "title", "body", "cta"],
        properties: {
          day: { type: "integer" },
          kind: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          cta: { type: "string" },
        },
      },
    },
  },
};

export async function generateChallengeWithGemini(config, mode, interest, reflexSeconds) {
  return callGeminiStructured(config, buildChallengePrompt(mode, interest, reflexSeconds), CHALLENGE_SCHEMA, 0.85);
}

export async function gradeOpenChallengeWithGemini(config, challenge, answers) {
  const prompt = `
Oceniasz odpowiedzi uzytkownika w etapie wejscia na serwer Discord.

Zasady:
- Pisz tylko po polsku.
- Zwroc tylko JSON zgodny ze schema.
- Kazde pytanie ocen od 0 do 100.
- Badz wyrozumialy dla literowek i skrotow myslowych.
- Oceniaj zgodnie z trybem:
  - knowledge: patrz glownie na trafnosc i podstawowe zrozumienie.
  - absurd: patrz na kreatywnosc, luz, sens wewnetrzny i czy odpowiedz nie jest pusta.
  - reflex: odpowiedzi beda bardzo krotkie; nie karz za zwiezlosc, tylko za totalny brak zwiazku z pytaniem.
  - paradox: patrz na spojny tok rozumowania, swiadomosc sprzecznosci i uczciwe uzasadnienie.
- Feedback ma byc krotki i konkretny.

Challenge:
${JSON.stringify(challenge, null, 2)}

Answers:
${JSON.stringify(answers, null, 2)}
`.trim();

  return callGeminiStructured(config, prompt, GRADING_SCHEMA, 0.35);
}

export async function generateMonthlyEventsWithGemini(config, monthKey, daysInMonth, eventCount) {
  const prompt = `
Przygotowujesz miesieczny kalendarz eventow dla serwera Discord.

Miesiac: ${monthKey}
Liczba dni w miesiacu: ${daysInMonth}
Liczba eventow do wygenerowania: ${eventCount}

Wymagania:
- Pisz tylko po polsku.
- Zwroc tylko JSON zgodny ze schema.
- Przygotuj dokladnie ${eventCount} pozycji.
- Dni musza byc unikalne i miescic sie w zakresie 1-${daysInMonth}.
- Miksuj te typy:
  - question_roulette: temat lub pytanie, na ktore kazdy moze odpowiedziec.
  - glitch_event: dziwny komunikat, z pozoru zepsuty bot, ukryta zagadka lub klimat.
  - pattern_hunt: chaos z ukrytym schematem, rytmem albo wzorem do wykrycia.
- Tytul ma byc krótki i chwytliwy.
- Body ma byc gotowe do wyslania na Discordzie i miec max okolo 500 znakow.
- CTA ma zachęcic ludzi do odpowiedzi albo wspolnej zabawy.
- Klimat ma byc kreatywny, lekko internetowy, ale czytelny i bezpieczny.
`.trim();

  return callGeminiStructured(config, prompt, MONTHLY_EVENTS_SCHEMA, 0.9);
}
