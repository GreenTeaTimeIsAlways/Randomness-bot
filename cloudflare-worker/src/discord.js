import { jsonResponse } from "./utils.js";

const INTERACTION_PONG = 1;
const INTERACTION_CHANNEL_MESSAGE = 4;
const INTERACTION_DEFERRED_CHANNEL_MESSAGE = 5;
const INTERACTION_MODAL = 9;
const EPHEMERAL_FLAG = 64;
const MANAGE_GUILD_PERMISSION = 1n << 5n;
const ADMINISTRATOR_PERMISSION = 1n << 3n;

let cachedPublicKeyHex = null;
let cachedCryptoKeyPromise = null;

function hexToUint8Array(hexString) {
  const clean = hexString.trim().toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error("Nieprawidlowy ciag hex.");
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let index = 0; index < clean.length; index += 2) {
    bytes[index / 2] = Number.parseInt(clean.slice(index, index + 2), 16);
  }
  return bytes;
}

async function getDiscordPublicKey(publicKeyHex) {
  if (cachedPublicKeyHex !== publicKeyHex || !cachedCryptoKeyPromise) {
    cachedPublicKeyHex = publicKeyHex;
    const keyData = hexToUint8Array(publicKeyHex);
    cachedCryptoKeyPromise = crypto.subtle.importKey("raw", keyData, "Ed25519", false, ["verify"]);
  }

  return cachedCryptoKeyPromise;
}

export async function verifyDiscordRequest(request, publicKeyHex) {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  const body = await request.text();

  if (!signature || !timestamp) {
    return { ok: false, body };
  }

  const key = await getDiscordPublicKey(publicKeyHex);
  const encoder = new TextEncoder();
  const isValid = await crypto.subtle.verify(
    "Ed25519",
    key,
    hexToUint8Array(signature),
    encoder.encode(`${timestamp}${body}`),
  );

  return { ok: isValid, body };
}

export function createPongResponse() {
  return jsonResponse({ type: INTERACTION_PONG });
}

export function createDeferredEphemeralResponse() {
  return jsonResponse({
    type: INTERACTION_DEFERRED_CHANNEL_MESSAGE,
    data: {
      flags: EPHEMERAL_FLAG,
    },
  });
}

export function createEphemeralMessageResponse(content, extraData = {}) {
  return jsonResponse({
    type: INTERACTION_CHANNEL_MESSAGE,
    data: {
      content,
      flags: EPHEMERAL_FLAG,
      allowed_mentions: { parse: [] },
      ...extraData,
    },
  });
}

export function createPublicMessageResponse(content, extraData = {}) {
  return jsonResponse({
    type: INTERACTION_CHANNEL_MESSAGE,
    data: {
      content,
      allowed_mentions: { parse: [] },
      ...extraData,
    },
  });
}

export function createModalResponse(modal) {
  return jsonResponse({
    type: INTERACTION_MODAL,
    data: modal,
  });
}

async function discordApi(config, path, options = {}) {
  const response = await fetch(`https://discord.com/api/v10${path}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bot ${config.discordBotToken}`,
      "Content-Type": "application/json; charset=utf-8",
      "User-Agent": "discord-verification-worker/1.0",
      ...(options.auditReason
        ? { "X-Audit-Log-Reason": encodeURIComponent(options.auditReason) }
        : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Discord API ${response.status}: ${errorText}`);
  }

  if (response.status === 204) {
    return null;
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function registerGuildCommands(config) {
  const commands = [
    {
      name: "post_verification_panel",
      description: "Publikuje panel wejscia na serwer.",
      options: [
        {
          type: 7,
          name: "channel",
          description: "Kanal, w ktorym ma pojawic sie panel.",
          required: false,
        },
      ],
    },
    {
      name: "reset_verification",
      description: "Resetuje weryfikacje wskazanego uzytkownika.",
      options: [
        {
          type: 6,
          name: "user",
          description: "Uzytkownik do zresetowania.",
          required: true,
        },
      ],
    },
    {
      name: "generate_monthly_events",
      description: "Generuje plan eventow na biezacy miesiac.",
    },
    {
      name: "post_today_event",
      description: "Publikuje dzisiejszy event od razu.",
    },
    {
      name: "verification_history",
      description: "Pokazuje historie ostatnich weryfikacji.",
      options: [
        {
          type: 6,
          name: "user",
          description: "Uzytkownik, dla ktorego chcesz zobaczyc historie.",
          required: false,
        },
        {
          type: 4,
          name: "limit",
          description: "Ile wpisow pokazac (1-10).",
          required: false,
          min_value: 1,
          max_value: 10,
        },
      ],
    },
    {
      name: "event_status",
      description: "Pokazuje kanal eventow i najblizszy plan publikacji.",
      options: [
        {
          type: 4,
          name: "limit",
          description: "Ile najblizszych eventow pokazac (1-10).",
          required: false,
          min_value: 1,
          max_value: 10,
        },
      ],
    },
    {
      name: "chaos_prompt",
      description: "Losuje absurdalny prompt do rozmowy bez uzywania AI.",
      options: [
        {
          type: 3,
          name: "category",
          description: "Jaki typ chaosu wylosowac?",
          required: false,
          choices: [
            { name: "losowy", value: "random" },
            { name: "historia", value: "story" },
            { name: "debata", value: "debate" },
            { name: "wyzwanie", value: "challenge" },
            { name: "przepowiednia", value: "prophecy" },
            { name: "glitch", value: "glitch" },
          ],
        },
      ],
    },
  ];

  return discordApi(
    config,
    `/applications/${config.discordApplicationId}/guilds/${config.discordGuildId}/commands`,
    {
      method: "PUT",
      body: commands,
    },
  );
}

export async function editOriginalInteractionResponse(config, interactionToken, body) {
  return discordApi(
    config,
    `/webhooks/${config.discordApplicationId}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      body: {
        allowed_mentions: { parse: [] },
        ...body,
      },
    },
  );
}

