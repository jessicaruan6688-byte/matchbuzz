const localeSwitcher = document.querySelector("#locale-switcher");

if (localeSwitcher) {
  const page = localeSwitcher.dataset.page || "index";
  const routeMap = {
    index: {
      en: "/",
      zh: "/zh/index.html"
    },
    about: {
      en: "/about.html",
      zh: "/zh/about.html"
    },
    pricing: {
      en: "/pricing.html",
      zh: "/zh/pricing.html"
    },
    admin: {
      en: "/admin.html",
      zh: "/zh/admin.html"
    },
    matches: {
      en: "/matches.html",
      zh: "/zh/matches.html"
    },
    match: {
      en: "/match.html",
      zh: "/zh/match.html"
    },
    campaign: {
      en: "/campaign.html",
      zh: "/zh/campaign.html"
    },
    community: {
      en: "/community.html",
      zh: "/zh/community.html"
    },
    auth: {
      en: "/auth.html",
      zh: "/zh/auth.html"
    },
    "community-room": {
      en: "/community-room.html",
      zh: "/zh/community-room.html"
    },
    "watch-parties": {
      en: "/watch-parties.html",
      zh: "/zh/watch-parties.html"
    },
    partners: {
      en: "/partners.html",
      zh: "/zh/partners.html"
    },
    growth: {
      en: "/growth.html",
      zh: "/zh/growth.html"
    }
  };

  localeSwitcher.addEventListener("change", () => {
    const target = routeMap[page]?.[localeSwitcher.value];
    if (target) {
      const suffix = `${window.location.search}${window.location.hash}`;
      window.location.href = `${target}${suffix}`;
    }
  });
}
