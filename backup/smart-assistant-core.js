(function () {
  if (!window.API) {
    window.API = "https://smart-ai-jh7s.onrender.com";
  }

  // 🛑 GLOBAL LOOP PROTECTION
  if (window.__SMART_CORE_ALREADY_RUNNING__) {
    console.warn("Smart core already running. Stopped duplicate load.");
    return; // Just return, don't throw error to prevent console red noise
  }
  window.__SMART_CORE_ALREADY_RUNNING__ = true;
  document.body.classList.add("loading");


  const API = window.API;
  // ===== GLOBAL SESSION EXPIRE HANDLER =====
function handleSessionExpired() {
  console.warn("Session expired. Redirecting to login.");
  localStorage.clear();
  window.location.replace("/login?reason=expired");
}
 const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);

    if (res.status === 401 || res.status === 403) {
      handleSessionExpired();
      throw new Error("Session expired");
    }

    return res;
  };
  // ===== GLOBAL STREAM CONTROL =====
  let isAITyping = false;
  let currentAbortController = null;
  let currentConversationId = null;
  let AUTH_STATE = "UNKNOWN"; // UNKNOWN | LOGGED_OUT | LOGGED_IN





  // ✅ UI HELPERS
  function clearChatUI() {
    const msgBox = document.getElementById("aiMessages");
    if (msgBox) msgBox.innerHTML = "";
  }
  
