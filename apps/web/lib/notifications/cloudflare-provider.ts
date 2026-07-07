import type { NotificationProvider } from "./types";

const CLOUDFLARE_EMAIL_SEND_URL = "https://api.cloudflare.com/client/v4/email/sending/send";

export interface CloudflareEmailConfig {
  apiToken: string;
}

type CloudflareEmailResponse = {
  id?: string;
  messageId?: string;
  message_id?: string;
  result?: {
    id?: string;
    messageId?: string;
    message_id?: string;
    delivered?: string[];
    queued?: string[];
  };
};

const responseText = async (response: Response): Promise<string> => {
  const body = await response.text();
  return body || "<empty response body>";
};

const providerMessageIdFrom = (payload: CloudflareEmailResponse): string => {
  const id =
    payload.result?.id ??
    payload.result?.messageId ??
    payload.result?.message_id ??
    payload.id ??
    payload.messageId ??
    payload.message_id;
  if (id) return id;

  const deliveredOrQueued = [...(payload.result?.delivered ?? []), ...(payload.result?.queued ?? [])];
  if (deliveredOrQueued.length > 0) return `cloudflare:${deliveredOrQueued.join(",")}`;

  throw new Error("Cloudflare Email returned no message id");
};

export function createCloudflareProvider(config: CloudflareEmailConfig): NotificationProvider {
  return {
    name: "cloudflare-email",
    async send(message) {
      const response = await fetch(CLOUDFLARE_EMAIL_SEND_URL, {
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

      const body = await responseText(response);
      if (!response.ok) {
        throw new Error(`Cloudflare Email send failed: ${response.status} ${body}`);
      }

      return {
        providerMessageId: providerMessageIdFrom(JSON.parse(body) as CloudflareEmailResponse),
      };
    },
  };
}
