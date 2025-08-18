const repoPath = oc.thread.customData.repoPath;

let debug, errors;
try {
  ({ debug, errors } = await import(`${repoPath}/imports.js`).then(mod => mod.importMain()));
  if (errors && errors.length > 0) {
    throw new Error(errors.join(', '));
  }
} catch (error) {
  throw new Error("messageProcessing failed to import: " + error.message);
}

// Log the name of the function when it's called
export function createProcessingResult({ messages, stop = false, updatedMessage = null }) {
  debug.log("createProcessingResult");
  return { messages, stop, updatedMessage };
}

export async function processMessages(ogMessage, processors) {
  let messages = [ogMessage];
  let updatedMessage = ogMessage;

  for (const processor of processors) {
    const result = await processor({ messages, originalMessage: ogMessage, updatedMessage });
    messages = result.messages || messages;
    updatedMessage = result.updatedMessage || updatedMessage;
    if (result.stop) break;
  }
  return { messages, updatedMessage };
}
