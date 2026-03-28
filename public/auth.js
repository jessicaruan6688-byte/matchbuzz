const AUTH_LOCALE = window.location.pathname.startsWith("/zh/") ? "zh" : "en";
const AUTH_QUERY = new URLSearchParams(window.location.search);
const AUTH_TOKEN_KEY = "matchbuzz_member_token";

const AUTH_TEXT = {
  en: {
    login: "Sign In",
    register: "Register",
    loginEyebrow: "Sign In",
    registerEyebrow: "Register",
    loginTitle: "Sign back in with your email",
    registerTitle: "Create your account with email",
    loginCopy: "Use the same email and password to reopen your wallet, referral code, and football member benefits.",
    registerCopy: "Use a real email address to activate your member wallet, referral code, and watch-party ticket credits.",
    checking: "Checking current member session...",
    guestTitle: "Real member registration is live",
    guestCopy:
      "Create an account with email and password. Your data is written into the MatchBuzz backend, and the same account can be used on the homepage and watch-party pages.",
    guestRules: "Signup bonus, daily check-in, referral rewards, and watch-party credits are already connected.",
    signedIn: "Signed in member",
    wallet: "Wallet",
    invite: "Referral code",
    tree: "Referral tree",
    continue: "Continue",
    openHome: "Open Home",
    openWatchParties: "Open Watch Parties",
    logout: "Log Out",
    logoutSuccess: "Logged out.",
    loginSuccess: "Signed in. Redirecting...",
    registerSuccess: "Account created. Redirecting...",
    errorPrefix: "Member access error: ",
    guestFallback: "No member session yet.",
    referralPlaceholder: "Optional invite code",
    continueHint: "After sign-in, you can go straight back to the football page you came from."
  },
  zh: {
    login: "登录",
    register: "注册",
    loginEyebrow: "登录",
    registerEyebrow: "注册",
    loginTitle: "用邮箱重新登录",
    registerTitle: "用邮箱创建真实会员账户",
    loginCopy: "使用同一个邮箱和密码，重新打开你的钱包、邀请码和足球会员权益。",
    registerCopy: "用真实邮箱激活会员钱包、邀请码，以及观赛活动里的积分抵扣能力。",
    checking: "正在检查会员会话...",
    guestTitle: "真实会员注册已经接通",
    guestCopy: "用邮箱和密码创建账户后，数据会写入 MatchBuzz 后台，同一个账户也能在首页和观赛活动页继续使用。",
    guestRules: "注册奖励、每日签到、推荐奖励和观赛活动积分抵扣都已经连起来了。",
    signedIn: "已登录会员",
    wallet: "钱包",
    invite: "邀请码",
    tree: "推荐树",
    continue: "继续进入",
    openHome: "打开首页",
    openWatchParties: "打开观赛活动",
    logout: "退出登录",
    logoutSuccess: "已退出登录。",
    loginSuccess: "登录成功，正在跳转...",
    registerSuccess: "注册成功，正在跳转...",
    errorPrefix: "会员入口错误：",
    guestFallback: "当前还没有登录会话。",
    referralPlaceholder: "可选，填写邀请代码",
    continueHint: "登录后可以直接回到你刚才打开的足球页面。"
  }
};

const authState = {
  mode: normalizeMode(AUTH_QUERY.get("mode"), AUTH_QUERY.get("ref")),
  token: window.localStorage.getItem(AUTH_TOKEN_KEY) || "",
  returnTo: sanitizeReturnTo(AUTH_QUERY.get("returnTo")),
  overview: null
};

const authElements = {
  modeEyebrow: document.querySelector("#auth-mode-eyebrow"),
  modeTitle: document.querySelector("#auth-mode-title"),
  modeCopy: document.querySelector("#auth-mode-copy"),
  switchButtons: Array.from(document.querySelectorAll("[data-mode-switch]")),
  loginForm: document.querySelector("#auth-login-form"),
  registerForm: document.querySelector("#auth-register-form"),
  feedback: document.querySelector("#auth-feedback"),
  statusShell: document.querySelector("#auth-status-shell"),
  loginEmail: document.querySelector("#auth-login-email"),
  loginPassword: document.querySelector("#auth-login-password"),
  registerName: document.querySelector("#auth-register-name"),
  registerEmail: document.querySelector("#auth-register-email"),
  registerPassword: document.querySelector("#auth-register-password"),
  registerTeam: document.querySelector("#auth-register-team"),
  registerReferral: document.querySelector("#auth-register-referral")
};

