const repoPath = oc.thread.customData.repoPath;

let html, debug, threadData;
let failedModules = [];

try {
  html = await import(`${repoPath}/ui/html.js`);
  if (!html) failedModules.push('html');
} catch (e) {
  failedModules.push('html');
}

try {
  debug = await import(`${repoPath}/debug/debug.js`);
  if (!debug) failedModules.push('debug');
} catch (e) {
  failedModules.push('debug');
}

try {
  const globals = await import(`${repoPath}/globals.js`);
  if (!globals) {
    failedModules.push('globals');
  } else {
    threadData = globals.threadData;
  }
} catch (e) {
  failedModules.push('globals');
}

if (failedModules.length > 0) {
  throw new Error("UI module failed to load required modules: " + failedModules.join(', ") + ".");
}

const statsScreen = "statsScreen";
const backstack = [];

function setPanelContent({ title, content }) {
  document.body.innerHTML = html.mainPanel({
    title,
    content
  });
}

function showPanel() {
  oc.window.show();
  refresh();
}

function refresh() {
  if (backstack.length === 0) return;
  const currentScreen = backstack[backstack.length - 1];
  if (currentScreen === statsScreen) {
    updateStatsScreen();
  }
  // Add additional screen tags and their corresponding update functions here as needed
}

function showStatsScreen() {
  debug.log("showStatsScreen");
  backstack.push(statsScreen);
  showPanel();
}

function updateStatsScreen() {
  // Only update if statsScreen is the last in backstack
  if (backstack.length === 0 || backstack[backstack.length - 1] !== statsScreen) return;

  let contentHTML = "";

  if (
    !threadData.contextSummary ||
    Object.keys(threadData.contextSummary).length === 0
  ) {
    contentHTML = html.text({
      title: "Nothing to show",
      message: "Start playing to see information",
      align: "center"
    });
    setPanelContent({ title: "Stats", content: contentHTML });
  } else {
    const summary = threadData.contextSummary;
    for (const [title, description] of Object.entries(summary)) {
      contentHTML += html.textBox({
        title,
        description
      });
    }
    setPanelContent({ title: "Stats", content: contentHTML });
  }
}

export { showPanel, refresh, showStatsScreen };
