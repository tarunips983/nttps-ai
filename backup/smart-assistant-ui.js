console.log("✅ Smart Assistant UI loaded");

window.selectedFile = null;



window.bindSmartAssistantUI = function () {
  if (window.__SMART_ASSISTANT_BOUND__) return;

  const fileInput = document.getElementById("chatFile");
  const previewBox = document.getElementById("filePreview");
  const attachBtn = document.getElementById("attachBtn");
  const inputEl = document.getElementById("aiInput");

  // A. Bind File Attachment
  if (attachBtn && fileInput) {
    attachBtn.onclick = () => fileInput.click();
  }

  if (fileInput && previewBox) {
    fileInput.onchange = () => {
      const file = fileInput.files[0];
      if (!file) return;

      console.log("📁 UI File selected:", file.name);
      window.selectedFile = file;

      // Force Chat Mode if a file is selected (Optional, but usually good UX)


      previewBox.style.display = "block";

      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        previewBox.innerHTML = `<img src="${url}" class="chat-image-preview">`;
      } else if (file.type === "application/pdf") {
        previewBox.innerHTML = `<div style="padding:8px;border:1px solid #ccc;border-radius:6px">📄 ${file.name}</div>`;
      } else {
        previewBox.innerHTML = `📎 ${file.name}`;
      }
    };
  }

  // B. Bind Input Key Events (Enter key)
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
      }
    });
  }

  window.__SMART_ASSISTANT_BOUND__ = true;
  console.log("✅ Smart Assistant UI bound");
}; // <--- THIS WAS MISSING IN YOUR CODE

/* =========================================
   4. UTILITIES
   ========================================= */

window.regenerateLastAnswer = async function () {
  // Assuming isAITyping is global or checked elsewhere
  if (window.isAITyping) return; 

  const token = localStorage.getItem("adminToken") || localStorage.getItem("token");
  if (!token) return;

  // Find last user message in UI
  const bubbles = document.querySelectorAll(".chat-bubble.user-bubble .bubble-body");
  if (!bubbles.length) return;

  const lastUserText = bubbles[bubbles.length - 1].innerText;
  const input = document.getElementById("aiInput");
  
  if(input) {
      input.value = lastUserText;
      if(window.handleAskAI) window.handleAskAI();
  }
};

window.clearChatUI = function () {
  const messages = document.getElementById("aiMessages");
  if (messages) messages.innerHTML = "";
};
