const repoPath = oc.thread.customData.repoPath;

let debugData;
let failedModules = [];

try {
  const globals = await import(`${repoPath}/globals.js`);
  if (!globals) {
    failedModules.push('globals');
  } else {
    debugData = globals.debugData;
  }
} catch (e) {
  failedModules.push('globals');
}

if (failedModules.length > 0) {
  throw new Error("Failed to load required modules: " + failedModules.join(', ') + ".");
}

function log(...args) {
  if (debugData.logDebugToMessages) {
    logToMessage(...args);
  } else if (debugData.logDebugToConsole) {
    console.log("[DEBUG]", ...args);
  }
}

function logToMessage(...args) {
  oc.thread.messages.push({
    author: "DEBUG",
    content: args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" "),
    customData: { debug: true },
    expectsReply: false,
    hiddenFrom: ["ai", "system"],
  });
}

export { log };
