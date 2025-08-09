// Config
let numMessagesInContext = 4; // Fixed number of recent messages for context

const propertiesToTrackMap = {
  Inventory: "any items currently in the player's inventory",
  Skills: "skills that the player has",
  Location: "player's current location",
  Actors: "names of people player is interacting with"
};

let aiProcessingOrder = [
  generateContextSummary,
  formatAndNameMessages, // Use the new processor here instead of fitMessageToForm
  splitIntoNamedMessages,
];

let userProcessingOrder = [
  onUserCommand,
];

// Debug
let logDebugToMessages = Boolean(oc.thread.customData?.isDebug);
let isHideFromUser = !logDebugToMessages;

// A simple log function that pushes a system message with optional text, default "Got here"
// Stringifies non-string input safely and hides from AI, marks debug messages via customData
function log(text = "Got here") {
  if (!logDebugToMessages) return;
  let content;
  try {
    content = typeof text === "string" ? text : JSON.stringify(text, null, 2);
  } catch {
    content = String(text);
  }
  oc.thread.messages.push({
    author: "system",
    name: "DEBUG",
    content,
    hiddenFrom: ["ai"], // Hide debug logs from AI
    customData: { debug: true, hiddenFrom: ["ai"] }, // Mark debug messages and store original hiddenFrom
  });
}

// Session variables
let lastShownData = "nothingShownYet"; // Tracks last shown summary to avoid redundant updates

// Standard processing result creator
function createProcessingResult({ messages, stop = false, updatedMessage = null }) {
  log("createProcessingResult");
  return {
    messages,
    stop,
    updatedMessage,
  };
}

/**
 * Runs the original message through provided processors in order.
 * Each processor receives `{ messages, originalMessage, updatedMessage }` object.
 * Messages array starts empty.
 * Returns final messages and updated message.
 */
async function processMessages(ogMessage, processors) {
  log("processMessages");
  let messagesArray = [];
  let updatedMessage = ogMessage;

  for (const processor of processors) {
    const result = await processor({
      messages: messagesArray,
      originalMessage: ogMessage,
      updatedMessage,
    });

    if (!result.updatedMessage) {
      result.updatedMessage = updatedMessage;
    }

    if (result.stop) {
      break;
    }

    messagesArray = result.messages;
    updatedMessage = result.updatedMessage;
  }

  return { messages: messagesArray, updatedMessage };
}

/**
 * Preformats input text by splitting quoted dialogue and narration.
 * Quotes become their own paragraphs, narration remains intact exactly as input without capitalization or punctuation change.
 * Ensures no duplication of quoted text inside narration paragraphs.
 *
 * @param {string} text - Raw input text
 * @returns {string} Preformatted text with paragraphs separated by double newlines
 */
export function preFormatForNamingMessages(text) {
  const segments = [];
  let cursor = 0;
  const length = text.length;

  while (cursor < length) {
    if (text[cursor] === '"') {
      // Find closing quote
      let endQuote = cursor + 1;
      while (endQuote < length) {
        if (text[endQuote] === '"') break;
        endQuote++;
      }
      if (endQuote >= length) {
        // No closing quote found, treat rest as narration
        let narrationRest = text.slice(cursor).trim();
        if (narrationRest) segments.push({ text: narrationRest, quoted: false });
        cursor = length;
      } else {
        let quotedText = text.slice(cursor, endQuote + 1).trim();
        segments.push({ text: quotedText, quoted: true });
        cursor = endQuote + 1;
      }
    } else {
      // Narration up to next quote or end of text
      let nextQuote = text.indexOf('"', cursor);
      let narrationPart = nextQuote === -1 ? text.slice(cursor) : text.slice(cursor, nextQuote);

      narrationPart = narrationPart.trim();

      if (narrationPart.length > 0) {
        // Keep narration exactly as is (no changes)
        segments.push({ text: narrationPart, quoted: false });
      }

      cursor = nextQuote === -1 ? length : nextQuote;
    }

    // Skip trailing whitespace/newlines
    while (cursor < length && /\s/.test(text[cursor])) cursor++;
  }

  // Join narration and dialogue paragraphs with double newlines
  return segments.map(s => s.text).join('\n\n');
}

/**
 * AI processor:
 * - Preformats the message content to separate dialogue and narration.
 * - Sends message and recent context to AI with explicit, strict instructions.
 * - AI only adds speaker names or temporary designations to quoted dialogue lines,
 *   without modifying narration or losing content.
 */
