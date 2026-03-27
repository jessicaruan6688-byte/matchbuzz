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
    }
  };

  localeSwitcher.addEventListener("change", () => {
    const target = routeMap[page]?.[localeSwitcher.value];
    if (target) {
      const suffix = page === "match" || page === "campaign" ? window.location.search : "";
      window.location.href = `${target}${suffix}`;
    }
  });
}
