export function log(text = "Got here") {
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
    hiddenFrom: ["ai"],
    customData: { debug: true, hiddenFrom: ["ai"] },
  });
}
