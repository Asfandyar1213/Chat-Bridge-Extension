// ============================================================
// ChatBridge — Background Service Worker
// Handles cross-tab communication, storage, and summarization
// ============================================================

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "SAVE_CHAT") {
    saveChat(msg.chatData, msg.formatted).then(sendResponse);
    return true;
  }

  if (msg.action === "GET_SAVED_CHATS") {
    getSavedChats().then(sendResponse);
    return true;
  }

  if (msg.action === "DELETE_CHAT") {
    deleteChat(msg.id).then(sendResponse);
    return true;
  }

  if (msg.action === "INJECT_TO_TAB") {
    injectToTab(msg.tabId, msg.text, msg.mode, msg.speed).then(sendResponse);
    return true;
  }

  if (msg.action === "GET_TABS") {
    getAiTabs().then(sendResponse);
    return true;
  }

  if (msg.action === "OPEN_AND_INJECT") {
    openAndInject(msg.url, msg.text, msg.mode, msg.speed).then(sendResponse);
    return true;
  }
});

// ── Storage helpers ─────────────────────────────────────────
async function saveChat(chatData, formatted) {
  const result = await chrome.storage.local.get("chatbridge_chats");
  const chats = result.chatbridge_chats || [];
  const entry = {
    id: Date.now().toString(),
    savedAt: new Date().toISOString(),
    source: chatData.source,
    url: chatData.url,
    messageCount: chatData.messages.length,
    formatted,
    chatData,
  };
  chats.unshift(entry);
  // Keep last 50 chats
  if (chats.length > 50) chats.splice(50);
  await chrome.storage.local.set({ chatbridge_chats: chats });
  return { success: true, id: entry.id };
}

async function getSavedChats() {
  const result = await chrome.storage.local.get("chatbridge_chats");
  return { chats: result.chatbridge_chats || [] };
}

async function deleteChat(id) {
  const result = await chrome.storage.local.get("chatbridge_chats");
  const chats = (result.chatbridge_chats || []).filter((c) => c.id !== id);
  await chrome.storage.local.set({ chatbridge_chats: chats });
  return { success: true };
}

// ── Tab injection ───────────────────────────────────────────
async function injectToTab(tabId, text, mode = "drip", speed = 8) {
  const action = mode === "drip" ? "DRIP_INJECT" : "INSTANT_PASTE";
  try {
    await chrome.tabs.sendMessage(tabId, { action, text, speed });
    return { success: true };
  } catch (e) {
    // Content script may not be loaded yet, inject it
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content/extractor.js", "content/injector.js"],
      });
      await chrome.scripting.insertCSS({
        target: { tabId },
        files: ["content/drip.css"],
      });
      await new Promise((r) => setTimeout(r, 500));
      await chrome.tabs.sendMessage(tabId, { action, text, speed });
      return { success: true };
    } catch (e2) {
      return { success: false, error: e2.message };
    }
  }
}

// ── Get open AI tabs ────────────────────────────────────────
async function getAiTabs() {
  const AI_PATTERNS = [
    "*://chatgpt.com/*",
    "*://chat.openai.com/*",
    "*://claude.ai/*",
    "*://gemini.google.com/*",
    "*://www.perplexity.ai/*",
    "*://chat.mistral.ai/*",
    "*://poe.com/*",
    "*://copilot.microsoft.com/*",
    "*://grok.x.com/*",
    "*://huggingface.co/*",
  ];

  const AI_NAMES = {
    "chatgpt.com": "ChatGPT",
    "chat.openai.com": "ChatGPT",
    "claude.ai": "Claude",
    "gemini.google.com": "Gemini",
    "perplexity.ai": "Perplexity",
    "chat.mistral.ai": "Mistral",
    "poe.com": "Poe",
    "copilot.microsoft.com": "Copilot",
    "grok.x.com": "Grok",
    "huggingface.co": "HuggingFace",
  };

  const tabs = [];
  for (const pattern of AI_PATTERNS) {
    try {
      const found = await chrome.tabs.query({ url: pattern });
      found.forEach((tab) => {
        const host = new URL(tab.url).hostname.replace("www.", "");
        const name = Object.keys(AI_NAMES).find((k) => host.includes(k));
        tabs.push({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          aiName: name ? AI_NAMES[name] : host,
          favIconUrl: tab.favIconUrl,
        });
      });
    } catch (_) {}
  }

  return { tabs };
}

// ── Open new tab then inject ────────────────────────────────
async function openAndInject(url, text, mode, speed) {
  const tab = await chrome.tabs.create({ url, active: true });
  // Wait for page load
  await new Promise((resolve) => {
    const listener = (tabId, info) => {
      if (tabId === tab.id && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    // Timeout safety
    setTimeout(resolve, 8000);
  });

  // Small extra delay for React apps to hydrate
  await new Promise((r) => setTimeout(r, 1500));
  return injectToTab(tab.id, text, mode, speed);
}
