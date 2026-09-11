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

export async function sendSlackDraft(draft, { webhookUrl, fetchImpl = fetch }) {
  if (!webhookUrl) return { sent: false, reason: "not_configured" };
  let target;
  try {
    target = new URL(webhookUrl);
  } catch {
    return { sent: false, reason: "invalid_webhook" };
  }
  if (target.protocol !== "https:" || !["hooks.slack.com", "hooks.slack-gov.com"].includes(target.hostname)) {
    return { sent: false, reason: "invalid_webhook" };
  }
  const response = await fetchImpl(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: draft.text }),
  });
  return { sent: response.ok, reason: response.ok ? null : "slack_rejected", status: response.status };
}
