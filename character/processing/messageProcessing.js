// Message processing utilities

export function createProcessingResult({ messages, updatedMessage, stop }) {
  return {
    messages: messages ?? [],
    updatedMessage,
    stop: !!stop,
  };
}

// Generic processor runner
export async function processMessages(message, processors) {
  let messages = [message];
  let updatedMessage = message;
  for (const processor of processors) {
    let result = await processor({ messages, originalMessage: message, updatedMessage });
    if (result && typeof result === 'object') {
      messages = result.messages ?? messages;
      updatedMessage = result.updatedMessage ?? updatedMessage;
      if (result.stop) break;
    }
  }
  return { messages, updatedMessage };
}