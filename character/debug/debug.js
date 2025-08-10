// Simple debug logger for Perchance Custom

// Extract debugVars at the top of the script for use by all functions
const debugVars = (typeof window !== "undefined" && window.customData && window.customData.debug) ? window.customData.debug : {};

/**
 * Logs debug messages to the console and optionally to the thread messages if enabled.
 * 
 * debugVars.logDebugToMessages controls logging.
 * If enabled, debug messages are pushed to oc.thread.messages with a special customData flag.
 */
export function log(...args) {
  if (debugVars.logDebugToMessages) {
    // Log to the console
    console.log("[DEBUG]", ...args);

    // Also log to the thread messages
    oc.thread.messages.push({
      author: "DEBUG",
      content: args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
      customData: { debug: true },
      expectsReply: false,
      hiddenFrom: ["ai"],
    });
  }
}
