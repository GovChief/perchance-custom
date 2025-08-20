const repoPath = oc.thread.customData.repoPath;

let debugData, errors = [];
try {
  const imports = await import(`${repoPath}/imports.js`);
  const globalsResult = await imports.getGlobals();
  if (globalsResult.error) errors.push(`getGlobals: ${globalsResult.error}`);
  debugData = globalsResult.globals?.debugData;
} catch (error) {
  errors.push("Failed to import imports.js: " + error.message);
}

if (errors.length > 0) {
  throw new Error("debug failed to import: " + errors.join("; "));
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
