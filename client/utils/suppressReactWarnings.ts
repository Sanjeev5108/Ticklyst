// Suppress noisy React 19 defaultProps deprecation warnings originating from
// Recharts functional components (XAxis/YAxis). Safe in all envs.
(function patchConsoleForRecharts() {
  const SHOULD_MATCH =
    "Support for defaultProps will be removed from function components";

  const shouldDrop = (args: unknown[]) => {
    try {
      for (const arg of args) {
        if (arg == null) continue;
        if (typeof arg === "string" && arg.includes(SHOULD_MATCH)) return true;
        if (
          typeof arg === "object" &&
          "message" in arg &&
          typeof (arg as any).message === "string" &&
          (arg as any).message.includes(SHOULD_MATCH)
        ) {
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  const origError = console.error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    if (shouldDrop(args)) return;
    // eslint-disable-next-line prefer-spread
    return origError.apply(console, args as unknown as []);
  };

  const origWarn = console.warn;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.warn = (...args: any[]) => {
    if (shouldDrop(args)) return;
    // eslint-disable-next-line prefer-spread
    return origWarn.apply(console, args as unknown as []);
  };
})();
