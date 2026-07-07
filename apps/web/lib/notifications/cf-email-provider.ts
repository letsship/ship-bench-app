import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references the vendor directly — providers are
// swappable behind NotificationProvider.

export interface CfEmailConfig {
  apiKey: string;
  endpoint?: string;
}

const DEFAULT_ENDPOINT = "https://api.cloudflare.com/client/v4/email/send";

export function createCfEmailProvider(config: CfEmailConfig): NotificationProvider {
  const endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: message.recipient.email,
          subject: message.subject,
          text: message.body,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `Cloudflare email send failed: ${response.status} ${response.statusText}`,
        );
      }
      const data = (await response.json()) as { result?: { id?: string }; id?: string };
      const providerMessageId = data?.result?.id ?? data?.id;
      if (!providerMessageId) {
        throw new Error("Cloudflare returned no message id");
      }
      return { providerMessageId };
    },
  };
}
