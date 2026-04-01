(function bootstrapMatchBuzzAnalytics() {
  const ENDPOINT = "/api/traffic/events";
  const VISITOR_KEY = "matchbuzz_visitor_id";
  const SESSION_KEY = "matchbuzz_session_id";
  const ATTRIBUTION_KEY = "matchbuzz_attribution";

  function safeStorage(method, key, value) {
    try {
      if (!window.localStorage) {
        return null;
      }
      if (method === "get") {
        return window.localStorage.getItem(key);
      }
      if (method === "set") {
        window.localStorage.setItem(key, value);
        return value;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function buildId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return `${prefix}-${window.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function getPersistentId(key, prefix) {
    const current = safeStorage("get", key);
    if (current) {
      return current;
    }
    const next = buildId(prefix);
    safeStorage("set", key, next);
    return next;
  }

  function trimValue(value, maxLength) {
    return String(value || "")
      .replace(/[<>{}]/g, "")
      .trim()
      .slice(0, maxLength);
  }

  function parseReferrerHost(value) {
    const raw = trimValue(value, 220);
    if (!raw) {
      return "";
    }

    try {
      return new URL(raw, window.location.origin).hostname.replace(/^www\./, "");
    } catch (error) {
      return raw.replace(/^https?:\/\//i, "").split("/")[0].replace(/^www\./, "");
    }
  }

  function inferLocale() {
    return window.location.pathname.startsWith("/zh/") ? "zh" : "en";
  }

  function inferPageKey(pathname) {
    if (pathname === "/" || pathname === "/index.html" || pathname === "/zh" || pathname === "/zh/" || pathname === "/zh/index.html") {
      return "home";
    }
    if (pathname.endsWith("/matches.html")) {
      return "matches";
    }
    if (pathname.endsWith("/match.html")) {
      return "match";
    }
    if (pathname.endsWith("/community-room.html")) {
      return "community_room";
    }
    if (pathname.endsWith("/community.html")) {
      return "community";
    }
    if (pathname.endsWith("/watch-parties.html")) {
      return "watch_parties";
    }
    if (pathname.endsWith("/partners.html")) {
      return "partners";
    }
    if (pathname.endsWith("/growth.html")) {
      return "growth";
    }
    if (pathname.endsWith("/pricing.html")) {
      return "pricing";
    }
    if (pathname.endsWith("/about.html")) {
      return "about";
    }
    if (pathname.endsWith("/campaign.html")) {
      return "campaign";
    }
    if (pathname.endsWith("/auth.html")) {
      return "auth";
    }
    return "other";
  }

  function readStoredAttribution() {
    try {
      const raw = safeStorage("get", ATTRIBUTION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStoredAttribution(value) {
    try {
      safeStorage("set", ATTRIBUTION_KEY, JSON.stringify(value));
    } catch (error) {
      return;
    }
  }

  function resolveAttribution(searchParams) {
    const referrerHost = parseReferrerHost(document.referrer);
    const hasExternalReferrer = referrerHost && referrerHost !== window.location.hostname.replace(/^www\./, "");
    const stored = readStoredAttribution() || {};
    const source = trimValue(searchParams.get("utm_source"), 80) || stored.source || (hasExternalReferrer ? referrerHost : "direct");
    const medium =
      trimValue(searchParams.get("utm_medium"), 80) || stored.medium || (hasExternalReferrer ? "referral" : "none");
    const campaign = trimValue(searchParams.get("utm_campaign"), 120) || stored.campaign || "";
    const content = trimValue(searchParams.get("utm_content"), 120) || stored.content || "";

    const nextValue = {
      source,
      medium,
      campaign,
      content
    };

    if (searchParams.get("utm_source") || searchParams.get("utm_medium") || searchParams.get("utm_campaign") || searchParams.get("utm_content")) {
      writeStoredAttribution(nextValue);
    }

    return {
      ...nextValue,
      referrerHost
    };
  }

  function getRouteGroup(rawHref) {
    if (!rawHref) {
      return "other";
    }

    if (rawHref.startsWith("#")) {
      if (rawHref === "#studio") {
        return "studio";
      }
      if (rawHref === "#share") {
        return "share";
      }
      return "other";
    }

    let targetUrl;
    try {
      targetUrl = new URL(rawHref, window.location.origin);
    } catch (error) {
      return "other";
    }

    if (targetUrl.origin !== window.location.origin) {
      return "external";
    }

    const pathname = targetUrl.pathname;
    if ((pathname === "/" || pathname.endsWith("/index.html")) && (targetUrl.hash === "#studio" || targetUrl.searchParams.get("fixtureId"))) {
      return "studio";
    }
    if ((pathname === "/" || pathname.endsWith("/index.html")) && targetUrl.hash === "#share") {
      return "share";
    }
    if (pathname.endsWith("/matches.html")) {
      return "matches";
    }
    if (pathname.endsWith("/match.html")) {
      return "match";
    }
    if (pathname.endsWith("/community-room.html")) {
      return "room";
    }
    if (pathname.endsWith("/community.html")) {
      return "community";
    }
    if (pathname.endsWith("/watch-parties.html")) {
      return "watch";
    }
    if (pathname.endsWith("/partners.html")) {
      return "partners";
    }
    if (pathname.endsWith("/growth.html")) {
      return "growth";
    }
    if (pathname.endsWith("/campaign.html")) {
      return "campaign";
    }
    if (pathname.endsWith("/auth.html")) {
      return "auth";
    }
    return "other";
  }

  function buildCurrentPath() {
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  }

  function normalizeMetadata(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    return Object.entries(value).reduce((result, [key, entry]) => {
      const cleanKey = trimValue(key, 32).replace(/\s+/g, "_").toLowerCase();
      const cleanValue = trimValue(entry, 180);
      if (cleanKey && cleanValue) {
        result[cleanKey] = cleanValue;
      }
      return result;
    }, {});
  }

  const searchParams = new URLSearchParams(window.location.search);
  const analyticsState = {
    visitorId: getPersistentId(VISITOR_KEY, "visitor"),
    sessionId: getPersistentId(SESSION_KEY, "session"),
    locale: inferLocale(),
    pageKey: inferPageKey(window.location.pathname),
    fixtureId:
      trimValue(searchParams.get("fixtureId"), 80) ||
      (window.location.pathname.endsWith("/match.html") ? trimValue(searchParams.get("id"), 80) : ""),
    roomId: window.location.pathname.endsWith("/community-room.html") ? trimValue(searchParams.get("id"), 80) : "",
    ...resolveAttribution(searchParams)
  };

  let hasTrackedPageView = false;

  function setContext(nextContext) {
    if (!nextContext || typeof nextContext !== "object") {
      return;
    }

    Object.entries(nextContext).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      if (typeof value === "string") {
        analyticsState[key] = trimValue(value, 180);
        return;
      }
      analyticsState[key] = value;
    });
  }

  function buildPayload(partialPayload) {
    const payload = {
      visitorId: analyticsState.visitorId,
      sessionId: analyticsState.sessionId,
      locale: analyticsState.locale,
      pageKey: analyticsState.pageKey,
      path: buildCurrentPath(),
      fixtureId: analyticsState.fixtureId,
      roomId: analyticsState.roomId,
      source: analyticsState.source,
      medium: analyticsState.medium,
      campaign: analyticsState.campaign,
      content: analyticsState.content,
      referrerHost: analyticsState.referrerHost,
      ...partialPayload
    };

    payload.metadata = normalizeMetadata(payload.metadata);
    payload.label = trimValue(payload.label, 160);
    payload.targetPath = trimValue(payload.targetPath, 240);
    payload.targetGroup = trimValue(payload.targetGroup, 48);
    payload.path = trimValue(payload.path, 240) || "/";
    payload.fixtureId = trimValue(payload.fixtureId, 80);
    payload.roomId = trimValue(payload.roomId, 80);
    payload.pageKey = trimValue(payload.pageKey, 48);
    payload.eventType = trimValue(payload.eventType, 32) || "page_view";
    return payload;
  }

  function sendPayload(payload) {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }

    fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body,
      keepalive: true
    }).catch(() => {});
  }

  function trackEvent(partialPayload) {
    sendPayload(buildPayload(partialPayload || {}));
  }

  function trackPageView(extraPayload) {
    if (hasTrackedPageView) {
      return;
    }
    hasTrackedPageView = true;
    trackEvent({
      eventType: "page_view",
      label: document.title,
      metadata: {
        title: document.title
      },
      ...(extraPayload || {})
    });
  }

  function extractTargetPath(rawHref) {
    if (!rawHref) {
      return "";
    }
    if (rawHref.startsWith("#")) {
      return `${window.location.pathname}${window.location.search}${rawHref}`;
    }

    try {
      const targetUrl = new URL(rawHref, window.location.origin);
      if (targetUrl.origin !== window.location.origin) {
        return targetUrl.href;
      }
      return `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    } catch (error) {
      return trimValue(rawHref, 240);
    }
  }

  function extractFixtureIdFromHref(rawHref) {
    try {
      const targetUrl = new URL(rawHref, window.location.origin);
      if (targetUrl.pathname.endsWith("/match.html")) {
        return trimValue(targetUrl.searchParams.get("id"), 80);
      }
      return trimValue(targetUrl.searchParams.get("fixtureId"), 80);
    } catch (error) {
      return "";
    }
  }

  function shouldTrackAnchor(anchor) {
    if (!anchor || anchor.dataset.noTrack === "true") {
      return false;
    }
    if (anchor.dataset.trackLabel) {
      return true;
    }
    return (
      anchor.classList.contains("button") ||
      anchor.classList.contains("module-link") ||
      anchor.classList.contains("storyline-item") ||
      anchor.classList.contains("mini-fixture-item") ||
      anchor.closest(".fixture-card-actions") ||
      anchor.closest(".ops-actions") ||
      anchor.closest(".campaign-link-row") ||
      anchor.closest(".campaign-link-grid") ||
      anchor.closest(".cta-actions")
    );
  }

  document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!shouldTrackAnchor(anchor)) {
      return;
    }

    const rawHref = anchor.getAttribute("href") || "";
    const targetPath = extractTargetPath(rawHref);
    trackEvent({
      eventType: "cta_click",
      label: anchor.dataset.trackLabel || trimValue(anchor.textContent, 160),
      targetPath,
      targetGroup: anchor.dataset.trackGroup || getRouteGroup(rawHref),
      fixtureId: extractFixtureIdFromHref(rawHref) || analyticsState.fixtureId,
      metadata: {
        source_page: analyticsState.pageKey,
        target_text: trimValue(anchor.textContent, 160)
      }
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      trackPageView();
    });
  } else {
    trackPageView();
  }

  window.MatchBuzzAnalytics = {
    getContext() {
      return { ...analyticsState };
    },
    setContext,
    trackEvent,
    trackPageView
  };
})();
