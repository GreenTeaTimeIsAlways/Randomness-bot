import { clamp, splitCsv, toBool, toInt } from "./utils.js";

const DEFAULT_MODES = ["knowledge", "absurd", "bluff", "reflex", "paradox"];
const SUPPORTED_MODES = new Set(DEFAULT_MODES);

export function readConfig(env) {
  const configuredModes = splitCsv(env.ENABLED_VERIFICATION_MODES, DEFAULT_MODES).filter((mode) =>
    SUPPORTED_MODES.has(mode),
  );

  return {
    enableVerification: toBool(env.ENABLE_VERIFICATION, true),
    enableMonthlyEvents: toBool(env.ENABLE_MONTHLY_EVENTS, true),
    discordApplicationId: String(env.DISCORD_APPLICATION_ID || "").trim(),
    discordBotToken: String(env.DISCORD_BOT_TOKEN || "").trim(),
    discordPublicKey: String(env.DISCORD_PUBLIC_KEY || "").trim(),
    discordGuildId: String(env.DISCORD_GUILD_ID || "").trim(),
    verifiedRoleId: String(env.VERIFIED_ROLE_ID || "").trim(),
    unverifiedRoleId: String(env.UNVERIFIED_ROLE_ID || "").trim(),
    verificationChannelId: String(env.VERIFICATION_CHANNEL_ID || "").trim(),
    eventChannelId: String(env.EVENT_CHANNEL_ID || "").trim(),
    adminApiSecret: String(env.ADMIN_API_SECRET || "").trim(),
    geminiApiKey: String(env.GEMINI_API_KEY || "").trim(),
    geminiModel: String(env.GEMINI_MODEL || "gemini-2.5-flash-lite").trim(),
    resetTimezone: String(env.RESET_TIMEZONE || "Europe/Warsaw").trim(),
    passingScore: clamp(toInt(env.PASSING_SCORE, 72), 1, 100),
    secondChanceScore: clamp(toInt(env.SECOND_CHANCE_SCORE, 55), 0, 100),
    minQuestionScore: clamp(toInt(env.MIN_QUESTION_SCORE, 35), 0, 100),
    maxAttempts: clamp(toInt(env.MAX_ATTEMPTS, 2), 1, 10),
    cooldownMinutes: clamp(toInt(env.COOLDOWN_MINUTES, 30), 0, 1440),
    activeSessionTtlMinutes: clamp(toInt(env.ACTIVE_SESSION_TTL_MINUTES, 120), 5, 1440),
    dailyVerificationLimit: Math.max(0, toInt(env.DAILY_VERIFICATION_LIMIT, 25)),
    reflexMinSeconds: clamp(toInt(env.REFLEX_MIN_SECONDS, 10), 5, 60),
    reflexMaxSeconds: clamp(toInt(env.REFLEX_MAX_SECONDS, 15), 5, 60),
    monthlyEventCount: clamp(toInt(env.MONTHLY_EVENT_COUNT, 12), 1, 31),
    eventPostHourLocal: clamp(toInt(env.EVENT_POST_HOUR_LOCAL, 18), 0, 23),
    eventPostMinuteLocal: clamp(toInt(env.EVENT_POST_MINUTE_LOCAL, 0), 0, 59),
    kickOnFailure: toBool(env.KICK_ON_FAILURE, false),
    enabledModes: configuredModes.length > 0 ? configuredModes : DEFAULT_MODES.slice(),
  };
}

export function getMissingConfig(config) {
  const missing = [];

  if (!config.discordApplicationId) missing.push("DISCORD_APPLICATION_ID");
  if (!config.discordBotToken) missing.push("DISCORD_BOT_TOKEN");
  if (!config.discordPublicKey) missing.push("DISCORD_PUBLIC_KEY");
  if (!config.discordGuildId) missing.push("DISCORD_GUILD_ID");
  if (!config.adminApiSecret) missing.push("ADMIN_API_SECRET");

  if (config.enableVerification) {
    if (!config.verifiedRoleId) missing.push("VERIFIED_ROLE_ID");
    if (!config.geminiApiKey) missing.push("GEMINI_API_KEY");
  }

  if (config.enableMonthlyEvents) {
    if (!config.eventChannelId) missing.push("EVENT_CHANNEL_ID");
    if (!config.geminiApiKey) missing.push("GEMINI_API_KEY");
  }

  return Array.from(new Set(missing));
}
