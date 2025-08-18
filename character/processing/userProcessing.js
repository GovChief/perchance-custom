const repoPath = oc.thread.customData.repoPath;

let debug, messageProcessing, ui, threadData, debugData;
let failedModules = [];

try {
  debug = await import(`${repoPath}/debug/debug.js`);
  if (!debug) failedModules.push('debug');
} catch (e) {
  failedModules.push('debug: ' + e.message);
}

try {
  messageProcessing = await import(`${repoPath}/processing/messageProcessing.js`);
  if (!messageProcessing) failedModules.push('messageProcessing');
} catch (e) {
  failedModules.push('messageProcessing: ' + e.message);
}

try {
  ui = await import(`${repoPath}/ui/ui.js`);
  if (!ui) failedModules.push('ui');
} catch (e) {
  failedModules.push('ui: ' + e.message);
}

try {
  const globals = await import(`${repoPath}/globals.js`);
  if (!globals) {
    failedModules.push('globals');
  } else {
    threadData = globals.threadData;
    debugData = globals.debugData;
  }
} catch (e) {
  failedModules.push('globals: ' + e.message);
}

if (failedModules.length > 0) {
  throw new Error("userProcessing module failed to load required modules: " + failedModules.join(', ') + ".");
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
