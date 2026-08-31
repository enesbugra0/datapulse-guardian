import { readFile } from "node:fs/promises";

const messagePath = process.argv[2];
const webhookUrl = process.env.SLACK_WEBHOOK_URL;

if (!messagePath) {
  console.error("Kullanım: node scripts/send-standup.mjs <mesaj-dosyası>");
  process.exit(2);
}

if (!webhookUrl) {
  console.error("SLACK_WEBHOOK_URL tanımlı değil; mesaj gönderilmedi.");
  process.exit(3);
}

const text = (await readFile(messagePath, "utf8")).trim();
if (!text) {
  console.error("Mesaj dosyası boş; mesaj gönderilmedi.");
  process.exit(4);
}

const response = await fetch(webhookUrl, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ text }),
});

if (!response.ok) {
  console.error(`Slack ${response.status} hatası döndürdü.`);
  process.exit(5);
}

console.log("Slack mesajı başarıyla gönderildi.");
