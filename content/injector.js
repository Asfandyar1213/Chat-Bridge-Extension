// ============================================================
// ChatBridge — Universal Chat Injector with Drip Animation
// Injects pasted chat text into any LLM input box
// with character-by-character drip typing animation
// ============================================================

(function () {
  "use strict";

  // ── Input box selectors per site ──────────────────────────
  const INPUT_SELECTORS = {
    "chatgpt.com": "#prompt-textarea, [data-id='root'] textarea",
    "chat.openai.com": "#prompt-textarea, textarea",
    "claude.ai": '[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
    "gemini.google.com": ".ql-editor, [contenteditable='true']",
    "perplexity.ai": "textarea, [contenteditable='true']",
    "chat.mistral.ai": "textarea, [contenteditable='true']",
    "poe.com": "textarea, [class*='GrowingTextArea']",
    "copilot.microsoft.com": "textarea, [contenteditable='true']",
    "grok.x.com": "textarea, [contenteditable='true']",
    "huggingface.co": "textarea, [contenteditable='true']",
  };

  function getInputSelector() {
    const host = window.location.hostname.replace("www.", "");
    for (const key in INPUT_SELECTORS) {
      if (host.includes(key)) return INPUT_SELECTORS[key];
    }
    return "textarea, [contenteditable='true']";
  }

  function findInputBox() {
    const selector = getInputSelector();
    const candidates = document.querySelectorAll(selector);
    // Pick the visible, largest, or most central one
    let best = null;
    let bestScore = -1;
    candidates.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const score = rect.width * rect.height;
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    });
    return best;
  }

  // ── Drip overlay UI ──────────────────────────────────────
  function createDripOverlay(text, speed, onDone) {
    // Remove existing overlay
    const existing = document.getElementById("chatbridge-drip-overlay");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "chatbridge-drip-overlay";
    overlay.innerHTML = `
      <div class="cb-drip-panel">
        <div class="cb-drip-header">
          <span class="cb-drip-icon">⚡</span>
          <span class="cb-drip-title">ChatBridge — Drip Injecting</span>
          <button class="cb-drip-stop" id="cb-stop-btn">✕ Stop</button>
        </div>
        <div class="cb-drip-progress-wrap">
          <div class="cb-drip-bar" id="cb-progress-bar"></div>
        </div>
        <div class="cb-drip-stats">
          <span id="cb-chars-done">0</span> / <span id="cb-chars-total">${text.length}</span> chars
          &nbsp;|&nbsp; Speed: <strong>${speed}ms/char</strong>
        </div>
        <div class="cb-drip-preview" id="cb-preview"></div>
        <div class="cb-drip-drops" id="cb-drops"></div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Spawn floating drop particles
    spawnDrops(overlay.querySelector("#cb-drops"));

    document.getElementById("cb-stop-btn").addEventListener("click", () => {
      overlay.setAttribute("data-stopped", "true");
    });

    return overlay;
  }

  function spawnDrops(container) {
    const colors = ["#00f5a0", "#00d9f5", "#a855f7", "#f59e0b"];
    let i = 0;
    const interval = setInterval(() => {
      if (!document.body.contains(container)) {
        clearInterval(interval);
        return;
      }
      const drop = document.createElement("div");
      drop.className = "cb-drop";
      drop.style.left = Math.random() * 100 + "%";
      drop.style.animationDuration = 0.8 + Math.random() * 1.2 + "s";
      drop.style.background = colors[i % colors.length];
      container.appendChild(drop);
      i++;
      setTimeout(() => drop.remove(), 2000);
    }, 120);
    container.__interval = interval;
  }

  // ── Set native value (works with React-controlled inputs) ─
  function setNativeValue(el, value) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === "TEXTAREA"
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype,
      "value"
    )?.set;

    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, value);
    } else {
      el.value = value;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // For contenteditable divs
  function setContentEditable(el, text) {
    el.focus();
    el.innerText = text;
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
  }

  // ── Main drip inject function ─────────────────────────────
  async function dripInject(text, speedMs = 8) {
    const inputEl = findInputBox();
    if (!inputEl) {
      showToast("❌ Could not find input box on this page.", "error");
      return;
    }

    inputEl.focus();
    inputEl.scrollIntoView({ behavior: "smooth", block: "center" });

    // Clear existing content
    if (inputEl.isContentEditable) {
      inputEl.innerText = "";
    } else {
      setNativeValue(inputEl, "");
    }

    const overlay = createDripOverlay(text, speedMs, () => {});
    const progressBar = document.getElementById("cb-progress-bar");
    const charsDone = document.getElementById("cb-chars-done");
    const preview = document.getElementById("cb-preview");
    let currentText = "";

    for (let i = 0; i < text.length; i++) {
      if (overlay.getAttribute("data-stopped") === "true") break;

      currentText += text[i];

      // Update the input
      if (inputEl.isContentEditable) {
        inputEl.innerText = currentText;
        // Dispatch input event for React
        inputEl.dispatchEvent(new InputEvent("input", { bubbles: true, data: text[i] }));
      } else {
        setNativeValue(inputEl, currentText);
      }

      // Move cursor to end
      try {
        if (inputEl.isContentEditable) {
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(inputEl);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          inputEl.selectionStart = inputEl.selectionEnd = currentText.length;
        }
      } catch (_) {}

      // Update progress UI
      const pct = ((i + 1) / text.length) * 100;
      progressBar.style.width = pct + "%";
      charsDone.textContent = i + 1;
      preview.textContent =
        "..." + currentText.slice(-60).replace(/\n/g, " ");

      await sleep(speedMs);
    }

    // Cleanup overlay
    clearInterval(overlay.querySelector("#cb-drops")?.__interval);
    setTimeout(() => {
      overlay.classList.add("cb-drip-done");
      setTimeout(() => overlay.remove(), 1200);
    }, 600);

    showToast("✅ Chat injected successfully!", "success");
  }

  // ── Instant paste (no animation) ─────────────────────────
  function instantPaste(text) {
    const inputEl = findInputBox();
    if (!inputEl) {
      showToast("❌ Could not find input box on this page.", "error");
      return;
    }
    inputEl.focus();
    if (inputEl.isContentEditable) {
      inputEl.innerText = text;
      inputEl.dispatchEvent(new InputEvent("input", { bubbles: true }));
    } else {
      setNativeValue(inputEl, text);
    }
    showToast("✅ Chat pasted instantly!", "success");
  }

  // ── Toast notification ────────────────────────────────────
  function showToast(message, type = "info") {
    const existing = document.getElementById("cb-toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.id = "cb-toast";
    toast.className = `cb-toast cb-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add("cb-toast-show"));
    setTimeout(() => {
      toast.classList.remove("cb-toast-show");
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  }

  // ── Sleep util ────────────────────────────────────────────
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  // ── Message listener ─────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "DRIP_INJECT") {
      dripInject(msg.text, msg.speed || 8)
        .then(() => sendResponse({ success: true }))
        .catch((e) => sendResponse({ success: false, error: e.message }));
      return true;
    }

    if (msg.action === "INSTANT_PASTE") {
      instantPaste(msg.text);
      sendResponse({ success: true });
      return true;
    }

    if (msg.action === "SHOW_TOAST") {
      showToast(msg.message, msg.type);
      sendResponse({ success: true });
      return true;
    }
  });
})();
