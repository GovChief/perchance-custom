const html = await import('https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character/ui/html.js');
const debug = await import('https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character/debug/debug.js');

// Check imports
if (!html || !debug) {
  throw new Error("Failed to load required modules: html or debug.");
}

const statsScreen = "statsScreen";
const backstack = [];

function getGlobals() {
  if (!window.customData) window.customData = {};
  const windowData = window.customData;

  if (!windowData.debug) windowData.debug = {};
  const debugData = windowData.debug;

  const thread = oc.thread;
  if (!thread.customData) thread.customData = {};
  const threadData = thread.customData;

  return { windowData, debugData, threadData };
}

const { windowData, debugData, threadData } = getGlobals();

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
