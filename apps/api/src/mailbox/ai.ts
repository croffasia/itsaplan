import { chatCompletionText } from '../integrations/openrouter';
import { getCredentialSecret, listCredentials } from '../integrations/store';
import { HttpError } from '../shared/lib';
import { getMailboxMessage, type MailMessage } from './client';
import { getStoredMailSummary, saveMailSummary, type MailboxConfig } from './store';

const MODEL = 'openrouter/free';
const REQUEST_TIMEOUT_MS = 60_000;

export type MailAiAction = 'summary' | 'reply';

async function openRouterApiKey(projectId: number): Promise<string> {
  const credential = (await listCredentials(projectId)).find(
    (item) => item.integrationKey === 'openrouter',
  );
  if (!credential) throw new HttpError(409, 'Connect an OpenRouter integration first');

  const secret = await getCredentialSecret(credential.id, projectId);
  const apiKey = String(secret?.config.apiKey ?? '');
  if (!apiKey) throw new HttpError(409, 'The OpenRouter integration has no API key');
  return apiKey;
}

function instructions(action: MailAiAction): string {
  if (action === 'summary') {
    return 'Summarize the email in at most three short sentences. Include any requested action or deadline. Return only the summary.';
  }
  return 'Write a concise, professional reply to the email. Match the language of the email. Do not invent commitments, dates, prices, or facts. Return only the reply body.';
}

export async function generateMailAssistance(
  projectId: number,
  message: MailMessage,
  action: MailAiAction,
): Promise<string> {
  const apiKey = await openRouterApiKey(projectId);
  return chatCompletionText(
    apiKey,
    {
      model: MODEL,
      messages: [
        { role: 'system', content: instructions(action) },
        {
          role: 'user',
          content: `Subject: ${message.subject}\nFrom: ${message.from.map((item) => item.address).join(', ')}\n\n${message.body}`,
        },
      ],
    },
    REQUEST_TIMEOUT_MS,
  );
}

// The summary of a message is generated once and then read back, so opening the
// same email again shows the same text without calling the model.
//
// The key is the RFC message id, which stays the same for the life of the
// message. A uid is used only when the message carries no id, and then the
// folder is part of the key because a uid means nothing outside it.
export async function mailSummary(
  projectId: number,
  config: MailboxConfig,
  uid: number,
  folder: string,
): Promise<string> {
  const message = await getMailboxMessage(config, uid, folder);
  const key = message.messageId ?? `${folder}:${uid}`;

  const stored = await getStoredMailSummary(projectId, key);
  if (stored) return stored;

  const text = await generateMailAssistance(projectId, message, 'summary');
  await saveMailSummary(projectId, key, text);
  return text;
}