async function formatAndNameMessages({ messages, originalMessage, updatedMessage }) {
  log("formatAndNameMessages");

  if (!updatedMessage || !updatedMessage.content) {
    return createProcessingResult({ messages, updatedMessage });
  }

  // Helper: get last n words from a string safely
  function getLastNWords(str, n = 5) {
    const words = str.trim().split(/\s+/);
    if (words.length <= n) return words.join(" ");
    return words.slice(-n).join(" ");
  }

  // Preformat current message content
  const preformattedContent = preFormatForNamingMessages(updatedMessage.content);

  // Build recent context excluding user and system messages, no speaker labels
  const visibleThreadMessages = oc.thread.messages.filter(
    m =>
      !(Array.isArray(m.hiddenFrom) && m.hiddenFrom.includes("ai")) &&
      m.author !== "system" &&
      m.author !== "user"
  );
  const recentMessages = visibleThreadMessages.slice(-numMessagesInContext, -1);
  const formattedContext = recentMessages.map(m => m.content).join("\n\n");

  // Compute startWith parameter: first up to 5 words or fewer before quote char
  let startWith = "";
  if (!preformattedContent.trim().startsWith('"')) {
    const wordRegex = /(\S+)/g;
    let words = [];
    let match;
    while ((match = wordRegex.exec(preformattedContent)) !== null && words.length < 5) {
      if (match[1].includes('"')) break;
      words.push(match[1]);
    }
    startWith = words.join(" ");
  }

  // Updated AI instruction message as requested
  const instructionText = `
You are a formatting assistant.

Recent context (only narration, no user messages):

${formattedContext}

Your task is to analyze the following text:

${preformattedContent}

You MUST add the FULL speaker name AT THE START of each quoted dialogue line ONLY without changing any other text.

Absolute rules:
- DO NOT add speaker names to any narration or descriptive lines (non-quoted lines).
- DO NOT remove, merge, split, or otherwise change any narration or descriptive text.
- DO NOT change any text inside quoted dialogue lines, except to add the correct speaker prefix.
- Dialogue lines must be of the form: Speaker Name: "Exact dialogue text."
- Maintain all blank lines and formatting exactly as in the input.
- Use the recent context above and the text itself to assign speaker names accurately.
- DO NOT add explanations, comments, notes, or any extra content.
- Return the full text correctly labeled with narration intact and dialogue lines properly prefixed.
- If the actor introduces itself assign that name.

Strictly follow these instructions.
`.trim();

  // Send request to AI
  let response = await oc.getInstructCompletion({
    instruction: instructionText,
    startWith: startWith || undefined,
  });

  if (response && response.text && response.text.trim()) {
    let content = response.text.trim();

    // Strip wrapping single quotes if present
    if (
      content.startsWith("'") &&
      content.endsWith("'") &&
      content.length >= 2
    ) {
      content = content.substring(1, content.length - 1).trim();
    }

    // Trim AI response to end exactly at the end of formattedContent snippet if present
    const endingSnippet = getLastNWords(preformattedContent, 5);
    const idx = content.lastIndexOf(endingSnippet);

    if (idx !== -1) {
      content = content.slice(0, idx + endingSnippet.length).trim();
    }
    // If idx === -1, keep content as-is (no trimming)

    // Maintain hiddenFrom flags and customData
    let hiddenFromSet = new Set(updatedMessage.hiddenFrom || []);
    if (hiddenFromSet.has("user")) {
      hiddenFromSet.delete("user");
      updatedMessage.customData = updatedMessage.customData || {};
      let existingHidden = new Set(updatedMessage.customData.hiddenFrom || []);
      existingHidden.add("user");
      updatedMessage.customData.hiddenFrom = [...existingHidden];
    }
    if (isHideFromUser) {
      hiddenFromSet.add("user");
    }

    updatedMessage = {
      ...updatedMessage,
      content,
      hiddenFrom: [...hiddenFromSet],
      customData: {
        ...(updatedMessage.customData || {}),
        hiddenFrom: updatedMessage.customData?.hiddenFrom || [],
      },
    };

    log("Message preformatted and strictly labeled by formatAndNameMessages");
    log(updatedMessage);
  }

  return createProcessingResult({ messages, updatedMessage });
}

/**
 * Generates or updates the player context summary in oc.thread.customData.contextSummary.
 */
