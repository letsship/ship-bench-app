import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare directly — vendors are swappable
// behind NotificationProvider.

// Send endpoint for the Cloudflare email send API. Defined as a single named
// constant so the host/path is a one-line fix if the real endpoint differs.
export const CLOUDFLARE_EMAIL_SEND_URL =
  "https://api.cloudflare.com/client/v4/accounts/email/messages";

export interface CloudflareEmailConfig {
  apiToken: string;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  const authHeader = `Bearer ${config.apiToken}`;
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(CLOUDFLARE_EMAIL_SEND_URL, {
        method: "POST",
        headers: {
          Authorization: authHeader,
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
          `Cloudflare email send failed: ${response.status} ${response.statusText} ${body}`,
        );
      }
      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        throw new Error("Cloudflare returned no message id");
      }
      return { providerMessageId: data.id };
    },
  };
}
