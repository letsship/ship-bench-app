import { describe, expect, it } from "vitest";
import { createMailjayProvider } from "./mailjay-provider";
import { MailjayClient, MailjayError, createInMemoryTransport } from "./mailjay-sdk";
import type { NotificationMessage } from "./types";

describe("MailjayClient", () => {
  it("requires an apiKey", () => {
    expect(() => new MailjayClient({ apiKey: "" })).toThrow(MailjayError);
  });

  it("sends through the in-memory transport and returns a queued id", async () => {
    const transport = createInMemoryTransport();
    const client = new MailjayClient({ apiKey: "k", defaultFrom: "from@studio.co", transport });
    const response = await client.messages.send({
      to: { email: "to@studio.co" },
      subject: "Hi",
      text: "Body",
    });
    expect(response.id).toMatch(/^mj_/);
    expect(response.status).toBe("queued");
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0].from).toBe("from@studio.co");
  });

  it("rejects a missing from address", async () => {
    const client = new MailjayClient({ apiKey: "k" });
    await expect(
      client.messages.send({ to: { email: "to@studio.co" }, subject: "Hi", text: "b" }),
    ).rejects.toBeInstanceOf(MailjayError);
  });

  it("rejects an invalid recipient email", async () => {
    const client = new MailjayClient({ apiKey: "k", defaultFrom: "f@studio.co" });
    await expect(
      client.messages.send({ to: { email: "not-an-email" }, subject: "Hi", text: "b" }),
    ).rejects.toBeInstanceOf(MailjayError);
  });

  it("rejects an empty subject", async () => {
    const client = new MailjayClient({ apiKey: "k", defaultFrom: "f@studio.co" });
    await expect(
      client.messages.send({ to: { email: "to@studio.co" }, subject: "  ", text: "b" }),
    ).rejects.toBeInstanceOf(MailjayError);
  });
});

describe("createMailjayProvider", () => {
  const message: NotificationMessage = {
    kind: "booking_confirmation",
    recipient: { memberId: "mem_1", email: "member@studio.co", name: "Member" },
    subject: "You're booked",
    body: "See you soon",
    data: {},
  };

  it("exposes the provider name", () => {
    const provider = createMailjayProvider({ apiKey: "k", from: "f@studio.co" });
    expect(provider.name).toBe("mailjay");
  });

  it("maps the notification message onto mailjay params", async () => {
    const transport = createInMemoryTransport();
    const provider = createMailjayProvider({ apiKey: "k", from: "f@studio.co", transport });
    const result = await provider.send(message);
    expect(result.providerMessageId).toMatch(/^mj_/);
    expect(transport.sent[0]).toMatchObject({
      to: { email: "member@studio.co", name: "Member" },
      subject: "You're booked",
      text: "See you soon",
      tags: ["booking_confirmation"],
    });
  });
});
