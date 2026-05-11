// ============================================================
// ChatBridge Popup — Full Logic
// ============================================================

"use strict";

// ── State ────────────────────────────────────────────────────
const state = {
  extractedChat: null,
  formattedChat: null,
  summary: null,
  selectedTabId: null,
  selectedTabMode: "open", // 'open' | 'new'
  selectedNewLLM: null,
  injectMode: "drip",
  contentMode: "full",
  speed: 8,
  settings: {},
};

const LLM_OPTIONS = [
  { name: "ChatGPT", emoji: "🟢", url: "https://chatgpt.com/" },
  { name: "Claude",  emoji: "🟠", url: "https://claude.ai/new" },
  { name: "Gemini",  emoji: "🔵", url: "https://gemini.google.com/" },
  { name: "Perplexity", emoji: "⚫", url: "https://www.perplexity.ai/" },
  { name: "Mistral", emoji: "🔴", url: "https://chat.mistral.ai/" },
  { name: "Poe",     emoji: "🟡", url: "https://poe.com/" },
  { name: "Copilot", emoji: "🔷", url: "https://copilot.microsoft.com/" },
  { name: "Grok",    emoji: "⚡", url: "https://grok.x.com/" },
];

// ── Init ─────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await loadSettings();
  setupViews();
  setupExtract();
  setupTargetTabs();
  setupLLMGrid();
  setupInjectOptions();
  detectCurrentSite();
  loadOpenTabs();
});

// ── Settings ─────────────────────────────────────────────────
async function loadSettings() {
  const result = await chrome.storage.local.get("chatbridge_settings");
  state.settings = result.chatbridge_settings || {
    mode: "drip",
    speed: 8,
    autosave: true,
    metadata: true,
    openRouterKey: "",
  };
  state.injectMode = state.settings.mode || "drip";
  state.speed = state.settings.speed || 8;
}

// ── View navigation ──────────────────────────────────────────
function setupViews() {
  document.getElementById("btn-history").addEventListener("click", () => {
    showView("history");
    loadHistory();
  });
  document.getElementById("btn-settings").addEventListener("click", () => {
    showView("settings");
    loadSettingsUI();
  });
  document.getElementById("btn-back-history").addEventListener("click", () => showView("main"));
  document.getElementById("btn-back-settings").addEventListener("click", () => showView("main"));

  document.getElementById("btn-save-settings").addEventListener("click", saveSettings);
  document.getElementById("btn-clear-all").addEventListener("click", clearAllHistory);
}

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => {
    v.classList.remove("active");
    v.classList.add("hidden");
  });
  const el = document.getElementById(`view-${name}`);
  el.classList.remove("hidden");
  el.classList.add("active");
}

// ── Detect current site ──────────────────────────────────────
async function detectCurrentSite() {
  const dot = document.getElementById("detect-dot");
  const label = document.getElementById("detect-label");
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const resp = await chrome.tabs.sendMessage(tab.id, { action: "PING" }).catch(() => null);
    if (resp?.pong) {
      dot.classList.add("active");
      label.textContent = `${resp.site} detected ✓`;
    } else {
      dot.classList.add("inactive");
      label.textContent = "Not an AI chat page";
    }
  } catch {
    dot.classList.add("inactive");
    label.textContent = "Can't detect site";
  }
}

// ── Extract ──────────────────────────────────────────────────
function setupExtract() {
  document.getElementById("btn-extract").addEventListener("click", extractChat);
  document.getElementById("btn-copy").addEventListener("click", copyChat);
  document.getElementById("btn-save").addEventListener("click", saveChatToHistory);
  document.getElementById("btn-summarize").addEventListener("click", summarizeChat);
  document.getElementById("btn-clear").addEventListener("click", clearExtract);
  document.getElementById("btn-use-summary").addEventListener("click", useSummaryAsContent);
}

