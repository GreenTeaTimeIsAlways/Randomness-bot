import {
  addGuildMemberRole,
  buildActionRow,
  buildButton,
  buildModalLabel,
  buildTextInput,
  createEphemeralMessageResponse,
  createModalResponse,
  editOriginalInteractionResponse,
  getModalFieldValue,
  getUserId,
  getUserRoles,
  kickGuildMember,
  removeGuildMemberRole,
} from "./discord.js";
import {
  clearSessionById,
  cleanupExpiredSessions,
  getActiveSession,
  getAttemptStats,
  getDailyQuotaUsage,
  recordAttempt,
  releaseDailyQuotaSlot,
  reserveDailyQuotaSlot,
  saveSession,
} from "./db.js";
import { describeGeminiError, generateChallengeWithGemini, gradeOpenChallengeWithGemini } from "./gemini.js";
import {
  diffMinutesFromNow,
  getLocalDayKey,
  makeId,
  normalizeShortAnswer,
  nowIso,
  pickRandom,
  randomIntInclusive,
  truncate,
} from "./utils.js";

export const VERIFICATION_START_CUSTOM_ID = "verification:start";
export const INTEREST_MODAL_ID = "verification:interest";

const MODE_LABELS = {
  knowledge: "Tryb wiedzy",
  absurd: "Tryb absurdu",
  bluff: "Tryb blefu",
  reflex: "Tryb refleksu",
  paradox: "Tryb paradoksu",
};

function cleanInterest(interest) {
  const normalized = String(interest || "").trim().replace(/\s+/g, " ");
  return truncate(normalized || "losowe tematy", 80);
}

function buildTextQuestion(prompt, scoringFocus, referencePoints) {
  return {
    prompt,
    answerFormat: "text",
    scoringFocus,
    referencePoints,
    options: null,
    correctOption: null,
    explanation: "",
  };
}

