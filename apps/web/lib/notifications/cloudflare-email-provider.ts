import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

export interface CloudflareEmailConfig {
  apiToken: string;
}

const CF_EMAIL_API_URL = "https://api.cloudflare.com/client/v4/email/send";

interface CloudflareEmailResponse {
  success: boolean;
  result?: { id: string };
  errors?: { message: string }[];
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(CF_EMAIL_API_URL, {
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
      const body = (await response.json()) as CloudflareEmailResponse;
      if (!response.ok || !body.success) {
        const detail = body.errors?.map((e) => e.message).join(", ") || response.statusText;
        throw new Error(`Cloudflare Email send failed: ${detail}`);
      }
      if (!body.result?.id) throw new Error("Cloudflare Email returned no message id");
      return { providerMessageId: body.result.id };
    },
  };
}
