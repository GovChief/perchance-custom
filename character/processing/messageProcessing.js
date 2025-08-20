const repoPath = oc.thread.customData.repoPath;

let debug, errors = [];
try {
  const imports = await import(`${repoPath}/imports.js`);
  const debugResult = await imports.getDebug();
  if (debugResult.error) errors.push(`getDebug: ${debugResult.error}`);
  debug = debugResult.debug;
} catch (error) {
  errors.push("Failed to import imports.js: " + error.message);
}

if (errors.length > 0) {
  throw new Error("messageProcessing failed to import: " + errors.join("; "));
}

// Log the name of the function when it's called
export function createProcessingResult({ messages, stop = false, updatedMessage = null }) {
  debug.log("createProcessingResult");
  return { messages, stop, updatedMessage };
}

export async function processMessages(ogMessage, processors) {
  let messages = [];
  let updatedMessage = ogMessage;

  for (const processor of processors) {
    const result = await processor({ messages, originalMessage: ogMessage, updatedMessage });
    messages = result.messages || messages;
    updatedMessage = result.updatedMessage || updatedMessage;
    if (result.stop) break;
  }
  return { messages, updatedMessage };
}
