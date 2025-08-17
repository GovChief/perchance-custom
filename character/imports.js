const repoPath = oc.thread.customData.repoPath;

let debug, messageProcessing, ui, globals;
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
  globals = await import(`${repoPath}/globals.js`);
  if (!globals) failedModules.push('globals');
} catch (e) {
  failedModules.push('globals: ' + e.message);
}

if (failedModules.length > 0) {
  throw new Error("Imports module failed to load required modules: " + failedModules.join(', ') + ".");
}

export { debug, messageProcessing, ui, globals };