export async function sendFollowupMessage(config, interactionToken, body) {
  return discordApi(config, `/webhooks/${config.discordApplicationId}/${interactionToken}`, {
    method: "POST",
    body: {
      allowed_mentions: { parse: [] },
      ...body,
    },
  });
}

export async function postChannelMessage(config, channelId, body) {
  return discordApi(config, `/channels/${channelId}/messages`, {
    method: "POST",
    body: {
      allowed_mentions: { parse: [] },
      ...body,
    },
  });
}

export async function addGuildMemberRole(config, guildId, userId, roleId, reason) {
  return discordApi(config, `/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "PUT",
    auditReason: reason,
  });
}

export async function removeGuildMemberRole(config, guildId, userId, roleId, reason) {
  return discordApi(config, `/guilds/${guildId}/members/${userId}/roles/${roleId}`, {
    method: "DELETE",
    auditReason: reason,
  });
}

export async function kickGuildMember(config, guildId, userId, reason) {
  return discordApi(config, `/guilds/${guildId}/members/${userId}`, {
    method: "DELETE",
    auditReason: reason,
  });
}

export function hasManageGuildPermission(interaction) {
  const rawPermissions = interaction?.member?.permissions;
  if (!rawPermissions) {
    return false;
  }

  try {
    const permissions = BigInt(rawPermissions);
    return (
      (permissions & ADMINISTRATOR_PERMISSION) === ADMINISTRATOR_PERMISSION ||
      (permissions & MANAGE_GUILD_PERMISSION) === MANAGE_GUILD_PERMISSION
    );
  } catch {
    return false;
  }
}

export function getUserId(interaction) {
  return String(
    interaction?.member?.user?.id || interaction?.user?.id || interaction?.member?.id || "",
  ).trim();
}

export function getUserRoles(interaction) {
  return Array.isArray(interaction?.member?.roles) ? interaction.member.roles.map(String) : [];
}

export function getCommandOptionValue(interaction, optionName) {
  const options = interaction?.data?.options || [];
  const found = options.find((option) => option.name === optionName);
  return found?.value ?? null;
}

function walkComponentValues(components, map) {
  for (const item of components || []) {
    if (item?.component && item.component.custom_id) {
      const nestedValue = item.component.value;
      if (typeof nestedValue === "string") {
        map.set(item.component.custom_id, nestedValue);
      }
      continue;
    }

    for (const component of item?.components || []) {
      if (component.custom_id && typeof component.value === "string") {
        map.set(component.custom_id, component.value);
      }
    }
  }
}

export function getModalFieldValue(interaction, fieldId) {
  const values = new Map();
  walkComponentValues(interaction?.data?.components || [], values);
  return String(values.get(fieldId) || "");
}

export function buildActionRow(component) {
  return {
    type: 1,
    components: [component],
  };
}

export function buildModalLabel({ label, description, component }) {
  return {
    type: 18,
    label,
    description,
    component,
  };
}

export function buildButton({ customId, label, style = 1 }) {
  return {
    type: 2,
    custom_id: customId,
    label,
    style,
  };
}

export function buildTextInput({
  customId,
  label,
  placeholder,
  minLength = 1,
  maxLength = 1200,
  style = 2,
  required = true,
}) {
  const payload = {
    type: 4,
    custom_id: customId,
    min_length: minLength,
    max_length: maxLength,
    style,
    required,
  };

  if (label) {
    payload.label = label;
  }

  if (placeholder) {
    payload.placeholder = placeholder;
  }

  return payload;
}
