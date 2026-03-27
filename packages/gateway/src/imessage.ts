import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { classifyError, type SendErrorCode } from "./errors.js";

const execFileAsync = promisify(execFile);

export interface SendResult {
  success: boolean;
  error?: string;
  /** Structured error code for programmatic handling */
  errorCode?: SendErrorCode;
}

/**
 * AppleScript that receives phone and body via `on run argv` instead of
 * string interpolation. This eliminates all escaping issues — emoji,
 * newlines, quotes, backslashes, and unicode all work correctly because
 * osascript passes them as native AppleScript string values.
 */
const SEND_SCRIPT = `
on run argv
  set targetPhone to item 1 of argv
  set messageBody to item 2 of argv

  tell application "Messages"
    -- Verify at least one iMessage account is signed in
    set iMsgAccounts to every account whose service type = iMessage
    if (count of iMsgAccounts) is 0 then
      error "NO_IMESSAGE_ACCOUNT: No iMessage account is signed in on this Mac"
    end if
    set targetService to item 1 of iMsgAccounts

    -- Send the message. Messages.app resolves (or creates) the buddy.
    try
      send messageBody to buddy targetPhone of targetService
    on error errMsg number errNum
      error "SEND_FAILED (" & errNum & "): " & errMsg
    end try
  end tell
end run
`;

/**
 * Send an iMessage via AppleScript / osascript.
 *
 * Uses `on run argv` to pass phone & body as proper arguments rather than
 * interpolating them into the script source. This avoids all escaping issues
 * with quotes, backslashes, emoji, newlines, and unicode.
 *
 * The Mac must be signed into an iMessage account in Messages.app.
 */
export async function sendIMessage(
  phone: string,
  body: string,
): Promise<SendResult> {
  if (process.platform !== "darwin") {
    return { success: false, error: "iMessage sending is only supported on macOS", errorCode: "NOT_MACOS" };
  }

  try {
    // Phone and body are passed as positional args — osascript delivers them
    // to `on run argv` as a list. No escaping or interpolation needed.
    await execFileAsync("osascript", ["-e", SEND_SCRIPT, phone, body], {
      timeout: 30_000, // 30s — Messages.app may need time to launch on first send
    });
    return { success: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Unknown osascript error";
    const classified = classifyError(raw);
    return { success: false, error: classified.message, errorCode: classified.code };
  }
}

/**
 * Check if the Messages.app chat database file exists on disk.
 */
export function isChatDbAvailable(): boolean {
  const chatDbPath = path.join(homedir(), "Library", "Messages", "chat.db");
  return existsSync(chatDbPath);
}

/**
 * Check if chat.db is actually readable (Full Disk Access granted).
 * The file can exist but be unreadable without FDA.
 */
export async function isChatDbReadable(): Promise<boolean> {
  if (!isChatDbAvailable()) return false;
  try {
    const { openSync, closeSync, constants } = await import("node:fs");
    const fd = openSync(getChatDbPath(), constants.O_RDONLY);
    closeSync(fd);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to the Messages.app chat database.
 */
export function getChatDbPath(): string {
  return path.join(homedir(), "Library", "Messages", "chat.db");
}

/**
 * Open the macOS System Settings to the Full Disk Access pane.
 */
export async function openFullDiskAccessSettings(): Promise<boolean> {
  if (process.platform !== "darwin") return false;
  try {
    await execFileAsync("open", [
      "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles",
    ]);
    return true;
  } catch {
    return false;
  }
}
