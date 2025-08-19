const repoPath = oc.thread.customData.repoPath;

async function getDebug() {
  try {
    const debug = await import(`${repoPath}/debug/debug.js`);
    if (!debug) throw new Error("missing");
    return { debug };
  } catch (e) {
    return { error: e.message };
  }
}

async function getMessageProcessing() {
  try {
    const messageProcessing = await import(`${repoPath}/processing/messageProcessing.js`);
    if (!messageProcessing) throw new Error("missing");
    return { messageProcessing };
  } catch (e) {
    return { error: e.message };
  }
}

async function getUserProcessing() {
  try {
    const userProcessing = await import(`${repoPath}/processing/userProcessing.js`);
    if (!userProcessing) throw new Error("missing");
    return { userProcessing };
  } catch (e) {
    return { error: e.message };
  }
}

async function getUI() {
  try {
    const ui = await import(`${repoPath}/ui/ui.js`);
    if (!ui) throw new Error("missing");
    return { ui };
  } catch (e) {
    return { error: e.message };
  }
}

async function getHtml() {
  try {
    const html = await import(`${repoPath}/ui/html.js`);
    if (!html) throw new Error("missing");
    return { html };
  } catch (e) {
    return { error: e.message };
  }
}

async function getGlobals() {
  try {
    const globals = await import(`${repoPath}/globals.js`);
    if (!globals) throw new Error("missing");
    return { globals };
  } catch (e) {
    return { error: e.message };
  }
}

async function getStrings() {
  try {
    const stringsModule = await import(`${repoPath}/strings/strings.js`);
    if (!stringsModule) throw new Error("missing");
    return { strings: stringsModule.strings, stringsModule: stringsModule };
  } catch (e) {
    return { error: e.message };
  }
}

// Main import function
async function importMain() {
  const debugImport = await getDebug();
  const uiImport = await getUI();
  const messageProcessingImport = await getMessageProcessing();
  const globalsImport = await getGlobals();
  const userProcessingImport = await getUserProcessing();
  const stringsImport = await getStrings();

  const errors = [];
  if (debugImport.error) errors.push(debugImport.error);
  if (uiImport.error) errors.push(uiImport.error);
  if (messageProcessingImport.error) errors.push(messageProcessingImport.error);
  if (globalsImport.error) errors.push(globalsImport.error);
  if (userProcessingImport.error) errors.push(userProcessingImport.error);
  if (stringsImport.error) errors.push(stringsImport.error);

  return {
    debug: debugImport.debug || null,
    ui: uiImport.ui || null,
    messageProcessing: messageProcessingImport.messageProcessing || null,
    globals: globalsImport.globals || null,
    userProcessing: userProcessingImport.userProcessing || null,
    strings: stringsImport.strings || null,
    errors
  };
}

export { getDebug, getMessageProcessing, getUserProcessing, getUI, getHtml, getGlobals, getStrings, importMain };
