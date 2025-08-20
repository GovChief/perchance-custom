const repoPath = oc.thread.customData.repoPath;

let debug, messageProcessing, ui, threadData, debugData, strings, errors = [];
try {
  const imports = await import(`${repoPath}/imports.js`);

  // Import debug
  const debugResult = await imports.getDebug();
  if (debugResult.error) errors.push(`getDebug: ${debugResult.error}`);
  debug = debugResult.debug;

  // Import messageProcessing
  const messageProcessingResult = await imports.getMessageProcessing();
  if (messageProcessingResult.error) errors.push(`getMessageProcessing: ${messageProcessingResult.error}`);
  messageProcessing = messageProcessingResult.messageProcessing;

  // Import ui
  const uiResult = await imports.getUI();
  if (uiResult.error) errors.push(`getUI: ${uiResult.error}`);
  ui = uiResult.ui;

  // Import globals
  const globalsResult = await imports.getGlobals();
  if (globalsResult.error) errors.push(`getGlobals: ${globalsResult.error}`);
  threadData = globalsResult.globals?.threadData;
  debugData = globalsResult.globals?.debugData;

  // Import strings
  const stringsResult = await imports.getStrings();
  if (stringsResult.error) errors.push(`getStrings: ${stringsResult.error}`);
  strings = stringsResult.strings;
} catch (error) {
  errors.push("Failed to import imports.js: " + error.message);
}

if (errors.length > 0) {
  throw new Error("userProcessing failed to import: " + errors.join("; "));
}

// -- Main dispatcher --

function onCommand({ messages, originalMessage, updatedMessage }) {
  debug.log("onCommand");
  if (!originalMessage) {
    return messageProcessing.createProcessingResult({ messages });
  }

  let content = originalMessage.content.trim();

  const commandHandlers = [
    { match: strings.commandStats, handler: handleStats },
    { match: strings.commandResetSession, handler: handleResetSession },
    { match: strings.commandClearAll, handler: handleClearAll },
    { match: strings.commandDebug, handler: handleDebug }
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
  oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith(strings.commandStats));
  ui.showStatsScreen();
  return messageProcessing.createProcessingResult({ messages, stop: true });
}

function handleResetSession({ messages }) {
  delete threadData.contextSummary;
  ui.refresh();
  oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith(strings.commandResetSession));
  debug.log("Session reset by " + strings.commandResetSession + " command");
  return messageProcessing.createProcessingResult({ messages, stop: true });
}

function handleClearAll({ messages }) {
  oc.thread.messages = [];
  debug.log("All messages cleared by " + strings.commandClearAll + " command");
  return messageProcessing.createProcessingResult({ messages, stop: true });
}

function handleDebug({ messages }) {
  debugData.logDebugToMessages = true;

  let isCurrentlyDebug = threadData.isDebug === true;

  if (!isCurrentlyDebug) {
    threadData.shortcutButtons = oc.thread.shortcutButtons || undefined;

    threadData.isDebug = true;
    let userCommands = [
      strings.commandStats,
      strings.commandResetSession,
      strings.commandClearAll,
      strings.commandDebug
    ];
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

  oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith(strings.commandDebug));

  ui.refresh();

  return messageProcessing.createProcessingResult({ messages, stop: true });
}

export { onCommand };