function forceScrollBottom() {
  const box = document.getElementById("aiMessages");
  if (!box) return;

  requestAnimationFrame(() => {
    box.scrollTop = box.scrollHeight;
  });
}
function renderChatHistoryFromCache(list) {
  const ui = document.getElementById("chatHistoryList");
  if (!ui || !Array.isArray(list)) return;

  ui.innerHTML = "";

  list.forEach(c => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.id = c.id;

    const title = document.createElement("span");
    title.textContent = c.title || "New Chat";
    title.style.whiteSpace = "nowrap";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.style.flex = "1";

    div.appendChild(title);
    ui.appendChild(div);
  });
}


  
  function showLoginOverlay() {
    const overlay = document.getElementById("aiLoginOverlay");
    if (overlay) overlay.style.display = "flex";
  }

  function hideLoginOverlay() {
    const overlay = document.getElementById("aiLoginOverlay");
    if (overlay) overlay.style.display = "none";
  }

  function setGuestUI() {
    const nameEl = document.getElementById("smartUserName");
    const statusEl = document.getElementById("smartUserStatus");
    if (nameEl) nameEl.textContent = "Guest";
    if (statusEl) statusEl.textContent = "Login required";
  }
  
  function setLoggedUI() {
    const nameEl = document.getElementById("smartUserName");
    const statusEl = document.getElementById("smartUserStatus");
    if (nameEl) nameEl.textContent = "User";
    if (statusEl) statusEl.textContent = "Logged in";
  }

  function formatTime(dateStr) {
    const d = dateStr ? new Date(dateStr) : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ... [MARKDOWN RENDERER CODE REMAINS THE SAME AS YOU PROVIDED] ...
  function renderMarkdown(text) {
    if (!text) return "";
    text = text.replace(/\n{3,}/g, "\n\n");
    let codeBlocks = [];
    text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
      const id = codeBlocks.length;
      codeBlocks.push(code);
      return `@@CODEBLOCK_${id}@@`;
    });
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
    html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
    html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
    html = html.replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>");
    html = html.replace(/\*(.*?)\*/gim, "<i>$1</i>");
    html = html.replace(/^\s*[-•] (.*)$/gim, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");
    html = html.replace(/\n\n+/g, "</p><p>");
    html = html.replace(/\n/g, "<br>");
    codeBlocks.forEach((code, i) => {
      const safeCode = code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const block = `<div class="ai-code-block"><button class="copy-btn">Copy</button><pre><code>${safeCode}</code></pre></div>`;
      html = html.replace(`@@CODEBLOCK_${i}@@`, block);
    });
    const finalHTML = `<div class="ai-formatted"><p>${html}</p></div>`;
    setTimeout(() => {
      document.querySelectorAll(".ai-code-block .copy-btn").forEach(btn => {
        btn.onclick = () => {
          const codeEl = btn.parentElement.querySelector("code");
          navigator.clipboard.writeText(codeEl.innerText);
          btn.textContent = "Copied!";
          setTimeout(() => (btn.textContent = "Copy"), 1200);
        };
      });
    }, 0);
    return finalHTML;
  }

  // ===== STREAMING LOGIC =====
  async function streamAIResponse({ query, fileText, memory = [], conversationId }) {
    const token = localStorage.getItem("token");
    currentAbortController = new AbortController();

    const res = await fetch(`${API}/ai/query-stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        query,
        fileText,
        memory,
        conversation_id: conversationId
      }),
      signal: currentAbortController.signal
    });

    if (!res.ok || !res.body) throw new Error("Stream failed");

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let finalText = "";

    const box = document.getElementById("aiMessages");
    const wrapper = document.createElement("div");
    wrapper.className = "chat-bubble assistant-bubble streaming-bubble";
    const bubble = document.createElement("div");
    bubble.className = "bubble-body";
    wrapper.appendChild(bubble);
    box.appendChild(wrapper);
    forceScrollBottom();

    try {
      while (isAITyping) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          finalText += chunk;
          bubble.innerHTML = renderMarkdown(finalText + "<span class='typing-cursor'>▍</span>");
          forceScrollBottom();
        }
      }
    } catch (err) {
      if (err.name !== "AbortError") console.error("Stream read error:", err);
    } finally {
      try { await reader.cancel(); } catch (e) {}
    }

    bubble.innerHTML = renderMarkdown(finalText);
    forceScrollBottom();
    currentAbortController = null;
    return finalText;
  }

  function renderMessageBubble({ role, content, created_at, file_url, message_id, file }) {


  const box = document.getElementById("aiMessages");
  if (!box) return;

  const wrapper = document.createElement("div");
  wrapper.className = "chat-bubble " + (role === "user" ? "user-bubble" : "assistant-bubble");
  if (message_id) wrapper.dataset.id = message_id;

  const bubble = document.createElement("div");
  bubble.className = "bubble-body";

  /* =========================
     1. TEXT CONTENT
     ========================= */
  if (content) {
    bubble.innerHTML = renderMarkdown(content);
  }

  /* =========================
     2. LOCAL FILE PREVIEW (before upload)
     ========================= */
  if (file) {
    bubble.appendChild(document.createElement("br"));

    if (file.type && file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.className = "chat-image-preview";
      img.onload = () => URL.revokeObjectURL(img.src);
      bubble.appendChild(img);
    } else {
      const fileDiv = document.createElement("div");
      fileDiv.className = "file-attachment";
      fileDiv.textContent = `📎 ${file.name}`;
      bubble.appendChild(fileDiv);
    }
  }

  /* =========================
     3. SERVER FILE LINK (after upload)
     ========================= */
  if (file_url) {
    bubble.appendChild(document.createElement("br"));

    const link = document.createElement("a");
    link.href = file_url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "📎 Open attachment";
    link.className = "file-link";

    bubble.appendChild(link);
  }

  const actions = document.createElement("div");
  actions.className = "bubble-actions";

  const copyBtn = document.createElement("span");
  copyBtn.textContent = "📋";
  copyBtn.title = "Copy";
  copyBtn.onclick = () =>
    navigator.clipboard.writeText(bubble.innerText || "");

  const retryBtn = document.createElement("span");
  retryBtn.textContent = "🔁";
  if (role === "assistant") {
    retryBtn.onclick = () =>
      window.regenerateLastAnswer && window.regenerateLastAnswer();
  } else {
    retryBtn.style.display = "none";
  }

  actions.appendChild(copyBtn);
  actions.appendChild(retryBtn);

  const time = document.createElement("div");
  time.className = "bubble-time";
  time.textContent = formatTime(created_at);

  const footer = document.createElement("div");
  footer.className = "bubble-footer";
  footer.appendChild(actions);
  footer.appendChild(time);

  wrapper.appendChild(bubble);
  wrapper.appendChild(footer);

  box.appendChild(wrapper);
  forceScrollBottom();
}


  async function checkAuthOnce() {
    if (AUTH_STATE !== "UNKNOWN") return;
    const token = localStorage.getItem("token");

    if (!token) {
      AUTH_STATE = "LOGGED_OUT";
      setGuestUI();
      showLoginOverlay();
      return;
    }

    try {
      const res = await fetch(`${API}/ai/conversations`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("token");
        AUTH_STATE = "LOGGED_OUT";
        setGuestUI();
        showLoginOverlay();
      } else {
        AUTH_STATE = "LOGGED_IN";
        hideLoginOverlay();
        setLoggedUI();
      }
    } catch (e) {
      console.warn("Backend sleeping");
    }
  }

  // ===== CHAT HANDLERS =====
  function startAIThinking() {
    isAITyping = true;
    setSendButtonMode("stop");
  }

  function stopAIThinking() {
    isAITyping = false;
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    setSendButtonMode("send");
  }

  function renderDateSeparator(dateStr) {
    const box = document.getElementById("aiMessages");
    if (!box) return;
    const d = new Date(dateStr);
    const sep = document.createElement("div");
    sep.className = "chat-date-separator";
    sep.textContent = "——— " + d.toDateString() + " ———";
    box.appendChild(sep);
  }

  function el(id) { return document.getElementById(id); }

  async function handleAskAI() {
    if (isAITyping) return;

  

    
    const input = el("aiInput");
    const msgBox = el("aiMessages");
    if (!input || !msgBox) return;

    const text = input.value.trim();
    const file = window.selectedFile || null;
    if (!text && !file) return;

    renderMessageBubble({
      role: "user",
      content: text || "[File uploaded]",
      created_at: new Date().toISOString(),
      file: window.selectedFile
    });
  // 🔥 FORCE CHAT MODE ON FIRST MESSAGE
  UIState.chat();
    
    forceScrollBottom();
    input.value = "";

    const token = localStorage.getItem("token");

    if (!currentConversationId) {
      try {
        currentConversationId = await window.createNewChat();
      } catch (e) {
        renderMessageBubble({ role: "assistant", content: "❌ Unable to start chat." });
        return;
      }
    }

    let extractedText = "";
    if (file) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const analyzeRes = await fetch(`${API}/ai/analyze-file`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd
        });
        const analyzeResult = await analyzeRes.json();
        extractedText = analyzeResult.text || "";
      } catch (e) {
        renderMessageBubble({ role: "assistant", content: "❌ Failed to analyze file." });
      }
    }

    await fetch(`${API}/ai/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ conversation_id: currentConversationId, role: "user", content: text || "[File uploaded]" })
    });

    startAIThinking();

    try {
      let memory = [];
      try {
        const memRes = await fetch(`${API}/ai/conversations/${currentConversationId}/messages`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const memMsgs = await memRes.json();
        memory = memMsgs.slice(-10).map(m => ({ role: m.role, content: m.content }));
      } catch (e) {}

      const finalReply = await streamAIResponse({
        query: text,
        fileText: extractedText,
        memory,
        conversationId: currentConversationId
      });

      stopAIThinking();
      if (!finalReply) return;

      await fetch(`${API}/ai/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: currentConversationId, role: "assistant", content: finalReply })
      });

    } catch (err) {
      isAITyping = false;
      setSendButtonMode("send");
      if (err.name !== "AbortError") {
        renderMessageBubble({ role: "assistant", content: "❌ Unable to process request." });
      }
    } finally {
      window.selectedFile = null;
      const preview = document.getElementById("filePreview");
      if (preview) preview.innerHTML = "";
    }
  }

function setSendButtonMode(mode) {
  const btn = document.getElementById("aiSendBtn");
  if (!btn) return;

  btn.classList.toggle("stop-mode", mode === "stop");
}


  const sendBtn = document.getElementById("aiSendBtn");
  if (sendBtn) {
    sendBtn.onclick = () => isAITyping ? stopAIThinking() : handleAskAI();
  }

  // ... [TABLE RENDERER AND EXPORT CODE REMAINS THE SAME] ...

  // ===== CONVERSATION LOGIC =====
 window.createNewChat = async function () {
  clearChatUI();
  currentConversationId = null;

  // 🔒 FORCE WELCOME MODE IMMEDIATELY
  UIState.welcome();

  const token = localStorage.getItem("token");

  const res = await fetch(`${API}/ai/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title: "New Chat" })
  });

  if (!res.ok) throw new Error("Failed to create conversation");

  const conv = await res.json();
  currentConversationId = conv.id;

  loadConversationList();
  return conv.id;
};