async function extractChat() {
  const btn = document.getElementById("btn-extract");
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> Extracting…';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab");

    const resp = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CHAT" });
    if (!resp?.success) throw new Error(resp?.error || "Extraction failed");

    state.extractedChat = resp.chatData;
    state.formattedChat = resp.formatted;

    // Auto-save if setting enabled
    if (state.settings.autosave) {
      await chrome.runtime.sendMessage({
        action: "SAVE_CHAT",
        chatData: state.extractedChat,
        formatted: state.formattedChat,
      });
    }

    showExtractResult();
    updateInjectButton();
  } catch (e) {
    alert("❌ Could not extract chat: " + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Extract Full Chat`;
  }
}

function showExtractResult() {
  const data = state.extractedChat;
  const el = document.getElementById("extract-result");
  el.classList.remove("hidden");

  document.getElementById("result-meta").textContent =
    `${data.source} · ${data.messages.length} messages · ${state.formattedChat.length.toLocaleString()} chars`;

  document.getElementById("preview-text").value =
    state.formattedChat.substring(0, 400) + (state.formattedChat.length > 400 ? "\n…(truncated in preview)" : "");
}

async function copyChat() {
  if (!state.formattedChat) return;
  await navigator.clipboard.writeText(state.formattedChat);
  const btn = document.getElementById("btn-copy");
  btn.textContent = "✓ Copied!";
  setTimeout(() => {
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
  }, 1500);
}

async function saveChatToHistory() {
  if (!state.extractedChat) return;
  await chrome.runtime.sendMessage({
    action: "SAVE_CHAT",
    chatData: state.extractedChat,
    formatted: state.formattedChat,
  });
  const btn = document.getElementById("btn-save");
  btn.textContent = "✓ Saved!";
  setTimeout(() => { btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Save`; }, 1500);
}

async function summarizeChat() {
  if (!state.formattedChat) return;
  
  if (!state.settings.openRouterKey) {
    alert("Please configure your OpenRouter API Key in Settings first.");
    return;
  }

  const btn = document.getElementById("btn-summarize");
  btn.disabled = true;
  btn.textContent = "Summarizing…";

  const summaryBlock = document.getElementById("summary-block");
  const summaryText = document.getElementById("summary-text");
  summaryBlock.classList.remove("hidden");
  summaryText.innerHTML = `<div class="summarize-loading"><div class="spinner"></div> Asking AI…</div>`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.settings.openRouterKey}`,
        "HTTP-Referer": "https://chatbridge.extension",
        "X-Title": "ChatBridge Extension"
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: [
          {
            role: "user",
            content: `Summarize this AI conversation concisely in 3-5 bullet points. Focus on the key topics, questions asked, and insights from the assistant. Keep it under 200 words.\n\nChat:\n${state.formattedChat.substring(0, 8000)}`,
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || "OpenRouter API Error");
    const text = data.choices?.[0]?.message?.content || "Could not summarize.";
    state.summary = text;
    summaryText.textContent = text;
  } catch (e) {
    summaryText.textContent = "⚠ Summarization failed: " + e.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg> Summarize`;
  }
}

function useSummaryAsContent() {
  document.getElementById("content-summary").click();
}

function clearExtract() {
  state.extractedChat = null;
  state.formattedChat = null;
  state.summary = null;
  document.getElementById("extract-result").classList.add("hidden");
  document.getElementById("summary-block").classList.add("hidden");
  updateInjectButton();
}

// ── Target LLM tabs ───────────────────────────────────────────
function setupTargetTabs() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const tab = btn.dataset.tab;
      state.selectedTabMode = tab;
      state.selectedTabId = null;
      state.selectedNewLLM = null;
      updateInjectButton();

      document.querySelectorAll(".tab-content").forEach((c) => {
        c.classList.add("hidden");
        c.classList.remove("active");
      });
      const content = document.getElementById(`tab-${tab}`);
      content.classList.remove("hidden");
      content.classList.add("active");
    });
  });

  document.getElementById("btn-refresh-tabs").addEventListener("click", loadOpenTabs);
}

