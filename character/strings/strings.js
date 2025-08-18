const repoPath = oc.thread.customData.repoPath;

const strings = {};

// Loads/updates strings in place. Does not return anything.
async function loadStrings() {
  // Always import the default (en) locale for baseline strings
  const defaultLocale = "en";
  const defaultLocaleUrl = `${repoPath}/strings/${defaultLocale}.js`;

  // Load default strings (let it crash if it fails)
  const defaultStrings = await import(/* @vite-ignore */ defaultLocaleUrl).then(mod => mod.default || mod);

  // Determine the selected locale from thread or character customData
  let selectedLocale =
    oc.thread?.customData?.locale ||
    oc.character?.customData?.locale ||
    defaultLocale;

  let localeStrings = {};

  if (selectedLocale !== defaultLocale) {
    const localeUrl = `${repoPath}/strings/${selectedLocale}.js`;
    try {
      localeStrings = await import(/* @vite-ignore */ localeUrl).then(mod => mod.default || mod);
    } catch (e) {
      // If strings is not empty and selected locale fails to load, throw error
      if (Object.keys(strings).length > 0) {
        throw new Error(`Failed to load selected locale (${selectedLocale}): ${e.message}`);
      }
      // Otherwise fallback to empty (do not override default)
      localeStrings = {};
    }
  }

  // Clear existing keys
  Object.keys(strings).forEach(k => delete strings[k]);
  // Copy all default keys
  Object.assign(strings, defaultStrings);
  // Override with loaded locale keys
  Object.assign(strings, localeStrings);
}

// Initial load on module import
await loadStrings();

export { strings, loadStrings };
