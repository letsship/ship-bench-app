import { gte, valid } from "semver";

// The oldest StudioBook client build we still support. Older clients are asked
// to refresh before they can talk to the API. Centralised here so the check
// lives in exactly one place.
export const MINIMUM_SUPPORTED_VERSION = "1.4.0";

export function isSupportedClientVersion(version: string): boolean {
  const parsed = valid(version);
  return parsed !== null && gte(parsed, MINIMUM_SUPPORTED_VERSION);
}
