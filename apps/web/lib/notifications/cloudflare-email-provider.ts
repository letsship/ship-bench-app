import type { NotificationProvider } from "./types";

export interface CloudflareEmailConfig {
  apiToken: string;
  accountId: string;
}

/**
 * Cloudflare Email adapter behind the provider-agnostic contract.
 *
 * NOTE: this uses the Cloudflare Email Service REST API
 * (POST /accounts/{account_id}/email/sending/send). The account ID and API token
 * are both required. The `from` address is omitted from the request body because
 * sender identity is configured on the Cloudflare side; if the API begins to
 * require it this adapter will need to be updated.
 */
export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`,
        {
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
        },
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Cloudflare email send failed (${response.status} ${response.statusText}): ${body}`,
        );
      }

      const json = (await response.json()) as {
        result?: { message_id?: string; id?: string };
      };
      const id = json.result?.message_id ?? json.result?.id;
      if (!id) {
        throw new Error("Cloudflare email send did not return a message id");
      }
      return { providerMessageId: id };
    },
  };
}
