import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { app, configMissing } from './app';

// Defaults mirror the Remote Config parameters in the plan, so the app works before
// (or without) a successful fetch, including offline.
export const RC_DEFAULTS = {
  cloud_model: 'gemini-3.5-flash-lite',
  cue_types: 'vague_quantity,sensory,condition,hedge,skipped_step,just_know',
  cue_keywords:
    'andaz,andaaz,a little,a bit,some,by feel,you just know,just know,usually,until it looks,roughly,enough,depends,sometimes,mostly,by eye,by smell,when it feels,experience,thoda,jaldi',
  max_followups_per_step: 2,
  ondevice_timeout_ms: 30000,
  scenario_count: 3,
  prompt_version: 'v1',
};

let rc = null;
try {
  if (!configMissing) {
    rc = getRemoteConfig(app);
    rc.settings.minimumFetchIntervalMillis = import.meta.env.DEV ? 60_000 : 3_600_000;
    rc.defaultConfig = RC_DEFAULTS;
  }
} catch (err) {
  console.warn('[UNWRITTEN] Remote Config unavailable, using defaults.', err);
}

export async function loadRemoteConfig() {
  if (!rc) return false;
  try {
    return await fetchAndActivate(rc);
  } catch (err) {
    console.warn('[UNWRITTEN] Remote Config fetch failed, using cached or default values.', err);
    return false;
  }
}

function raw(key) {
  if (!rc) return String(RC_DEFAULTS[key]);
  const v = getValue(rc, key).asString();
  return v === '' ? String(RC_DEFAULTS[key]) : v;
}

export const cfg = {
  string: (key) => raw(key),
  number: (key) => {
    const n = Number(raw(key));
    return Number.isFinite(n) ? n : Number(RC_DEFAULTS[key]);
  },
  list: (key) =>
    raw(key)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
};
