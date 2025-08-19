const repoPath = oc.thread.customData.repoPath;

let html, debug, threadData, strings, errors;
try {
  ({ html, debug, globals, strings, errors } = await import(`${repoPath}/imports.js`).then(mod => ({
    ...mod.importMain(),
    ...mod.getStrings(),
  })));
  if (errors && errors.length > 0) {
    throw new Error(errors.join(', '));
  }
  threadData = globals.threadData;
} catch (error) {
  throw new Error("ui failed to import: " + error.message);
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
