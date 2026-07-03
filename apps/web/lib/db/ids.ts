// Short, human-scannable, URL-safe entity ids, e.g. "mem_a1b2c3d4e5f6...".
// Generated app-side so route handlers can return the id of a freshly created
// row without a round-trip.
export type IdPrefix =
  | "stu"
  | "mem"
  | "ct"
  | "cs"
  | "bkg"
  | "inv"
  | "ili"
  | "nof";

export function newId(prefix: IdPrefix): string {
  const body = crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${body.slice(0, 20)}`;
}
