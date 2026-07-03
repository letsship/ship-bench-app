import { Resend } from "resend";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeProvider } from "./fake-provider";
import { createResendProvider } from "./resend-provider";
import type { NotificationMessage } from "./types";

vi.mock("resend", () => ({ Resend: vi.fn() }));

const message: NotificationMessage = {
  kind: "booking_confirmation",
  recipient: { memberId: "m1", email: "a@b.co", name: "A" },
  subject: "Hi",
  body: "Body text",
  data: {},
};

describe("fake provider", () => {
  it("records sent messages and returns a fake id", async () => {
    const provider = createFakeProvider();
    const result = await provider.send(message);
    expect(provider.name).toBe("fake");
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]).toBe(message);
    expect(result.providerMessageId.startsWith("fake_")).toBe(true);
  });
});

describe("resend provider", () => {
  const send = vi.fn();

  beforeEach(() => {
    send.mockReset();
    vi.mocked(Resend).mockImplementation(() => ({ emails: { send } }) as unknown as Resend);
  });

  it("maps a message onto the Resend send params", async () => {
    send.mockResolvedValue({ data: { id: "re_x" }, error: null });
    const provider = createResendProvider({ apiKey: "k", from: "Studiobook <s@b.co>" });
    const result = await provider.send(message);
    expect(result.providerMessageId).toBe("re_x");
    expect(send).toHaveBeenCalledWith({
      from: "Studiobook <s@b.co>",
      to: ["a@b.co"],
      subject: "Hi",
      text: "Body text",
      tags: [{ name: "kind", value: "booking_confirmation" }],
    });
  });

  it("throws when Resend returns an error", async () => {
    send.mockResolvedValue({ data: null, error: { message: "bad recipient" } });
    const provider = createResendProvider({ apiKey: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/Resend send failed: bad recipient/);
  });

  it("throws when Resend returns no id", async () => {
    send.mockResolvedValue({ data: null, error: null });
    const provider = createResendProvider({ apiKey: "k", from: "s@b.co" });
    await expect(provider.send(message)).rejects.toThrow(/no message id/);
  });
});
