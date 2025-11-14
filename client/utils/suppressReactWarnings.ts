// Suppress noisy React 19 defaultProps deprecation warnings originating from
// Recharts functional components (XAxis/YAxis). This is DEV-only and does not
// affect production builds.
if (import.meta.env?.DEV) {
  const originalError = console.error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    try {
      const msg = String(args?.[0] ?? "");
      // React logs with format strings, e.g. "Warning: %s: Support for defaultProps... %s", componentName, extra
      if (
        msg.includes("Support for defaultProps will be removed from function components") &&
        (args?.[1] === "XAxis" || args?.[1] === "YAxis" || msg.includes("XAxis") || msg.includes("YAxis"))
      ) {
        return; // drop this specific warning
      }
    } catch {}
    // Forward everything else
    // eslint-disable-next-line prefer-spread
    return originalError.apply(console, args as unknown as []);
  };
}
