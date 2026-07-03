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
