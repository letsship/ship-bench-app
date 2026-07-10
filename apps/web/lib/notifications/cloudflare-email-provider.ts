import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

export const DEFAULT_CF_EMAIL_API_URL = "https://api.cloudflare.com/client/v4/email/send";

export interface CloudflareEmailConfig {
  apiToken: string;
  // Overridable for testing / regional endpoints; defaults to the Cloudflare
  // email send API.
  apiUrl?: string;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  const apiUrl = config.apiUrl ?? DEFAULT_CF_EMAIL_API_URL;
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(apiUrl, {
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
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Cloudflare Email send failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
        );
      }
      const data = (await response.json()) as { id?: string };
      if (!data.id) throw new Error("Cloudflare Email returned no message id");
      return { providerMessageId: data.id };
    },
  };
}
