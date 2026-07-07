import type { NotificationProvider } from "./types";

// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare directly — vendors are swappable
// behind NotificationProvider.

// Cloudflare Email Routing send endpoint. The address is verified at the
// account/domain level on the Cloudflare side, so the request body carries only
// { to, subject, text } with no per-request `from`.
const CF_EMAIL_SEND_URL = "https://api.cloudflare.com/client/v4/email/send";

export interface CloudflareEmailConfig {
  apiToken: string;
}

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(CF_EMAIL_SEND_URL, {
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
        let detail = `${response.status} ${response.statusText}`;
        try {
          const body = await response.text();
          if (body) detail += `: ${body}`;
        } catch {
          // Ignore body read errors; the status line is still informative.
        }
        throw new Error(`Cloudflare Email send failed: ${detail}`);
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("Cloudflare Email returned a non-JSON response");
      }

      const id = (payload as { result?: { id?: string }; id?: string } | null)?.result?.id
        ?? (payload as { id?: string } | null)?.id;
      if (!id) {
        throw new Error("Cloudflare Email returned no message id");
      }
      return { providerMessageId: id };
    },
  };
}
