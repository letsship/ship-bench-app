import { Resend } from "resend";
import type { NotificationProvider } from "./types";

// The Resend adapter behind the provider-agnostic contract. Nothing upstream
// of this file references Resend directly — vendors are swappable behind
// NotificationProvider.

export interface ResendConfig {
  apiKey: string;
  // A verified from address, e.g. "Studiobook <hello@yourdomain.com>".
  from: string;
}

export function createResendProvider(config: ResendConfig): NotificationProvider {
  const resend = new Resend(config.apiKey);
  return {
    name: "resend",
    async send(message) {
      const { data, error } = await resend.emails.send({
        from: config.from,
        to: [message.recipient.email],
        subject: message.subject,
        text: message.body,
        tags: [{ name: "kind", value: message.kind }],
      });
      if (error) throw new Error(`Resend send failed: ${error.message}`);
      if (!data) throw new Error("Resend returned no message id");
      return { providerMessageId: data.id };
    },
  };
}
