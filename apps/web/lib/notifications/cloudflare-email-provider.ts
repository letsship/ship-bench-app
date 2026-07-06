import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider. Uses the platform's built-in fetch
// rather than a bundled SDK, since this app runs at the Cloudflare Workers edge.

const CLOUDFLARE_EMAIL_SEND_URL = "https://api.cloudflare.com/client/v4/email/messages";

export interface CloudflareEmailConfig {
  apiToken: string;
  // A verified from address, e.g. "Studiobook <hello@yourdomain.com>".
  from: string;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  if (!config.apiToken) {
    throw new Error("Cloudflare Email API token is required to send email.");
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
      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Cloudflare Email send failed: ${response.status} ${body}`);
      }
      const data = (await response.json()) as { id?: string };
      if (!data.id) throw new Error("Cloudflare Email returned no message id");
      return { providerMessageId: data.id };
    },
  };
}
