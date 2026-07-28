import type {
  Booking,
  ClassSession,
  ClassType,
  Invoice,
  InvoiceLineItem,
  Member,
  NotificationOutboxRow,
  Studio,
  StudioSettings,
} from "../types";
import type { Repositories, SessionRange } from "./types";

// In-memory implementation of the repository seam. Used by the test suite
// (fully hermetic — no Postgres, no native modules) and by the local
// fake-backends mode (`USE_FAKE_BACKENDS=1`). Rows are cloned on the way in and
// out so callers can never mutate the store by reference.

export interface SeedData {
  studio: Studio;
  settings: StudioSettings;
  members: Member[];
  classTypes: ClassType[];
  sessions: ClassSession[];
  bookings: Booking[];
  invoices: Invoice[];
  lineItems: InvoiceLineItem[];
  outbox: NotificationOutboxRow[];
}

interface Store {
  studios: Studio[];
  settings: StudioSettings[];
  members: Member[];
  classTypes: ClassType[];
  classSessions: ClassSession[];
  bookings: Booking[];
  invoices: Invoice[];
  invoiceLineItems: InvoiceLineItem[];
  outbox: NotificationOutboxRow[];
}

const clone = <T>(row: T): T => ({ ...row });
const cloneAll = <T>(rows: T[]): T[] => rows.map(clone);

function inRange(startsAt: string, range: SessionRange): boolean {
  if (range.from && startsAt < range.from) return false;
  if (range.to && startsAt >= range.to) return false;
  return true;
}

function patched<T>(list: T[], match: (row: T) => boolean, patch: Partial<T>, label: string): T {
  const index = list.findIndex(match);
  if (index === -1) throw new Error(`${label} not found`);
  list[index] = { ...list[index], ...patch };
  return clone(list[index]);
}

export function createInMemoryRepositories(seed?: SeedData): Repositories {
  const store: Store = {
    studios: seed ? [clone(seed.studio)] : [],
    settings: seed ? [clone(seed.settings)] : [],
    members: seed ? cloneAll(seed.members) : [],
    classTypes: seed ? cloneAll(seed.classTypes) : [],
    classSessions: seed ? cloneAll(seed.sessions) : [],
    bookings: seed ? cloneAll(seed.bookings) : [],
    invoices: seed ? cloneAll(seed.invoices) : [],
    invoiceLineItems: seed ? cloneAll(seed.lineItems) : [],
    outbox: seed ? cloneAll(seed.outbox) : [],
  };

  return {
    studios: {
      async getFirst() {
        return store.studios[0] ? clone(store.studios[0]) : null;
      },
    },
    settings: {
      async getByStudioId(studioId) {
        const found = store.settings.find((row) => row.studioId === studioId);
        return found ? clone(found) : null;
      },
      async update(studioId, patch) {
        return patched(
          store.settings,
          (row) => row.studioId === studioId,
          patch,
          "Studio settings",
        );
      },
    },
    members: {
      async listByStudio(studioId) {
        return cloneAll(
          store.members
            .filter((row) => row.studioId === studioId)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      },
      async getById(id) {
        const found = store.members.find((row) => row.id === id);
        return found ? clone(found) : null;
      },
      async findByEmail(studioId, email) {
        const found = store.members.find((row) => row.studioId === studioId && row.email === email);
        return found ? clone(found) : null;
      },
      async insert(member) {
        store.members.push(clone(member));
        return clone(member);
      },
      async update(id, patch) {
        return patched(store.members, (row) => row.id === id, patch, "Member");
      },
    },
    classTypes: {
      async listByStudio(studioId) {
        return cloneAll(
          store.classTypes
            .filter((row) => row.studioId === studioId)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      },
      async getById(id) {
        const found = store.classTypes.find((row) => row.id === id);
        return found ? clone(found) : null;
      },
      async insert(classType) {
        store.classTypes.push(clone(classType));
        return clone(classType);
      },
    },
    classSessions: {
      async listByStudio(studioId, range = {}) {
        return cloneAll(
          store.classSessions
            .filter((row) => row.studioId === studioId && inRange(row.startsAt, range))
            .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        );
      },
      async getById(id) {
        const found = store.classSessions.find((row) => row.id === id);
        return found ? clone(found) : null;
      },
      async insert(session) {
        store.classSessions.push(clone(session));
        return clone(session);
      },
    },
    bookings: {
      async listBySessionIds(sessionIds) {
        const ids = new Set(sessionIds);
        return cloneAll(store.bookings.filter((row) => ids.has(row.sessionId)));
      },
      async listBySession(sessionId) {
        return cloneAll(store.bookings.filter((row) => row.sessionId === sessionId));
      },
      async getById(id) {
        const found = store.bookings.find((row) => row.id === id);
        return found ? clone(found) : null;
      },
      async insert(booking) {
        store.bookings.push(clone(booking));
        return clone(booking);
      },
      async update(id, patch) {
        return patched(store.bookings, (row) => row.id === id, patch, "Booking");
      },
    },
    invoices: {
      async listByStudio(studioId) {
        return cloneAll(
          store.invoices
            .filter((row) => row.studioId === studioId)
            .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)),
        );
      },
      async getById(id) {
        const found = store.invoices.find((row) => row.id === id);
        return found ? clone(found) : null;
      },
      async countByStudio(studioId) {
        return store.invoices.filter((row) => row.studioId === studioId).length;
      },
      async insert(invoice) {
        store.invoices.push(clone(invoice));
        return clone(invoice);
      },
      async update(id, patch) {
        return patched(store.invoices, (row) => row.id === id, patch, "Invoice");
      },
    },
    invoiceLineItems: {
      async listByInvoice(invoiceId) {
        return cloneAll(store.invoiceLineItems.filter((row) => row.invoiceId === invoiceId));
      },
      async insertMany(items) {
        for (const item of items) store.invoiceLineItems.push(clone(item));
        return cloneAll(items);
      },
      async updateLineItem(id, patch) {
        return patched(store.invoiceLineItems, (row) => row.id === id, patch, "Invoice line item");
      },
    },
    outbox: {
      async insert(row) {
        store.outbox.push(clone(row));
        return clone(row);
      },
      async listPending() {
        return cloneAll(store.outbox.filter((row) => row.sentAt === null));
      },
      async update(id, patch) {
        return patched(store.outbox, (row) => row.id === id, patch, "Outbox row");
      },
    },
  };
}
