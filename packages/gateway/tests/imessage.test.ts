import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn: Function) => {
    return (...args: unknown[]) => {
      return new Promise((resolve, reject) => {
        fn(...args, (err: Error | null, result: unknown) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
  }),
}));

describe("iMessage Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sendIMessage", () => {
    it("should return error on non-macOS platforms", async () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, "platform", { value: "linux" });

      const { sendIMessage } = await import("../src/imessage.js");

      const result = await sendIMessage("+15551234567", "Hello");
      expect(result.success).toBe(false);
      expect(result.error).toContain("only supported on macOS");

      Object.defineProperty(process, "platform", { value: originalPlatform });
    });

    it("should call osascript with correct AppleScript on macOS", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });

      const mockedExecFile = vi.mocked(execFile);
      mockedExecFile.mockImplementation(
        (_cmd: string, _args: any, _opts: any, callback: any) => {
          if (callback) callback(null, "");
          return {} as any;
        },
      );

      const { sendIMessage } = await import("../src/imessage.js");

      const result = await sendIMessage("+15551234567", "Hello");

      expect(result.success).toBe(true);

      // Verify osascript was called with right command and args
      expect(mockedExecFile).toHaveBeenCalled();
      const call = mockedExecFile.mock.calls[0];
      expect(call[0]).toBe("osascript");
      // Args array contains ["-e", <script>]
      expect(call[1]).toEqual(expect.arrayContaining(["-e"]));
    });

    it("should escape quotes in message body", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });

      const mockedExecFile = vi.mocked(execFile);
      mockedExecFile.mockImplementation(
        (_cmd: string, _args: any, _opts: any, callback: any) => {
          if (callback) callback(null, "");
          return {} as any;
        },
      );

      const { sendIMessage } = await import("../src/imessage.js");

      await sendIMessage("+15551234567", 'Hello "world"');

      const callArgs = mockedExecFile.mock.calls[0];
      // The script is passed as the second element of the args array (after "-e")
      const args = callArgs[1] as string[];
      const script = args.find((a) => a.includes("tell application"));
      expect(script).toBeDefined();
      // The inner double quotes should be escaped
      expect(script).toContain('\\"world\\"');
    });
  });
});
