const repoPath = 'https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@versionName/character';

oc.thread.customData ??= {};

const versionList = [
  {
    name: "main",
    changeLog: "development",
    preview: true
  }
];

const versionMigration = {};

async function load(name = "latest", opts = {}) {
  let targetName;
  if (name === "latest") {
    // Find the last version that is not a preview
    const nonPreviewVersions = versionList.filter(v => !v.preview);
    if (nonPreviewVersions.length > 0) {
      targetName = nonPreviewVersions[nonPreviewVersions.length - 1].name;
    } else {
      targetName = versionList[versionList.length - 1].name;
    }
  } else if (name === "latest_preview") {
    // Use all versions, including preview ones
    targetName = versionList[versionList.length - 1].name;
  } else {
    targetName = name;
  }
  const found = versionList.find(v => v.name === targetName);
  if (found) {
    const curVersion = oc.thread.customData.curVersion;
    const result = await handleVersioning(targetName);
    oc.thread.customData.curVersion = result.finalVersion;
    oc.thread.customData.repoPath = getRepoPathForVersion(result.finalVersion);
    console.log(`Loaded version: ${found.name} (${found.changeLog})`);
    // Only show changelog if we're switching to a new version
    if (curVersion !== result.finalVersion) {
      const history = getVersionHistory({ previousVersion: result.from, finalVersion: result.finalVersion });
      showChangelog({ content: history });
    }
    // Do not return anything
  } else {
    // Try fallback to last valid version in oc.thread.customData.curVersion
    const lastValidVersion = oc.thread.customData.curVersion;
    if (lastValidVersion && versionList.find(v => v.name === lastValidVersion)) {
      // Load last valid version instead
      const lastFound = versionList.find(v => v.name === lastValidVersion);
      await handleVersioning(lastValidVersion);
      oc.thread.customData.repoPath = getRepoPathForVersion(lastValidVersion);
      console.warn(`Version ${targetName} not found. Using last valid version ${lastValidVersion}`);
      showChangelog({
        title: "Version FAIL",
        content: `Using last valid version ${lastValidVersion}`
      });
    } else {
      showChangelog({
        title: "Version FAIL",
        content: `Version ${targetName} not found!`
      });
      console.warn(`Version ${targetName} not found. No loading performed.`);
      throw new Error(`Version ${targetName} not found.`);
    }
  }
}

async function handleVersioning(targetVersion) {
  let threadVersion = typeof oc !== "undefined" && oc.thread.customData.version || null;

  let previousVersion;
  let finalVersion;

  if (threadVersion) {
    previousVersion = threadVersion;
    finalVersion = targetVersion;
  } else {
    previousVersion = undefined;
    finalVersion = targetVersion;
  }

  if (versionIndex(finalVersion) === -1) finalVersion = versionList[0].name;

  if (!previousVersion) {
    // Find previousVersion as 10 versions before finalVersion, or the first version if not enough exist
    const finalIdx = versionIndex(finalVersion);
    const prevIdx = Math.max(0, finalIdx - 10);
    previousVersion = versionList[prevIdx].name;
  }

  if (versionIndex(previousVersion) === -1) previousVersion = versionList[0].name;

  if (versionIndex(previousVersion) < versionIndex(finalVersion)) {
    await update(previousVersion, finalVersion);
    return { updated: true, from: previousVersion, to: finalVersion, finalVersion };
  }
  return { updated: false, from: previousVersion, to: finalVersion, finalVersion };
}

async function update(previousVersion, finalVersion) {
  let prevIdx = versionIndex(previousVersion);
  const finalIdx = versionIndex(finalVersion);

  for (let i = prevIdx; i < finalIdx; i++) {
    const fromVersion = versionList[i].name;
    const toVersion = versionList[i + 1].name;
    const upgradeFuncName = `versionUpgradeV${fromVersion.replace(/\./g,'')}_V${toVersion.replace(/\./g,'')}`;
    if (typeof versionMigration[upgradeFuncName] === "function") {
      await versionMigration[upgradeFuncName](fromVersion, toVersion);
    } else {
      console.log(`No upgrade function found for ${fromVersion} -> ${toVersion}`);
    }
  }
}

// Returns a repo path with the given version name in place of versionName using repoPath as template
function getRepoPathForVersion(versionName) {
  return repoPath.replace('versionName', versionName);
}

function versionIndex(name) {
  return versionList.findIndex(v => v.name === name);
}

function getVersionHistory({ previousVersion, finalVersion }) {
  // If previousVersion is not set, default as finalVersion - 10
  if (!previousVersion) {
    const finalIdx = versionIndex(finalVersion);
    const prevIdx = Math.max(0, finalIdx - 10);
    previousVersion = versionList[prevIdx].name;
  }
  const prevIdx = versionIndex(previousVersion);
  const finalIdx = versionIndex(finalVersion);

  if (prevIdx === -1 || finalIdx === -1) return '';

  let history = '';
  for (let i = prevIdx + 1; i <= finalIdx; i++) {
    history += `${versionList[i].name}\n${versionList[i].changeLog}\n\n`;
  }
  return history;
}

function showChangelog({ title = "Changelog", content } = {}) {
  // Exit early if oc.thread.customData.showChangelog is set to false
  if (oc.thread.customData.showChangelog === false) {
    return;
  }
  // If content is not set, use getVersionHistory with final version being oc.thread.customData.curVersion
  if (typeof content === "undefined") {
    content = getVersionHistory({ finalVersion: oc.thread.customData.curVersion });
  }
  oc.window.show();
  document.body.innerHTML = `
    <div style="position: relative; width: 100%; height: 100%; font-family: sans-serif; display: flex; flex-direction: column;">
      <div style="flex: 0 0 auto; padding: 10px 20px; background: #333; color: white; font-weight: bold; font-size: 1.2em; display: flex; justify-content: space-between; align-items: center;">
        <div id="contextSummaryTitle">${title}</div>
        <button
          style="background: transparent; border: none; color: white; font-size: 1.2em; cursor: pointer;"
          aria-label="Close Info Window"
          onclick="oc.window.hide()"
        >❌</button>
      </div>
      <div style="flex: 1 1 auto; padding: 20px; overflow-y: auto;">
        ${content}
      </div>
    </div>
  `;
}

 
// Version upgrades
export { load, showChangelog };
