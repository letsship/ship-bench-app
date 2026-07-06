import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare directly — vendors are
// swappable behind NotificationProvider.

export interface CloudflareEmailConfig {
  apiToken: string;
  // Cloudflare's send API is scoped to an account, and the account id is part
  // of the endpoint path (there is no account-less variant).
  accountId: string;
  // A verified from address, e.g. "Studiobook <hello@yourdomain.com>".
  from: string;
}

interface CloudflareSendResponse {
  success: boolean;
  errors?: { message: string }[];
  result?: {
    delivered?: string[];
    queued?: string[];
    permanent_bounces?: string[];
  };
}

export function createCloudflareProvider(config: CloudflareEmailConfig): NotificationProvider {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/email/sending/send`;
  return {
    name: "cloudflare",
    async send(message) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: config.from,
          to: message.recipient.email,
          subject: message.subject,
          text: message.body,
        }),
      });
      const body = (await response.json()) as CloudflareSendResponse;
      if (!response.ok || !body.success) {
        const detail = body.errors?.[0]?.message ?? response.statusText;
        throw new Error(`Cloudflare email send failed: ${detail}`);
      }
      if (body.result?.permanent_bounces?.includes(message.recipient.email)) {
        throw new Error(`Cloudflare email send failed: recipient bounced`);
      }
      // The send API reports delivery status per-recipient rather than a
      // message id in the response body, so we fall back to the per-request
      // "cf-ray" header as the stable identifier for this send.
      const providerMessageId = response.headers.get("cf-ray");
      if (!providerMessageId) throw new Error("Cloudflare returned no message id");
      return { providerMessageId };
    },
  };
}
