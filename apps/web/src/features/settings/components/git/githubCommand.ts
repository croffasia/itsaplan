function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function githubWebhookCommand(payloadUrl: string, secret: string): string {
  return [
    'gh api repos/<owner>/<repo>/hooks',
    "-f name=web -F active=true -f 'events[]=pull_request' -f 'events[]=check_run' -f 'events[]=create' -f 'events[]=delete'",
    `-f ${shellQuote(`config[url]=${payloadUrl}`)} -f 'config[content_type]=json' -f ${shellQuote(`config[secret]=${secret}`)}`,
  ].join(' \\\n  ');
}
