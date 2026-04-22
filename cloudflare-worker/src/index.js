import { getMissingConfig, readConfig } from "./config.js";
import {
  addGuildMemberRole,
  createDeferredEphemeralResponse,
  createEphemeralMessageResponse,
  createPongResponse,
  editOriginalInteractionResponse,
  getCommandOptionValue,
  hasManageGuildPermission,
  postChannelMessage,
  registerGuildCommands,
  removeGuildMemberRole,
  verifyDiscordRequest,
} from "./discord.js";
import { resetUserState } from "./db.js";
import { ensureMonthlyPlan, postTodayEventsIfNeeded } from "./events.js";
import {
  buildVerificationPanelPayload,
  handleOpenAnswers,
  handleVerificationStart,
  processAnswersModal,
  processInterestModal,
  VERIFICATION_START_CUSTOM_ID,
} from "./verification.js";
import { jsonResponse } from "./utils.js";

function isConfiguredForGuild(config, interaction) {
  return String(interaction?.guild_id || "") === config.discordGuildId;
}

function requireReadyConfig(config) {
  const missing = getMissingConfig(config);
  if (missing.length > 0) {
    throw new Error(`Brakuje konfiguracji: ${missing.join(", ")}`);
  }
}

function isInternalRoute(pathname) {
  return pathname.startsWith("/internal/");
}

