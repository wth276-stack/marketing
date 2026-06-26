(function jessiAuthGate() {
  const SESSION_KEY = "jessi-auth-v1";
  const SESSION_SALT = "|jessi-session|v1";

  const config = window.JESSI_AUTH_CONFIG;
  if (!config || !config.passwordHash) return;

  document.documentElement.classList.add("auth-pending");

  async function sha256(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function sessionToken() {
    return sha256(config.passwordHash + SESSION_SALT);
  }

  function readSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function writeSession(data) {
    const json = JSON.stringify(data);
    sessionStorage.setItem(SESSION_KEY, json);
    try {
      localStorage.setItem(SESSION_KEY, json);
    } catch (_) {}
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch (_) {}
  }

  async function hasValidSession() {
    const saved = readSession();
    if (!saved || !saved.token || !saved.exp) return false;
    if (Date.now() > saved.exp) {
      clearSession();
      return false;
    }
    const expected = await sessionToken();
    return saved.token === expected;
  }

  async function unlock() {
    document.documentElement.classList.remove("auth-pending");
    const gate = document.querySelector(".jessi-auth-gate");
    if (gate) gate.remove();
  }

  function buildGate() {
    const name = config.appName || "Jessi Beauty Academy";
    const gate = document.createElement("div");
    gate.className = "jessi-auth-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "jessi-auth-title");
    gate.innerHTML = `
      <form class="jessi-auth-card" id="jessi-auth-form" autocomplete="off">
        <h1 id="jessi-auth-title">${escapeHtml(name)}</h1>
        <p>請輸入密碼以使用此系統</p>
        <p class="jessi-auth-error" id="jessi-auth-error" aria-live="polite"></p>
        <div class="jessi-auth-field">
          <label for="jessi-auth-password">密碼</label>
          <input type="password" id="jessi-auth-password" name="password" required autocomplete="current-password" autofocus>
        </div>
        <button type="submit" class="jessi-auth-submit">進入系統</button>
        <p class="jessi-auth-note">此裝置會記住登入狀態 ${config.sessionDays || 30} 日</p>
      </form>
    `;

    const form = gate.querySelector("#jessi-auth-form");
    const input = gate.querySelector("#jessi-auth-password");
    const err = gate.querySelector("#jessi-auth-error");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      err.textContent = "";
      const pw = input.value;
      const hash = await sha256(pw);
      if (hash !== config.passwordHash) {
        err.textContent = "密碼不正確，請再試";
        input.select();
        return;
      }
      const days = config.sessionDays || 30;
      writeSession({
        token: await sessionToken(),
        exp: Date.now() + days * 86400000,
      });
      await unlock();
    });

    return gate;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.jessiAuthLogout = function jessiAuthLogout() {
    clearSession();
    document.documentElement.classList.add("auth-pending");
    const existing = document.querySelector(".jessi-auth-gate");
    if (existing) existing.remove();
    document.body.appendChild(buildGate());
    document.getElementById("jessi-auth-password")?.focus();
  };

  async function init() {
    if (await hasValidSession()) {
      await unlock();
      return;
    }
    if (!document.querySelector(".jessi-auth-gate")) {
      document.body.appendChild(buildGate());
    }
  }

  if (document.body) init();
  else document.addEventListener("DOMContentLoaded", init);
})();
