// Suppress noisy React 19 defaultProps deprecation warnings originating from
// Recharts functional components (XAxis/YAxis). Safe in all envs.
(function patchConsoleForRecharts() {
  const shouldDrop = (args: unknown[]) => {
    try {
      const msg = String(args?.[0] ?? "");
      // React logs with format strings, e.g. "Warning: %s: Support for defaultProps... %s", componentName, extra
      return (
        msg.includes("Support for defaultProps will be removed from function components") &&
        (String(args?.[1] ?? "").includes("XAxis") ||
          String(args?.[1] ?? "").includes("YAxis") ||
          msg.includes("XAxis") ||
          msg.includes("YAxis"))
      );
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
