(function () {
  const TEAM_META = {
    Argentina: {
      emoji: "🇦🇷",
      flagUrl: "https://flagcdn.com/w40/ar.png"
    },
    Brazil: {
      emoji: "🇧🇷",
      flagUrl: "https://flagcdn.com/w40/br.png"
    },
    Spain: {
      emoji: "🇪🇸",
      flagUrl: "https://flagcdn.com/w40/es.png"
    },
    France: {
      emoji: "🇫🇷",
      flagUrl: "https://flagcdn.com/w40/fr.png"
    },
    Mexico: {
      emoji: "🇲🇽",
      flagUrl: "https://flagcdn.com/w40/mx.png"
    },
    USA: {
      emoji: "🇺🇸",
      flagUrl: "https://flagcdn.com/w40/us.png"
    },
    Indonesia: {
      emoji: "🇮🇩",
      flagUrl: "https://flagcdn.com/w40/id.png"
    },
    England: {
      emoji: "🏴",
      flagUrl: "https://upload.wikimedia.org/wikipedia/en/b/be/Flag_of_England.svg"
    },
    Portugal: {
      emoji: "🇵🇹",
      flagUrl: "https://flagcdn.com/w40/pt.png"
    },
    Germany: {
      emoji: "🇩🇪",
      flagUrl: "https://flagcdn.com/w40/de.png"
    },
    Netherlands: {
      emoji: "🇳🇱",
      flagUrl: "https://flagcdn.com/w40/nl.png"
    },
    Morocco: {
      emoji: "🇲🇦",
      flagUrl: "https://flagcdn.com/w40/ma.png"
    },
    Japan: {
      emoji: "🇯🇵",
      flagUrl: "https://flagcdn.com/w40/jp.png"
    },
    "South Korea": {
      emoji: "🇰🇷",
      flagUrl: "https://flagcdn.com/w40/kr.png"
    }
  };

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getTeamMeta(name) {
    return TEAM_META[String(name || "").trim()] || null;
  }

  function withEmojiLabel(name) {
    const teamName = String(name || "").trim();
    const meta = getTeamMeta(teamName);
    return meta && meta.emoji ? `${meta.emoji} ${teamName}` : teamName;
  }

  function renderFlagMarkup(name, options = {}) {
    const teamName = String(name || "").trim();
    const meta = getTeamMeta(teamName);
    const className = options.className ? ` ${options.className}` : "";
    const sizeClass = options.compact ? " flag-inline-compact" : "";
    const label = options.label === undefined ? teamName : String(options.label || "").trim();

    if (!meta || !meta.flagUrl) {
      return `<span class="flag-inline${sizeClass}${className}">${escapeHtml(label || teamName)}</span>`;
    }

    return `
      <span class="flag-inline${sizeClass}${className}">
        <span class="flag-mark" aria-hidden="true">
          <img class="flag-icon" src="${meta.flagUrl}" alt="" loading="lazy" />
        </span>
        ${label ? `<span class="flag-label">${escapeHtml(label)}</span>` : ""}
      </span>
    `.trim();
  }

  function decorateFlagNodes(root = document) {
    root.querySelectorAll("[data-flag-team]").forEach((node) => {
      const team = node.getAttribute("data-flag-team");
      const labelAttr = node.getAttribute("data-flag-label");
      const compact = node.getAttribute("data-flag-compact") === "true";
      node.innerHTML = renderFlagMarkup(team, {
        label: labelAttr === null ? undefined : labelAttr,
        compact
      });
    });
  }

  window.MatchBuzzTeams = {
    TEAM_META,
    escapeHtml,
    getTeamMeta,
    withEmojiLabel,
    renderFlagMarkup,
    decorateFlagNodes
  };
})();
