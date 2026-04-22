import { nowIso, safeJsonParse } from "./utils.js";

export async function cleanupExpiredSessions(env, currentIso = nowIso()) {
  await env.DB.prepare("DELETE FROM verification_sessions WHERE expires_at <= ?")
    .bind(currentIso)
    .run();
}

export async function getActiveSession(env, userId) {
  const row = await env.DB.prepare(
    `
      SELECT session_id, user_id, interest, mode, challenge_json, created_at, expires_at,
             reflex_deadline_at, quota_day_key, attempt_number
      FROM verification_sessions
      WHERE user_id = ?
      LIMIT 1
    `,
  )
    .bind(userId)
    .first();

  if (!row) {
    return null;
  }

  return {
    sessionId: row.session_id,
    userId: row.user_id,
    interest: row.interest,
    mode: row.mode,
    challenge: safeJsonParse(row.challenge_json, null),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    reflexDeadlineAt: row.reflex_deadline_at,
    quotaDayKey: row.quota_day_key,
    attemptNumber: Number(row.attempt_number || 1),
  };
}

export async function saveSession(env, session) {
  await env.DB.prepare("DELETE FROM verification_sessions WHERE user_id = ?").bind(session.userId).run();

  await env.DB.prepare(
    `
      INSERT INTO verification_sessions (
        session_id, user_id, interest, mode, challenge_json, created_at, expires_at,
        reflex_deadline_at, quota_day_key, attempt_number
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      session.sessionId,
      session.userId,
      session.interest,
      session.mode,
      JSON.stringify(session.challenge),
      session.createdAt,
      session.expiresAt,
      session.reflexDeadlineAt,
      session.quotaDayKey,
      session.attemptNumber,
    )
    .run();
}

export async function clearSessionById(env, sessionId) {
  await env.DB.prepare("DELETE FROM verification_sessions WHERE session_id = ?").bind(sessionId).run();
}

export async function clearSessionByUserId(env, userId) {
  await env.DB.prepare("DELETE FROM verification_sessions WHERE user_id = ?").bind(userId).run();
}

export async function getAttemptStats(env, userId) {
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS attempt_count FROM verification_attempts WHERE user_id = ?",
  )
    .bind(userId)
    .first();

  const lastRow = await env.DB.prepare(
    `
      SELECT id, mode, average_score, result, details_json, created_at
      FROM verification_attempts
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `,
  )
    .bind(userId)
    .first();

  return {
    attemptCount: Number(countRow?.attempt_count || 0),
    lastAttempt: lastRow
      ? {
          id: Number(lastRow.id),
          mode: lastRow.mode,
          averageScore: Number(lastRow.average_score || 0),
          result: lastRow.result,
          details: safeJsonParse(lastRow.details_json, {}),
          createdAt: lastRow.created_at,
        }
      : null,
  };
}

export async function recordAttempt(env, attempt) {
  await env.DB.prepare(
    `
      INSERT INTO verification_attempts (
        user_id, session_id, mode, interest, average_score, result, details_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )
    .bind(
      attempt.userId,
      attempt.sessionId,
      attempt.mode,
      attempt.interest,
      attempt.averageScore,
      attempt.result,
      JSON.stringify(attempt.details),
      attempt.createdAt,
    )
    .run();
}

export async function resetUserState(env, userId) {
  await env.DB.prepare("DELETE FROM verification_sessions WHERE user_id = ?").bind(userId).run();
  await env.DB.prepare("DELETE FROM verification_attempts WHERE user_id = ?").bind(userId).run();
}

export async function reserveDailyQuotaSlot(env, quotaDayKey, limit, currentIso = nowIso()) {
  if (limit <= 0) {
    return true;
  }

  await env.DB.prepare(
    `
      INSERT OR IGNORE INTO daily_quota (quota_day_key, used_count, updated_at)
      VALUES (?, 0, ?)
    `,
  )
    .bind(quotaDayKey, currentIso)
    .run();

  const result = await env.DB.prepare(
    `
      UPDATE daily_quota
      SET used_count = used_count + 1, updated_at = ?
      WHERE quota_day_key = ? AND used_count < ?
    `,
  )
    .bind(currentIso, quotaDayKey, limit)
    .run();

  return Number(result?.meta?.changes || 0) > 0;
}

export async function releaseDailyQuotaSlot(env, quotaDayKey, currentIso = nowIso()) {
  await env.DB.prepare(
    `
      UPDATE daily_quota
      SET used_count = CASE WHEN used_count > 0 THEN used_count - 1 ELSE 0 END,
          updated_at = ?
      WHERE quota_day_key = ?
    `,
  )
    .bind(currentIso, quotaDayKey)
    .run();
}

export async function getDailyQuotaUsage(env, quotaDayKey) {
  const row = await env.DB.prepare(
    "SELECT used_count FROM daily_quota WHERE quota_day_key = ? LIMIT 1",
  )
    .bind(quotaDayKey)
    .first();

  return Number(row?.used_count || 0);
}

export async function getMonthlyEventCount(env, monthKey) {
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS item_count FROM monthly_events WHERE month_key = ?",
  )
    .bind(monthKey)
    .first();

  return Number(row?.item_count || 0);
}

export async function replaceMonthlyEvents(env, monthKey, items, createdAt) {
  await env.DB.prepare("DELETE FROM monthly_events WHERE month_key = ?").bind(monthKey).run();

  for (const item of items) {
    await env.DB.prepare(
      `
        INSERT INTO monthly_events (
          month_key, day_number, event_date, event_kind, title, body, cta, payload_json, posted_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
      `,
    )
      .bind(
        monthKey,
        item.day,
        item.eventDate,
        item.kind,
        item.title,
        item.body,
        item.cta || null,
        JSON.stringify(item),
        createdAt,
      )
      .run();
  }
}

export async function getPendingEventsForDate(env, eventDate) {
  const result = await env.DB.prepare(
    `
      SELECT id, month_key, day_number, event_date, event_kind, title, body, cta, payload_json, created_at
      FROM monthly_events
      WHERE event_date = ? AND posted_at IS NULL
      ORDER BY id ASC
    `,
  )
    .bind(eventDate)
    .all();

  return (result?.results || []).map((row) => ({
    id: Number(row.id),
    monthKey: row.month_key,
    day: Number(row.day_number),
    eventDate: row.event_date,
    kind: row.event_kind,
    title: row.title,
    body: row.body,
    cta: row.cta,
    payload: safeJsonParse(row.payload_json, {}),
    createdAt: row.created_at,
  }));
}

export async function markEventPosted(env, eventId, postedAt = nowIso()) {
  await env.DB.prepare("UPDATE monthly_events SET posted_at = ? WHERE id = ?")
    .bind(postedAt, eventId)
    .run();
}
