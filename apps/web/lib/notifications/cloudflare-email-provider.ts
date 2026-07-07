import type { NotificationMessage, NotificationProvider, SendResult } from "./types";

/**
 * Cloudflare Email send endpoint.
 *
 * Uses the Cloudflare Email Routing send API. The account identifier is
 * interpolated at runtime from the CF_ACCOUNT_ID environment variable.
 */
const CLOUDFLARE_EMAIL_SEND_ENDPOINT_BASE =
  "https://api.cloudflare.com/client/v4/accounts";

function buildSendEndpoint(accountId: string): string {
  return `${CLOUDFLARE_EMAIL_SEND_ENDPOINT_BASE}/${accountId}/email/routing/send`;
}

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  if (!config.apiToken) {
    throw new Error("CF_EMAIL_API_TOKEN is not set.");
  }
  if (!config.accountId) {
    throw new Error("CF_ACCOUNT_ID is not set.");
  }

  return {
    name: "cloudflare-email",
    async send(message: NotificationMessage): Promise<SendResult> {
      const endpoint = buildSendEndpoint(config.accountId);
      const response = await fetch(endpoint, {
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
        const text = await response.text();
        throw new Error(
          `Cloudflare Email send failed: ${response.status} ${text}`,
        );
      }

      const data = (await response.json()) as unknown;

      let id: string | undefined;
      if (
        typeof data === "object" &&
        data !== null &&
        "result" in data &&
        typeof data.result === "object" &&
        data.result !== null &&
        "id" in data.result &&
        typeof data.result.id === "string"
      ) {
        id = data.result.id;
      } else if (
        typeof data === "object" &&
        data !== null &&
        "id" in data &&
        typeof data.id === "string"
      ) {
        id = data.id;
      }

      if (!id) {
        throw new Error("Cloudflare Email returned no message id");
      }

      return { providerMessageId: id };
    },
  };
}