async function loadOpenTabs() {
  const list = document.getElementById("tab-list");
  list.innerHTML = `<div class="loading-tabs"><div class="spinner"></div> Scanning…</div>`;

  const resp = await chrome.runtime.sendMessage({ action: "GET_TABS" });
  const tabs = resp.tabs || [];

  if (tabs.length === 0) {
    list.innerHTML = `<div class="no-tabs">No AI chat tabs open.<br>Open ChatGPT, Claude, Gemini, etc.<br>then click Refresh.</div>`;
    return;
  }

  list.innerHTML = "";
  tabs.forEach((tab) => {
    const item = document.createElement("div");
    item.className = "tab-item";
    item.dataset.tabId = tab.id;
    item.innerHTML = `
      ${tab.favIconUrl ? `<img class="tab-item-favicon" src="${tab.favIconUrl}" />` : '<span style="font-size:14px">🤖</span>'}
      <div class="tab-item-info">
        <div class="tab-item-ai">${tab.aiName}</div>
        <div class="tab-item-title">${escapeHtml(tab.title || tab.url)}</div>
      </div>
    `;

    const iconImg = item.querySelector('.tab-item-favicon');
    if (iconImg) {
      iconImg.addEventListener("error", () => {
        iconImg.style.display = 'none';
      });
    }

    item.addEventListener("click", () => {
      document.querySelectorAll(".tab-item").forEach((i) => i.classList.remove("selected"));
      item.classList.add("selected");
      state.selectedTabId = tab.id;
      updateInjectButton();
    });
    list.appendChild(item);
  });
}

// ── LLM Grid ──────────────────────────────────────────────────
function setupLLMGrid() {
  const grid = document.getElementById("llm-grid");
  LLM_OPTIONS.forEach((llm) => {
    const btn = document.createElement("button");
    btn.className = "llm-btn";
    btn.innerHTML = `<span class="llm-emoji">${llm.emoji}</span><span>${llm.name}</span>`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".llm-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      state.selectedNewLLM = llm;
      updateInjectButton();
    });
    grid.appendChild(btn);
  });
}

// ── Inject options ────────────────────────────────────────────
function setupInjectOptions() {
  // Mode toggle
  document.querySelectorAll("[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.injectMode = btn.dataset.mode;
      document.getElementById("speed-row").style.opacity = state.injectMode === "drip" ? "1" : "0.3";
    });
  });

  // Content toggle
  document.querySelectorAll("[data-content]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-content]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.contentMode = btn.dataset.content;
    });
  });

  // Speed slider
  const slider = document.getElementById("speed-slider");
  slider.value = state.speed;
  document.getElementById("speed-val").textContent = state.speed + "ms";
  slider.addEventListener("input", () => {
    state.speed = parseInt(slider.value);
    document.getElementById("speed-val").textContent = state.speed + "ms";
  });

  // Inject button
  document.getElementById("btn-inject").addEventListener("click", doInject);
}

function updateInjectButton() {
  const btn = document.getElementById("btn-inject");
  const label = document.getElementById("inject-label");
  const icon = document.querySelector(".inject-icon");

  const hasContent = !!(state.extractedChat);
  const hasTarget =
    (state.selectedTabMode === "open" && state.selectedTabId) ||
    (state.selectedTabMode === "new" && state.selectedNewLLM);

  if (!hasContent) {
    btn.disabled = true;
    icon.textContent = "💧";
    label.textContent = "Extract a chat first";
    return;
  }

  if (!hasTarget) {
    btn.disabled = true;
    icon.textContent = "💧";
    label.textContent = "Select a target LLM";
    return;
  }

  btn.disabled = false;
  const targetName =
    state.selectedTabMode === "new"
      ? state.selectedNewLLM.name
      : "Selected Tab";
  icon.textContent = state.injectMode === "drip" ? "💧" : "⚡";
  label.textContent = `${state.injectMode === "drip" ? "Drip Inject" : "Instant Paste"} → ${targetName}`;
}

async function doInject() {
  const btn = document.getElementById("btn-inject");
  btn.disabled = true;

  const text =
    state.contentMode === "summary" && state.summary
      ? state.summary
      : state.formattedChat;

  if (!text) {
    alert("No content to inject.");
    updateInjectButton();
    return;
  }

  try {
    if (state.selectedTabMode === "open" && state.selectedTabId) {
      const resp = await chrome.runtime.sendMessage({
        action: "INJECT_TO_TAB",
        tabId: state.selectedTabId,
        text,
        mode: state.injectMode,
        speed: state.speed,
      });
      if (!resp.success) throw new Error(resp.error);
    } else if (state.selectedTabMode === "new" && state.selectedNewLLM) {
      const resp = await chrome.runtime.sendMessage({
        action: "OPEN_AND_INJECT",
        url: state.selectedNewLLM.url,
        text,
        mode: state.injectMode,
        speed: state.speed,
      });
      if (!resp.success) throw new Error(resp.error);
    }
  } catch (e) {
    alert("❌ Injection failed: " + e.message);
  } finally {
    updateInjectButton();
  }
}