function buildFallbackChallenge(mode, interest, reflexSeconds) {
  const topic = cleanInterest(interest);

  if (mode === "bluff") {
    return {
      mode,
      modeLabel: "Tryb blefu",
      interestSummary: topic,
      introText: "Bot odpala szybki lokalny zestaw blefu.",
      deadlineSeconds: null,
      questions: [
        {
          prompt: `Wskaz odpowiedz, ktora jest zmyslona albo wyraznie przesadzona w temacie: ${topic}.`,
          answerFormat: "choice",
          scoringFocus: "Wykrycie najbardziej niewiarygodnej odpowiedzi.",
          referencePoints: [],
          options: [
            { id: "A", text: "Regularna praktyka zwykle pomaga lepiej rozumiec temat." },
            { id: "B", text: "Przyklady i proby czesto sa lepsze niz sama teoria." },
            { id: "C", text: "Kazdy temat da sie opanowac perfekcyjnie w 7 minut bez zadnej praktyki." },
          ],
          correctOption: "C",
          explanation: "Opcja C jest skrajnie nierealna.",
        },
        {
          prompt: `Ktora odpowiedz brzmi jak blef dotyczacy zainteresowania: ${topic}?`,
          answerFormat: "choice",
          scoringFocus: "Odrzucenie odpowiedzi zbyt absolutnej.",
          referencePoints: [],
          options: [
            { id: "A", text: "Warto porownywac rozne zrodla i opinie." },
            { id: "B", text: "Jedna osoba zawsze ma identyczne zdanie jak cala spolecznosc." },
            { id: "C", text: "Najlatwiej uczyc sie, gdy rozumie sie podstawowe pojecia." },
          ],
          correctOption: "B",
          explanation: "Opcja B udaje fakt, ale jest zbyt absolutna.",
        },
        {
          prompt: "Wskaz najbardziej zmyslona odpowiedz.",
          answerFormat: "choice",
          scoringFocus: "Rozpoznanie odpowiedzi, ktora lamie zdrowy rozsadek.",
          referencePoints: [],
          options: [
            { id: "A", text: "Dobry opis tematu powinien miec przyklad albo uzasadnienie." },
            { id: "B", text: "Rozmowa z innymi moze pokazac nowe spojrzenie." },
            { id: "C", text: "Jesli slowo ma litere A, automatycznie jest eksperckim argumentem." },
          ],
          correctOption: "C",
          explanation: "Opcja C nie ma sensownego zwiazku z ocena argumentu.",
        },
      ],
    };
  }

  if (mode === "reflex") {
    return {
      mode,
      modeLabel: "Tryb refleksu",
      interestSummary: topic,
      introText: "Odpowiedz krotko i szybko. Liczy sie sensowny pierwszy strzal.",
      deadlineSeconds: reflexSeconds || 60,
      questions: [
        buildTextQuestion(`Jedno slowo, ktore kojarzy Ci sie z: ${topic}.`, "Szybkie skojarzenie.", [
          "Odpowiedz nie jest pusta.",
          "Ma zwiazek z tematem.",
        ]),
        buildTextQuestion("Podaj kolor, ktory pasuje do tego tematu.", "Krotkie, intuicyjne dopasowanie.", [
          "Odpowiedz jest zwiezla.",
          "Da sie ja uzasadnic klimatem tematu.",
        ]),
        buildTextQuestion("Wybierz jedno haslo, ktore mogloby byc nazwa misji.", "Kreatywne haslo w kilku slowach.", [
          "Odpowiedz jest krotka.",
          "Brzmi jak haslo albo nazwa.",
        ]),
      ],
    };
  }

  if (mode === "absurd") {
    return {
      mode,
      modeLabel: "Tryb absurdu",
      interestSummary: topic,
      introText: "Pytania sa dziwne, ale oceniamy kreatywnosc i wewnetrzny sens odpowiedzi.",
      deadlineSeconds: null,
      questions: [
        buildTextQuestion(`Gdyby ${topic} bylo pogoda, jaka pogoda by bylo i dlaczego?`, "Kreatywne skojarzenie.", [
          "Odpowiedz zawiera porownanie.",
          "Odpowiedz ma krotkie uzasadnienie.",
        ]),
        buildTextQuestion(`Jaki przedmiot codzienny najlepiej udawalby eksperta od ${topic}?`, "Absurd z uzasadnieniem.", [
          "Pojawia sie konkretny przedmiot.",
          "Jest wyjasnienie, czemu pasuje.",
        ]),
        buildTextQuestion(`Wymysl jedno prawo fizyki, ktore dzialaloby tylko w swiecie ${topic}.`, "Pomyslowosc i spojny zart.", [
          "Odpowiedz opisuje zasade.",
          "Zasada ma sens w absurdalnym swiecie.",
        ]),
      ],
    };
  }

  if (mode === "paradox") {
    return {
      mode,
      modeLabel: "Tryb paradoksu",
      interestSummary: topic,
      introText: "Nie ma jednej poprawnej odpowiedzi. Liczy sie spojny argument.",
      deadlineSeconds: null,
      questions: [
        buildTextQuestion(`Czy w temacie ${topic} lepszy jest porzadek czy chaos? Uzasadnij.`, "Spojny wybor i argument.", [
          "Jest jasne stanowisko.",
          "Jest uzasadnienie.",
        ]),
        buildTextQuestion(`Kiedy brak wiedzy o ${topic} moze byc zaleta?`, "Paradoksalne, ale logiczne rozumowanie.", [
          "Odpowiedz wskazuje sytuacje.",
          "Wyjasnia paradoks.",
        ]),
        buildTextQuestion(`Co byloby prawda i falszem jednoczesnie w swiecie ${topic}?`, "Zrozumialy paradoks.", [
          "Odpowiedz zawiera sprzecznosc.",
          "Sprzecznosc jest wyjasniona.",
        ]),
      ],
    };
  }

  return {
    mode: "knowledge",
    modeLabel: "Tryb wiedzy",
    interestSummary: topic,
    introText: "Odpowiedz normalnie. Bot sprawdza podstawowe rozumienie tematu.",
    deadlineSeconds: null,
    questions: [
      buildTextQuestion(`Wyjasnij w 2-4 zdaniach, co najbardziej wciaga Cie w temacie: ${topic}.`, "Podstawowe rozumienie tematu.", [
        "Odpowiedz jest konkretna.",
        "Odpowiedz pokazuje osobiste zainteresowanie.",
      ]),
      buildTextQuestion(`Podaj jeden fakt, zasade albo przyklad zwiazany z: ${topic}.`, "Konkretny przyklad albo fakt.", [
        "Pojawia sie fakt, zasada albo przyklad.",
        "Odpowiedz nie jest calkowicie ogolna.",
      ]),
      buildTextQuestion(`Jak odroznilbys osobe, ktora zna ${topic} powierzchownie, od kogos bardziej ogarnietego?`, "Umiejetnosc rozroznienia poziomu wiedzy.", [
        "Odpowiedz porownuje dwa poziomy.",
        "Jest wskazana konkretna roznica.",
      ]),
    ],
  };
}

