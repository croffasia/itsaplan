import {
  JOB_SETTINGS_KEY,
  getJobSettings,
  mergeJobSettings,
  setSetting,
  type JobSettingsPatch,
} from '@repo/db';

// Writes job settings straight to the table, past the ranges the god route accepts, so a
// test can cut a lease or a wait down to milliseconds. resetDb clears them.
export async function setTestJobSettings(patch: JobSettingsPatch): Promise<void> {
  await setSetting(JOB_SETTINGS_KEY, mergeJobSettings(await getJobSettings(), patch));
}
