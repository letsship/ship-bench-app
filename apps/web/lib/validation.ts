import { z } from "zod";

// Zod schemas for every API input boundary. Route handlers parse request bodies
// through these before touching the database.

const isoDatetime = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), { message: "Invalid ISO datetime" });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a #rrggbb hex color");

export const createClassTypeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  color: hexColor.optional(),
  defaultCapacity: z.number().int().min(1).max(500),
  defaultPriceCents: z.number().int().min(0),
});

export const updateClassTypeSchema = createClassTypeSchema.partial();

export const createSessionSchema = z
  .object({
    classTypeId: z.string().min(1),
    instructor: z.string().trim().min(1).max(100),
    startsAt: isoDatetime,
    endsAt: isoDatetime,
    capacity: z.number().int().min(1).max(500),
    priceCents: z.number().int().min(0).optional(),
  })
  .refine((value) => Date.parse(value.endsAt) > Date.parse(value.startsAt), {
    message: "endsAt must be after startsAt",
    path: ["endsAt"],
  });

export const createMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(["active", "paused", "cancelled"]).default("active"),
});

export const updateMemberSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  status: z.enum(["active", "paused", "cancelled"]).optional(),
  notificationsOptedOut: z.boolean().optional(),
});

export const createBookingSchema = z.object({
  sessionId: z.string().min(1),
  memberId: z.string().min(1),
});

export const createInvoiceSchema = z.object({
  memberId: z.string().min(1),
  dueAt: isoDatetime.optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(200),
        quantity: z.number().int().min(1).max(1000),
        unitAmountCents: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const updateInvoiceStatusSchema = z.object({
  status: z.enum(["draft", "open", "paid", "void", "refunded"]),
});

export const stripeWebhookEventSchema = z.object({
  id: z.string(),
  type: z.string(),
  data: z.object({
    object: z.object({
      metadata: z
        .object({
          invoice_id: z.string().optional(),
        })
        .optional(),
    }),
  }),
});

export type CreateClassTypeInput = z.infer<typeof createClassTypeSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type StripeWebhookEvent = z.infer<typeof stripeWebhookEventSchema>;