function scoreLocalAnswer(challenge, answer) {
  const text = String(answer || "").trim();
  if (!text) {
    return 0;
  }

  const words = text.split(/\s+/).filter(Boolean);
  const hasReason = /\b(bo|poniewaz|dlatego|np\.?|przyklad|czyli|wedlug|mysle)\b/i.test(text);

  if (challenge.mode === "reflex") {
    if (words.length <= 5) {
      return 85;
    }
    if (words.length <= 12) {
      return 75;
    }
    return 60;
  }

  let score = 45;
  if (words.length >= 5) score += 15;
  if (words.length >= 12) score += 15;
  if (words.length >= 25) score += 10;
  if (hasReason) score += 10;
  if (/[,.!?]/.test(text)) score += 5;

  if (challenge.mode === "absurd" || challenge.mode === "paradox") {
    score += 5;
  }

  return Math.max(0, Math.min(95, score));
}

function gradeOpenChallengeLocally(challenge, answers) {
  const gradedAnswers = challenge.questions.map((question, index) => {
    const score = scoreLocalAnswer(challenge, answers[index]);
    return {
      questionIndex: index + 1,
      score,
      feedback:
        score >= 72
          ? "Odpowiedz jest wystarczajaco konkretna i trzyma sie pytania."
          : score >= 55
            ? "Odpowiedz ma sens, ale moglaby byc bardziej konkretna."
            : "Odpowiedz jest za krotka albo zbyt malo zwiazana z pytaniem.",
      strengths: score >= 55 ? ["Jest proba odpowiedzi na temat."] : [],
      missingPoints: score >= 72 ? [] : ["Dodaj wiecej konkretu albo krotkie uzasadnienie."],
    };
  });

  return {
    summary:
      "Bot uzyl lokalnej oceny awaryjnej. Liczyla sie konkretnosc, zwiazek z pytaniem i podstawowe uzasadnienie.",
    answers: gradedAnswers,
  };
}

function parseQuestion(question, index, mode) {
  const prompt = String(question?.prompt || "").trim();
  const scoringFocus = String(question?.scoringFocus || "").trim();
  const answerFormat = String(question?.answerFormat || "").trim();
  const referencePoints = Array.isArray(question?.referencePoints)
    ? question.referencePoints.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const options = Array.isArray(question?.options)
    ? question.options
        .map((option) => ({
          id: String(option?.id || "").trim().toUpperCase(),
          text: String(option?.text || "").trim(),
        }))
        .filter((option) => option.id && option.text)
    : [];
  const correctOption = question?.correctOption ? String(question.correctOption).trim().toUpperCase() : null;
  const explanation = String(question?.explanation || "").trim();

  if (!prompt || !scoringFocus || !answerFormat) {
    throw new Error(`Pytanie ${index + 1} jest niekompletne.`);
  }

  if (mode === "bluff") {
    if (answerFormat !== "choice" || options.length !== 3 || !["A", "B", "C"].includes(correctOption || "")) {
      throw new Error("Tryb blefu wymaga 3 opcji A/B/C i poprawnej odpowiedzi.");
    }
  } else if (answerFormat !== "text" || referencePoints.length < 2) {
    throw new Error(`Tryb ${mode} wymaga pytan tekstowych z punktami odniesienia.`);
  }

  return {
    prompt,
    scoringFocus,
    answerFormat,
    referencePoints,
    options: options.length ? options : null,
    correctOption,
    explanation,
  };
}

