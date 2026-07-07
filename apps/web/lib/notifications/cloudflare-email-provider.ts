import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare directly — vendors are swappable
// behind NotificationProvider.

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
  from: string;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  if (!config.apiToken || config.apiToken.trim().length === 0) {
    throw new Error("CF_EMAIL_API_TOKEN is required");
  }
  if (!config.accountId || config.accountId.trim().length === 0) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID is required");
  }

  return {
    name: "cloudflare-email",
    async send(message) {
      const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: message.recipient.email,
          subject: message.subject,
          text: message.body,
        }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "unknown error");
        throw new Error(
          `Cloudflare Email send failed (${response.status}): ${text}`,
        );
      }

      const json = (await response.json()) as {
        result?: { message_id?: string };
      };
      const providerMessageId = json.result?.message_id;
      if (!providerMessageId) {
        throw new Error("Cloudflare Email returned no message id");
      }

      return { providerMessageId };
    },
  };
}
