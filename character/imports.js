const repoPath = 'https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character';

const debug = await import(`${repoPath}/debug/debug.js`);
const messageProcessing = await import(`${repoPath}/processing/messageProcessing.js`);
const ui = await import(`${repoPath}/ui/ui.js`);

if (!debug || !messageProcessing || !ui) {
  throw new Error("Failed to load required modules: debug, messageProcessing or ui.");
}

export { debug, messageProcessing, ui };