function normalizeChallenge(rawChallenge, requestedMode) {
  const mode = String(rawChallenge?.mode || requestedMode).trim();
  const modeLabel = String(rawChallenge?.modeLabel || MODE_LABELS[mode] || requestedMode).trim();
  const interestSummary = String(rawChallenge?.interestSummary || "").trim();
  const introText = String(rawChallenge?.introText || "").trim();
  const questions = Array.isArray(rawChallenge?.questions) ? rawChallenge.questions : [];
  const deadlineSeconds =
    rawChallenge?.deadlineSeconds === null || rawChallenge?.deadlineSeconds === undefined
      ? null
      : Number(rawChallenge.deadlineSeconds);

  if (!MODE_LABELS[mode]) {
    throw new Error(`Gemini zwrocilo nieobslugiwany tryb: ${mode}`);
  }

  if (!interestSummary || !introText || questions.length !== 3) {
    throw new Error("Gemini zwrocilo niepelny zestaw pytan.");
  }

  return {
    mode,
    modeLabel,
    interestSummary,
    introText,
    deadlineSeconds: Number.isFinite(deadlineSeconds) ? deadlineSeconds : null,
    questions: questions.map((question, index) => parseQuestion(question, index, mode)),
  };
}

function normalizeGrading(rawGrading) {
  const summary = String(rawGrading?.summary || "").trim();
  const answers = Array.isArray(rawGrading?.answers) ? rawGrading.answers : [];

  if (!summary || answers.length !== 3) {
    throw new Error("Gemini zwrocilo niepelna ocene.");
  }

  return {
    summary,
    answers: answers.map((answer, index) => {
      const score = Number(answer?.score || 0);
      return {
        questionIndex: index + 1,
        score: Math.max(0, Math.min(100, Math.round(score))),
        feedback: String(answer?.feedback || "").trim() || "Brak uzasadnienia.",
        strengths: Array.isArray(answer?.strengths)
          ? answer.strengths.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
          : [],
        missingPoints: Array.isArray(answer?.missingPoints)
          ? answer.missingPoints.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
          : [],
      };
    }),
  };
}

function buildPreviewText(session) {
  const lines = [
    `**${session.challenge.modeLabel}**`,
    session.challenge.introText,
    "",
    `Temat startowy: **${session.challenge.interestSummary}**`,
  ];

  if (session.challenge.mode === "reflex" && session.reflexDeadlineAt) {
    lines.push(`Limit czasu na ten etap: **${session.challenge.deadlineSeconds} sekund**.`);
  }

  lines.push("");

  for (const [index, question] of session.challenge.questions.entries()) {
    lines.push(`**${index + 1}.** ${question.prompt}`);
    if (session.challenge.mode === "bluff" && question.options) {
      for (const option of question.options) {
        lines.push(`${option.id}. ${option.text}`);
      }
    }
    lines.push("");
  }

  lines.push("Kliknij przycisk ponizej i wyslij odpowiedzi.");
  return lines.join("\n");
}

function buildAnswerButton(sessionId) {
  return [
    buildActionRow(
      buildButton({
        customId: `verification:answer:${sessionId}`,
        label: "Otworz formularz odpowiedzi",
        style: 3,
      }),
    ),
  ];
}

function buildQuestionHint(question, mode) {
  if (mode === "bluff" && Array.isArray(question.options) && question.options.length > 0) {
    const optionsText = question.options.map((option) => `${option.id}: ${option.text}`).join(" | ");
    return truncate(`${question.prompt} ${optionsText}`, 100);
  }

  return truncate(question.prompt, 100);
}

function buildInterestModal() {
  return {
    custom_id: INTEREST_MODAL_ID,
    title: "Pytanie 1 z 4",
    components: [
      buildModalLabel({
        label: "Czym sie interesujesz?",
        description: "To pytanie ustala klimat kolejnych 3 pytan.",
        component: buildTextInput({
          customId: "interest",
          placeholder: "Np. muzyka, gry, fotografia, historia, programowanie...",
          minLength: 3,
          maxLength: 250,
        }),
      }),
    ],
  };
}

function buildAnswersModal(session) {
  const isBluff = session.challenge.mode === "bluff";
  const isReflex = session.challenge.mode === "reflex";

  return {
    custom_id: `verification:answers:${session.sessionId}`,
    title: "Formularz odpowiedzi",
    components: session.challenge.questions.map((question, index) =>
      buildModalLabel({
        label: `Pytanie ${index + 1}`,
        description: buildQuestionHint(question, session.challenge.mode),
        component: buildTextInput({
          customId: `answer_${index + 1}`,
          placeholder: isBluff
            ? "Wpisz A, B albo C"
            : isReflex
              ? "Krotka odpowiedz, najlepiej 1-5 slow"
              : "Wpisz swoja odpowiedz",
          minLength: 1,
          maxLength: isBluff ? 3 : isReflex ? 120 : 1200,
          style: isBluff || isReflex ? 1 : 2,
        }),
      }),
    ),
  };
}

