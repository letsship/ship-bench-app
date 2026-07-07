import type { NotificationProvider } from "./types";

export interface CloudflareEmailConfig {
  apiToken: string;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(
        "https://api.email.cloudflare.com/send",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${config.apiToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: message.recipient.email,
            subject: message.subject,
            text: message.body,
          }),
        },
      );

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Cloudflare Email send failed (${response.status}): ${body}`,
        );
      }

      const data = await response.json() as { id?: string };
      if (!data.id) {
        throw new Error("Cloudflare Email returned no message id");
      }

      return { providerMessageId: data.id };
    },
  };
}