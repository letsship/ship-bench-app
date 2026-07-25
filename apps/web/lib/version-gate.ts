import { satisfies } from "semver";

export function isClientVersionSupported(clientVersion: string, minimumVersion: string): boolean {
  try {
    return satisfies(clientVersion, `>=${minimumVersion}`);
  } catch {
    return false;
  }
}

export const MINIMUM_CLIENT_VERSION = "1.0.0";

export function checkClientVersionGate(clientVersion: string): boolean {
  return isClientVersionSupported(clientVersion, MINIMUM_CLIENT_VERSION);
}
