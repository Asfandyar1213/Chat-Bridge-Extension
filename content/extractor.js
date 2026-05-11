// ============================================================
// ChatBridge — Universal Chat Extractor
// Supports: ChatGPT, Claude, Gemini, Perplexity, Mistral,
//           Poe, Copilot, Grok, HuggingFace Chat
// ============================================================

(function () {
  "use strict";

  const SITE_CONFIGS = {
    "chatgpt.com": {
      name: "ChatGPT",
      messageSelector: "[data-message-author-role]",
      roleAttr: "data-message-author-role",
      contentSelector: ".markdown, .whitespace-pre-wrap",
      userRole: "user",
      assistantRole: "assistant",
    },
    "chat.openai.com": {
      name: "ChatGPT",
      messageSelector: "[data-message-author-role]",
      roleAttr: "data-message-author-role",
      contentSelector: ".markdown, .whitespace-pre-wrap",
      userRole: "user",
      assistantRole: "assistant",
    },
    "claude.ai": {
      name: "Claude",
      messageSelector: '[data-testid="user-message"], [data-testid="assistant-message"], .font-user-message, .font-claude-message, [data-testid="human-turn"], [data-testid="ai-turn"]',
      roleAttr: "class",
      contentSelector: ".prose, p, .grid-cols-1, .text-text-100",
      userRole: "user",
      assistantRole: "claude",
    },
    "gemini.google.com": {
      name: "Gemini",
      messageSelector: ".conversation-turn",
      roleAttr: "class",
      contentSelector: ".model-response-text, .query-text",
      userRole: "user-query",
      assistantRole: "model-response",
    },
    "perplexity.ai": {
      name: "Perplexity",
      messageSelector: ".prose-query, .prose",
      roleAttr: "class",
      contentSelector: "p, .prose",
      userRole: "prose-query",
      assistantRole: "prose",
    },
    "chat.mistral.ai": {
      name: "Mistral",
      messageSelector: "[class*='message']",
      roleAttr: "class",
      contentSelector: "p, .markdown",
      userRole: "user",
      assistantRole: "assistant",
    },
    "poe.com": {
      name: "Poe",
      messageSelector: "[class*='Message_humanMessageBubble'], [class*='Message_botMessageBubble']",
      roleAttr: "class",
      contentSelector: "p, [class*='Markdown']",
      userRole: "human",
      assistantRole: "bot",
    },
    "copilot.microsoft.com": {
      name: "Copilot",
      messageSelector: "[data-content='user-message'], [data-content='ai-message']",
      roleAttr: "data-content",
      contentSelector: "p, .prose",
      userRole: "user-message",
      assistantRole: "ai-message",
    },
    "grok.x.com": {
      name: "Grok",
      messageSelector: "[class*='message']",
      roleAttr: "class",
      contentSelector: "p",
      userRole: "user",
      assistantRole: "assistant",
    },
    "huggingface.co": {
      name: "HuggingFace Chat",
      messageSelector: "[class*='message']",
      roleAttr: "class",
      contentSelector: "p, .prose",
      userRole: "user",
      assistantRole: "assistant",
    },
  };

  function detectSite() {
    const host = window.location.hostname.replace("www.", "");
    for (const key in SITE_CONFIGS) {
      if (host.includes(key)) return { host: key, config: SITE_CONFIGS[key] };
    }
    return null;
  }

  function extractTextFromNode(node) {
    if (!node) return "";
    // Get visible text content, preserving structure
    const clone = node.cloneNode(true);
    // Remove code block indicators we'll handle separately
    const texts = [];
    
    // Handle code blocks specially
    clone.querySelectorAll("pre code, pre").forEach((block) => {
      const lang = block.className.match(/language-(\w+)/)?.[1] || "";
      const code = block.textContent.trim();
      // Mark it
      block.setAttribute("data-extracted-code", `\`\`\`${lang}\n${code}\n\`\`\``);
      block.textContent = `[[CODE_BLOCK_${lang}]]`;
    });

    let text = clone.innerText || clone.textContent || "";
    
    // Re-insert code blocks
    node.querySelectorAll("pre code, pre").forEach((block) => {
      const lang = block.className.match(/language-(\w+)/)?.[1] || "";
      const code = block.textContent.trim();
      const placeholder = `[[CODE_BLOCK_${lang}]]`;
      const replacement = `\`\`\`${lang}\n${code}\n\`\`\``;
      text = text.replace(placeholder, replacement);
    });

    return text.trim();
  }

  function extractChatGeneric() {
    const site = detectSite();
    const messages = [];

    if (!site) {
      // Fallback: try to grab anything that looks like a conversation
      return extractFallback();
    }

    const { config } = site;
    const elements = document.querySelectorAll(config.messageSelector);

    elements.forEach((el) => {
      const roleVal = String(el.getAttribute(config.roleAttr) || el.className || "").toLowerCase();
      let role = "unknown";

      if (
        roleVal.includes(config.userRole.toLowerCase()) ||
        roleVal === config.userRole.toLowerCase() ||
        roleVal.includes("user") ||
        roleVal.includes("human") ||
        el.getAttribute("data-message-author-role") === "user"
      ) {
        role = "user";
      } else if (
        roleVal.includes(config.assistantRole.toLowerCase()) ||
        roleVal === config.assistantRole.toLowerCase() ||
        roleVal.includes("bot") ||
        roleVal.includes("ai") ||
        roleVal.includes("claude") ||
        roleVal.includes("model") ||
        el.getAttribute("data-message-author-role") === "assistant"
      ) {
        role = "assistant";
      }

      const contentEl =
        el.querySelector(config.contentSelector) || el;
      const text = extractTextFromNode(contentEl);

      if (text && text.length > 1) {
        messages.push({ role, text });
      }
    });

    if (messages.length === 0) {
      return extractFallback();
    }

    return {
      source: config.name,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  function extractFallback() {
    // Last-resort: grab all paragraphs and group them
    const all = document.querySelectorAll(
      "p, .message, [class*='message'], [class*='chat']"
    );
    const messages = [];
    all.forEach((el) => {
      const text = (el.innerText || el.textContent || "").trim();
      if (text.length > 10) {
        messages.push({ role: "unknown", text });
      }
    });

    return {
      source: document.title || window.location.hostname,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
      messages,
    };
  }

  function formatChatAsText(chatData) {
    let output = `# Chat Export from ${chatData.source}\n`;
    output += `Extracted: ${new Date(chatData.extractedAt).toLocaleString()}\n`;
    output += `URL: ${chatData.url}\n\n`;
    output += "---\n\n";

    chatData.messages.forEach((msg, i) => {
      const label =
        msg.role === "user"
          ? "👤 User"
          : msg.role === "assistant"
          ? "🤖 Assistant"
          : "💬 Message";
      output += `**${label}:**\n${msg.text}\n\n`;
      if (i < chatData.messages.length - 1) output += "---\n\n";
    });

    return output;
  }

  function formatChatAsMarkdown(chatData) {
    return formatChatAsText(chatData);
  }

  // Listen for messages from popup / background
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "EXTRACT_CHAT") {
      try {
        const chatData = extractChatGeneric();
        const formatted = formatChatAsMarkdown(chatData);
        sendResponse({ success: true, chatData, formatted });
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
      return true;
    }

    if (msg.action === "PING") {
      sendResponse({ pong: true, site: detectSite()?.config?.name || "Unknown" });
      return true;
    }
  });

  // Expose globally for injector.js
  window.__chatBridgeExtract = () => extractChatGeneric();
  window.__chatBridgeFormat = (data) => formatChatAsMarkdown(data);
})();
