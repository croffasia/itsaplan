import type { Integration } from '../../types';
import { slackSendMessage } from './send-message';
import { slackListChannels } from './list-channels';
import { slackGetMessages } from './get-messages';
import { slackGetThread } from './get-thread';
import { slackAddReaction } from './add-reaction';
import { slackFindUser } from './find-user';
import { slackIcon } from './icon';
import { verifySlack } from './verify';

// Slack: the bot of a Slack app installed in one workspace. One credential is one
// workspace; two workspaces are two credentials.
export const slack: Integration = {
  key: 'slack',
  label: 'Slack',
  description: 'Posts and reads messages in a Slack workspace through your Slack app.',
  credentialSchema: [
    {
      key: 'botToken',
      label: 'Bot token',
      type: 'secret',
      required: true,
      placeholder: 'xoxb-…',
      help: 'The Bot User OAuth Token (xoxb-…) from OAuth & Permissions at [api.slack.com/apps](https://api.slack.com/apps). Give the app the bot scopes listed by the tools you use, install it to your Slack workspace and invite the bot to the channels it works in.',
    },
    {
      key: 'defaultChannel',
      label: 'Default channel ID',
      type: 'string',
      required: false,
      placeholder: 'C0123456789',
      help: 'Used when the agent names no channel. In Slack, select the channel name → About → Channel ID.',
    },
  ],
  icon: slackIcon,
  website: 'https://slack.com',
  verify: verifySlack,
  tools: [
    slackSendMessage,
    slackListChannels,
    slackGetMessages,
    slackGetThread,
    slackAddReaction,
    slackFindUser,
  ],
};