async function generateContextSummary({ messages, originalMessage, updatedMessage }) {
  log("generateContextSummary");

  const visibleThreadMessages = oc.thread.messages.filter(
    m => !(Array.isArray(m.hiddenFrom) && m.hiddenFrom.includes("ai"))
  );

  if (visibleThreadMessages.filter(m => m.author === "ai").length < 2) {
    return createProcessingResult({ messages, updatedMessage });
  }

  if (!updatedMessage || updatedMessage.author !== "ai") {
    return createProcessingResult({ messages, updatedMessage });
  }

  let summarySystemMessage = oc.thread.messages.findLast(
    m => m.customData && m.customData.isSystemSummaryMessage
  );

  const contextSummary = oc.thread.customData?.contextSummary || {};

  let existingSummaryText;
  if (Object.keys(contextSummary).length) {
    existingSummaryText =
      "**Player Character Details:**\n" +
      Object.entries(contextSummary)
        .map(([key, value]) => `- ${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`)
        .join("\n");
  } else {
    existingSummaryText = "**Player Character Details:**\n- No summary yet.";
  }

  const propertiesListString = Object.keys(propertiesToTrackMap)
    .map(key => key.toLowerCase())
    .join("/");

  const propertiesPromptLines = Object.entries(propertiesToTrackMap)
    .map(([prop, instruction]) => ` - ${prop}: <write a comma-separated list of ${instruction}>`)
    .join("\n");

  log("est " + existingSummaryText);
  log("pls " + propertiesListString);
  log("ppl " + propertiesPromptLines);

  let questionText = `Here's the recent chat logs of the Player who is taking actions, and the "Game Master" describing the world:

---
${visibleThreadMessages
  .slice(-numMessagesInContext, -1)
  .filter(m => m.author !== "system")
  .map(m => (m.author === "ai" ? `[Game_Master]: ` : `[Player]: `) + m.content)
  .join("\n\n")}
---

Here's a summary of the player's ${propertiesListString}/etc:

---
${existingSummaryText}
---

Update the summary based on this latest development:

---
${updatedMessage.content}
---

If the player's data hasn't changed or if an invalid action was rejected, reply with the same summary unchanged.

Reply only with dot points for the properties below, no extra text.

**Player Character Details:**
${propertiesPromptLines}
`;

  let response = await oc.getInstructCompletion({
    instruction:
      `Your task is to keep track of the Player's ${propertiesListString}/etc. based on the messages of the Player and the Game Master.\n\n` +
      questionText,
    startWith: `**Player Character Details:**\n - ${Object.keys(propertiesToTrackMap)[0]}:`,
    stopSequences: ["\n\n"],
  });

  if (!oc.thread.customData) oc.thread.customData = {};

  const extractSection = (label, text) => {
    const regex = new RegExp(`^\\s*-\\s*${label}:\\s*([^\\r\\n]*)`, "mi");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  };

  let extractedProperties = {};
  for (const prop of Object.keys(propertiesToTrackMap)) {
    const key = prop.charAt(0).toLowerCase() + prop.slice(1);
    extractedProperties[key] = extractSection(prop, response.text);
  }

  oc.thread.customData.contextSummary = extractedProperties;

  updateContextSummaryWin();

  if (summarySystemMessage) {
    summarySystemMessage.content = response.text;
    oc.thread.messages = oc.thread.messages.filter(m => m !== summarySystemMessage);
  } else {
    summarySystemMessage = {
      author: "system",
      content: response.text,
      customData: { isSystemSummaryMessage: true },
      expectsReply: false,
      hiddenFrom: isHideFromUser ? ["user"] : [],
    };
  }
  oc.thread.messages.push(summarySystemMessage);

  return createProcessingResult({ messages, updatedMessage });
}

/**
 * Splits messages into lines and extracts dialog name/content from each.
 * Assigns "unknown character" if dialog name is empty.
 * Assigns " " (space) for non-dialogue lines.
 * Merges consecutive entries with name === " " by concatenating contents with a space.
 *
 * Also sets:
 * - customData.hideMessageInfo = true for non-dialogue lines (name === " ")
 * - customData.hideMessageButtons = true for dialog lines with assigned speaker name (except "unknown character")
 * - Does NOT set hideMessageInfo if name === "unknown character"
 */
