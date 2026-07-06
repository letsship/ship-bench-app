import type { NotificationProvider, NotificationMessage, SendResult } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare's API directly — vendors are
// swappable behind NotificationProvider.

const CLOUDFLARE_EMAIL_ENDPOINT =
  "https://api.cloudflare.com/client/v4/accounts" as const;

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

const buildSendUrl = (accountId: string): string =>
  `${CLOUDFLARE_EMAIL_ENDPOINT}/${accountId}/email/routing/email/send`;

/**
 * Create a NotificationProvider backed by Cloudflare Email Routing.
 *
 * Each call to `send` issues one HTTPS POST to the Cloudflare email send API
 * authenticated with a Bearer token.  The JSON body carries the flattened
 * `{ to, subject, text }` shape and the response's `result.id` is surfaced
 * as `providerMessageId`.
 */
export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  const url = buildSendUrl(config.accountId);
  return {
    name: "cloudflare-email",
    async send(message: NotificationMessage): Promise<SendResult> {
      const response = await fetch(url, {
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
        throw new Error(
          `Cloudflare email send failed: ${response.status} ${body}`,
        );
      }

      const result: { success: boolean; errors?: unknown; result?: { id: string } } =
        await response.json();

      if (!result.success) {
        throw new Error(
          `Cloudflare email send failed: ${JSON.stringify(result.errors ?? "unknown error")}`,
        );
      }

      if (!result.result?.id) {
        throw new Error("Cloudflare email send returned no message id");
      }

      return { providerMessageId: result.result.id };
    },
  };
}