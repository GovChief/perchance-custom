let strings;
try {
  ({ strings } = await import(oc.thread.customData.repoPath + "/imports.js").then(mod => mod.getStrings()));
  if (!strings) {
    throw new Error("Failed to load strings from imports.");
  }
} catch (error) {
  throw new Error("html failed to import: " + error.message);
}

function mainPanel({ title = undefined, content = "" } = {}) {
  return `
    <div style="position: relative; width: 100%; height: 100%; font-family: sans-serif; display: flex; flex-direction: column;">
      <div style="flex: 0 0 auto; padding: 10px 20px; background: #333; color: white; font-weight: bold; font-size: 1.2em; display: flex; justify-content: space-between; align-items: center;">
        <div id="contextSummaryTitle">${title ?? (strings.mainPanelTitle ?? "Character custom")}</div>
        <button
          style="background: transparent; border: none; color: white; font-size: 1.2em; cursor: pointer;"
          aria-label="${strings.closeButtonAriaLabel ?? "Close Info Window"}"
          onclick="oc.window.hide()"
        >❌</button>
      </div>
      <div id="contextSummaryContent" style="flex: 1 1 auto; padding: 20px; overflow-y: auto;">
        ${content}
      </div>
    </div>
  `;
}

function text({ title = undefined, message, align = "left" } = {}) {
  return `
    <div style="margin-top: 20px; text-align: ${align};">
      ${title ? `<div style="font-size: 1.3em; color: #222; font-weight: bold; margin-bottom: 8px;">${title}</div>` : ""}
      <div style="font-size: 1.1em; color: #666;">${message}</div>
    </div>
  `;
}

function textBox({ title = undefined, description } = {}) {
  return `
    <div class="property-item" style="margin-bottom: 12px;">
      ${title ? `<h3 style="margin: 0 0 4px 0; font-weight: bold;">${title}</h3>` : ''}
      <div style="border: 1px solid black; padding: 6px 10px; border-radius: 3px; white-space: pre-wrap;">${description || '(none)'}</div>
    </div>
  `;
}

export { mainPanel, text, textBox };
