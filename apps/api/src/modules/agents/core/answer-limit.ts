import { sql, type SQL } from 'drizzle-orm';
import { getAgentSettings } from '#modules/settings/service';

// The start of an agent's answer, up to the instance's answer limit, as the value to store.
// Postgres left() counts characters, so the cut never splits an emoji in two.
export async function limitAnswer(text: SQL | string): Promise<SQL> {
  const { maxAnswerChars } = await getAgentSettings();
  return maxAnswerChars > 0 ? sql`left(${text}, ${maxAnswerChars})` : sql`${text}`;
}