// ── History ──────────────────────────────────────────────────
async function loadHistory() {
  const resp = await chrome.runtime.sendMessage({ action: "GET_SAVED_CHATS" });
  const chats = resp.chats || [];
  const list = document.getElementById("history-list");

  if (chats.length === 0) {
    list.innerHTML = '<div class="empty-state">No saved chats yet.<br>Extract and save chats to see them here.</div>';
    return;
  }

  list.innerHTML = "";
  chats.forEach((chat) => {
    const item = document.createElement("div");
    item.className = "history-item";
    const date = new Date(chat.savedAt).toLocaleString();
    item.innerHTML = `
      <div class="history-item-header">
        <span class="history-source">${escapeHtml(chat.source)}</span>
        <span class="history-date">${date}</span>
      </div>
      <div class="history-meta">${chat.messageCount} messages · ${chat.formatted?.length?.toLocaleString() || 0} chars</div>
      <div class="history-actions">
        <button class="btn-xs btn-load-chat" data-id="${chat.id}">Load</button>
        <button class="btn-xs btn-copy-history" data-id="${chat.id}">Copy</button>
        <button class="btn-xs danger btn-delete-chat" data-id="${chat.id}">Delete</button>
      </div>
    `;

    item.querySelector(".btn-load-chat").addEventListener("click", (e) => {
      e.stopPropagation();
      state.extractedChat = chat.chatData;
      state.formattedChat = chat.formatted;
      showView("main");
      showExtractResult();
      updateInjectButton();
    });

    item.querySelector(".btn-copy-history").addEventListener("click", async (e) => {
      e.stopPropagation();
      await navigator.clipboard.writeText(chat.formatted || "");
      e.target.textContent = "✓ Copied";
      setTimeout(() => { e.target.textContent = "Copy"; }, 1500);
    });

    item.querySelector(".btn-delete-chat").addEventListener("click", async (e) => {
      e.stopPropagation();
      await chrome.runtime.sendMessage({ action: "DELETE_CHAT", id: chat.id });
      item.remove();
    });

    list.appendChild(item);
  });
}

async function clearAllHistory() {
  if (!confirm("Delete all saved chats?")) return;
  const resp = await chrome.runtime.sendMessage({ action: "GET_SAVED_CHATS" });
  for (const chat of resp.chats || []) {
    await chrome.runtime.sendMessage({ action: "DELETE_CHAT", id: chat.id });
  }
  loadHistory();
}

// ── Settings UI ──────────────────────────────────────────────
function loadSettingsUI() {
  const s = state.settings;
  const modeEl = document.getElementById("setting-mode");
  const speedEl = document.getElementById("setting-speed");
  const autosaveEl = document.getElementById("setting-autosave");
  const metaEl = document.getElementById("setting-metadata");
  const keyEl = document.getElementById("setting-openrouter-key");

  if (modeEl) modeEl.value = s.mode || "drip";
  if (speedEl) speedEl.value = s.speed || 8;
  if (autosaveEl) autosaveEl.checked = s.autosave !== false;
  if (metaEl) metaEl.checked = s.metadata !== false;
  if (keyEl) keyEl.value = s.openRouterKey || "";
}

async function saveSettings() {
  const settings = {
    mode: document.getElementById("setting-mode").value,
    speed: parseInt(document.getElementById("setting-speed").value) || 8,
    autosave: document.getElementById("setting-autosave").checked,
    metadata: document.getElementById("setting-metadata").checked,
    openRouterKey: document.getElementById("setting-openrouter-key").value.trim(),
  };
  await chrome.storage.local.set({ chatbridge_settings: settings });
  state.settings = settings;
  state.injectMode = settings.mode;
  state.speed = settings.speed;

  const btn = document.getElementById("btn-save-settings");
  btn.textContent = "✓ Saved!";
  setTimeout(() => { btn.textContent = "Save Settings"; }, 1500);
}

// ── Utils ─────────────────────────────────────────────────────
function escapeHtml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
