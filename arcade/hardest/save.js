/* Defensive persistence shared by the browser and regression checks. */
(function (root) {
'use strict';
const validCount = n => Number.isSafeInteger(n) && n >= 0;
const validTime = n => Number.isFinite(n) && n >= 0;
function medal(deaths) { return deaths === 0 ? 'gold' : deaths <= 2 ? 'silver' : 'bronze'; }
function sanitize(value, levelCount = 114) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = { unlocked: validCount(raw.unlocked) ? Math.max(1, Math.min(levelCount, raw.unlocked)) : 1,
    best: {}, deaths: validCount(raw.deaths) ? raw.deaths : 0, mute: raw.mute === true };
  if (raw.best && typeof raw.best === 'object' && !Array.isArray(raw.best)) {
    for (const [id, entry] of Object.entries(raw.best)) {
      if (!/^\d+$/.test(id) || Number(id) < 1 || Number(id) > levelCount || !entry || typeof entry !== 'object') continue;
      if (!validCount(entry.deaths) || !validTime(entry.time)) continue;
      result.best[id] = { deaths: entry.deaths, time: entry.time, medal: medal(entry.deaths),
        bestTime: validTime(entry.bestTime) ? Math.min(entry.time, entry.bestTime) : entry.time };
      result.unlocked = Math.max(result.unlocked, Math.min(levelCount, Number(id) + 1));
    }
  }
  return result;
}
function record(save, id, deaths, time, levelCount) {
  const before = save.best[id];
  const bestTime = Math.min(before ? before.bestTime : Infinity, time);
  if (!before || deaths < before.deaths || (deaths === before.deaths && time < before.time)) {
    save.best[id] = { deaths, time, medal: medal(deaths), bestTime };
  } else before.bestTime = bestTime;
  save.unlocked = Math.max(save.unlocked, Math.min(levelCount, id + 1));
}
root.HardestSave = { sanitize, record, medal };
})(globalThis);
