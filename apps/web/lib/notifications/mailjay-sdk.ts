// mailjay — a (fictional) transactional email vendor SDK, authored for
// Studiobook and styled like a real ESM client SDK. It is intentionally
// self-contained: delivery goes through an injectable transport that defaults
// to an in-memory recorder, so the app runs and is tested with no network and
// no real vendor account. A benchmark task can later migrate the notification
// seam off this SDK onto another provider.

export interface MailjayClientOptions {
  apiKey: string;
  baseUrl?: string;
  defaultFrom?: string;
  transport?: MailjayTransport;
}

export interface MailjaySendParams {
  to: { email: string; name?: string };
  from?: string;
  subject: string;
  text: string;
  html?: string;
  tags?: string[];
  headers?: Record<string, string>;
}

export interface MailjaySendResponse {
  id: string;
  status: "queued" | "sent";
  to: string;
}

export class MailjayError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "MailjayError";
    this.status = status;
  }
}

// A transport turns validated send params into a delivery. The default records
// in memory; a real deployment would swap in one backed by `fetch`.
export interface MailjayTransport {
  deliver(params: MailjaySendParams): Promise<MailjaySendResponse>;
}

export interface InMemoryTransport extends MailjayTransport {
  readonly sent: MailjaySendParams[];
}

export function createInMemoryTransport(): InMemoryTransport {
  const sent: MailjaySendParams[] = [];
  return {
    sent,
    async deliver(params) {
      sent.push(params);
      const id = `mj_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
      return { id, status: "queued", to: params.to.email };
    },
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class MailjayClient {
  readonly messages: { send: (params: MailjaySendParams) => Promise<MailjaySendResponse> };
  private readonly defaultFrom?: string;
  private readonly transport: MailjayTransport;

  constructor(options: MailjayClientOptions) {
    if (!options.apiKey) throw new MailjayError("A mailjay apiKey is required", 401);
    this.defaultFrom = options.defaultFrom;
    this.transport = options.transport ?? createInMemoryTransport();
    this.messages = { send: (params) => this.send(params) };
  }

  private async send(params: MailjaySendParams): Promise<MailjaySendResponse> {
    const from = params.from ?? this.defaultFrom;
    if (!from) throw new MailjayError("A `from` address is required", 422);
    if (!EMAIL_PATTERN.test(params.to.email)) {
      throw new MailjayError(`Invalid recipient email: ${params.to.email}`, 422);
    }
    if (!params.subject.trim()) throw new MailjayError("A subject is required", 422);
    return this.transport.deliver({ ...params, from });
  }
}