export function buildVerificationPanelPayload() {
  return {
    embeds: [
      {
        title: "Wejscie na serwer",
        description:
          "Kliknij przycisk i przejdz losowy etap weryfikacji. Bot najpierw pyta, czym sie interesujesz, a potem wybiera styl wejscia.",
        color: 5793266,
        fields: [
          {
            name: "Mozliwe tryby",
            value:
              "- wiedzy\n- absurdu\n- blefu\n- refleksu\n- paradoksu\n\nDobra odpowiedz wpuszcza od razu, srednia daje druga szanse.",
          },
        ],
        footer: {
          text: "Jesli cos sie zatnie, administrator moze zresetowac probe.",
        },
      },
    ],
    components: [
      buildActionRow(
        buildButton({
          customId: VERIFICATION_START_CUSTOM_ID,
          label: "Rozpocznij weryfikacje",
          style: 1,
        }),
      ),
    ],
  };
}

function hasVerifiedRole(interaction, config) {
  return getUserRoles(interaction).includes(config.verifiedRoleId);
}

async function getQuotaBlockReason(env, config) {
  if (config.dailyVerificationLimit <= 0) {
    return null;
  }

  const quotaDayKey = getLocalDayKey(new Date(), config.resetTimezone);
  const used = await getDailyQuotaUsage(env, quotaDayKey);

  if (used < config.dailyVerificationLimit) {
    return null;
  }

  return (
    `Dzisiejszy limit nowych weryfikacji zostal wyczerpany (${used}/${config.dailyVerificationLimit}). ` +
    "Sprobuj ponownie po resecie dziennego limitu."
  );
}

async function getAttemptBlockReason(env, config, interaction) {
  if (hasVerifiedRole(interaction, config)) {
    return "Masz juz role zweryfikowanego uzytkownika.";
  }

  const userId = getUserId(interaction);
  const { attemptCount, lastAttempt } = await getAttemptStats(env, userId);

  if (attemptCount >= config.maxAttempts) {
    return "Wykorzystales wszystkie proby. Administrator musi zresetowac Twoja weryfikacje.";
  }

  if (lastAttempt && lastAttempt.result === "failed" && config.cooldownMinutes > 0) {
    const cooldownEnd = new Date(new Date(lastAttempt.createdAt).getTime() + config.cooldownMinutes * 60000);
    const minutesLeft = diffMinutesFromNow(cooldownEnd.toISOString());
    if (minutesLeft > 0) {
      return `Mozesz sprobowac ponownie za okolo ${minutesLeft} min.`;
    }
  }

  return null;
}

async function finalizePass(config, interaction) {
  const guildId = String(interaction.guild_id);
  const userId = getUserId(interaction);
  const notes = [];

  await addGuildMemberRole(
    config,
    guildId,
    userId,
    config.verifiedRoleId,
    "Uzytkownik zaliczyl wejscie na serwer",
  );
  notes.push("Nadano role zweryfikowana.");

  if (config.unverifiedRoleId) {
    try {
      await removeGuildMemberRole(
        config,
        guildId,
        userId,
        config.unverifiedRoleId,
        "Uzytkownik zaliczyl wejscie na serwer",
      );
      notes.push("Usunieto role startowa.");
    } catch {
      notes.push("Nie udalo sie usunac roli startowej - sprawdz hierarchie rol.");
    }
  }

  return notes.join(" ");
}

async function finalizeNotPassed(config, interaction, resultCategory) {
  const guildId = String(interaction.guild_id);
  const userId = getUserId(interaction);
  const notes = [];

  if (config.kickOnFailure && ["failed", "timeout"].includes(resultCategory)) {
    await kickGuildMember(
      config,
      guildId,
      userId,
      resultCategory === "timeout"
        ? "Uzytkownik nie ukonczyl weryfikacji w przewidzianym czasie"
        : "Uzytkownik nie przeszedl weryfikacji",
    );
    return "Uzytkownik zostal wyrzucony z serwera po niezaliczonej weryfikacji.";
  }

  if (config.unverifiedRoleId) {
    await addGuildMemberRole(
      config,
      guildId,
      userId,
      config.unverifiedRoleId,
      "Uzytkownik nie przeszedl jeszcze weryfikacji",
    );
    notes.push("Nadano lub pozostawiono role startowa.");
  }

  try {
    await removeGuildMemberRole(
      config,
      guildId,
      userId,
      config.verifiedRoleId,
      "Uzytkownik nie przeszedl jeszcze weryfikacji",
    );
  } catch {
    // Nic nie robimy, uzytkownik mogl po prostu nie miec tej roli.
  }

  return notes.join(" ");
}

