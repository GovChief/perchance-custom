const repoPath = 'https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character';

const debug = await import(`${repoPath}/debug/debug.js`);
const messageProcessing = await import(`${repoPath}/processing/messageProcessing.js`);
if (!debug || !messageProcessing) {
  throw new Error("Failed to load required modules: debug and/or messageProcessing.");
}

export { debug, messageProcessing };
