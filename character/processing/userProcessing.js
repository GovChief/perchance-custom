const repoPath = oc.thread.customData.repoPath;

let debug, messageProcessing, ui, threadData, debugData, errors;
try {
  ({ debug, messageProcessing, ui, globals, errors } = await import(`${repoPath}/imports.js`).then(mod => mod.importMain()));
  if (errors && errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  threadData = globals.threadData;
  debugData = globals.debugData;
} catch (error) {
  throw new Error("userProcessing failed to import: " + error.message);
}

// -- Main dispatcher --

function onCommand({ messages, originalMessage, updatedMessage }) {
  debug.log("onCommand");
  if (!originalMessage) {
    return messageProcessing.createProcessingResult({ messages });
  }

  let content = originalMessage.content.trim();

  const commandHandlers = [
    { match: "/stats", handler: handleStats },
    { match: "/resetSession", handler: handleResetSession },
    { match: "/clearAll", handler: handleClearAll },
    { match: "/debug", handler: handleDebug }
  ];

  for (const { match, handler } of commandHandlers) {
    if (content.startsWith(match)) {
      const result = handler({ messages });
      if (result !== null) return result;
    }
  }

  return messageProcessing.createProcessingResult({ messages });
}

// -- Individual command handlers --

function handleStats({ messages }) {
  oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith("/stats"));
  ui.showStatsScreen();
  return messageProcessing.createProcessingResult({ messages, stop: true });
}

function handleResetSession({ messages }) {
  delete threadData.contextSummary;
  ui.refresh();
  oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith("/resetSession"));
  debug.log("Session reset by /resetSession command");
  return messageProcessing.createProcessingResult({ messages, stop: true });
}

function handleClearAll({ messages }) {
  oc.thread.messages = [];
  debug.log("All messages cleared by /clearAll command");
  return messageProcessing.createProcessingResult({ messages, stop: true });
}

function handleDebug({ messages }) {
  debugData.logDebugToMessages = true;

  let isCurrentlyDebug = threadData.isDebug === true;

  if (!isCurrentlyDebug) {
    threadData.shortcutButtons = oc.thread.shortcutButtons || undefined;

    threadData.isDebug = true;
    let userCommands = ["/stats", "/resetSession", "/clearAll", "/debug"];
    oc.thread.shortcutButtons = userCommands.map(cmd => ({
      autoSend: true,
      insertionType: "replace",
      message: cmd,
      name: cmd.substring(1),
      clearAfterSend: true,
      type: "message",
    }));
    oc.thread.messages.forEach(msg => {
      const originalSet = new Set([
        ...(Array.isArray(msg.customData?.hiddenFrom) ? msg.customData.hiddenFrom : []),
        ...(Array.isArray(msg.hiddenFrom) ? msg.hiddenFrom : []),
      ]);
      if (originalSet.has("user")) {
        msg.hiddenFrom = [...originalSet].filter(h => h !== "user");
        if (!msg.customData) msg.customData = {};
        msg.customData.hiddenFrom = [...originalSet];
        msg.customData.debugShown = true;
      } else {
        if (!msg.customData?.hiddenFrom) {
          msg.customData = msg.customData || {};
          msg.customData.hiddenFrom = [...originalSet];
        }
      }
    });

    debug.log("Debug mode enabled");
  } else {
    threadData.isDebug = false;

    oc.thread.shortcutButtons = threadData.shortcutButtons || undefined;
    delete threadData.shortcutButtons;

    oc.thread.messages.forEach(msg => {
      if (msg.customData?.debugShown === true) {
        const originalHidden = Array.isArray(msg.customData.hiddenFrom)
          ? msg.customData.hiddenFrom
          : (Array.isArray(msg.hiddenFrom) ? msg.hiddenFrom : []);
        msg.hiddenFrom = originalHidden;
        delete msg.customData.debugShown;
      }
    });

    oc.thread.messages = oc.thread.messages.filter(
      m => !(m.customData?.debug === true)
    );

    debug.log("Debug mode disabled");
  }

  const isDebug = Boolean(threadData.isDebug);
  debugData.logDebugToMessages = isDebug;
  debugData.isHideFromUser = !isDebug;

  oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith("/debug"));

  ui.refresh();

  return messageProcessing.createProcessingResult({ messages, stop: true });
}

export { onCommand };
