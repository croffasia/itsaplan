# Connecting GitHub through a GitHub App

A team can connect GitHub with a GitHub App instead of a personal access token. With an App,
the pull requests, webhooks and comments that Plan creates are made by the App's bot account
(`<app-name>[bot]`), not by the person who owns a token, and access does not end when that
person leaves the organization.

Plan signs a short-lived JWT with the App's private key and exchanges it for an installation
access token, which GitHub makes valid for one hour. The private key is stored encrypted and is
never returned by the API.

This works with github.com and with GitHub Enterprise Server.

## Create the App

1. On GitHub, open the settings of the organization (or your personal account) that owns the
   repositories: **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Enter a name and a homepage URL. The name becomes the bot's login.
3. Under **Webhook**, clear **Active**. Plan creates a webhook in each repository it manages,
   so the App needs no webhook of its own.
4. Under **Repository permissions**, set:

   | Permission    | Access         | Used for                                          |
   | ------------- | -------------- | ------------------------------------------------- |
   | Metadata      | Read-only      | reading repositories (always on)                  |
   | Contents      | Read-only      | listing branches                                  |
   | Pull requests | Read and write | listing and creating pull requests, and comments  |
   | Webhooks      | Read and write | creating and updating the repository webhooks     |
   | Actions       | Read-only      | optional: the CI status shown on a linked PR      |

5. Under **Where can this GitHub App be installed?**, choose **Only on this account**, unless
   other accounts need it too.
6. Click **Create GitHub App**. Note the **App ID** (or the **Client ID**; either works) at the
   top of the App's page.
7. Under **Private keys**, click **Generate a private key**. Your browser downloads a `.pem` file.
   Plan accepts RSA keys of 2048 to 4096 bits; the key GitHub generates is 2048 bits.

## Install the App

1. On the App's page, open **Install App** and install it on the account.
2. Choose the repositories Plan should manage, or all repositories.
3. After the installation, GitHub opens its settings page. The number at the end of that
   address is the **Installation ID**, for example `12345678` in
   `https://github.com/organizations/acme/settings/installations/12345678`.

## Connect it in Plan

1. Open the team's **Settings → Git** and click **Connect GitHub App**. Only team owners and
   managers see this page.
2. Leave the provider URL as `https://github.com`, or enter the address of your GitHub
   Enterprise Server.
3. Enter the App ID (or Client ID) and the Installation ID, then click **Choose .pem file** and
   select the file you downloaded from GitHub. Plan shows only the file name, never the key. If
   you keep the key in a password manager instead, click **Paste the key instead** and paste the
   whole content of the key, including the `BEGIN` and `END` lines.
4. Click **Connect**. Plan checks the key and the installation with GitHub before it saves
   anything.
5. Delete the `.pem` file from your computer. Plan keeps the key encrypted and never returns it.

The connection is listed as **GitHub App**, with the account the App is installed on. In each
project, **Settings → Git** then lists the repositories of the installation, and Plan creates
the webhook of each repository you select with the App's token.

## Changing or removing the App

- To rotate the private key, generate a new one on GitHub and connect the same installation
  again with it. Plan updates the existing connection; the repositories and webhooks stay.
- To add or remove repositories, change the installation on GitHub. Plan cannot read a
  repository removed from the installation, or open pull requests in it; disconnect it in the
  project's **Settings → Git**.
- **Disconnect** removes the webhooks Plan created, then the connection. If the App was
  already uninstalled or its key revoked, Plan cannot reach the repositories any more: it
  removes the connection and leaves the webhooks, which you can delete in each repository's
  settings. If GitHub fails for another reason, such as a rate limit, Disconnect shows the
  error and keeps the connection, so you can try again.