async function splitIntoNamedMessages({ messages, originalMessage, updatedMessage }) {
  log("splitIntoNamedMessages");
  const inputMessages = messages && messages.length > 0 ? messages : [updatedMessage];

  let allParsedEntries = [];

  // Step 1. Parse lines into entries with assigned names
  for (const msg of inputMessages) {
    if (!msg?.content) continue;

    const lines = msg.content
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.length > 0);

    for (const line of lines) {
      const dialogMatch = line.match(/^([^:]+):\s*"([^"]+)"$/);
      let newName = "";
      let newContent = line;

      let hideMessageInfo = false;
      let hideMessageButtons = false;

      if (dialogMatch) {
        newName = dialogMatch[1].trim();

        if (!newName) {
          newName = "unknown character";
          // Do NOT hide message info for unknown character
        } else {
          // Valid speaker name assigned (not empty, not unknown character)
          hideMessageButtons = true;
        }

        newContent = dialogMatch[2].trim();
      } else {
        // Non-dialogue lines get name " "
        newName = " ";
        hideMessageInfo = true; // Hide info for narration lines only
      }

      allParsedEntries.push({
        ...msg,
        content: newContent,
        name: newName,
        hiddenFrom: ["ai"],
        customData: {
          ...msg.customData,
          hiddenFrom: ["ai"],
          hideMessageInfo: hideMessageInfo || false,
          hideMessageButtons: hideMessageButtons || false,
        },
      });
    }
  }

  // Step 2. Merge only consecutive entries with name === " "
  const mergedEntries = [];
  for (const entry of allParsedEntries) {
    if (entry.name === " ") {
      const lastEntry = mergedEntries[mergedEntries.length - 1];
      if (lastEntry && lastEntry.name === " ") {
        // Merge content with space separator
        lastEntry.content += " " + entry.content;
      } else {
        mergedEntries.push({ ...entry });
      }
    } else {
      mergedEntries.push({ ...entry });
    }
  }

  // Step 3. Remove duplicates by combining with existing messages array
  const uniqueMessagesSet = new Set(messages || []);
  for (const entry of mergedEntries) {
    uniqueMessagesSet.add(entry);
  }
  const resultMessages = Array.from(uniqueMessagesSet);

  return createProcessingResult({ messages: resultMessages });
}

// User command processor
async function onUserCommand({ messages, originalMessage }) {
  log("onUserCommand");
  if (!originalMessage) {
    return createProcessingResult({ messages });
  }

  let content = originalMessage.content.trim();

  if (content.startsWith("/info")) {
    oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith("/info"));
    showContextSummary();
    return createProcessingResult({ messages, stop: true });
  }

  if (content.startsWith("/resetSession")) {
    lastShownData = "nothingShownYet";
    if (oc.thread.customData) {
      delete oc.thread.customData.contextSummary;
    }
    updateContextSummaryWin();
    oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith("/resetSession"));
    log("Session reset by /resetSession command");
    return createProcessingResult({ messages, stop: true });
  }

  if (content.startsWith("/clearAll")) {
    oc.thread.messages = [];
    log("All messages cleared by /clearAll command");
    return createProcessingResult({ messages, stop: true });
  }

  if (content.startsWith("/debug")) {
    logDebugToMessages = true;

    oc.thread.customData = oc.thread.customData || {};
    let isCurrentlyDebug = oc.thread.customData.isDebug === true;

    if (!isCurrentlyDebug) {
      
      if (!oc.thread.customData) {
        oc.thread.customData = {};
      }

      oc.thread.customData.shortcutsButtons = oc.thread.shortcutButtons || undefined;
      
      oc.thread.customData.isDebug = true;
      let userCommands = ["/info", "/resetSession", "/clearAll", "/debug"];
      oc.thread.shortcutButtons = userCommands.map(cmd => ({
        autoSend: true,
        insertionType: "replace",
        message: cmd,
        name: cmd.substring(1),
        clearAfterSend: true,
        type: "message",
      }));
      oc.thread.messages.forEach(msg => {
        const originalSet = new Set([
          ...(Array.isArray(msg.customData?.hiddenFrom) ? msg.customData.hiddenFrom : []),
          ...(Array.isArray(msg.hiddenFrom) ? msg.hiddenFrom : []),
        ]);
        if (originalSet.has("user")) {
          msg.hiddenFrom = [...originalSet].filter(h => h !== "user");
          if (!msg.customData) msg.customData = {};
          msg.customData.hiddenFrom = [...originalSet];
          msg.customData.debugShown = true;
        } else {
          if (!msg.customData?.hiddenFrom) {
            msg.customData = msg.customData || {};
            msg.customData.hiddenFrom = [...originalSet];
          }
        }
      });

      log("Debug mode enabled");
    } else {
      oc.thread.customData.isDebug = false;

      oc.thread.shortcutButtons = oc.thread.customData.shortcutsButtons || undefined;
      delete oc.thread.customData.shortcutsButtons;

      oc.thread.messages.forEach(msg => {
        if (msg.customData?.debugShown === true) {
          const originalHidden = Array.isArray(msg.customData.hiddenFrom)
            ? msg.customData.hiddenFrom
            : (Array.isArray(msg.hiddenFrom) ? msg.hiddenFrom : []);
          msg.hiddenFrom = originalHidden;
          delete msg.customData.debugShown;
        }
      });

      oc.thread.messages = oc.thread.messages.filter(
        m => !(m.customData?.debug === true)
      );

      log("Debug mode disabled");
    }

    const isDebug = Boolean(oc.thread.customData.isDebug);
    logDebugToMessages = isDebug;
    isHideFromUser = !isDebug;

    oc.thread.messages = oc.thread.messages.filter(m => !m.content.startsWith("/debug"));

    updateContextSummaryWin();

    return createProcessingResult({ messages, stop: true });
  }

  return createProcessingResult({ messages });
}

