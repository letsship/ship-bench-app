import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare's email API directly — vendors
// are swappable behind NotificationProvider.

const CLOUDFLARE_EMAIL_SEND_URL = "https://api.cloudflare.com/client/v4/email/send";

export interface CloudflareEmailConfig {
  apiToken: string;
  // A verified from address, e.g. "Studiobook <hello@yourdomain.com>".
  from: string;
}

interface CloudflareEmailSendResponse {
  success: boolean;
  result?: { id: string };
  errors?: Array<{ message: string }>;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  if (!config.apiToken) {
    throw new Error("Cloudflare Email API token is missing.");
  }
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
      const payload = (await response.json()) as CloudflareEmailSendResponse;
      if (!response.ok || !payload.success || !payload.result) {
        const reason = payload.errors?.map((e) => e.message).join(", ") || response.statusText;
        throw new Error(`Cloudflare Email send failed: ${reason}`);
      }
      return { providerMessageId: payload.result.id };
    },
  };
}
