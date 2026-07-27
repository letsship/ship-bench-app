import { describe, it, expect } from "vitest";
import {
  createMemberSchema,
  updateMemberSchema,
  createClassTypeSchema,
  createSessionSchema,
  createBookingSchema,
  createInvoiceSchema,
} from "./validation";

describe("createMemberSchema", () => {
  it("rejects malformed email", () => {
    const result = createMemberSchema.safeParse({
      name: "John Doe",
      email: "not-an-email",
      status: "active",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid email with whitespace and mixed case, trims and lowercases it", () => {
    const result = createMemberSchema.safeParse({
      name: "John Doe",
      email: "  Foo@Bar.COM  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("foo@bar.com");
    }
  });

  it("defaults status to active when omitted", () => {
    const result = createMemberSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("active");
    }
  });

  it("trims name", () => {
    const result = createMemberSchema.safeParse({
      name: "  John Doe  ",
      email: "john@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("John Doe");
    }
  });
});

describe("updateMemberSchema", () => {
  it("accepts valid email with whitespace and mixed case, trims and lowercases it", () => {
    const result = updateMemberSchema.safeParse({
      email: "  Baz@Example.ORG  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("baz@example.org");
    }
  });

  it("allows all fields to be omitted", () => {
    const result = updateMemberSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe("createClassTypeSchema", () => {
  it("rejects color that is not #rrggbb hex format", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Pilates",
      color: "red",
      defaultCapacity: 10,
      defaultPriceCents: 1500,
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid #rrggbb hex color", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Pilates",
      color: "#ff00aa",
      defaultCapacity: 10,
      defaultPriceCents: 1500,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe("#ff00aa");
    }
  });

  it("allows optional color to be omitted", () => {
    const result = createClassTypeSchema.safeParse({
      name: "Yoga",
      defaultCapacity: 20,
      defaultPriceCents: 2000,
    });
    expect(result.success).toBe(true);
  });

  it("trims name and description", () => {
    const result = createClassTypeSchema.safeParse({
      name: "  Zumba  ",
      description: "  Fun dance class  ",
      defaultCapacity: 15,
      defaultPriceCents: 1800,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Zumba");
      expect(result.data.description).toBe("Fun dance class");
    }
  });
});

describe("createSessionSchema", () => {
  it("accepts valid ISO datetimes", () => {
    const result = createSessionSchema.safeParse({
      classTypeId: "class-1",
      instructor: "Alice",
      startsAt: "2026-08-01T10:00:00Z",
      endsAt: "2026-08-01T11:00:00Z",
      capacity: 10,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid ISO datetime", () => {
    const result = createSessionSchema.safeParse({
      classTypeId: "class-1",
      instructor: "Alice",
      startsAt: "not-a-date",
      endsAt: "2026-08-01T11:00:00Z",
      capacity: 10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when endsAt is not after startsAt", () => {
    const result = createSessionSchema.safeParse({
      classTypeId: "class-1",
      instructor: "Alice",
      startsAt: "2026-08-01T11:00:00Z",
      endsAt: "2026-08-01T10:00:00Z",
      capacity: 10,
    });
    expect(result.success).toBe(false);
  });
});

describe("createBookingSchema", () => {
  it("accepts valid booking", () => {
    const result = createBookingSchema.safeParse({
      sessionId: "session-1",
      memberId: "member-1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty sessionId", () => {
    const result = createBookingSchema.safeParse({
      sessionId: "",
      memberId: "member-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("createInvoiceSchema", () => {
  it("accepts valid invoice with line items", () => {
    const result = createInvoiceSchema.safeParse({
      memberId: "member-1",
      lineItems: [
        {
          description: "Class pass",
          quantity: 5,
          unitAmountCents: 2000,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invoice with no line items", () => {
    const result = createInvoiceSchema.safeParse({
      memberId: "member-1",
      lineItems: [],
    });
    expect(result.success).toBe(false);
  });
});
