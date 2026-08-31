function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function gitlabWebhookCommand(payloadUrl: string, secret: string): string {
  return [
    'glab api projects/:id/hooks',
    '--method POST',
    `--raw-field url=${shellQuote(payloadUrl)}`,
    `--raw-field token=${shellQuote(secret)}`,
    '--field merge_requests_events=true',
    '--field pipeline_events=true',
    '--field push_events=true',
    '--field enable_ssl_verification=true',
    '--silent',
  ].join(' \\\n  ');
}
