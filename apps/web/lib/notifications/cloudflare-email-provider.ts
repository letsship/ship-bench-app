import type { NotificationProvider } from "./types";

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

function buildSendUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/routes/send`;
}

function extractMessageId(body: unknown): string {
  // Assumed response shape: { result: { id: string } }
  const result = (body as { result?: { id?: string } } | undefined)?.result;
  if (!result?.id) {
    throw new Error("Cloudflare Email response did not contain a message id");
  }
  return result.id;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      if (!config.accountId) {
        throw new Error(
          "CF_EMAIL_ACCOUNT_ID is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
        );
      }
      if (!config.apiToken) {
        throw new Error(
          "CF_EMAIL_API_TOKEN is not set. Set it for real email delivery, or run with USE_FAKE_BACKENDS=1.",
        );
      }

      const response = await fetch(buildSendUrl(config.accountId), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: message.recipient.email,
          subject: message.subject,
          text: message.body,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Cloudflare Email send failed: ${response.status} ${text}`,
        );
      }

      const body = await response.json();
      const providerMessageId = extractMessageId(body);
      return { providerMessageId };
    },
  };
}
