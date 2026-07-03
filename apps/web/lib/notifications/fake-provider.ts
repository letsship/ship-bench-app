import type { NotificationMessage, NotificationProvider } from "./types";

// An in-memory notification provider for tests and the local fake-backends mode.
// It records every message it "sends" so tests can assert on delivery without a
// vendor account or network.
export interface FakeProvider extends NotificationProvider {
  readonly sent: NotificationMessage[];
}

export function createFakeProvider(): FakeProvider {
  const sent: NotificationMessage[] = [];
  return {
    name: "fake",
    sent,
    async send(message) {
      sent.push(message);
      return { providerMessageId: `fake_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}` };
    },
  };
}