function checkAdminSecret(url, request, config) {
  const secret =
    url.searchParams.get("secret") ||
    request.headers.get("x-admin-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  return secret === config.adminApiSecret;
}

async function postVerificationPanel(config, channelId) {
  if (!config.enableVerification) {
    throw new Error("Weryfikacja jest wylaczona w konfiguracji.");
  }

  const targetChannelId = channelId || config.verificationChannelId;
  if (!targetChannelId) {
    throw new Error("Brakuje channelId albo VERIFICATION_CHANNEL_ID.");
  }

  await postChannelMessage(config, targetChannelId, buildVerificationPanelPayload());
  return { ok: true, channelId: targetChannelId };
}

async function resetVerification(config, env, guildId, userId) {
  await resetUserState(env, userId);

  try {
    await removeGuildMemberRole(
      config,
      guildId,
      userId,
      config.verifiedRoleId,
      "Administrator zresetowal weryfikacje",
    );
  } catch {
    // Uzytkownik mogl nie miec tej roli, nie traktujemy tego jako blad krytyczny.
  }

  if (config.unverifiedRoleId) {
    try {
      await addGuildMemberRole(
        config,
        guildId,
        userId,
        config.unverifiedRoleId,
        "Administrator zresetowal weryfikacje",
      );
    } catch {
      // To tylko wygodny dodatek.
    }
  }

  return { ok: true, userId };
}

async function handleInternalRoute(request, env, ctx, config, url) {
  if (!checkAdminSecret(url, request, config)) {
    return jsonResponse({ ok: false, message: "Brak poprawnego secret." }, 401);
  }

  requireReadyConfig(config);

  if (url.pathname === "/internal/register-commands") {
    const result = await registerGuildCommands(config);
    return jsonResponse({
      ok: true,
      message: "Komendy zostaly zarejestrowane dla serwera testowego.",
      result,
    });
  }

  if (url.pathname === "/internal/post-panel") {
    const result = await postVerificationPanel(config, url.searchParams.get("channelId") || "");
    return jsonResponse({
      ok: true,
      message: "Panel weryfikacji zostal opublikowany.",
      ...result,
    });
  }

  if (url.pathname === "/internal/generate-monthly-events") {
    if (!config.enableMonthlyEvents) {
      return jsonResponse({ ok: false, message: "Eventy miesieczne sa wylaczone." }, 400);
    }
    const result = await ensureMonthlyPlan(env, config, new Date());
    return jsonResponse({
      ok: true,
      message: result.created ? "Plan miesieczny zostal wygenerowany." : "Plan miesieczny juz istnial.",
      ...result,
    });
  }

  if (url.pathname === "/internal/post-today-event") {
    if (!config.enableMonthlyEvents) {
      return jsonResponse({ ok: false, message: "Eventy miesieczne sa wylaczone." }, 400);
    }
    const result = await postTodayEventsIfNeeded(env, config, new Date(), true);
    return jsonResponse({
      ok: true,
      message: result.posted > 0 ? "Dzisiejszy event zostal opublikowany." : "Na dzis nie bylo nic do wyslania.",
      ...result,
    });
  }

  return jsonResponse({ ok: false, message: "Nieznana trasa wewnetrzna." }, 404);
}

async function handleApplicationCommand(interaction, env, ctx, config) {
  if (!hasManageGuildPermission(interaction)) {
    return createEphemeralMessageResponse("Te komendy sa tylko dla administracji serwera.");
  }

  if (!isConfiguredForGuild(config, interaction)) {
    return createEphemeralMessageResponse("Ten worker jest przypiety do innego serwera.");
  }

  const commandName = String(interaction?.data?.name || "");
  const interactionToken = interaction.token;

  if (commandName === "post_verification_panel") {
    const channelId = String(
      getCommandOptionValue(interaction, "channel") || config.verificationChannelId || interaction.channel_id || "",
    );
    ctx.waitUntil(
      (async () => {
        try {
          const result = await postVerificationPanel(config, channelId);
          await editOriginalInteractionResponse(config, interactionToken, {
            content: `Panel zostal opublikowany w kanale <#${result.channelId}>.`,
            components: [],
          });
        } catch (error) {
          await editOriginalInteractionResponse(config, interactionToken, {
            content: `Nie udalo sie opublikowac panelu: ${String(error?.message || error)}`,
            components: [],
          });
        }
      })(),
    );

    return createDeferredEphemeralResponse();
  }

  if (commandName === "reset_verification") {
    const userId = String(getCommandOptionValue(interaction, "user") || "");
    ctx.waitUntil(
      (async () => {
        try {
          await resetVerification(config, env, config.discordGuildId, userId);
          await editOriginalInteractionResponse(config, interactionToken, {
            content: `Zresetowano weryfikacje uzytkownika <@${userId}>.`,
            components: [],
          });
        } catch (error) {
          await editOriginalInteractionResponse(config, interactionToken, {
            content: `Nie udalo sie zresetowac uzytkownika: ${String(error?.message || error)}`,
            components: [],
          });
        }
      })(),
    );

    return createDeferredEphemeralResponse();
  }

  if (commandName === "generate_monthly_events") {
    if (!config.enableMonthlyEvents) {
      return createEphemeralMessageResponse("Eventy miesieczne sa aktualnie wylaczone.");
    }
    ctx.waitUntil(
      (async () => {
        try {
          const result = await ensureMonthlyPlan(env, config, new Date());
          await editOriginalInteractionResponse(config, interactionToken, {
            content: result.created
              ? `Wygenerowano plan eventow na miesiac ${result.monthKey} (${result.count} pozycji, zrodlo: ${result.source}).`
              : `Plan eventow na miesiac ${result.monthKey} juz istnial (${result.count} pozycji).`,
            components: [],
          });
        } catch (error) {
          await editOriginalInteractionResponse(config, interactionToken, {
            content: `Nie udalo sie wygenerowac planu: ${String(error?.message || error)}`,
            components: [],
          });
        }
      })(),
    );

    return createDeferredEphemeralResponse();
  }

  if (commandName === "post_today_event") {
    if (!config.enableMonthlyEvents) {
      return createEphemeralMessageResponse("Eventy miesieczne sa aktualnie wylaczone.");
    }
    ctx.waitUntil(
      (async () => {
        try {
          const result = await postTodayEventsIfNeeded(env, config, new Date(), true);
          await editOriginalInteractionResponse(config, interactionToken, {
            content:
              result.posted > 0
                ? `Opublikowano ${result.posted} event(y) na dzis.`
                : "Na dzis nie bylo nic zaplanowanego albo wszystko juz zostalo wyslane.",
            components: [],
          });
        } catch (error) {
          await editOriginalInteractionResponse(config, interactionToken, {
            content: `Nie udalo sie wyslac eventu: ${String(error?.message || error)}`,
            components: [],
          });
        }
      })(),
    );

    return createDeferredEphemeralResponse();
  }

  return createEphemeralMessageResponse("Nie znam jeszcze tej komendy.");
}

async function handleComponentInteraction(interaction, env, config) {
  if (!isConfiguredForGuild(config, interaction)) {
    return createEphemeralMessageResponse("Ten worker jest przypiety do innego serwera.");
  }

  const customId = String(interaction?.data?.custom_id || "");
  if (customId === VERIFICATION_START_CUSTOM_ID) {
    if (!config.enableVerification) {
      return createEphemeralMessageResponse("Weryfikacja jest aktualnie wylaczona.");
    }
    return handleVerificationStart(env, config, interaction);
  }

  if (customId.startsWith("verification:answer:")) {
    const sessionId = customId.split(":").pop() || "";
    return handleOpenAnswers(env, interaction, sessionId);
  }

  return createEphemeralMessageResponse("Ten przycisk nie jest juz aktywny.");
}

async function handleModalSubmit(interaction, env, ctx, config) {
  if (!isConfiguredForGuild(config, interaction)) {
    return createEphemeralMessageResponse("Ten worker jest przypiety do innego serwera.");
  }

  const modalId = String(interaction?.data?.custom_id || "");

  if (modalId === "verification:interest") {
    ctx.waitUntil(processInterestModal(env, config, interaction));
    return createDeferredEphemeralResponse();
  }

  if (modalId.startsWith("verification:answers:")) {
    const sessionId = modalId.split(":").pop() || "";
    ctx.waitUntil(processAnswersModal(env, config, interaction, sessionId));
    return createDeferredEphemeralResponse();
  }

  return createEphemeralMessageResponse("Ten formularz nie jest juz obslugiwany.");
}

async function handleInteraction(request, env, ctx, config) {
  requireReadyConfig(config);

  const verification = await verifyDiscordRequest(request, config.discordPublicKey);
  if (!verification.ok) {
    return new Response("Bad request signature", { status: 401 });
  }

  let interaction;
  try {
    interaction = JSON.parse(verification.body);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  if (interaction.type === 1) {
    return createPongResponse();
  }

  if (interaction.type === 2) {
    return handleApplicationCommand(interaction, env, ctx, config);
  }

  if (interaction.type === 3) {
    return handleComponentInteraction(interaction, env, config);
  }

  if (interaction.type === 5) {
    return handleModalSubmit(interaction, env, ctx, config);
  }

  return createEphemeralMessageResponse("Ten typ interakcji nie jest jeszcze obslugiwany.");
}

function buildHealthPayload(config) {
  const missing = getMissingConfig(config);
  return {
    ok: missing.length === 0,
    service: "discord-verification-worker",
    missing,
    features: {
      verification: config.enableVerification,
      monthlyEvents: config.enableMonthlyEvents,
    },
    guildId: config.discordGuildId || null,
    verificationChannelId: config.verificationChannelId || null,
    eventChannelId: config.eventChannelId || null,
    geminiModel: config.geminiModel,
    timezone: config.resetTimezone,
    routes: {
      interactionEndpoint: "/",
      health: "/health",
      registerCommands: "/internal/register-commands?secret=...",
      postPanel: "/internal/post-panel?secret=...",
      generateMonthlyEvents: "/internal/generate-monthly-events?secret=...",
      postTodayEvent: "/internal/post-today-event?secret=...",
    },
  };
}

export default {
  async fetch(request, env, ctx) {
    const config = readConfig(env);
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return jsonResponse(buildHealthPayload(config));
    }

    if (isInternalRoute(url.pathname)) {
      try {
        return await handleInternalRoute(request, env, ctx, config, url);
      } catch (error) {
        return jsonResponse(
          {
            ok: false,
            message: String(error?.message || error),
          },
          500,
        );
      }
    }

    if (request.method === "POST" && url.pathname === "/") {
      try {
        return await handleInteraction(request, env, ctx, config);
      } catch (error) {
        console.error("Blad obslugi interakcji:", error);
        return jsonResponse(
          {
            ok: false,
            message: String(error?.message || error),
          },
          500,
        );
      }
    }

    return jsonResponse({ ok: false, message: "Not found" }, 404);
  },

  async scheduled(controller, env, ctx) {
    const config = readConfig(env);
    const missing = getMissingConfig(config);
    if (missing.length > 0) {
      console.error("Pomijam cron, bo brakuje konfiguracji:", missing);
      return;
    }

    if (!config.enableMonthlyEvents) {
      return;
    }

    ctx.waitUntil(
      (async () => {
        const scheduledDate = new Date(controller.scheduledTime);
        try {
          await ensureMonthlyPlan(env, config, scheduledDate);
          await postTodayEventsIfNeeded(env, config, scheduledDate, false);
        } catch (error) {
          console.error("Blad crona:", error);
        }
      })(),
    );
  },
};