function authText() {
  return AUTH_TEXT[AUTH_LOCALE];
}

function escapeAuthHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function authNumber(value) {
  return new Intl.NumberFormat(AUTH_LOCALE === "zh" ? "zh-CN" : "en-US").format(Number(value || 0));
}

function normalizeMode(mode, referralCode = "") {
  if (mode === "login") {
    return "login";
  }
  if (mode === "register" || referralCode) {
    return "register";
  }
  return "register";
}

function sanitizeReturnTo(value) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "";
  }
  return raw;
}

function defaultHomePath() {
  return AUTH_LOCALE === "zh" ? "/zh/index.html#member-club" : "/#member-club";
}

function continuePath() {
  return authState.returnTo || defaultHomePath();
}

function setAuthToken(token) {
  authState.token = token || "";
  if (authState.token) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, authState.token);
  } else {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

function setFeedback(message, isError = false) {
  if (!authElements.feedback) {
    return;
  }
  authElements.feedback.textContent = message || "";
  authElements.feedback.classList.toggle("is-error", Boolean(message && isError));
}

async function authFetchJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (authState.token) {
    headers.Authorization = `Bearer ${authState.token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

function updateModeQuery(mode) {
  const params = new URLSearchParams(window.location.search);
  params.set("mode", mode);
  const search = params.toString();
  window.history.replaceState({}, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
}

function renderMode() {
  const text = authText();
  const loginActive = authState.mode === "login";
  authElements.loginForm?.classList.toggle("is-hidden", !loginActive);
  authElements.registerForm?.classList.toggle("is-hidden", loginActive);

  authElements.switchButtons.forEach((button) => {
    const active = button.dataset.modeSwitch === authState.mode;
    button.classList.toggle("button-primary", active);
    button.classList.toggle("button-secondary", !active);
  });

  if (authElements.modeEyebrow) {
    authElements.modeEyebrow.textContent = loginActive ? text.loginEyebrow : text.registerEyebrow;
  }
  if (authElements.modeTitle) {
    authElements.modeTitle.textContent = loginActive ? text.loginTitle : text.registerTitle;
  }
  if (authElements.modeCopy) {
    authElements.modeCopy.textContent = loginActive ? text.loginCopy : text.registerCopy;
  }

  updateModeQuery(authState.mode);
}

function renderStatus() {
  if (!authElements.statusShell) {
    return;
  }

  const text = authText();
  const member = authState.overview?.member || null;
  const network = authState.overview?.network?.counts || { level1: 0, level2: 0, level3: 0 };
  const watchPartyLink = AUTH_LOCALE === "zh" ? "/zh/watch-parties.html" : "/watch-parties.html";
  const homeLink = AUTH_LOCALE === "zh" ? "/zh/index.html" : "/";

  if (!member) {
    authElements.statusShell.innerHTML = `
      <article class="member-booking-banner">
        <h4>${escapeAuthHtml(text.guestTitle)}</h4>
        <p class="depth-copy">${escapeAuthHtml(text.guestCopy)}</p>
        <div class="member-mini-stats">
          <span>${escapeAuthHtml(text.guestRules)}</span>
          <span>${escapeAuthHtml(text.continueHint)}</span>
        </div>
      </article>
    `;
    return;
  }

  authElements.statusShell.innerHTML = `
    <article class="member-booking-banner member-booking-banner-live">
      <p class="eyebrow">${escapeAuthHtml(text.signedIn)}</p>
      <h4>${escapeAuthHtml(member.displayName)}</h4>
      <div class="member-mini-stats">
        <span>${escapeAuthHtml(text.wallet)} · ${authNumber(member.pointsBalance)} ${AUTH_LOCALE === "zh" ? "积分" : "pts"}</span>
        <span>${escapeAuthHtml(text.invite)} · ${escapeAuthHtml(member.referralCode)}</span>
        <span>${escapeAuthHtml(text.tree)} · L1 ${network.level1} / L2 ${network.level2} / L3 ${network.level3}</span>
      </div>
      <div class="cta-actions">
        <a class="button button-primary" href="${escapeAuthHtml(continuePath())}">${escapeAuthHtml(text.continue)}</a>
        <a class="button button-secondary" href="${escapeAuthHtml(homeLink)}">${escapeAuthHtml(text.openHome)}</a>
        <a class="button button-secondary" href="${escapeAuthHtml(watchPartyLink)}">${escapeAuthHtml(text.openWatchParties)}</a>
        <button id="auth-logout-button" class="button button-secondary" type="button">${escapeAuthHtml(text.logout)}</button>
      </div>
    </article>
  `;

  document.querySelector("#auth-logout-button")?.addEventListener("click", handleLogout);
}

async function refreshOverview() {
  const overview = await authFetchJson(`/api/member/overview?language=${AUTH_LOCALE}`);
  if (authState.token && !overview.member) {
    setAuthToken("");
  }
  authState.overview = overview;
  renderStatus();
}

function hydrateReferralFromQuery() {
  const referralCode = AUTH_QUERY.get("ref");
  if (referralCode && authElements.registerReferral) {
    authElements.registerReferral.value = referralCode.toUpperCase();
  }
  if (authElements.registerReferral && !authElements.registerReferral.value) {
    authElements.registerReferral.placeholder = authText().referralPlaceholder;
  }
}

function scheduleRedirect() {
  window.setTimeout(() => {
    window.location.href = continuePath();
  }, 700);
}

async function submitLogin(event) {
  event.preventDefault();
  setFeedback("");

  try {
    const overview = await authFetchJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: authElements.loginEmail.value.trim(),
        password: authElements.loginPassword.value,
        language: AUTH_LOCALE
      })
    });
    setAuthToken(overview.token);
    authState.overview = overview;
    renderStatus();
    setFeedback(authText().loginSuccess);
    authElements.loginForm.reset();
    scheduleRedirect();
  } catch (error) {
    setFeedback(`${authText().errorPrefix}${error.message}`, true);
  }
}

async function submitRegister(event) {
  event.preventDefault();
  setFeedback("");

  try {
    const overview = await authFetchJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        displayName: authElements.registerName.value.trim(),
        email: authElements.registerEmail.value.trim(),
        password: authElements.registerPassword.value,
        favoriteTeam: authElements.registerTeam.value.trim(),
        referralCode: authElements.registerReferral.value.trim(),
        language: AUTH_LOCALE
      })
    });
    setAuthToken(overview.token);
    authState.overview = overview;
    renderStatus();
    setFeedback(authText().registerSuccess);
    authElements.registerForm.reset();
    hydrateReferralFromQuery();
    scheduleRedirect();
  } catch (error) {
    setFeedback(`${authText().errorPrefix}${error.message}`, true);
  }
}

async function handleLogout() {
  try {
    await authFetchJson("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  } catch (error) {
    // Ignore logout response errors and clear local state.
  }

  setAuthToken("");
  authState.overview = null;
  setFeedback(authText().logoutSuccess);
  renderStatus();
}

function wireAuthEvents() {
  authElements.switchButtons.forEach((button) => {
    button.addEventListener("click", () => {
      authState.mode = button.dataset.modeSwitch === "login" ? "login" : "register";
      renderMode();
      setFeedback("");
    });
  });

  authElements.loginForm?.addEventListener("submit", submitLogin);
  authElements.registerForm?.addEventListener("submit", submitRegister);
}

async function bootstrapAuthPage() {
  hydrateReferralFromQuery();
  renderMode();
  wireAuthEvents();

  try {
    await refreshOverview();
  } catch (error) {
    authState.overview = { member: null, network: null };
    renderStatus();
    setFeedback(`${authText().errorPrefix}${error.message}`, true);
  }
}

bootstrapAuthPage();
