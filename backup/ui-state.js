(() => {
  if (window.UIState) return;

  const STATE = {
    WELCOME: "welcome",
    CHAT: "chat"
  };

  let currentState = null; // 🔑 CRITICAL FIX

  function applyState(state) {
    if (currentState === state) return;
    currentState = state;

    document.body.classList.remove("welcome-mode", "chat-mode");
    document.body.classList.add(`${state}-mode`);

    const messages = document.getElementById("aiMessages");
    const hero = document.getElementById("welcomeHero");

    if (!messages || !hero) return;

    if (state === STATE.WELCOME) {
      messages.style.display = "none";
      hero.style.display = "block";
    }

    if (state === STATE.CHAT) {
      hero.style.display = "none";
      messages.style.display = "flex";

      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
        document.getElementById("aiInput")?.focus();
      });
    }
  }

  window.UIState = {
    get: () => currentState,
    welcome: () => applyState(STATE.WELCOME),
    chat: () => applyState(STATE.CHAT),
    isChat: () => currentState === STATE.CHAT
  };
})();
