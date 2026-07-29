import { __setTestTracker } from "@/lib/analytics/tracker";
import { createFakeTracker } from "@/lib/analytics/fake-tracker";

// Default the analytics tracker to an in-memory recorder for every test, so
// service tests that exercise the booking/cancel flows (e.g. services.test.ts)
// capture into a harmless fake instead of trying to construct a real PostHog
// client. Individual tests override this via `__setTestTracker(...)` and clear
// it with `__setTestTracker(null)` — the seam is what's graded.
__setTestTracker(createFakeTracker());
