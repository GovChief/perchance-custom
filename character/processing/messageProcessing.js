const repoPath = oc.thread.customData.repoPath;

let debug;
let failedModules = [];

try {
  debug = await import(`${repoPath}/debug/debug.js`);
  if (!debug) failedModules.push('debug');
} catch (e) {
  failedModules.push('debug');
}

if (failedModules.length > 0) {
  throw new Error("Failed to load required modules: " + failedModules.join(', ') + ".");
}

// Log the name of the function when it's called
export function createProcessingResult({ messages, stop = false, updatedMessage = null }) {
  debug.log("createProcessingResult called");
  return {
    messages,
    stop,
    updatedMessage,
  };
}

export async function processMessages(ogMessage, processors) {
  debug.log("processMessages called");
  let messagesArray = [];
  let updatedMessage = ogMessage;

  for (const processor of processors) {
    const result = await processor({
      messages: messagesArray,
      originalMessage: ogMessage,
      updatedMessage,
    });

    if (!result.updatedMessage) {
      result.updatedMessage = updatedMessage;
    }

    if (result.stop) {
      break;
    }

    messagesArray = result.messages;
    updatedMessage = result.updatedMessage;
  }

  return { messages: messagesArray, updatedMessage };
}
