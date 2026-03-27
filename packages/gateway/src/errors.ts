/**
 * Structured error codes for iMessage send operations.
 *
 * - NOT_MACOS:            Gateway is running on a non-macOS platform
 * - NO_IMESSAGE_ACCOUNT:  No iMessage account is signed in on this Mac
 * - BUDDY_NOT_FOUND:      Recipient not reachable via iMessage (osascript -1728)
 * - SEND_FAILED:          Messages.app accepted the request but couldn't send
 * - TIMEOUT:              osascript didn't respond within the allowed window
 * - UNKNOWN:              Unrecognised error
 */
export type SendErrorCode =
  | "NOT_MACOS"
  | "NO_IMESSAGE_ACCOUNT"
  | "BUDDY_NOT_FOUND"
  | "SEND_FAILED"
  | "TIMEOUT"
  | "UNKNOWN";

export interface ClassifiedError {
  message: string;
  code: SendErrorCode;
}

/**
 * Classify a raw osascript error string into a structured error code.
 *
 * The error strings come from two sources:
 * 1. Our own AppleScript `error "PREFIX: …"` statements (NO_IMESSAGE_ACCOUNT, SEND_FAILED)
 * 2. macOS / osascript runtime errors (-1728 for missing buddy, SIGTERM for timeout, etc.)
 */
export function classifyError(raw: string): ClassifiedError {
  if (raw.includes("NO_IMESSAGE_ACCOUNT")) {
    return { message: "No iMessage account is signed in on this Mac", code: "NO_IMESSAGE_ACCOUNT" };
  }
  if (raw.includes("SEND_FAILED")) {
    return { message: raw, code: "SEND_FAILED" };
  }
  // osascript error -1728 = "Can't get buddy" (buddy not found / not an iMessage user)
  if (raw.includes("-1728") || raw.includes("Can't get buddy")) {
    return { message: `Buddy not found — recipient may not use iMessage: ${raw}`, code: "BUDDY_NOT_FOUND" };
  }
  if (raw.includes("ETIMEDOUT") || raw.includes("timed out") || raw.includes("SIGTERM")) {
    return { message: `osascript timed out — Messages.app may be unresponsive: ${raw}`, code: "TIMEOUT" };
  }
  return { message: raw, code: "UNKNOWN" };
}
