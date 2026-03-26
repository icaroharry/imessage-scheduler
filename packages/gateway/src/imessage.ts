import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const execFileAsync = promisify(execFile);

export interface SendResult {
  success: boolean;
  error?: string;
}

/**
 * Send an iMessage via AppleScript / osascript.
 *
 * This uses the Messages.app on macOS to send an iMessage.
 * The Mac must be signed into an iMessage account.
 */
export async function sendIMessage(
  phone: string,
  body: string,
): Promise<SendResult> {
  // Validate we're on macOS
  if (process.platform !== "darwin") {
    return {
      success: false,
      error: "iMessage sending is only supported on macOS",
    };
  }

  // Escape single quotes in the message body and phone number
  const escapedBody = body.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escapedPhone = phone.replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${escapedPhone}" of targetService
      send "${escapedBody}" to targetBuddy
    end tell
  `;

  try {
    await execFileAsync("osascript", ["-e", script], {
      timeout: 15000,
    });
    return { success: true };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : "Unknown osascript error";
    return { success: false, error: errorMsg };
  }
}

/**
 * Check if the Messages.app chat database exists.
 * This is used to verify the Mac is set up for iMessage.
 */
export function isChatDbAvailable(): boolean {
  const chatDbPath = path.join(homedir(), "Library", "Messages", "chat.db");
  return existsSync(chatDbPath);
}

/**
 * Get the path to the Messages.app chat database.
 */
export function getChatDbPath(): string {
  return path.join(homedir(), "Library", "Messages", "chat.db");
}
