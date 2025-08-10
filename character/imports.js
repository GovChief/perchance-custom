const repoPath = 'https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character';

let debug;

export async function importModules() {
  const debugModule = await import(`${repoPath}/debug/debug.js`);
  debug = debugModule;
}

export { debug };
