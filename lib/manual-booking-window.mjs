// The founder's staffed booking hours are 10:00–23:00 Asia/Kolkata, every day.
// India does not observe daylight saving time, so a fixed offset is sufficient.
const IST_OFFSET_MS = 330 * 60_000;
const OPEN_MINUTE = 10 * 60;
const CLOSE_MINUTE = 23 * 60;
const CONFIRMATION_MS = 120 * 60_000;

export const staffedHoursLabel = '10:00 am–11:00 pm IST, daily';

export function manualConfirmationDeadline(paidAt) {
  const paidMs = Date.parse(paidAt);
  if (!Number.isFinite(paidMs)) throw new Error('Invalid payment time');
  let localMs = paidMs + IST_OFFSET_MS;
  let remainingMs = CONFIRMATION_MS;
  while (remainingMs > 0) {
    const local = new Date(localMs);
    const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
    const open = midnight + OPEN_MINUTE * 60_000;
    const close = midnight + CLOSE_MINUTE * 60_000;
    if (localMs < open) localMs = open;
    if (localMs >= close) {
      localMs = open + 24 * 60 * 60_000;
      continue;
    }
    const usedMs = Math.min(close - localMs, remainingMs);
    localMs += usedMs;
    remainingMs -= usedMs;
  }
  return new Date(localMs - IST_OFFSET_MS).toISOString();
}
