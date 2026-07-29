// RFC 4180 CSV serialization. A field is quoted when it contains a comma,
// quote, or newline; embedded quotes are doubled. Rows are joined with CRLF.

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => unknown;
}

export function escapeCsvField(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const header = columns.map((column) => escapeCsvField(column.header)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsvField(column.value(row))).join(","),
  );
  return [header, ...body].join("\r\n");
}

export interface MemberRow {
  name: string;
  email: string;
  phone: string | null;
  status: string;
  createdAt: string;
}

export function membersToCsv(members: readonly MemberRow[]): string {
  return toCsv(members, [
    { header: "Name", value: (member) => member.name },
    { header: "Email", value: (member) => member.email },
    { header: "Phone", value: (member) => member.phone ?? "" },
    { header: "Status", value: (member) => member.status },
    { header: "Joined", value: (member) => member.createdAt },
  ]);
}

export interface InvoiceRow {
  number: string;
  memberName: string;
  status: string;
  issuedAt: string;
  totalCents: number;
  currency: string;
}

export function invoicesToCsv(invoices: readonly InvoiceRow[]): string {
  return toCsv(invoices, [
    { header: "Number", value: (invoice) => invoice.number },
    { header: "Member", value: (invoice) => invoice.memberName },
    { header: "Status", value: (invoice) => invoice.status },
    { header: "Issued", value: (invoice) => invoice.issuedAt },
    { header: "Total", value: (invoice) => (invoice.totalCents / 100).toFixed(2) },
    { header: "Currency", value: (invoice) => invoice.currency },
  ]);
}

export interface BookingExportRow {
  startsAt: string;
  className: string;
  memberName: string;
  email: string;
  status: string;
}

// Normalizes a session start to a canonical ISO-8601 UTC timestamp. A missing
// or unparseable startsAt (e.g. a booking whose session was deleted) renders as
// an empty field instead of throwing, so one bad row can't abort the whole
// export.
function toIsoUtc(value: string): string {
  if (!value) return "";
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

// Bookings export for accounting: one row per booking joined to its session,
// class, and member. `Starts` is normalized to a canonical ISO-8601 UTC
// timestamp so a non-Z input can never leak through. Reuses toCsv so the same
// RFC 4180 quoting handles names like "Rossi, Chiara".
export function bookingsToCsv(rows: readonly BookingExportRow[]): string {
  return toCsv(rows, [
    { header: "Starts", value: (row) => toIsoUtc(row.startsAt) },
    { header: "Class", value: (row) => row.className },
    { header: "Member", value: (row) => row.memberName },
    { header: "Email", value: (row) => row.email },
    { header: "Status", value: (row) => row.status },
  ]);
}
