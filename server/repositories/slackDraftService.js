export function createSlackDraft(issues) {
  const lines = issues.map((issue) => `• *${issue.sourceName}* — ${issue.code}: ${issue.message} (${issue.field})`);
  return {
    channel: "Slack Incoming Webhook",
    issueCount: issues.length,
    text: issues.length
      ? `:rotating_light: DataPulse Guardian kritik kalite bildirimi\n${lines.join("\n")}`
      : "DataPulse Guardian: gönderilecek kritik kalite bulgusu yok.",
  };
}
