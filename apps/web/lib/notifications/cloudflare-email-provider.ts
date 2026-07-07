import type { NotificationProvider } from "./types";

const CLOUDFLARE_EMAIL_SEND_URL = "https://api.email.cloudflare.com/send";

export interface CloudflareEmailConfig {
  apiToken: string;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(CLOUDFLARE_EMAIL_SEND_URL, {
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
        throw new Error(
          `Cloudflare Email send failed (${response.status}): ${body}`,
        );
      }

      const result = await response.json();
      const id: string | undefined = result?.id ?? result?.result?.id;
      if (!id) {
        throw new Error("Cloudflare Email returned no message id");
      }

      return { providerMessageId: id };
    },
  };
}
