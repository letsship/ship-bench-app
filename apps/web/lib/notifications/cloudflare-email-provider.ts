import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

// Cloudflare Email REST API send endpoint, scoped to the sending account. See
// .agents/skills/cloudflare-email-service/references/rest-api.md.
const cfEmailSendUrl = (accountId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

interface CloudflareEmailResponse {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  result: { delivered: string[]; permanent_bounces: string[]; queued: string[] } | null;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(cfEmailSendUrl(config.accountId), {
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
        throw new Error(`Cloudflare Email send failed: ${response.status} ${body}`);
      }
      const data = (await response.json()) as CloudflareEmailResponse;
      if (!data.success || !data.result) {
        const reason = data.errors.map((error) => error.message).join(", ") || "unknown error";
        throw new Error(`Cloudflare Email send failed: ${reason}`);
      }
      // The REST API's success response carries delivery status
      // (delivered/permanent_bounces/queued), not a message id, so the
      // per-request CF-Ray header is the only unique id Cloudflare returns.
      const providerMessageId = response.headers.get("cf-ray");
      if (!providerMessageId) throw new Error("Cloudflare Email returned no message id");
      return { providerMessageId };
    },
  };
}
