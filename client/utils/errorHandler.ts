// Lightweight ResizeObserver error suppression
// These warnings are common with shadcn/ui components and don't affect functionality

export const suppressResizeObserverWarnings = () => {
  // Only suppress console warnings, don't modify critical browser APIs
  const originalError = console.error;
  const originalWarn = console.warn;

  const shouldSuppress = (msg: any) => {
    if (typeof msg !== 'string') return false;
    return msg.includes('ResizeObserver loop completed with undelivered notifications') ||
           msg.includes('ResizeObserver loop limit exceeded');
  };

  console.error = (...args: any[]) => {
    if (shouldSuppress(args[0])) return;
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    if (shouldSuppress(args[0])) return;
    originalWarn.apply(console, args);
  };

  // Add a simple error event listener that doesn't interfere with React
  const handleError = (event: ErrorEvent) => {
    if (event.message && (event.message.includes('ResizeObserver loop completed with undelivered notifications') || event.message.includes('ResizeObserver loop limit exceeded'))) {
      event.preventDefault();
    }
  };

  // Only add listener if it doesn't already exist
  if (!window.__resizeObserverErrorHandlerAdded) {
    window.addEventListener('error', handleError);
    window.__resizeObserverErrorHandlerAdded = true;
  }
};

export const patchResizeObserverRAF = () => {
  try {
    const w = window as any;
    if (!('ResizeObserver' in w)) return;
    if (w.__resizeObserverPatched) return;
    const Original = w.ResizeObserver;
    class Patched extends Original {
      constructor(cb: ResizeObserverCallback) {
        super((entries: ResizeObserverEntry[], observer: ResizeObserver) => {
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(() => cb(entries, observer));
          } else {
            setTimeout(() => cb(entries, observer));
          }
        });
      }
    }
    w.ResizeObserver = Patched;
    w.__resizeObserverPatched = true;
  } catch {}
};

// Extend the Window interface to track our error handler
declare global {
  interface Window {
    __resizeObserverErrorHandlerAdded?: boolean;
    __resizeObserverPatched?: boolean;
  }
}
