# ⚡ ChatBridge — Universal AI Chat Copier

ChatBridge is a powerful Chrome Extension (Manifest V3) designed to seamlessly bridge conversations across multiple AI chat platforms. It allows you to extract full conversations, generate concise summaries using OpenRouter, and directly inject them into other AI models with style.

## 🌟 Features

- **Universal Extraction**: Supports capturing chat history from:
  - ChatGPT
  - Claude
  - Google Gemini
  - Perplexity
  - Mistral
  - Poe
  - Microsoft Copilot
  - Grok
  - HuggingFace Chat
- **Smart Summarization**: Integrated with **OpenRouter Auto API** to instantly summarize long conversation histories into concise bullet points.
- **Dynamic Injection**: Paste your extracted chats or summaries into a new AI tab instantly, or use the signature **Drip Mode** to watch the prompt stream in animated real-time.
- **Local History**: Automatically saves your last 50 extracted chats locally to your browser so you never lose context.
- **Privacy First**: Fully client-side processing using Vanilla JavaScript. The only external API call is to OpenRouter when you explicitly request a summary.

## 🚀 Installation (Unpacked)

Since this extension is not currently listed on the Chrome Web Store, you can install it manually in developer mode:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle in the top right corner.
4. Click the **Load unpacked** button in the top left.
5. Select the `Chat-Bridge-Extension` folder.
6. The ChatBridge icon ⚡ should now appear in your extensions toolbar!

## ⚙️ Configuration (OpenRouter API)

To use the **Summarize** feature, you need to provide your own OpenRouter API key:

1. Click the ChatBridge extension icon in your toolbar.
2. Click the **Settings (gear icon)** in the top right of the popup.
3. Paste your OpenRouter API key (starting with `sk-or-v1-...`) into the input field.
4. Click **Save Settings**.
*(Note: Your API key is securely saved only in your browser's local storage).*

## 💡 How to Use

1. **Capture**: Open any supported AI chat tab (like ChatGPT or Claude) and click **Extract Full Chat** from the extension popup.
2. **Review & Summarize**: Once extracted, you can preview the raw text, save it to history, copy it to your clipboard, or click **Summarize** to condense the content using OpenRouter.
3. **Inject**: 
   - Select a target LLM either from your currently open tabs or spawn a "New Tab" directly from the extension.
   - Choose whether you want to inject the "Full Chat" or the "Summary".
   - Select your paste mode (Drip or Instant) and hit **Inject**!

## 🛠️ Technical Details

Built entirely with Vanilla JavaScript, HTML, and CSS. No build tools (Webpack/Vite/NPM) required.
- **Manifest V3** compliant.
- Content Security Policy (CSP) optimized.
- Fallback text extraction mechanisms implemented for maximum robustness against UI changes on host platforms.
