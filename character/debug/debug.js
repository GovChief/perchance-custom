const repoPath = oc.thread.customData.repoPath;

let debugData, errors;
try {
  ({ globals, errors } = await import(`${repoPath}/imports.js`).then(mod => mod.importMain()));
  if (errors && errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  debugData = globals.debugData;
} catch (error) {
  throw new Error("debug failed to import: " + error.message);
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
