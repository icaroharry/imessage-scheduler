import { describe, it, expect, vi, beforeEach } from "vitest";
import { execFile } from "node:child_process";

// Mock child_process
vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:util", () => ({
  promisify: vi.fn((fn: (...args: unknown[]) => void) => {
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
        ((_cmd: string, _args: unknown, _opts: unknown, callback: unknown) => {
          if (callback) (callback as (err: Error | null, result: string) => void)(null, "");
          return {} as ReturnType<typeof execFile>;
        }) as typeof execFile,
      );

      const { sendIMessage } = await import("../src/imessage.js");

      const result = await sendIMessage("+15551234567", "Hello");

      expect(result.success).toBe(true);

      // Verify osascript was called with right command and args
      expect(mockedExecFile).toHaveBeenCalled();
      const call = mockedExecFile.mock.calls[0];
      expect(call[0]).toBe("osascript");
      // Args array: ["-e", <script>, phone, body]
      const args = call[1] as string[];
      expect(args[0]).toBe("-e");
      expect(args[1]).toContain("on run argv");
      expect(args[1]).toContain("tell application");
    });

    it("should pass phone and body as osascript argv (no string interpolation)", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });

      const mockedExecFile = vi.mocked(execFile);
      mockedExecFile.mockImplementation(
        ((_cmd: string, _args: unknown, _opts: unknown, callback: unknown) => {
          if (callback) (callback as (err: Error | null, result: string) => void)(null, "");
          return {} as ReturnType<typeof execFile>;
        }) as typeof execFile,
      );

      const { sendIMessage } = await import("../src/imessage.js");

      const phone = "+15551234567";
      const body = 'Hello "world" with emoji 🎉 and\nnewlines';
      await sendIMessage(phone, body);

      const callArgs = mockedExecFile.mock.calls[0];
      const args = callArgs[1] as string[];
      // Phone and body are passed as separate argv elements — NOT interpolated into the script
      expect(args[2]).toBe(phone);
      expect(args[3]).toBe(body);
      // The script itself should NOT contain the phone or body text
      expect(args[1]).not.toContain(phone);
      expect(args[1]).not.toContain("Hello");
    });

    it("should return structured errorCode on failure", async () => {
      Object.defineProperty(process, "platform", { value: "darwin" });

      const mockedExecFile = vi.mocked(execFile);
      mockedExecFile.mockImplementation(
        ((_cmd: string, _args: unknown, _opts: unknown, callback: unknown) => {
          if (callback) (callback as (err: Error | null, result: string) => void)(new Error("execution error: Can't get buddy \"+15550000000\" (-1728)"), "");
          return {} as ReturnType<typeof execFile>;
        }) as typeof execFile,
      );

      const { sendIMessage } = await import("../src/imessage.js");

      const result = await sendIMessage("+15550000000", "Test");
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("BUDDY_NOT_FOUND");
    });
  });
});
