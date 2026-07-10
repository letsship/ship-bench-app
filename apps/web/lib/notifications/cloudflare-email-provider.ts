import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

function buildSendUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;
}

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

interface CloudflareEmailSendResponse {
  result: {
    message_id: string;
  };
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
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
        const detail = await response.text();
        throw new Error(`Cloudflare Email send failed (${response.status}): ${detail}`);
      }
      const data = (await response.json()) as CloudflareEmailSendResponse;
      const messageId = data.result?.message_id;
      if (!messageId) throw new Error("Cloudflare Email returned no message id");
      return { providerMessageId: messageId };
    },
  };
}
