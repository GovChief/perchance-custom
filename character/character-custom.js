await import('https://cdn.jsdelivr.net/gh/GovChief/perchance-custom@main/character/versions.js').then(async ({ load }) => {
  await load("latest_preview");
});

const repoPath = oc.thread.customData.repoPath;

// Imports segment
let imports, debug, messageProcessing, ui, globals, userProcessing;
try {
  let failedModules = [];
  imports = await import(`${repoPath}/imports.js`);
  if (!imports) {
    failedModules.push('imports');
  } else {
    debug = imports.debug;
    messageProcessing = imports.messageProcessing;
    ui = imports.ui;
    globals = imports.globals;
    userProcessing = await import(`${repoPath}/processing/userProcessing.js`);
    if (!debug) failedModules.push('debug');
    if (!messageProcessing) failedModules.push('messageProcessing');
    if (!ui) failedModules.push('ui');
    if (!globals) failedModules.push('globals');
    if (!userProcessing) failedModules.push('userProcessing');
  }
  if (failedModules.length > 0) {
    throw new Error("Failed to load required modules: " + failedModules.join(', ') + ".");
  }
} catch (error) {
  oc.thread.messages.push({
    author: "FAILED INIT",
    content: "Failed to initialise imports: " + error.message,
    customData: { debug: true },
    expectsReply: false,
    hiddenFrom: ["ai"],
  });
}

// Deconstruct globals after import
const { threadData, windowData, debugData, session, config } = globals;

// CustomData grouping
Object.assign(config, {
  numMessagesInContext: 4, // Fixed number of recent messages for context
  propertiesToTrackMap: {
    Inventory: "any items currently in the player's inventory",
    Skills: "skills that the player has",
    Location: "player's current location",
    Actors: "names of people player is interacting with"
  },
  aiProcessingOrder: [
    generateContextSummary,
    formatAndNameMessages,
    splitIntoNamedMessages,
  ],
  userProcessingOrder: [
    userProcessing.onUserCommand,
  ],
});

// Keep session object empty but ready for future use
Object.assign(session, {});

Object.assign(debugData, {
  logDebugToMessages: Boolean(threadData?.isDebug),
  isHideFromUser: !Boolean(threadData?.isDebug)
});

// Utility functions segment
function preFormatForNamingMessages(text) {
  const segments = [];
  let cursor = 0;
  const length = text.length;

  while (cursor < length) {
    if (text[cursor] === '"') {
      let endQuote = cursor + 1;
      while (endQuote < length) {
        if (text[endQuote] === '"') break;
        endQuote++;
      }
      if (endQuote >= length) {
        let narrationRest = text.slice(cursor).trim();
        if (narrationRest) segments.push({ text: narrationRest, quoted: false });
        cursor = length;
      } else {
        let quotedText = text.slice(cursor, endQuote + 1).trim();
        segments.push({ text: quotedText, quoted: true });
        cursor = endQuote + 1;
      }
    } else {
      let nextQuote = text.indexOf('"', cursor);
      let narrationPart = nextQuote === -1 ? text.slice(cursor) : text.slice(cursor, nextQuote);

      narrationPart = narrationPart.trim();

      if (narrationPart.length > 0) {
        segments.push({ text: narrationPart, quoted: false });
      }

      cursor = nextQuote === -1 ? length : nextQuote;
    }

    while (cursor < length && /\s/.test(text[cursor])) cursor++;
  }

  return segments.map(s => s.text).join('\n\n');
}