// ===== NEW: CREATE CHAT MENU FUNCTION =====
  function createChatMenu(chatId, chatTitle, containerDiv) {
    // 1. Create the Three Dots Button
    const btn = document.createElement("button");
    btn.className = "chat-menu-btn";
    btn.innerHTML = "⋮";
    btn.title = "Options";

    // 2. Create the Dropdown Menu
    const menu = document.createElement("div");
    menu.className = "chat-context-menu hidden";

    // Helper to add menu items
    const addItem = (label, icon, actionClass, onClick) => {
      const item = document.createElement("div");
      item.className = "menu-option " + (actionClass || "");
      item.innerHTML = `<span>${icon}</span> ${label}`;
      item.onclick = (e) => {
        e.stopPropagation(); // Stop click from bubbling
        menu.classList.add("hidden"); // Close menu
        onClick();
      };
      menu.appendChild(item);
    };

    // --- MENU ITEMS ---

    // A. Rename
    addItem("Rename", "✏️", "", async () => {
      const newTitle = prompt("Rename chat to:", chatTitle);
      if (newTitle && newTitle.trim() !== "") {
        try {
          await fetch(`${API}/ai/conversations/${chatId}`, {
            method: "PUT", // Assuming your API supports PUT for rename
            headers: { 
              "Content-Type": "application/json",
              Authorization: `Bearer ${localStorage.getItem("token")}` 
            },
            body: JSON.stringify({ title: newTitle })
          });
          await loadConversationList(); // Refresh list
        } catch (e) { console.error("Rename failed", e); }
      }
    });

    // B. Pin (Logic depends on backend, simulating visual change for now)
    addItem("Pin Chat", "📌", "", () => {
      // If you have a backend endpoint: await fetch(`${API}/pin/${chatId}`...)
      // For now, let's just alert
      alert(`Pinning "${chatTitle}" functionality requires backend support.`);
    });

    // C. Share
    addItem("Share", "📤", "", () => {
      const shareUrl = `${window.location.origin}/share/${chatId}`;
      navigator.clipboard.writeText(shareUrl);
      alert("Chat link copied to clipboard! (Simulated)");
    });

    // D. Delete
    addItem("Delete", "🗑️", "delete", async () => {
      if (confirm(`Are you sure you want to delete "${chatTitle}"?`)) {
        try {
          await fetch(`${API}/ai/conversations/${chatId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
          });
          // If deleted chat was active, switch to welcome mode
        currentConversationId = null;
clearChatUI();
UIState.welcome();

          await loadConversationList(); // Refresh list
        } catch (e) { console.error("Delete failed", e); }
      }
    });

    // 3. Toggle Logic
    btn.onclick = (e) => {
      e.stopPropagation(); // Prevent loading the chat
      
      // Close all other open menus first
      document.querySelectorAll(".chat-context-menu").forEach(m => {
        if (m !== menu) m.classList.add("hidden");
      });

      menu.classList.toggle("hidden");
    };

    // Append to the container
    containerDiv.appendChild(btn);
    containerDiv.appendChild(menu);
  }

  // GLOBAL CLICK LISTENER (To close menu when clicking outside)
  document.addEventListener("click", () => {
    document.querySelectorAll(".chat-context-menu").forEach(m => m.classList.add("hidden"));
  });

async function loadConversationList() {

  // ✅ INSTANT CACHE RENDER
  const cached = sessionStorage.getItem("chatList");
  if (cached) {
    try {
      renderChatHistoryFromCache(JSON.parse(cached));
    } catch (e) {}
  }

  const token = localStorage.getItem("token");
  const res = await fetch(`${API}/ai/conversations`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  let list = await res.json();
  if (list && list.conversations) list = list.conversations;
  if (!Array.isArray(list)) list = [];

  // ✅ UPDATE CACHE
  sessionStorage.setItem("chatList", JSON.stringify(list));

  const ui = document.getElementById("chatHistoryList");
  ui.innerHTML = "";

  list.forEach(c => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.dataset.id = c.id;
    if (c.id === currentConversationId) div.classList.add("active");

    div.onclick = () => loadConversation(c.id);

    const title = document.createElement("span");
    title.textContent = c.title || "New Chat";
    title.style.whiteSpace = "nowrap";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";
    title.style.flex = "1";

    div.appendChild(title);
    createChatMenu(c.id, c.title || "New Chat", div);
    ui.appendChild(div);
  });

  return list;
}

  
/* async function loadConversationList() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API}/ai/conversations`, { headers: { Authorization: `Bearer ${token}` } });
    let list = await res.json();
    if (list && list.conversations) list = list.conversations;
    if (!Array.isArray(list)) list = [];

    const ui = document.getElementById("chatHistoryList");
    ui.innerHTML = "";
    list.forEach(c => {
      const div = document.createElement("div");
      div.className = "chat-item";
      div.dataset.id = c.id;
      if (c.id === currentConversationId) div.classList.add("active");
      div.onclick = () => loadConversation(c.id);
      
      const title = document.createElement("span");
      title.textContent = c.title || "New Chat";
      div.appendChild(title);
      // Assuming createChatMenu is defined above or in helper
      // div.appendChild(createChatMenu(c.id, c.title)); 
      ui.appendChild(div);
    });
    return list;
  }
*/
  window.loadConversation = async function (id) {
    // ✅ MOBILE FIX: Close menu when a chat is selected
    const sidebar = document.querySelector('.left-bar');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (overlay) overlay.classList.remove('active');
    // -----------------------------------------------------

    currentConversationId = id;
    document.querySelectorAll(".chat-item").forEach(el => {
      el.classList.remove("active");
      if (el.dataset.id == id) el.classList.add("active");
    });
    
    clearChatUI();
    const token = localStorage.getItem("token");
    let res;
    try {
      res = await fetch(`${API}/ai/conversations/${id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) { return; }

    if (!res.ok) return;
    const messages = await res.json();
    if (!Array.isArray(messages)) return;

    // ✅ CHECK HISTORY: 
    // If we have messages -> Chat Mode (Bottom). 
    // If empty -> Welcome Mode (Center).
 if (messages.length > 0) {
  UIState.chat();

  let lastDate = null;
  messages.forEach(m => {
    const msgDate = new Date(m.created_at).toDateString();
    if (msgDate !== lastDate) {
      renderDateSeparator(m.created_at);
      lastDate = msgDate;
    }
    renderMessageBubble({
      role: m.role,
      content: m.content,
      created_at: m.created_at,
      file_url: m.file_url
    });
  });

  forceScrollBottom();
} else {
  UIState.welcome();
}

  };

  // ===== AUTH UI FUNCTIONS =====
  window.triggerSmartLogin = function () {
    const modal = document.getElementById("authModal");
    if(modal) modal.classList.remove("hidden");
  };

  window.closeAuthModal = function () {
    const modal = document.getElementById("authModal");
    if(modal) modal.classList.add("hidden");
  };

  window.submitLogin = async function () {
    // ✅ FIX: Use getElementById to get values
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    
    if(!emailInput || !passInput) return;

    const email = emailInput.value.trim();
    const password = passInput.value.trim();
    const errorEl = document.getElementById("authError");

    errorEl.textContent = "";

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.message || "Login failed";
        return;
      }
      localStorage.setItem("token", data.token);
      closeAuthModal();
      AUTH_STATE = "LOGGED_IN";
      hideLoginOverlay();
      setLoggedUI();
      await loadConversationList();
      
  
    } catch (e) {
      errorEl.textContent = "Server error";
    }
  };
async function loadUserSettings() {
  const token = localStorage.getItem("token");
  if (!token) return;

  const res = await fetch(`${API}/user/settings`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return;

  const settings = await res.json();

  // Apply theme
  if (settings.theme === "system") {
    document.body.removeAttribute("data-theme");
  } else {
    document.body.setAttribute("data-theme", settings.theme);
  }

  // Accent color
  if (settings.accent_color) {
    document.documentElement.style.setProperty(
      "--accent",
      settings.accent_color
    );
  }

  // Time format
  localStorage.setItem("timeFormat", settings.time_format || "12");

  // Cache locally (optional but fast)
  localStorage.setItem("userSettings", JSON.stringify(settings));
}

async function initSmartCore() {
  // ✅ Decide layout instantly (NO network wait)
  UIState.welcome();

  await checkAuthOnce();
  if (AUTH_STATE !== "LOGGED_IN") {
    document.body.classList.remove("loading");
    return;
  }

  // These load in background
  loadUserSettings();

  loadConversationList()
    .catch(() => {}) // avoid breaking UI on failure
    .finally(() => {
      // ✅ REMOVE loading ONLY AFTER LIST IS READY
      document.body.classList.remove("loading");
    });
}


// ===== MOBILE MENU LOGIC =====
// ===== MOBILE MENU LOGIC =====
  function initMobileMenu() {
    const btn = document.getElementById('mobile-menu-btn');
    const overlay = document.getElementById('mobile-overlay');
    const sidebar = document.querySelector('.left-bar');

    if (!btn || !overlay || !sidebar) return;

    // Toggle Function
    function toggleMenu() {
      const isOpen = sidebar.classList.contains('mobile-open');
      if (isOpen) {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
      } else {
        sidebar.classList.add('mobile-open');
        overlay.classList.add('active');
      }
    }

    // Event Listeners
    btn.onclick = (e) => {
      e.stopPropagation();
      toggleMenu();
    };

    overlay.onclick = () => toggleMenu(); // Close when clicking background
  }

  // ✅ CRITICAL: You must call this function here!
  initMobileMenu();

  // Start Core
  initSmartCore();
  console.log("✅ Smart Assistant Core loaded");

})();