// Event handler for added messages
oc.thread.on("MessageAdded", async () => {
  try {
    const message = oc.thread.messages.at(-1);
    if (!message) return;

    let processedResult = null;

    if (message.author === "ai") {
      processedResult = await processMessages(message, aiProcessingOrder);
    } else if (message.author === "user") {
      processedResult = await processMessages(message, userProcessingOrder);
    }

    if (processedResult && Array.isArray(processedResult.messages)) {
      if (processedResult.updatedMessage) {
        message.hiddenFrom = processedResult.updatedMessage.hiddenFrom ?? message.hiddenFrom;
        message.content = processedResult.updatedMessage.content ?? message.content;
        message.customData = processedResult.updatedMessage.customData ?? message.customData;
      }

      for (const msg of processedResult.messages) {
        oc.thread.messages.push(msg);
      }
    }
  } catch (err) {
    console.error("Error processing message:", err);
  }
});

function showContextSummary() {
  log("showContextSummary");
  oc.window.show();
  updateContextSummaryWin();
}

function updateContextSummaryWin() {
  const currentSummaryJSON =
    oc.thread.customData && oc.thread.customData.contextSummary
      ? JSON.stringify(oc.thread.customData.contextSummary)
      : null;

  if (lastShownData !== "nothingShownYet" && currentSummaryJSON === lastShownData) {
    return;
  }

  const container = document.getElementById("contextSummaryContent");
  if (!container) {
    console.error("Container element #contextSummaryContent not found.");
    return;
  }

  container.innerHTML = "";

  if (
    !oc.thread.customData ||
    !oc.thread.customData.contextSummary ||
    Object.keys(oc.thread.customData.contextSummary).length === 0
  ) {
    lastShownData = "nothingShownYet";

    const fallbackMessage = document.createElement("div");
    fallbackMessage.textContent = "No info yet. Start playing.";
    fallbackMessage.style.fontSize = "1.1em";
    fallbackMessage.style.color = "#666";
    fallbackMessage.style.textAlign = "center";
    fallbackMessage.style.marginTop = "20px";

    container.appendChild(fallbackMessage);
    return;
  }

  const summary = oc.thread.customData.contextSummary;

  for (const [key, value] of Object.entries(summary)) {
    const propertyDiv = document.createElement("div");
    propertyDiv.style.marginBottom = "12px";

    const titleElem = document.createElement("h3");
    titleElem.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    titleElem.style.margin = "0 0 4px 0";
    titleElem.style.fontWeight = "bold";

    const contentElem = document.createElement("div");
    contentElem.textContent = value || "(none)";
    contentElem.style.border = "1px solid black";
    contentElem.style.padding = "6px 10px";
    contentElem.style.borderRadius = "3px";
    contentElem.style.whiteSpace = "pre-wrap";

    propertyDiv.appendChild(titleElem);
    propertyDiv.appendChild(contentElem);

    container.appendChild(propertyDiv);
  }

  lastShownData = currentSummaryJSON;
}

function init() {
  log("init");
  document.body.innerHTML = contextSummaryWin;
  showContextSummary();
}

const contextSummaryWin = `
  <div style="position: relative; width: 100%; height: 100%; font-family: sans-serif; display: flex; flex-direction: column;">
    <div style="flex: 0 0 auto; padding: 10px 20px; background: #333; color: white; font-weight: bold; font-size: 1.2em; display: flex; justify-content: space-between; align-items: center;">
      <div>Info</div>
      <button
        style="background: transparent; border: none; color: white; font-size: 1.2em; cursor: pointer;"
        aria-label="Close Info Window"
        onclick="oc.window.hide()"
      >❌</button>
    </div>
    <div id="contextSummaryContent" style="flex: 1 1 auto; padding: 20px; overflow-y: auto;">
      <!-- Content will be filled here dynamically -->
    </div>
  </div>
`;

init();