function decideResultCategory(config, averageScore, answers, attemptNumber, isTimeout = false) {
  if (isTimeout) {
    return attemptNumber < config.maxAttempts ? "retry" : "timeout";
  }

  const enoughAverage = averageScore >= config.passingScore;
  const enoughEach = answers.every((answer) => answer.score >= config.minQuestionScore);
  if (enoughAverage && enoughEach) {
    return "passed";
  }

  if (averageScore >= config.secondChanceScore && attemptNumber < config.maxAttempts) {
    return "retry";
  }

  return "failed";
}

function formatResultMessage(config, session, evaluation, averageScore, resultCategory, roleNote = "") {
  const headlineMap = {
    passed: "Wchodzisz normalnie.",
    retry: "To jest poziom na druga szanse.",
    failed: "Tym razem nie weszlo.",
    timeout: "Czas minal i etap zostal zamkniety.",
  };

  const lines = [
    `**${headlineMap[resultCategory]}**`,
    `Tryb: **${session.challenge.modeLabel}**`,
    `Sredni wynik: **${averageScore}/100**`,
    `Prog wejscia: **${config.passingScore}/100**`,
    `Prog drugiej szansy: **${config.secondChanceScore}/100**`,
    "",
    evaluation.summary,
    "",
  ];

  for (const answer of evaluation.answers.sort((left, right) => left.questionIndex - right.questionIndex)) {
    lines.push(`**Pytanie ${answer.questionIndex}: ${answer.score}/100** - ${answer.feedback}`);
  }

  if (resultCategory === "retry") {
    lines.push("", "Mozesz od razu kliknac panel jeszcze raz i dostaniesz nowy zestaw.");
  }

  if (resultCategory === "failed") {
    lines.push(
      "",
      config.kickOnFailure
        ? "Ta proba zakonczyla weryfikacje niepowodzeniem."
        : "Jesli zostaly Ci jeszcze proby, poczekaj na cooldown i sprobuj ponownie.",
    );
  }

  if (resultCategory === "timeout") {
    lines.push(
      "",
      config.kickOnFailure
        ? "Limit czasu zostal przekroczony przy ostatniej probie."
        : "W trybie refleksu mozna podejsc od razu do kolejnej proby, jesli masz jeszcze wolne podejscia.",
    );
  }

  if (roleNote) {
    lines.push("", roleNote);
  }

  return lines.join("\n");
}

function autoGradeBluff(session, answers) {
  const gradedAnswers = session.challenge.questions.map((question, index) => {
    const normalized = normalizeShortAnswer(answers[index]);
    const isCorrect = normalized === question.correctOption;
    const score = isCorrect ? 100 : 0;
    return {
      questionIndex: index + 1,
      score,
      feedback: isCorrect
        ? `Dobrze - falszywa byla odpowiedz ${question.correctOption}.`
        : `Nie trafiles. Falszywa byla odpowiedz ${question.correctOption}. ${question.explanation || ""}`.trim(),
      strengths: isCorrect ? ["Poprawnie wykryty falsz."] : [],
      missingPoints: isCorrect ? [] : ["Warto bylo porownac trzy wersje bardziej krytycznie."],
    };
  });

  const correctCount = gradedAnswers.filter((answer) => answer.score === 100).length;
  return {
    summary:
      correctCount === 3
        ? "Pelny komplet. Dobrze wyczules, co bylo dorobiona sciema."
        : correctCount === 2
          ? "Dwie odpowiedzi trafione. To juz jest poziom drugiej szansy."
          : "Blef tym razem byl silniejszy od Ciebie.",
    answers: gradedAnswers,
  };
}

function getAnswerValues(interaction) {
  return [1, 2, 3].map((index) => getModalFieldValue(interaction, `answer_${index}`).trim());
}

