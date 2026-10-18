# Microsoft 365 tools for agents

The Microsoft 365 integration gives an internal agent tools for a company tenant through
Microsoft Graph:

| Tool                           | What it does                                  | Graph application permission                  |
| ------------------------------ | --------------------------------------------- | --------------------------------------------- |
| `microsoft365_files_search`    | Search a OneDrive or SharePoint library       | `Files.Read.All`                              |
| `microsoft365_files_list`      | List a folder                                 | `Files.Read.All`                              |
| `microsoft365_file_read`       | Read a text file                              | `Files.Read.All`                              |
| `microsoft365_file_write`      | Create or replace a text file                 | `Files.ReadWrite.All`                         |
| `microsoft365_sites_search`    | Find SharePoint sites                         | `Sites.Read.All`                              |
| `microsoft365_mail_search`     | Search an Outlook mailbox                     | `Mail.Read`                                   |
| `microsoft365_mail_read`       | Read one message                              | `Mail.Read`                                   |
| `microsoft365_mail_send`       | Send mail                                     | `Mail.Send`                                   |
| `microsoft365_calendar_list`   | List calendar events                          | `Calendars.Read`                              |
| `microsoft365_calendar_create` | Create an event, optionally with a Teams link | `Calendars.ReadWrite`                         |
| `microsoft365_teams_list`      | List teams, or a team's channels              | `Team.ReadBasic.All`, `Channel.ReadBasic.All` |
| `microsoft365_teams_messages`  | Read a channel's newest messages              | `ChannelMessage.Read.All`                     |

The agent acts as an app, not as a person, so each mail, calendar and OneDrive call names a
user; the credential's default user is used when the agent names none. Graph does not let an
app post Teams channel messages, so the Teams tools only read.

## Set it up

1. In Entra ID (entra.microsoft.com), open **App registrations**, **New registration**, and
   pick **Accounts in this organizational directory only**. No redirect URI is needed.
2. Under **Certificates & secrets**, add a client secret and copy its value.
3. Under **API permissions**, **Add a permission**, **Microsoft Graph**, **Application
   permissions**, add the permissions of the tools you will turn on (table above), then
   **Grant admin consent**.
4. In the project, open the integrations, add a **Microsoft 365** credential with the tenant
   ID, the client ID, the secret and a default user, and bind the tools to an agent.

A call without a granted permission fails with a message that names the permission.

## Limit what the app can reach

Application permissions reach every mailbox, calendar and drive of the tenant. To hold the
app to a few mailboxes, add an Exchange
[application access policy](https://learn.microsoft.com/graph/auth-limit-mailbox-access)
(`New-ApplicationAccessPolicy -AccessRight RestrictAccess -AppId <client id> -PolicyScopeGroupId <group>`).
For SharePoint, grant `Sites.Selected` instead of `Sites.Read.All` and the file permissions,
then give the app access to chosen sites only.

Agents with **Require approval** on hold every Microsoft 365 call until a person approves it,
as they do for every integration tool.
