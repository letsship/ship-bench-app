import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

const CF_EMAIL_SEND_URL = "https://api.cloudflare.com/client/v4/accounts/email/send";

export interface CloudflareEmailConfig {
  apiToken: string;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(CF_EMAIL_SEND_URL, {
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
        const body = await response.text();
        throw new Error(`Cloudflare Email send failed (${response.status}): ${body}`);
      }
      const data = (await response.json()) as { id?: string; message_id?: string };
      const providerMessageId = data.id ?? data.message_id;
      if (!providerMessageId) {
        throw new Error("Cloudflare Email returned no message id");
      }
      return { providerMessageId };
    },
  };
}
