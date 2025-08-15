if (!window.customData) window.customData = {};
const windowData = window.customData;

if (!windowData.debug) windowData.debug = {};
const debugData = windowData.debug;

if (!windowData.config) windowData.config = {};
const config = windowData.config;

const thread = oc.thread;
if (!thread.customData) thread.customData = {};
const threadData = thread.customData;

if (!windowData.session) windowData.session = {};
const session = windowData.session;

export { windowData, debugData, threadData, session, config };
