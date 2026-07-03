import { MailjayClient } from "./mailjay-sdk";
import type { NotificationProvider } from "./types";

export interface MailjayProviderConfig {
  apiKey: string;
  from: string;
  transport?: ConstructorParameters<typeof MailjayClient>[0]["transport"];
}

// Adapt the mailjay SDK to the provider-agnostic NotificationProvider contract.
// Swapping vendors means writing a sibling adapter — nothing upstream of this
// file references mailjay.
export function createMailjayProvider(config: MailjayProviderConfig): NotificationProvider {
  const client = new MailjayClient({
    apiKey: config.apiKey,
    defaultFrom: config.from,
    transport: config.transport,
  });
  return {
    name: "mailjay",
    async send(message) {
      const response = await client.messages.send({
        to: { email: message.recipient.email, name: message.recipient.name },
        subject: message.subject,
        text: message.body,
        tags: [message.kind],
        headers: { "X-Studiobook-Kind": message.kind },
      });
      return { providerMessageId: response.id };
    },
  };
}
