// The Cloudflare Email adapter behind the provider-agnostic contract. Nothing
// upstream of this file references Cloudflare directly — vendors are swappable
// behind NotificationProvider. It speaks HTTP straight to the Cloudflare Email
// send API with a plain `fetch`, so no vendor SDK ships in the Workers bundle.

import type { NotificationProvider } from "./types";

export interface CloudflareEmailConfig {
  apiToken: string;
  // The Cloudflare Email send API endpoint. Overridable for tests; defaults to
  // the documented send path.
  endpoint?: string;
}

export const CLOUDFLARE_EMAIL_ENDPOINT =
  "https://api.cloudflare.com/client/v4/email/send";

export function createCloudflareEmailProvider(
  config: CloudflareEmailConfig,
): NotificationProvider {
  const endpoint = config.endpoint ?? CLOUDFLARE_EMAIL_ENDPOINT;
  return {
    name: "cloudflare-email",
    async send(message) {
      let response: Response;
      try {
        response = await fetch(endpoint, {
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
      } catch (err) {
        throw new Error(
          `Cloudflare Email send failed: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Cloudflare Email send failed: ${response.status} ${response.statusText}${
            body ? ` — ${body}` : ""
          }`,
        );
      }

      const data = (await response.json().catch(() => null)) as
        | { id?: string }
        | null;
      if (!data || !data.id) {
        throw new Error("Cloudflare Email returned no message id");
      }
      return { providerMessageId: data.id };
    },
  };
}
