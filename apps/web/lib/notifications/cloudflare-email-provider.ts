import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

export function cloudflareEmailSendUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;
}

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  const sendUrl = cloudflareEmailSendUrl(config.accountId);
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(sendUrl, {
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
        const detail = await response.text().catch(() => response.statusText);
        throw new Error(`Cloudflare Email send failed: ${response.status} ${detail}`);
      }
      // The REST API's success payload carries delivery status
      // (delivered/permanent_bounces/queued), not a message id, so we
      // synthesize one for the outbox to store.
      const data = (await response.json()) as {
        success?: boolean;
        errors?: Array<{ code: number; message: string }>;
      };
      if (!data.success) {
        const detail = data.errors?.map((e) => e.message).join(", ") || "unknown error";
        throw new Error(`Cloudflare Email send failed: ${detail}`);
      }
      return { providerMessageId: `cf_${crypto.randomUUID()}` };
    },
  };
}
