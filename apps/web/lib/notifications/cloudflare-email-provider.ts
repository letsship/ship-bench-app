import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file talks to Cloudflare's API directly — vendors are
// swappable behind NotificationProvider.

const CLOUDFLARE_EMAIL_SEND_URL = "https://api.cloudflare.com/client/v4/email/send";

export interface CloudflareEmailConfig {
  apiToken: string;
  // A verified from address, e.g. "Studiobook <hello@yourdomain.com>".
  from: string;
}

interface CloudflareEmailSendResponse {
  id?: string;
  errors?: { message: string }[];
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
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
          from: config.from,
          to: message.recipient.email,
          subject: message.subject,
          text: message.body,
        }),
      });
      const data = (await response.json()) as CloudflareEmailSendResponse;
      if (!response.ok) {
        const reason = data.errors?.[0]?.message ?? response.statusText;
        throw new Error(`Cloudflare Email send failed: ${reason}`);
      }
      if (!data.id) throw new Error("Cloudflare Email returned no message id");
      return { providerMessageId: data.id };
    },
  };
}