// AI processing functions segment
async function formatAndNameMessages({ messages, originalMessage, updatedMessage }) {
  debug.log("formatAndNameMessages");

  if (!updatedMessage || !updatedMessage.content) {
    return messageProcessing.createProcessingResult({ messages, updatedMessage });
  }

  function getLastNWords(str, n = 5) {
    const words = str.trim().split(/\s+/);
    if (words.length <= n) return words.join(" ");
    return words.slice(-n).join(" ");
  }

  const preformattedContent = preFormatForNamingMessages(updatedMessage.content);

  const visibleThreadMessages = oc.thread.messages.filter(
    m =>
      !(Array.isArray(m.hiddenFrom) && m.hiddenFrom.includes("ai")) &&
      m.author !== "system" &&
      m.author !== "user"
  );
  const recentMessages = visibleThreadMessages.slice(-config.numMessagesInContext, -1);
  const formattedContext = recentMessages.map(m => m.content).join("\n\n");

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

  let response = await oc.getInstructCompletion({
    instruction: instructionText,
    startWith: startWith || undefined,
  });

  if (response && response.text && response.text.trim()) {
    let content = response.text.trim();

    if (
      content.startsWith("'") &&
      content.endsWith("'") &&
      content.length >= 2
    ) {
      content = content.substring(1, content.length - 1).trim();
    }

    const endingSnippet = getLastNWords(preformattedContent, 5);
    const idx = content.lastIndexOf(endingSnippet);

    if (idx !== -1) {
      content = content.slice(0, idx + endingSnippet.length).trim();
    }

    let hiddenFromSet = new Set(updatedMessage.hiddenFrom || []);
    if (hiddenFromSet.has("user")) {
      hiddenFromSet.delete("user");
      updatedMessage.customData = updatedMessage.customData || {};
      let existingHidden = new Set(updatedMessage.customData?.hiddenFrom || []);
      existingHidden.add("user");
      updatedMessage.customData.hiddenFrom = [...existingHidden];
    }
    if (debugData.isHideFromUser) {
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

    debug.log("Message preformatted and strictly labeled by formatAndNameMessages");
    debug.log(updatedMessage);
  }

  return messageProcessing.createProcessingResult({ messages, updatedMessage });
}

async function generateContextSummary({ messages, originalMessage, updatedMessage }) {
  debug.log("generateContextSummary");

  const visibleThreadMessages = oc.thread.messages.filter(
    m => !(Array.isArray(m.hiddenFrom) && m.hiddenFrom.includes("ai"))
  );

  if (visibleThreadMessages.filter(m => m.author === "ai").length < 2) {
    return messageProcessing.createProcessingResult({ messages, updatedMessage });
  }

  if (!updatedMessage || updatedMessage.author !== "ai") {
    return messageProcessing.createProcessingResult({ messages, updatedMessage });
  }

  let summarySystemMessage = oc.thread.messages.findLast(
    m => m.customData && m.customData.isSystemSummaryMessage
  );

  const contextSummary = threadData.contextSummary || {};

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

  const propertiesListString = Object.keys(config.propertiesToTrackMap)
    .map(key => key.toLowerCase())
    .join("/");

  const propertiesPromptLines = Object.entries(config.propertiesToTrackMap)
    .map(([prop, instruction]) => ` - ${prop}: <write a comma-separated list of ${instruction}>`)
    .join("\n");

  debug.log("est " + existingSummaryText);
  debug.log("pls " + propertiesListString);
  debug.log("ppl " + propertiesPromptLines);

  let questionText = `Here's the recent chat logs of the Player who is taking actions, and the "Game Master" describing the world:

---
${visibleThreadMessages
  .slice(-config.numMessagesInContext, -1)
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
    startWith: `**Player Character Details:**\n - ${Object.keys(config.propertiesToTrackMap)[0]}:`,
    stopSequences: ["\n\n"],
  });

  const extractSection = (label, text) => {
    const regex = new RegExp(`^\\s*-\\s*${label}:\\s*([^\\r\\n]*)`, "mi");
    const match = text.match(regex);
    return match ? match[1].trim() : "";
  };

  let extractedProperties = {};
  for (const prop of Object.keys(config.propertiesToTrackMap)) {
    const key = prop.charAt(0).toLowerCase() + prop.slice(1);
    extractedProperties[key] = extractSection(prop, response.text);
  }

  threadData.contextSummary = extractedProperties;

  ui.refresh();

  if (summarySystemMessage) {
    summarySystemMessage.content = response.text;
    oc.thread.messages = oc.thread.messages.filter(m => m !== summarySystemMessage);
  } else {
    summarySystemMessage = {
      author: "system",
      content: response.text,
      customData: { isSystemSummaryMessage: true },
      expectsReply: false,
      hiddenFrom: debugData.isHideFromUser ? ["user"] : [],
    };
  }
  oc.thread.messages.push(summarySystemMessage);

  return messageProcessing.createProcessingResult({ messages, updatedMessage });
}

async function splitIntoNamedMessages({ messages, originalMessage, updatedMessage }) {
  debug.log("splitIntoNamedMessages");
  const inputMessages = messages && messages.length > 0 ? messages : [updatedMessage];

  let allParsedEntries = [];

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
        } else {
          hideMessageButtons = true;
        }

        newContent = dialogMatch[2].trim();
      } else {
        newName = " ";
        hideMessageInfo = true;
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

  const mergedEntries = [];
  for (const entry of allParsedEntries) {
    if (entry.name === " ") {
      const lastEntry = mergedEntries[mergedEntries.length - 1];
      if (lastEntry && lastEntry.name === " ") {
        lastEntry.content += " " + entry.content;
      } else {
        mergedEntries.push({ ...entry });
      }
    } else {
      mergedEntries.push({ ...entry });
    }
  }

  const uniqueMessagesSet = new Set(messages || []);
  for (const entry of mergedEntries) {
    uniqueMessagesSet.add(entry);
  }
  const resultMessages = Array.from(uniqueMessagesSet);

  return messageProcessing.createProcessingResult({ messages: resultMessages });
}

// Event hook segment
oc.thread.on("MessageAdded", async () => {
  try {
    const message = oc.thread.messages.at(-1);
    if (!message) return;

    let processedResult = null;

    if (message.author === "ai") {
      processedResult = await messageProcessing.processMessages(message, config.aiProcessingOrder);
    } else if (message.author === "user") {
      processedResult = await messageProcessing.processMessages(message, config.userProcessingOrder);
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

// UI segment
function init() {
  debug.log("init");
  ui.refresh();
}

init();
