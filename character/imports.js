const repoPath = 'https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character';

const debug = await import(`${repoPath}/debug/debug.js`);
const messageProcessing = await import(`${repoPath}/processing/messageProcessing.js`);
const html = await import(`${repoPath}/ui/html.js`);
if (!debug || !messageProcessing || !html) {
  throw new Error("Failed to load required modules: debug, messageProcessing and/or html.");
}

export { debug, messageProcessing, html };
