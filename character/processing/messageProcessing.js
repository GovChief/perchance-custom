const repoPath = 'https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character';
const debug = await import(`${repoPath}/debug/debug.js`);
if (!debug) {
  throw new Error("Failed to load required module: debug.");
}

export function createProcessingResult({ messages, stop = false, updatedMessage = null }) {
  debug.log("createProcessingResult");
  return {
    messages,
    stop,
    updatedMessage,
  };
}

export async function processMessages(ogMessage, processors) {
  debug.log("processMessages");
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