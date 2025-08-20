const repoPath = oc.thread.customData.repoPath;

let html, debug, threadData, strings, errors = [];
try {
  const imports = await import(`${repoPath}/imports.js`);

  // Import html
  const htmlResult = await imports.getHtml();
  if (htmlResult.error) errors.push(`getHtml: ${htmlResult.error}`);
  html = htmlResult.html;

  // Import debug
  const debugResult = await imports.getDebug();
  if (debugResult.error) errors.push(`getDebug: ${debugResult.error}`);
  debug = debugResult.debug;

  // Import globals
  const globalsResult = await imports.getGlobals();
  if (globalsResult.error) errors.push(`getGlobals: ${globalsResult.error}`);
  threadData = globalsResult.globals?.threadData;

  // Import strings
  const stringsResult = await imports.getStrings();
  if (stringsResult.error) errors.push(`getStrings: ${stringsResult.error}`);
  strings = stringsResult.strings;
} catch (error) {
  errors.push("Failed to import imports.js: " + error.message);
}

if (errors.length > 0) {
  throw new Error("ui failed to import: " + errors.join("; "));
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
      title: strings.statsEmpty,
      message: strings.statsEmptyHint,
      align: "center"
    });
    setPanelContent({ title: strings.statsTitle, content: contentHTML });
  } else {
    const summary = threadData.contextSummary;
    for (const [title, description] of Object.entries(summary)) {
      contentHTML += html.textBox({
        title,
        description
      });
    }
    setPanelContent({ title: strings.statsTitle, content: contentHTML });
  }
}

export { showPanel, refresh, showStatsScreen };