export async function handleVerificationStart(env, config, interaction) {
  await cleanupExpiredSessions(env);

  const userId = getUserId(interaction);
  const activeSession = await getActiveSession(env, userId);
  if (activeSession?.challenge) {
    return createEphemeralMessageResponse(buildPreviewText(activeSession), {
      components: buildAnswerButton(activeSession.sessionId),
    });
  }

  const attemptBlockReason = await getAttemptBlockReason(env, config, interaction);
  if (attemptBlockReason) {
    return createEphemeralMessageResponse(attemptBlockReason);
  }

  const quotaBlockReason = await getQuotaBlockReason(env, config);
  if (quotaBlockReason) {
    return createEphemeralMessageResponse(quotaBlockReason);
  }

  return createModalResponse(buildInterestModal());
}

export async function handleOpenAnswers(env, interaction, sessionId) {
  await cleanupExpiredSessions(env);

  const session = await getActiveSession(env, getUserId(interaction));
  if (!session || session.sessionId !== sessionId || !session.challenge) {
    return createEphemeralMessageResponse(
      "Ten zestaw juz wygasl albo nie nalezy do Ciebie. Kliknij panel i wygeneruj nowy.",
    );
  }

  if (session.challenge.mode === "reflex" && session.reflexDeadlineAt) {
    const msLeft = new Date(session.reflexDeadlineAt).getTime() - Date.now();
    if (!Number.isFinite(msLeft) || msLeft <= 0) {
      return createEphemeralMessageResponse("Czas na tryb refleksu juz minal. Kliknij panel jeszcze raz.");
    }
  }

  return createModalResponse(buildAnswersModal(session));
}

export async function processInterestModal(env, config, interaction) {
  const interactionToken = interaction.token;
  const userId = getUserId(interaction);
  const interest = getModalFieldValue(interaction, "interest").trim();

  if (!interest) {
    await editOriginalInteractionResponse(config, interactionToken, {
      content: "Nie dostalem zainteresowania. Sprobuj jeszcze raz.",
      components: [],
    });
    return;
  }

  await cleanupExpiredSessions(env);

  const attemptBlockReason = await getAttemptBlockReason(env, config, interaction);
  if (attemptBlockReason) {
    await editOriginalInteractionResponse(config, interactionToken, {
      content: attemptBlockReason,
      components: [],
    });
    return;
  }

  const quotaDayKey = getLocalDayKey(new Date(), config.resetTimezone);
  const reserved = await reserveDailyQuotaSlot(env, quotaDayKey, config.dailyVerificationLimit, nowIso());
  if (!reserved) {
    await editOriginalInteractionResponse(config, interactionToken, {
      content: (await getQuotaBlockReason(env, config)) || "Dzisiejszy limit weryfikacji jest juz pelny.",
      components: [],
    });
    return;
  }

  const { attemptCount } = await getAttemptStats(env, userId);
  const mode = pickRandom(config.enabledModes);
  const reflexSeconds =
    mode === "reflex"
      ? randomIntInclusive(config.reflexMinSeconds, config.reflexMaxSeconds)
      : null;

  try {
    let challenge;
    try {
      const rawChallenge = await generateChallengeWithGemini(config, mode, interest, reflexSeconds);
      challenge = normalizeChallenge(rawChallenge, mode);
    } catch (error) {
      console.error("Gemini nie wygenerowalo pytan, uzywam lokalnego fallbacku:", error);
      challenge = normalizeChallenge(buildFallbackChallenge(mode, interest, reflexSeconds), mode);
    }

    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + config.activeSessionTtlMinutes * 60000).toISOString();
    const reflexDeadlineAt =
      challenge.mode === "reflex" && challenge.deadlineSeconds
        ? new Date(Date.now() + challenge.deadlineSeconds * 1000).toISOString()
        : null;

    const session = {
      sessionId: makeId("vs_"),
      userId,
      interest,
      mode: challenge.mode,
      challenge,
      createdAt,
      expiresAt,
      reflexDeadlineAt,
      quotaDayKey,
      attemptNumber: attemptCount + 1,
    };

    await saveSession(env, session);

    await editOriginalInteractionResponse(config, interactionToken, {
      content: buildPreviewText(session),
      components: buildAnswerButton(session.sessionId),
    });
  } catch (error) {
    await releaseDailyQuotaSlot(env, quotaDayKey, nowIso());
    await editOriginalInteractionResponse(config, interactionToken, {
      content: describeGeminiError(error),
      components: [],
    });
  }
}

