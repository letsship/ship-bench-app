import type { ExperimentClient } from "./types";

// An in-memory experiment client for tests and the local fake-backends mode.
// It records every captureWaitlistJoined call so tests can assert on it
// without a vendor account, and lets tests pin a member to a specific
// variant. Mirrors lib/notifications/fake-provider.ts.
export interface FakeExperimentClient extends ExperimentClient {
  readonly captured: { memberId: string; sessionId: string }[];
  setVariant(memberId: string, variant: string): void;
}

export function createFakeExperimentClient(defaultVariant = "test"): FakeExperimentClient {
  const variants = new Map<string, string>();
  const captured: { memberId: string; sessionId: string }[] = [];
  return {
    captured,
    setVariant(memberId, variant) {
      variants.set(memberId, variant);
    },
    async getWaitlistVariant(memberId) {
      return variants.get(memberId) ?? defaultVariant;
    },
    async captureWaitlistJoined({ memberId, sessionId }) {
      captured.push({ memberId, sessionId });
    },
  };
}
