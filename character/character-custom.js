await import('https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character/versions.js').then(async ({ load }) => {
  await load("latest_preview");
});

const repoPath = oc.thread.customData.repoPath;

// Utility function for promise timeout
async function withTimeout(promise, ms) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms.`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// Imports segment - now using direct destructuring from importMain, wrapped with timeout
let debug, messageProcessing, ui, globals, userProcessing, aiProcessing, errors;
try {
  const imports = await import(`${repoPath}/imports.js`);
  const importResult = await withTimeout(imports.importMain(), 5000); // 5s timeout
  ({ debug, messageProcessing, ui, globals, userProcessing, aiProcessing, errors } = importResult);
  if (errors && errors.length > 0) {
    throw new Error("Failed to load required modules: " + errors.join(', ') + ".");
  }
} catch (error) {
  let message = "Failed to initialise imports: " + error.message;
  if (error.message && error.message.startsWith("Operation timed out")) {
    message += "\nThis error is likely caused by circular dependencies in imports.";
  }
  oc.thread.messages.push({
    author: "FAILED INIT",
    content: message,
    customData: { debug: true },
    expectsReply: false,
    hiddenFrom: ["ai"],
  });
  throw new Error("Failed to load");
}

// Deconstruct globals after import
const { threadData, windowData, debugData, session, config } = globals;

// CustomData grouping
Object.assign(config, {
  numMessagesInContext: 4, // Fixed number of recent messages for context
  propertiesToTrackMap: {
    Inventory: "any items currently in the player's inventory",
    Skills: "skills that the player has",
    Location: "player's current location",
    Actors: "names of people player is interacting with"
  },
  aiProcessingOrder: [
    aiProcessing.generateContextSummary,
    aiProcessing.formatAndNameMessages,
    aiProcessing.splitIntoNamedMessages,
  ],
  userProcessingOrder: [
    userProcessing.onCommand,
  ],
});

// Keep session object empty but ready for future use
Object.assign(session, {});

Object.assign(debugData, {
  logDebugToMessages: Boolean(threadData?.isDebug),
  isHideFromUser: !Boolean(threadData?.isDebug)
});

// Event hook segment
oc.thread.on("MessageAdded", async () => {
  try {
    const message = oc.thread.messages.at(-1);
    if (!message) return;

    let processedResult = null;

    if (message.author === "ai") {
      processedResult = await messageProcessing.processMessages(message, config.aiProcessingOrder);
    } else if (message.author === "user") {
      processedResult = await messageProcessing.processMessages(message, config.userProcessingOrder);
    }

    if (processedResult && Array.isArray(processedResult.messages)) {
      if (processedResult.updatedMessage) {
        message.hiddenFrom = processedResult.updatedMessage.hiddenFrom ?? message.hiddenFrom;
        message.content = processedResult.updatedMessage.content ?? message.content;
        message.customData = processedResult.updatedMessage.customData ?? message.customData;
      }

      for (const msg of processedResult.messages) {
        oc.thread.messages.push(msg);
      }
    }
  } catch (err) {
    console.error("Error processing message:", err);
  }
});

// UI segment
function init() {
  debug.log("init");
  ui.refresh();
}

init();
