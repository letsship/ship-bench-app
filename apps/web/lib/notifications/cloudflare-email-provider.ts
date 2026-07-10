import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare Email directly — vendors are
// swappable behind NotificationProvider.

// Matches the REST API's account-scoped send endpoint (see
// .agents/skills/cloudflare-email-service/references/rest-api.md) — there is
// no unscoped `/email/send` route.
export function defaultCfEmailApiUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/email/sending/send`;
}

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
  // Overridable for testing / regional endpoints; defaults to the
  // account-scoped Cloudflare email send API.
  apiUrl?: string;
}

interface CloudflareEmailResponse {
  success: boolean;
  errors: { code: number; message: string }[];
  result: { delivered: string[]; permanent_bounces: string[]; queued: string[] } | null;
}

export function createCloudflareEmailProvider(config: CloudflareEmailConfig): NotificationProvider {
  const apiUrl = config.apiUrl ?? defaultCfEmailApiUrl(config.accountId);
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
      const data = (await response.json()) as CloudflareEmailResponse;
      if (!data.success) {
        const detail = data.errors.map((e) => `${e.code}: ${e.message}`).join(", ");
        throw new Error(`Cloudflare Email send failed: ${detail || "unknown error"}`);
      }
      if (data.result?.permanent_bounces.includes(message.recipient.email)) {
        throw new Error(
          `Cloudflare Email send failed: ${message.recipient.email} permanently bounced`,
        );
      }
      // The REST API's response carries delivery status, not a message id
      // (that field only exists on the Workers-binding response) — mint our
      // own correlation id for the outbox to key on.
      return { providerMessageId: `cf_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}` };
    },
  };
}