export async function processAnswersModal(env, config, interaction, sessionId) {
  const interactionToken = interaction.token;
  await cleanupExpiredSessions(env);

  const session = await getActiveSession(env, getUserId(interaction));
  if (!session || session.sessionId !== sessionId || !session.challenge) {
    await editOriginalInteractionResponse(config, interactionToken, {
      content: "Zestaw pytan juz wygasl. Kliknij panel jeszcze raz.",
      components: [],
    });
    return;
  }

  const answers = getAnswerValues(interaction);
  let evaluation = null;
  let resultCategory = "failed";

  try {
    if (session.challenge.mode === "reflex" && session.reflexDeadlineAt) {
      const timeLeftMs = new Date(session.reflexDeadlineAt).getTime() - Date.now();
      if (!Number.isFinite(timeLeftMs) || timeLeftMs <= 0) {
        evaluation = {
          summary: "Odpowiedz przyszla po limicie czasu.",
          answers: [
            {
              questionIndex: 1,
              score: 0,
              feedback: "Za pozno.",
              strengths: [],
              missingPoints: ["Przekroczony limit czasu."],
            },
            {
              questionIndex: 2,
              score: 0,
              feedback: "Za pozno.",
              strengths: [],
              missingPoints: ["Przekroczony limit czasu."],
            },
            {
              questionIndex: 3,
              score: 0,
              feedback: "Za pozno.",
              strengths: [],
              missingPoints: ["Przekroczony limit czasu."],
            },
          ],
        };
        resultCategory = decideResultCategory(config, 0, evaluation.answers, session.attemptNumber, true);
      }
    }

    if (!evaluation) {
      if (session.challenge.mode === "bluff") {
        evaluation = autoGradeBluff(session, answers);
      } else {
        try {
          const rawEvaluation = await gradeOpenChallengeWithGemini(config, session.challenge, answers);
          evaluation = normalizeGrading(rawEvaluation);
        } catch (error) {
          console.error("Gemini nie ocenilo odpowiedzi, uzywam lokalnego fallbacku:", error);
          evaluation = gradeOpenChallengeLocally(session.challenge, answers);
        }
      }

      const averageScore = Math.round(
        evaluation.answers.reduce((sum, answer) => sum + answer.score, 0) / evaluation.answers.length,
      );
      resultCategory = decideResultCategory(
        config,
        averageScore,
        evaluation.answers,
        session.attemptNumber,
        false,
      );
    }
  } catch (error) {
    await editOriginalInteractionResponse(config, interactionToken, {
      content: describeGeminiError(error),
      components: [],
    });
    return;
  }

  const averageScore = Math.round(
    evaluation.answers.reduce((sum, answer) => sum + answer.score, 0) / evaluation.answers.length,
  );

  await recordAttempt(env, {
    userId: session.userId,
    sessionId: session.sessionId,
    mode: session.challenge.mode,
    interest: session.interest,
    averageScore,
    result: resultCategory,
    createdAt: nowIso(),
    details: {
      challenge: session.challenge,
      answers,
      evaluation,
    },
  });

  await clearSessionById(env, session.sessionId);

  let roleNote = "";
  if (resultCategory === "passed") {
    try {
      roleNote = await finalizePass(config, interaction);
    } catch (error) {
      roleNote = `Weryfikacja zaliczona, ale nie udalo sie ustawic roli. Szczegoly: ${String(error?.message || error)}`;
    }
  } else {
    try {
      roleNote = await finalizeNotPassed(config, interaction, resultCategory);
    } catch (error) {
      roleNote = config.kickOnFailure && ["failed", "timeout"].includes(resultCategory)
        ? `Weryfikacja niezaliczona, ale nie udalo sie wyrzucic uzytkownika. Szczegoly: ${String(error?.message || error)}`
        : `Nie udalo sie ustawic roli startowej. Szczegoly: ${String(error?.message || error)}`;
    }
  }

  await editOriginalInteractionResponse(config, interactionToken, {
    content: formatResultMessage(config, session, evaluation, averageScore, resultCategory, roleNote),
    components: [],
  });
}
