const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

loadLocalEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const APP_HOST = process.env.APP_HOST || "127.0.0.1";
const DEFAULT_GMI_API_URL = "https://api.gmi-serving.com/v1/chat/completions";
const DEFAULT_GMI_MODEL = "MiniMaxAI/MiniMax-M2.7";
const GMI_MODEL_ALIASES = {
  "b55d47ed-0d1e-467e-ae93-f1500402d184": "MiniMaxAI/MiniMax-M2.7",
  "minimax-m2-7": "MiniMaxAI/MiniMax-M2.7",
  "minimaxai/minimax-m2.7": "MiniMaxAI/MiniMax-M2.7"
};

const CONFIG = {
  llm: {
    apiUrl: process.env.GMI_API_URL || process.env.LLM_API_URL || DEFAULT_GMI_API_URL,
    apiKey: process.env.GMI_API_KEY || process.env.LLM_API_KEY || "",
    model: resolveConfiguredModel(process.env.GMI_MODEL || process.env.LLM_MODEL || DEFAULT_GMI_MODEL),
    apiStyle: process.env.LLM_API_STYLE || "openai-chat",
    authHeader: process.env.LLM_API_AUTH_HEADER || "Authorization",
    authPrefix: process.env.LLM_API_AUTH_PREFIX || "Bearer"
  },
  matchData: {
    apiUrl: process.env.MATCH_DATA_API_URL || "",
    apiKey: process.env.MATCH_DATA_API_KEY || "",
    apiStyle: process.env.MATCH_DATA_API_STYLE || "matchbuzz-json",
    authHeader: process.env.MATCH_DATA_API_AUTH_HEADER || "Authorization",
    authPrefix: process.env.MATCH_DATA_API_AUTH_PREFIX || "Bearer",
    cacheMs: Number(process.env.MATCH_DATA_CACHE_MS || 300000)
  },
  realFixtures: {
    baseUrl: process.env.REAL_FIXTURE_API_URL || "https://www.thesportsdb.com/api/v1/json/123",
    leagueId: process.env.REAL_FIXTURE_LEAGUE_ID || "4328",
    season: process.env.REAL_FIXTURE_SEASON || "2025-2026",
    cacheMs: Number(process.env.REAL_FIXTURE_CACHE_MS || 300000)
  }
};

function loadLocalEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return;
    }

    const key = trimmed.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) {
      return;
    }

    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  });
}

function resolveConfiguredModel(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const alias = GMI_MODEL_ALIASES[raw] || GMI_MODEL_ALIASES[raw.toLowerCase()];
  return alias || raw;
}

const remoteMatchesCache = {
  expiresAt: 0,
  items: null
};

const realFixturesCache = {
  upcoming: {
    expiresAt: 0,
    items: null
  },
  recent: {
    expiresAt: 0,
    items: null
  },
  table: {
    expiresAt: 0,
    items: null
  }
};

const matches = [
  {
    id: "arg-bra",
    homeTeam: "Argentina",
    awayTeam: "Brazil",
    kickOff: "2026-06-19T20:00:00Z",
    city: "New York / New Jersey",
    stage: "Featured Rivalry",
    storyline: "A heavyweight South American rivalry built on control, creativity, and late-match drama.",
    facts: [
      "Both fanbases turn any neutral venue into a home crowd within minutes.",
      "This rivalry is usually framed as structure versus improvisation.",
      "Public football culture around this fixture travels especially well in Spanish and Portuguese-speaking markets."
    ],
    tags: ["#WorldCupBuzz", "#Argentina", "#Brazil", "#RivalryNight"],
    hotTakes: [
      "The midfield duel will shape the entire tempo.",
      "One transition moment could decide everything.",
      "The crowd energy will matter as much as the tactics."
    ]
  },
  {
    id: "esp-fra",
    homeTeam: "Spain",
    awayTeam: "France",
    kickOff: "2026-06-23T18:30:00Z",
    city: "Dallas",
    stage: "Featured Knockout Theme",
    storyline: "Possession, press resistance, and elite finishing turn this into a high-IQ contest.",
    facts: [
      "This fixture is perfect for tactical storytelling and creator explainers.",
      "It performs well with audiences that prefer analysis over pure fandom.",
      "Brand accounts can position this match as elegance versus efficiency."
    ],
    tags: ["#WorldCupBuzz", "#Spain", "#France", "#TacticalBattle"],
    hotTakes: [
      "Who controls central spaces will own the narrative.",
      "A single set piece may break the balance.",
      "The first 15 minutes will reveal the true momentum."
    ]
  },
  {
    id: "mex-usa",
    homeTeam: "Mexico",
    awayTeam: "USA",
    kickOff: "2026-06-27T01:00:00Z",
    city: "Mexico City",
    stage: "Host Region Spotlight",
    storyline: "Emotion, tempo, and regional pride make this one of the loudest matchups in the tournament conversation.",
    facts: [
      "The atmosphere around this matchup is a product in itself for fan communities.",
      "It is ideal for bilingual English-Spanish campaigns.",
      "Supporter identity is usually the strongest conversion trigger for this fixture."
    ],
    tags: ["#WorldCupBuzz", "#Mexico", "#USMNT", "#HostEnergy"],
    hotTakes: [
      "This game will be driven by nerve before tactics.",
      "The louder team mentality wins the marginal moments.",
      "Second-half substitutions could swing the entire story."
    ]
  }
];

const polls = new Map();
const campaigns = new Map();
let campaignSequence = 1;
let activitySequence = 1;

const factTranslations = {
  zh: {
    "arg-bra": [
      "两边球迷都能在几分钟内把中立场地变成主场氛围。",
      "这组对决常被解读为结构对即兴、控制对灵感。",
      "这场比赛的公共足球文化话题，天然适合在西语和葡语市场传播。"
    ],
    "esp-fra": [
      "这组对决非常适合做战术型内容和高质量复盘。",
      "它在偏分析向、偏内容深度的观众里通常更容易引发讨论。",
      "对品牌方来说，这场比赛很适合包装成优雅与效率的对抗。"
    ],
    "mex-usa": [
      "这组比赛的主场氛围本身就足以成为传播内容。",
      "它非常适合英语和西语双语运营。",
      "在这场比赛里，球迷身份认同往往比单纯比分更能带动传播。"
    ]
  },
  es: {
    "arg-bra": [
      "Ambas hinchadas convierten cualquier sede neutral en una localía en cuestión de minutos.",
      "Esta rivalidad suele explicarse como estructura contra improvisación.",
      "La cultura pública alrededor de este duelo viaja especialmente bien en mercados hispanohablantes y lusófonos."
    ],
    "esp-fra": [
      "Este cruce es ideal para contar fútbol desde la táctica y los detalles.",
      "Rinde muy bien con audiencias que prefieren análisis por encima de la reacción inmediata.",
      "Las marcas pueden posicionarlo como elegancia contra eficiencia."
    ],
    "mex-usa": [
      "La atmósfera alrededor de este duelo ya funciona como producto para comunidades de fans.",
      "Es una oportunidad muy fuerte para campañas bilingües en inglés y español.",
      "La identidad del aficionado suele ser el mejor disparador de conversión en este partido."
    ]
  },
  id: {
    "arg-bra": [
      "Kedua basis suporter bisa mengubah venue netral menjadi terasa seperti kandang dalam hitungan menit.",
      "Rivalitas ini sering dibaca sebagai struktur melawan improvisasi.",
      "Budaya publik di sekitar laga ini sangat kuat untuk pasar berbahasa Spanyol dan Portugis."
    ],
    "esp-fra": [
      "Laga ini sangat cocok untuk storytelling taktik dan konten analisis.",
      "Performanya kuat di audiens yang suka pembahasan cerdas, bukan sekadar reaksi.",
      "Brand bisa membingkainya sebagai elegansi melawan efisiensi."
    ],
    "mex-usa": [
      "Atmosfer di sekitar duel ini sendiri sudah menjadi produk bagi komunitas fans.",
      "Ini sangat ideal untuk kampanye bilingual Inggris-Spanyol.",
      "Identitas suporter biasanya menjadi pemicu konversi terkuat dalam laga ini."
    ]
  }
};

const languageBundles = {
  zh: {
    label: "中文",
    sceneNames: {
      pre_match: "赛前预热",
      live: "赛中互动",
      post_match: "赛后复盘"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` 趣味点：${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `${supportTeam} 球迷，现在就是情绪最高点`,
          socialPost: `${supportTeam} 正在和 ${opposition} 进入最关键的拉扯阶段。现在最适合发起投票、带动评论区和球迷站队讨论。${funLine}`,
          videoScript: `${supportTeam} 在提速，${opposition} 在试图稳住节奏，接下来的几分钟很可能直接改写整场比赛的气氛。`,
          recap: `${supportTeam} 在关键阶段把情绪和讨论度都拉了起来，适合继续做实时互动内容。`,
          chant: `${supportTeam} 顶住现在，把声音拉满。`,
          pollQuestion: `${supportTeam} 对阵 ${opposition}，现在最能代表比赛气氛的是什么？`,
          pollOptions: ["进攻压迫", "中场博弈", "防守韧性", "最后时刻剧情"],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#世界杯互动", "#实时讨论"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} 用比赛内容留下了明确态度`,
          socialPost: `${supportTeam} 用比赛气质、执行力和关键瞬间，把这场对决的赛后讨论牢牢抓在自己手里。${opposition} 也制造了压力，但叙事重心仍然偏向 ${supportTeam}。${funLine}`,
          videoScript: `终场哨响之后，一个判断已经很清楚：${supportTeam} 不只是踢完了一场比赛，而是交出了一次有辨识度的世界杯表达。`,
          recap: `${supportTeam} 给这场比赛留下了清晰的复盘角度，适合做战术、情绪和社区三条内容线。`,
          chant: `${supportTeam} 带着气势上场，也带着记忆点离场。`,
          pollQuestion: `${supportTeam} 对阵 ${opposition}，赛后最值得记住的是什么？`,
          pollOptions: ["情绪张力", "战术调整", "关键个人瞬间", "球迷氛围"],
          hashtags: [match.tags[0], "#赛后复盘", "#足球内容", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} 已经把赛前氛围拉起来了`,
        socialPost: `今晚的关键词是自豪感、节奏和世界杯情绪。${supportTeam} 对阵 ${opposition} 的这场比赛，在开球前就已经具备全球传播话题。${funLine}`,
        videoScript: `强强对话、全球关注、球迷情绪到位。${supportTeam} 带着信念登场，${opposition} 带着传统回应，这是一场非常适合做传播和互动的比赛。`,
        recap: `${supportTeam} 在赛前阶段已经具备了很强的内容叙事，适合创作者、球迷社区和品牌账号快速切入。`,
        chant: `${supportTeam} 今晚一起，把气氛拉满。`,
        pollQuestion: `${supportTeam} 对阵 ${opposition}，赛前最强的话题线是什么？`,
        pollOptions: ["进攻对控制", "战术纪律", "球星聚焦", "球场氛围"],
        hashtags: [match.tags[0], "#赛前预热", "#通往决赛", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  },
  en: {
    label: "English",
    sceneNames: {
      pre_match: "pre-match hype",
      live: "live interaction",
      post_match: "post-match recap"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` Fun angle: ${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `${supportTeam} fans, every touch matters now`,
          socialPost: `${supportTeam} are in the pressure zone against ${opposition}. This is the moment to flood the timeline with belief, noise, and bold predictions.${funLine}`,
          videoScript: `${supportTeam} are pushing the tempo, ${opposition} are trying to reset the rhythm, and the next five minutes could change the whole mood of this match.`,
          recap: `${supportTeam} stayed emotionally present and kept the conversation alive every time the game tilted.`,
          chant: `${supportTeam} on the rise, hold the line tonight.`,
          pollQuestion: `What defines the live mood of ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Fast attacking momentum",
            "Midfield chess match",
            "Defensive resilience",
            "Late drama loading"
          ],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#LiveFootball", "#FanReaction"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} leave a statement after the whistle`,
          socialPost: `${supportTeam} turned this matchup with personality, discipline, and moments that fans will replay for days. ${opposition} forced big questions, but the emotional edge stayed with ${supportTeam}.${funLine}`,
          videoScript: `Final whistle, big noise, and one clear takeaway: ${supportTeam} gave their supporters a performance with identity. This was more than a result, it was a message.`,
          recap: `${supportTeam} gave the game a clear shape, matched the pressure, and made the post-match conversation about intent instead of luck.`,
          chant: `${supportTeam} walked in ready and walked out remembered.`,
          pollQuestion: `What will fans remember most from ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "The emotional momentum",
            "A tactical adjustment",
            "One iconic individual moment",
            "The crowd connection"
          ],
          hashtags: [match.tags[0], "#PostMatch", "#FootballCulture", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} are ready to own the buildup`,
        socialPost: `Tonight is about pride, tempo, and tournament energy. ${supportTeam} meet ${opposition} with a story that already feels global, and the fan conversation starts before kickoff.${funLine}`,
        videoScript: `Big rivalry, global audience, and a fanbase ready to travel through every moment. ${supportTeam} step in with belief, ${opposition} answer with legacy, and this is built for noise.`,
        recap: `${supportTeam} enter with a strong emotional angle and a clean storyline for creators, fan pages, and brand activations.`,
        chant: `${supportTeam} all in, all night, all noise.`,
        pollQuestion: `Which storyline is strongest before ${supportTeam} vs ${opposition}?`,
        pollOptions: [
          "Attack versus control",
          "Tactical discipline",
          "Star player spotlight",
          "Hostile atmosphere factor"
        ],
        hashtags: [match.tags[0], "#PreMatch", "#RoadToTheFinal", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  },
  es: {
    label: "Español",
    sceneNames: {
      pre_match: "previa del partido",
      live: "interacción en vivo",
      post_match: "resumen postpartido"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` Dato para compartir: ${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `${supportTeam} vive su momento más intenso`,
          socialPost: `${supportTeam} entra en la zona de máxima presión contra ${opposition}. Es el momento ideal para activar a la afición y llenar la conversación de energía.${funLine}`,
          videoScript: `${supportTeam} acelera, ${opposition} intenta ordenar el partido, y los próximos minutos pueden cambiar por completo el tono del encuentro.`,
          recap: `${supportTeam} sostuvo la emoción y mantuvo viva la conversación cada vez que el partido cambió de ritmo.`,
          chant: `${supportTeam}, arriba ahora, no sueltes la noche.`,
          pollQuestion: `¿Qué define el ambiente en vivo de ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Ataque con impulso",
            "Batalla en el medio",
            "Resistencia defensiva",
            "Drama final"
          ],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#EnVivo", "#ReaccionDeLaAficion"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} deja huella tras el silbatazo final`,
          socialPost: `${supportTeam} resolvió este partido con personalidad, orden y momentos que la afición va a repetir durante días. ${opposition} exigió muchísimo, pero el pulso emocional quedó del lado de ${supportTeam}.${funLine}`,
          videoScript: `Se terminó el partido y queda una idea clara: ${supportTeam} jugó con identidad. Más que un resultado, fue una declaración competitiva.`,
          recap: `${supportTeam} dio forma al partido, respondió a la presión y dejó una narrativa postpartido mucho más fuerte que cualquier lectura superficial.`,
          chant: `${supportTeam} salió a competir y salió para quedarse en la memoria.`,
          pollQuestion: `¿Qué recordará más la afición de ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "La emoción del partido",
            "El ajuste táctico",
            "Un momento individual icónico",
            "La conexión con la grada"
          ],
          hashtags: [match.tags[0], "#PostPartido", "#CulturaFutbolera", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} ya domina la previa`,
        socialPost: `Esta noche se juega con orgullo, ritmo y energía mundialista. ${supportTeam} enfrenta a ${opposition} con una historia lista para explotar en redes incluso antes del inicio.${funLine}`,
        videoScript: `Gran rivalidad, audiencia global y una afición lista para vivir cada segundo. ${supportTeam} llega con convicción, ${opposition} con historia, y el contexto es perfecto para generar conversación.`,
        recap: `${supportTeam} llega con una narrativa clara y muy útil para creadores, comunidades y marcas.`,
        chant: `${supportTeam}, con todo, toda la noche.`,
        pollQuestion: `¿Qué narrativa pesa más antes de ${supportTeam} vs ${opposition}?`,
        pollOptions: [
          "Ataque contra control",
          "Disciplina táctica",
          "Figura estelar",
          "Factor ambiente"
        ],
        hashtags: [match.tags[0], "#Previa", "#CaminoALaFinal", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  },
  id: {
    label: "Bahasa Indonesia",
    sceneNames: {
      pre_match: "pemanasan sebelum laga",
      live: "interaksi langsung",
      post_match: "ringkasan setelah laga"
    },
    build(match, supportTeam, scene, includeFun) {
      const opposition = supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam;
      const funLine = includeFun ? ` Fakta seru: ${match.facts[0]}` : "";

      if (scene === "live") {
        return {
          headline: `Suporter ${supportTeam}, sekarang momen penentunya`,
          socialPost: `${supportTeam} sedang masuk fase paling menegangkan melawan ${opposition}. Saatnya dorong percakapan, voting, dan dukungan real-time.${funLine}`,
          videoScript: `${supportTeam} menaikkan tempo, ${opposition} mencoba menenangkan ritme, dan lima menit berikutnya bisa mengubah seluruh suasana pertandingan.`,
          recap: `${supportTeam} tetap menjaga emosi pertandingan dan membuat percakapan fans terus hidup di setiap momentum.`,
          chant: `${supportTeam} naik terus, tahan malam ini.`,
          pollQuestion: `Apa yang paling menentukan mood laga ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Serangan cepat",
            "Duel lini tengah",
            "Pertahanan disiplin",
            "Drama akhir laga"
          ],
          hashtags: [match.tags[0], `#${supportTeam.replace(/\s+/g, "")}`, "#LiveMatch", "#SuaraFans"]
        };
      }

      if (scene === "post_match") {
        return {
          headline: `${supportTeam} meninggalkan kesan kuat setelah laga`,
          socialPost: `${supportTeam} membawa pertandingan ini dengan karakter, disiplin, dan momen yang akan terus diputar ulang oleh fans. ${opposition} memberi tekanan besar, tapi narasi emosional tetap milik ${supportTeam}.${funLine}`,
          videoScript: `Peluit akhir berbunyi dan satu hal terlihat jelas: ${supportTeam} tampil dengan identitas. Ini bukan sekadar hasil, ini adalah pernyataan.`,
          recap: `${supportTeam} membentuk arah pertandingan, menjawab tekanan, dan membuat pembahasan setelah laga terasa lebih besar dari sekadar angka.`,
          chant: `${supportTeam} datang siap, pulang dikenang.`,
          pollQuestion: `Apa yang paling diingat fans dari ${supportTeam} vs ${opposition}?`,
          pollOptions: [
            "Momentum emosional",
            "Perubahan taktik",
            "Momen individu ikonik",
            "Koneksi dengan penonton"
          ],
          hashtags: [match.tags[0], "#AfterMatch", "#BudayaBola", `#${supportTeam.replace(/\s+/g, "")}`]
        };
      }

      return {
        headline: `${supportTeam} siap menguasai suasana sebelum kickoff`,
        socialPost: `Malam ini adalah soal harga diri, tempo, dan energi turnamen. ${supportTeam} menghadapi ${opposition} dalam laga yang sudah terasa global bahkan sebelum mulai.${funLine}`,
        videoScript: `Rivalitas besar, penonton global, dan basis fans yang siap hidup di setiap momen. ${supportTeam} datang dengan keyakinan, ${opposition} menjawab dengan warisan, dan semuanya siap ramai.`,
        recap: `${supportTeam} masuk dengan cerita yang kuat dan cocok untuk kreator, komunitas fans, dan aktivasi brand.`,
        chant: `${supportTeam} penuh suara, penuh tenaga, sepanjang malam.`,
        pollQuestion: `Narasi apa yang paling kuat sebelum ${supportTeam} vs ${opposition}?`,
        pollOptions: [
          "Serangan lawan kontrol",
          "Disiplin taktik",
          "Sorotan pemain bintang",
          "Faktor atmosfer"
        ],
        hashtags: [match.tags[0], "#PreMatch", "#RoadToFinal", `#${supportTeam.replace(/\s+/g, "")}`]
      };
    }
  }
};

seedSupportPolls();

function hasRemoteLlm() {
  return Boolean(CONFIG.llm.apiUrl && CONFIG.llm.model && CONFIG.llm.apiKey);
}

function hasRemoteMatchData() {
  return Boolean(CONFIG.matchData.apiUrl);
}

function buildAuthHeaders(config) {
  const headers = {
    Accept: "application/json"
  };

  if (!config.apiKey) {
    return headers;
  }

  const headerName = config.authHeader || "Authorization";
  const prefix = config.authPrefix ? `${config.authPrefix} ` : "";
  headers[headerName] = `${prefix}${config.apiKey}`.trim();
  return headers;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sanitizeEnum(value, allowed, fallback) {
  const clean = sanitizeText(value);
  return allowed.includes(clean) ? clean : fallback;
}

function sanitizeHashtags(value, fallback = []) {
  const tags = Array.isArray(value)
    ? value
        .map((entry) => sanitizeText(entry))
        .filter(Boolean)
        .map((entry) => (entry.startsWith("#") ? entry : `#${entry.replace(/\s+/g, "")}`))
        .slice(0, 6)
    : [];
  return tags.length ? tags : fallback;
}

function normalizeCampaignContent(raw, fallback = {}) {
  return {
    headline: sanitizeText(raw.headline).slice(0, 180) || fallback.headline || "",
    socialPost: sanitizeText(raw.socialPost).slice(0, 900) || fallback.socialPost || "",
    videoScript: sanitizeText(raw.videoScript).slice(0, 700) || fallback.videoScript || "",
    recap: sanitizeText(raw.recap).slice(0, 700) || fallback.recap || "",
    chant: sanitizeText(raw.chant).slice(0, 220) || fallback.chant || "",
    hashtags: sanitizeHashtags(raw.hashtags, fallback.hashtags || [])
  };
}

function nextCampaignId() {
  const id = `cmp-${String(campaignSequence).padStart(4, "0")}`;
  campaignSequence += 1;
  return id;
}

function nextActivityId() {
  const id = `act-${String(activitySequence).padStart(5, "0")}`;
  activitySequence += 1;
  return id;
}

function toStringList(value) {
  return Array.isArray(value)
    ? value
        .map((entry) => sanitizeText(entry))
        .filter(Boolean)
    : [];
}

function buildDefaultStoryline(homeTeam, awayTeam, stage) {
  return `${homeTeam} vs ${awayTeam} is positioned as a ${stage.toLowerCase()} story built for global football audiences.`;
}

function compactHashtag(value) {
  return `#${String(value || "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .slice(0, 24)}`;
}

function normalizeKickoff(value, fallback = new Date().toISOString()) {
  const raw = sanitizeText(value);
  if (!raw) {
    return fallback;
  }

  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
    return raw;
  }

  return `${raw}Z`;
}

function buildGenericFacts(match, leagueLabel) {
  return [
    `${leagueLabel} · ${match.stage}.`,
    `${match.city} is the current host context for ${match.homeTeam} vs ${match.awayTeam}.`,
    `${match.homeTeam} and ${match.awayTeam} are useful for cross-market football storytelling and engagement.`
  ];
}

function buildGenericHotTakes(match) {
  return [
    `${match.homeTeam} vs ${match.awayTeam} should be framed around momentum, emotion, and matchday participation.`,
    `This fixture can support creator clips, fan polls, and sponsor storytelling in one workflow.`,
    `The strongest operator angle is to connect pre-match buildup with a live interaction layer.`
  ];
}

function normalizeMatchInput(raw) {
  const homeTeam = sanitizeText(raw.homeTeam || raw.strHomeTeam);
  const awayTeam = sanitizeText(raw.awayTeam || raw.strAwayTeam);

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const stage = sanitizeText(raw.stage || raw.strLeague || raw.competition || "Featured Match");
  const city =
    sanitizeText(raw.city || raw.strVenue || raw.venue || raw.strCountry || "TBD");
  const id =
    sanitizeText(raw.id || raw.idEvent || raw.matchId) ||
    `custom-${slugify(`${homeTeam}-${awayTeam}-${raw.dateEvent || raw.kickOff || stage}`)}`;

  const match = {
    id,
    homeTeam,
    awayTeam,
    kickOff: normalizeKickoff(raw.kickOff || raw.strTimestamp || `${raw.dateEvent || ""}T${raw.strTime || "00:00:00"}`),
    city,
    stage,
    storyline:
      sanitizeText(raw.storyline || raw.strStoryline) || buildDefaultStoryline(homeTeam, awayTeam, stage),
    facts: toStringList(raw.facts).length > 0 ? toStringList(raw.facts) : buildGenericFacts({ homeTeam, awayTeam, city, stage }, stage),
    tags:
      toStringList(raw.tags).length > 0
        ? toStringList(raw.tags)
        : ["#MatchBuzz", compactHashtag(homeTeam), compactHashtag(awayTeam), compactHashtag(stage)],
    hotTakes: toStringList(raw.hotTakes).length > 0 ? toStringList(raw.hotTakes) : buildGenericHotTakes({ homeTeam, awayTeam })
  };

  if (raw.leagueId || raw.idLeague) {
    match.leagueId = sanitizeText(raw.leagueId || raw.idLeague);
  }
  if (raw.league || raw.strLeague) {
    match.league = sanitizeText(raw.league || raw.strLeague);
  }
  if (raw.season || raw.strSeason) {
    match.season = sanitizeText(raw.season || raw.strSeason);
  }
  if (raw.round || raw.intRound) {
    match.round = sanitizeText(raw.round || raw.intRound);
  }
  if (raw.homeBadge || raw.strHomeTeamBadge) {
    match.homeBadge = sanitizeText(raw.homeBadge || raw.strHomeTeamBadge);
  }
  if (raw.awayBadge || raw.strAwayTeamBadge) {
    match.awayBadge = sanitizeText(raw.awayBadge || raw.strAwayTeamBadge);
  }
  if (raw.leagueBadge || raw.strLeagueBadge) {
    match.leagueBadge = sanitizeText(raw.leagueBadge || raw.strLeagueBadge);
  }
  if (raw.poster || raw.strPoster) {
    match.poster = sanitizeText(raw.poster || raw.strPoster);
  }
  if (raw.banner || raw.strBanner) {
    match.banner = sanitizeText(raw.banner || raw.strBanner);
  }
  if (raw.thumb || raw.strThumb) {
    match.thumb = sanitizeText(raw.thumb || raw.strThumb);
  }
  if (raw.status || raw.strStatus) {
    match.status = sanitizeText(raw.status || raw.strStatus);
  }
  if (raw.homeScore !== undefined || raw.intHomeScore !== undefined) {
    match.homeScore = raw.homeScore ?? raw.intHomeScore ?? null;
  }
  if (raw.awayScore !== undefined || raw.intAwayScore !== undefined) {
    match.awayScore = raw.awayScore ?? raw.intAwayScore ?? null;
  }
  if (raw.venueId || raw.idVenue) {
    match.venueId = sanitizeText(raw.venueId || raw.idVenue);
  }
  if (raw.homeTeamId || raw.idHomeTeam) {
    match.homeTeamId = sanitizeText(raw.homeTeamId || raw.idHomeTeam);
  }
  if (raw.awayTeamId || raw.idAwayTeam) {
    match.awayTeamId = sanitizeText(raw.awayTeamId || raw.idAwayTeam);
  }
  if (raw.country || raw.strCountry) {
    match.country = sanitizeText(raw.country || raw.strCountry);
  }

  return ensureSupportPoll(match);
}

function buildRealFixtureStoryline(event) {
  const stage = `${event.strLeague || "League football"} round ${event.intRound || "TBD"}`;
  return `${event.strHomeTeam} vs ${event.strAwayTeam} arrives as a ${stage} story built for live football audiences and creator distribution.`;
}

function normalizeRealFixture(raw) {
  const match = normalizeMatchInput({
    id: `real-${sanitizeText(raw.idEvent)}`,
    homeTeam: raw.strHomeTeam,
    awayTeam: raw.strAwayTeam,
    kickOff: raw.strTimestamp || `${raw.dateEvent || ""}T${raw.strTime || "00:00:00"}`,
    city: raw.strVenue || raw.strCountry || "TBD",
    stage: `${raw.strLeague || "League"} · Round ${sanitizeText(raw.intRound || "TBD")}`,
    storyline: buildRealFixtureStoryline(raw),
    facts: [
      `${raw.strLeague || "League football"} in season ${raw.strSeason || CONFIG.realFixtures.season}.`,
      `${raw.strVenue || "Venue TBD"} hosts this fixture${raw.strCountry ? ` in ${raw.strCountry}` : ""}.`,
      raw.strStatus === "Match Finished"
        ? `The latest recorded score is ${raw.strHomeTeam} ${raw.intHomeScore ?? 0} - ${raw.intAwayScore ?? 0} ${raw.strAwayTeam}.`
        : `${raw.strHomeTeam} and ${raw.strAwayTeam} are scheduled for an upcoming kickoff.`
    ],
    tags: [
      "#RealFootballFeed",
      compactHashtag(raw.strHomeTeam),
      compactHashtag(raw.strAwayTeam),
      compactHashtag(raw.strLeague || "Football")
    ],
    hotTakes: [
      `${raw.strHomeTeam} vs ${raw.strAwayTeam} is a useful live test case for multi-market football content ops.`,
      `This fixture can support pre-match, live, and post-match publishing in one workflow.`,
      `The operator opportunity is to turn the match page into a localized distribution engine.`
    ],
    leagueId: raw.idLeague,
    league: raw.strLeague,
    season: raw.strSeason,
    round: raw.intRound,
    homeBadge: raw.strHomeTeamBadge,
    awayBadge: raw.strAwayTeamBadge,
    leagueBadge: raw.strLeagueBadge,
    poster: raw.strPoster,
    banner: raw.strBanner,
    thumb: raw.strThumb,
    status: raw.strStatus,
    homeScore: raw.intHomeScore,
    awayScore: raw.intAwayScore,
    venueId: raw.idVenue,
    homeTeamId: raw.idHomeTeam,
    awayTeamId: raw.idAwayTeam,
    country: raw.strCountry
  });

  return match;
}

function getRealFixtureId(value) {
  return sanitizeText(value).replace(/^real-/, "");
}

async function fetchRealFixturesFeed(scope) {
  const cacheKey = scope === "recent" ? "recent" : "upcoming";
  const endpoint =
    cacheKey === "recent"
      ? `eventspastleague.php?id=${CONFIG.realFixtures.leagueId}`
      : `eventsnextleague.php?id=${CONFIG.realFixtures.leagueId}`;

  const cache = realFixturesCache[cacheKey];
  if (cache.items && cache.expiresAt > Date.now()) {
    return cache.items;
  }

  const response = await fetch(`${CONFIG.realFixtures.baseUrl}/${endpoint}`);
  if (!response.ok) {
    throw new Error(`Real fixtures provider returned ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.events) ? payload.events.map(normalizeRealFixture).filter(Boolean) : [];
  cache.items = items;
  cache.expiresAt = Date.now() + CONFIG.realFixtures.cacheMs;
  return items;
}

async function fetchRealFixturesTable() {
  if (realFixturesCache.table.items && realFixturesCache.table.expiresAt > Date.now()) {
    return realFixturesCache.table.items;
  }

  const response = await fetch(
    `${CONFIG.realFixtures.baseUrl}/lookuptable.php?l=${CONFIG.realFixtures.leagueId}&s=${CONFIG.realFixtures.season}`
  );
  if (!response.ok) {
    throw new Error(`Real table provider returned ${response.status}`);
  }

  const payload = await response.json();
  const items = Array.isArray(payload.table)
    ? payload.table.map((entry) => ({
        rank: Number(entry.intRank || 0),
        teamId: sanitizeText(entry.idTeam),
        team: sanitizeText(entry.strTeam),
        badge: sanitizeText(entry.strBadge),
        played: Number(entry.intPlayed || 0),
        win: Number(entry.intWin || 0),
        draw: Number(entry.intDraw || 0),
        loss: Number(entry.intLoss || 0),
        goalsFor: Number(entry.intGoalsFor || 0),
        goalsAgainst: Number(entry.intGoalsAgainst || 0),
        goalDifference: Number(entry.intGoalDifference || 0),
        points: Number(entry.intPoints || 0),
        form: sanitizeText(entry.strForm),
        description: sanitizeText(entry.strDescription)
      }))
    : [];

  realFixturesCache.table.items = items;
  realFixturesCache.table.expiresAt = Date.now() + CONFIG.realFixtures.cacheMs;
  return items;
}

async function getRealFixtureDetail(matchId) {
  const rawId = getRealFixtureId(matchId);
  const [upcoming, recent] = await Promise.all([fetchRealFixturesFeed("upcoming"), fetchRealFixturesFeed("recent")]);
  const cached = upcoming.concat(recent).find((item) => getRealFixtureId(item.id) === rawId);
  let table = [];

  try {
    table = await fetchRealFixturesTable();
  } catch (error) {
    table = [];
  }

  if (cached) {
    return {
      fixture: cached,
      table: table.slice(0, 6),
      upcoming: upcoming.filter((item) => item.id !== cached.id).slice(0, 4),
      recent: recent.filter((item) => item.id !== cached.id).slice(0, 4)
    };
  }

  const response = await fetch(`${CONFIG.realFixtures.baseUrl}/lookupevent.php?id=${rawId}`);
  if (!response.ok) {
    throw new Error(`Real event provider returned ${response.status}`);
  }

  const payload = await response.json();
  const item = Array.isArray(payload.events) && payload.events[0] ? normalizeRealFixture(payload.events[0]) : null;
  if (!item) {
    throw new Error("Real event provider returned no usable event");
  }

  return {
    fixture: item,
    table: table.slice(0, 6),
    upcoming: upcoming.filter((entry) => entry.id !== item.id).slice(0, 4),
    recent: recent.filter((entry) => entry.id !== item.id).slice(0, 4)
  };
}

async function resolveMatchPayload(payload) {
  const localMatch = payload.matchId ? await getMatch(payload.matchId) : null;
  if (localMatch) {
    return localMatch;
  }

  if (payload.match) {
    return normalizeMatchInput(payload.match);
  }

  return null;
}

function buildQueueWindow(match, scene) {
  const kickOff = new Date(match.kickOff);
  if (Number.isNaN(kickOff.getTime())) {
    return null;
  }

  const offsets = {
    pre_match: -75,
    live: 12,
    post_match: 105
  };
  const offsetMinutes = offsets[scene] ?? -75;
  return new Date(kickOff.getTime() + offsetMinutes * 60_000).toISOString();
}

function buildCampaignWorkflow(campaign) {
  const reviewed = Boolean(campaign.reviewedAt);
  const queued = Boolean(campaign.queuedAt);

  return [
    { key: "inputs_locked", state: "done" },
    { key: "content_generated", state: "done" },
    { key: "editor_review", state: reviewed ? "done" : "active" },
    { key: "publish_queue", state: queued ? "done" : reviewed ? "active" : "pending" }
  ];
}

function appendCampaignActivity(campaign, code, meta = {}) {
  const entry = {
    id: nextActivityId(),
    code,
    meta,
    createdAt: new Date().toISOString()
  };
  campaign.activity.unshift(entry);
  campaign.updatedAt = entry.createdAt;
  return entry;
}

function serializeCampaign(campaign) {
  return {
    id: campaign.id,
    matchId: campaign.match.id,
    match: {
      id: campaign.match.id,
      homeTeam: campaign.match.homeTeam,
      awayTeam: campaign.match.awayTeam,
      kickOff: campaign.match.kickOff,
      city: campaign.match.city,
      stage: campaign.match.stage
    },
    supportTeam: campaign.supportTeam,
    language: campaign.language,
    languageLabel: campaign.languageLabel,
    scene: campaign.scene,
    targetMarket: campaign.targetMarket,
    channel: campaign.channel,
    angle: campaign.angle,
    includeFun: campaign.includeFun,
    generationSource: campaign.generationSource,
    generatedPollId: campaign.generatedPollId || null,
    status: campaign.status,
    queueWindow: campaign.queueWindow,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    reviewedAt: campaign.reviewedAt,
    queuedAt: campaign.queuedAt,
    exportedAt: campaign.exportedAt,
    workflow: buildCampaignWorkflow(campaign),
    content: {
      ...campaign.content,
      hashtags: [...campaign.content.hashtags]
    },
    funFacts: [...campaign.funFacts],
    trending: [...campaign.trending],
    hotTakes: [...campaign.hotTakes],
    activity: campaign.activity.map((entry) => ({
      ...entry,
      meta: { ...entry.meta }
    }))
  };
}

function serializeCampaignSummary(campaign) {
  return {
    id: campaign.id,
    matchId: campaign.match.id,
    matchLabel: `${campaign.match.homeTeam} vs ${campaign.match.awayTeam}`,
    supportTeam: campaign.supportTeam,
    language: campaign.language,
    scene: campaign.scene,
    targetMarket: campaign.targetMarket,
    channel: campaign.channel,
    angle: campaign.angle,
    status: campaign.status,
    generationSource: campaign.generationSource,
    queueWindow: campaign.queueWindow,
    updatedAt: campaign.updatedAt
  };
}

function listCampaignSummaries() {
  return Array.from(campaigns.values())
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())
    .map(serializeCampaignSummary);
}

function buildCampaignBrief(campaign) {
  const tags = campaign.content.hashtags.join(" ");
  return [
    "# MatchBuzz Operator Brief",
    "",
    `Campaign ID: ${campaign.id}`,
    `Match: ${campaign.match.homeTeam} vs ${campaign.match.awayTeam}`,
    `Support Team: ${campaign.supportTeam}`,
    `Market: ${campaign.targetMarket}`,
    `Channel: ${campaign.channel}`,
    `Language: ${campaign.language}`,
    `Scene: ${campaign.scene}`,
    `Generation Source: ${campaign.generationSource}`,
    `Queue Window: ${campaign.queueWindow || "TBD"}`,
    "",
    "## Content Package",
    `Headline: ${campaign.content.headline}`,
    "",
    "Social Post:",
    campaign.content.socialPost,
    "",
    "Video Script:",
    campaign.content.videoScript,
    "",
    "Support Chant:",
    campaign.content.chant,
    "",
    "Recap Angle:",
    campaign.content.recap,
    "",
    `Hashtags: ${tags}`,
    "",
    "## Interaction Layer",
    `Generated Poll: ${campaign.generatedPollId || "Not attached"}`,
    `Facts Attached: ${campaign.funFacts.length}`,
    `Trending Tags: ${campaign.trending.join(" ")}`,
    "",
    "## Recent Activity"
  ]
    .concat(
      campaign.activity.slice(0, 6).map((entry) => `- ${entry.code} @ ${entry.createdAt}`)
    )
    .join("\n");
}

function getCampaignCounts() {
  const items = Array.from(campaigns.values());
  return {
    total: items.length,
    draft: items.filter((entry) => entry.status === "draft").length,
    ready: items.filter((entry) => entry.status === "ready").length,
    queued: items.filter((entry) => entry.status === "queued").length
  };
}

function ensureSupportPoll(match, index = 0) {
  const pollId = `support-${match.id}`;
  match.supportPollId = pollId;

  if (!polls.has(pollId)) {
    polls.set(pollId, {
      id: pollId,
      matchId: match.id,
      question: `Who are you backing in ${match.homeTeam} vs ${match.awayTeam}?`,
      options: [
        { id: "home", label: match.homeTeam, votes: 40 + index * 9 },
        { id: "away", label: match.awayTeam, votes: 35 + index * 7 }
      ],
      createdAt: new Date().toISOString()
    });
  }

  return match;
}

function seedSupportPolls() {
  matches.forEach((match, index) => {
    ensureSupportPoll(match, index);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (error, file) => {
    if (error) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml; charset=utf-8"
    };

    res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
    res.end(file);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeText(value) {
  return String(value || "")
    .replace(/[<>{}]/g, "")
    .trim();
}

function normalizeRemoteMatch(raw, index) {
  const homeTeam = sanitizeText(
    raw.homeTeam || raw.home_team || raw.home?.name || raw.teams?.home?.name || raw.teams?.home || raw.participants?.[0]?.name
  );
  const awayTeam = sanitizeText(
    raw.awayTeam || raw.away_team || raw.away?.name || raw.teams?.away?.name || raw.teams?.away || raw.participants?.[1]?.name
  );

  if (!homeTeam || !awayTeam) {
    return null;
  }

  const stage = sanitizeText(raw.stage || raw.round || raw.phase || "Featured Match");
  const match = {
    id: slugify(raw.id || raw.matchId || `${homeTeam}-${awayTeam}`),
    homeTeam,
    awayTeam,
    kickOff: raw.kickOff || raw.kickoff || raw.startTime || raw.utcDate || new Date(Date.now() + index * 7200000).toISOString(),
    city: sanitizeText(raw.city || raw.venue?.city || raw.venue?.name || raw.venue || "TBD"),
    stage,
    storyline:
      sanitizeText(raw.storyline || raw.description || raw.summary) || buildDefaultStoryline(homeTeam, awayTeam, stage),
    facts:
      toStringList(raw.facts || raw.funFacts).length > 0
        ? toStringList(raw.facts || raw.funFacts)
        : [
            `${homeTeam} vs ${awayTeam} is being positioned as a global fan conversation fixture.`,
            `This matchup is useful for multi-language football storytelling and creator workflows.`,
            `The atmosphere, rivalry, and tournament timing make it a strong social distribution event.`
          ],
    tags:
      toStringList(raw.tags).length > 0
        ? toStringList(raw.tags)
        : ["#MatchBuzz", `#${homeTeam.replace(/\s+/g, "")}`, `#${awayTeam.replace(/\s+/g, "")}`, "#WorldFootball"],
    hotTakes:
      toStringList(raw.hotTakes || raw.talkingPoints).length > 0
        ? toStringList(raw.hotTakes || raw.talkingPoints)
        : [
            `${homeTeam} vs ${awayTeam} should be framed around momentum and emotional swings.`,
            `This fixture is likely to perform well with fans, creators, and sponsor storytelling.`,
            `A strong live interaction layer matters as much as the recap content here.`
          ]
  };

  return ensureSupportPoll(match, index);
}

function listLocalMatches() {
  return matches.map((match, index) => ensureSupportPoll(match, index));
}

async function fetchRemoteMatches() {
  const response = await fetch(CONFIG.matchData.apiUrl, {
    method: "GET",
    headers: buildAuthHeaders(CONFIG.matchData)
  });

  if (!response.ok) {
    throw new Error(`Match data provider returned ${response.status}`);
  }

  const payload = await response.json();
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.matches)
      ? payload.matches
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.events)
          ? payload.events
          : [];

  const normalized = candidates.map(normalizeRemoteMatch).filter(Boolean);
  if (!normalized.length) {
    throw new Error("Match data provider returned no usable matches");
  }

  remoteMatchesCache.expiresAt = Date.now() + CONFIG.matchData.cacheMs;
  remoteMatchesCache.items = normalized;
  return normalized;
}

async function listMatches() {
  if (!hasRemoteMatchData()) {
    return listLocalMatches();
  }

  if (remoteMatchesCache.items && remoteMatchesCache.expiresAt > Date.now()) {
    return remoteMatchesCache.items;
  }

  try {
    return await fetchRemoteMatches();
  } catch (error) {
    return listLocalMatches();
  }
}

async function getMatch(matchId) {
  const items = await listMatches();
  return items.find((match) => match.id === matchId);
}

function getBundle(language) {
  return languageBundles[language] || languageBundles.en;
}

function getLocalizedFacts(match, language) {
  return factTranslations[language]?.[match.id] || match.facts;
}

function moderateText(input) {
  const banned = ["rumor", "leak", "betting", "hack", "scandal"];
  const lower = String(input || "").toLowerCase();
  const hits = banned.filter((word) => lower.includes(word));
  return {
    safe: hits.length === 0,
    hits
  };
}

function extractJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    return null;
  }

  const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch (nestedError) {
        return null;
      }
    }
    return null;
  }
}

function normalizeGeneratedPayload(raw, fallback) {
  const pollOptions = Array.isArray(raw.pollOptions || raw.poll_options)
    ? (raw.pollOptions || raw.poll_options).map((option) => sanitizeText(option)).filter(Boolean).slice(0, 4)
    : [];
  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags
        .map((tag) => sanitizeText(tag))
        .filter(Boolean)
        .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`))
        .slice(0, 5)
    : [];

  return {
    headline: sanitizeText(raw.headline) || fallback.headline,
    socialPost: sanitizeText(raw.socialPost || raw.social_post) || fallback.socialPost,
    videoScript: sanitizeText(raw.videoScript || raw.video_script) || fallback.videoScript,
    recap: sanitizeText(raw.recap) || fallback.recap,
    chant: sanitizeText(raw.chant) || fallback.chant,
    pollQuestion: sanitizeText(raw.pollQuestion || raw.poll_question) || fallback.pollQuestion,
    pollOptions: pollOptions.length === 4 ? pollOptions : fallback.pollOptions,
    hashtags: hashtags.length >= 3 ? hashtags : fallback.hashtags
  };
}

async function generateWithRemoteLlm(payload) {
  const response = await fetch(CONFIG.llm.apiUrl, {
    method: "POST",
    headers: {
      ...buildAuthHeaders(CONFIG.llm),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CONFIG.llm.model,
      messages: [
        {
          role: "system",
          content:
            "You are MatchBuzz, a football content generation engine for global sports operators. Return JSON only. The JSON must contain headline, socialPost, videoScript, recap, chant, pollQuestion, pollOptions, hashtags. Keep content safe, public, brand-friendly, and free of rumors. Adapt tone to the target market, channel, and content angle. pollOptions must be an array of exactly 4 short options. hashtags must be an array of 4 or 5 short hashtags."
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ],
      temperature: 0.8,
      max_tokens: 700
    })
  });

  if (!response.ok) {
    throw new Error(`LLM provider returned ${response.status}`);
  }

  const data = await response.json();
  const content =
    data.choices?.[0]?.message?.content ||
    data.output_text ||
    data.output?.[0]?.content?.[0]?.text ||
    data.content ||
    "";

  const parsed = extractJsonObject(content);
  if (!parsed) {
    throw new Error("LLM provider did not return valid JSON content");
  }

  return parsed;
}

async function createGeneratedContent(payload) {
  const match = await resolveMatchPayload(payload);
  if (!match) {
    return { error: "Unknown match" };
  }

  const bundle = getBundle(payload.language);
  const supportTeam =
    payload.supportTeam === match.homeTeam || payload.supportTeam === match.awayTeam
      ? payload.supportTeam
      : match.homeTeam;
  const scene = ["pre_match", "live", "post_match"].includes(payload.scene) ? payload.scene : "pre_match";
  const includeFun = Boolean(payload.includeFun);
  const localizedFacts = getLocalizedFacts(match, payload.language);
  const fallbackGenerated = bundle.build({ ...match, facts: localizedFacts }, supportTeam, scene, includeFun);
  let generated = fallbackGenerated;
  let generationSource = "template";

  if (hasRemoteLlm()) {
    try {
      const remoteGenerated = await generateWithRemoteLlm({
        match: {
          homeTeam: match.homeTeam,
          awayTeam: match.awayTeam,
          city: match.city,
          stage: match.stage,
          storyline: match.storyline,
          kickOff: match.kickOff,
          league: match.league || null,
          round: match.round || null,
          status: match.status || null,
          homeScore: match.homeScore ?? null,
          awayScore: match.awayScore ?? null
        },
        supportTeam,
        opposition: supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam,
        language: payload.language || "en",
        languageLabel: bundle.label,
        scene,
        sceneLabel: bundle.sceneNames[scene],
        targetMarket: sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], "global"),
        channel: sanitizeEnum(payload.channel, ["fan_community", "creator_short", "brand_social"], "fan_community"),
        angle: sanitizeEnum(payload.angle, ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"], "rivalry"),
        includeFun,
        funFacts: localizedFacts,
        hotTakes: match.hotTakes,
        tags: match.tags
      });

      generated = normalizeGeneratedPayload(remoteGenerated, fallbackGenerated);
      generationSource = "remote-llm";
    } catch (error) {
      generationSource = "template-fallback";
    }
  }

  return {
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      city: match.city,
      stage: match.stage,
      storyline: match.storyline
    },
    language: payload.language || "en",
    languageLabel: bundle.label,
    generationSource,
    scene,
    sceneLabel: bundle.sceneNames[scene],
    targetMarket: sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], "global"),
    channel: sanitizeEnum(payload.channel, ["fan_community", "creator_short", "brand_social"], "fan_community"),
    angle: sanitizeEnum(payload.angle, ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"], "rivalry"),
    supportTeam,
    opposition: supportTeam === match.homeTeam ? match.awayTeam : match.homeTeam,
    content: generated,
    funFacts: includeFun ? localizedFacts : [],
    hotTakes: match.hotTakes,
    trending: match.tags
  };
}

async function createCampaign(payload) {
  const match = await resolveMatchPayload(payload);
  if (!match) {
    return { error: "Match not found" };
  }

  const campaign = {
    id: nextCampaignId(),
    match: {
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickOff: match.kickOff,
      city: match.city,
      stage: match.stage
    },
    supportTeam:
      payload.supportTeam === match.homeTeam || payload.supportTeam === match.awayTeam
        ? payload.supportTeam
        : match.homeTeam,
    language: sanitizeEnum(payload.language, ["en", "es", "id", "zh"], "en"),
    languageLabel: getBundle(payload.language).label,
    scene: sanitizeEnum(payload.scene, ["pre_match", "live", "post_match"], "pre_match"),
    targetMarket: sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], "global"),
    channel: sanitizeEnum(payload.channel, ["fan_community", "creator_short", "brand_social"], "fan_community"),
    angle: sanitizeEnum(payload.angle, ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"], "rivalry"),
    includeFun: Boolean(payload.includeFun),
    generationSource: sanitizeText(payload.generationSource) || "template",
    generatedPollId: sanitizeText(payload.generatedPollId) || null,
    status: "draft",
    queueWindow: buildQueueWindow(match, sanitizeEnum(payload.scene, ["pre_match", "live", "post_match"], "pre_match")),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    reviewedAt: null,
    queuedAt: null,
    exportedAt: null,
    content: normalizeCampaignContent(payload.content || {}),
    funFacts: toStringList(payload.funFacts || []).slice(0, 6),
    trending: sanitizeHashtags(payload.trending || [], []),
    hotTakes: toStringList(payload.hotTakes || []).slice(0, 6),
    activity: []
  };

  appendCampaignActivity(campaign, "campaign_created", {
    scene: campaign.scene,
    language: campaign.language,
    market: campaign.targetMarket
  });

  if (campaign.generatedPollId) {
    appendCampaignActivity(campaign, "poll_attached", {
      pollId: campaign.generatedPollId
    });
  }

  if (campaign.funFacts.length) {
    appendCampaignActivity(campaign, "facts_attached", {
      count: campaign.funFacts.length
    });
  }

  campaigns.set(campaign.id, campaign);
  return { campaign: serializeCampaign(campaign) };
}

function updateCampaignDraft(campaign, payload) {
  const nextContent = normalizeCampaignContent(payload.content || {}, campaign.content);
  let changedFields = 0;

  ["headline", "socialPost", "videoScript", "recap", "chant"].forEach((field) => {
    if (campaign.content[field] !== nextContent[field]) {
      changedFields += 1;
    }
  });

  if (campaign.content.hashtags.join(" ") !== nextContent.hashtags.join(" ")) {
    changedFields += 1;
  }

  const nextMarket = sanitizeEnum(payload.targetMarket, ["sea", "latam", "global"], campaign.targetMarket);
  const nextChannel = sanitizeEnum(
    payload.channel,
    ["fan_community", "creator_short", "brand_social"],
    campaign.channel
  );
  const nextAngle = sanitizeEnum(
    payload.angle,
    ["rivalry", "star_spotlight", "fan_culture", "tactical_debate"],
    campaign.angle
  );

  if (nextMarket !== campaign.targetMarket) {
    changedFields += 1;
  }
  if (nextChannel !== campaign.channel) {
    changedFields += 1;
  }
  if (nextAngle !== campaign.angle) {
    changedFields += 1;
  }

  campaign.content = nextContent;
  campaign.targetMarket = nextMarket;
  campaign.channel = nextChannel;
  campaign.angle = nextAngle;
  campaign.status = "ready";
  campaign.reviewedAt = new Date().toISOString();
  appendCampaignActivity(campaign, "draft_saved", {
    changedFields
  });

  return serializeCampaign(campaign);
}

function queueCampaign(campaign) {
  if (!campaign.reviewedAt) {
    campaign.reviewedAt = new Date().toISOString();
    appendCampaignActivity(campaign, "draft_saved", {
      changedFields: 0,
      auto: true
    });
  }

  campaign.status = "queued";
  campaign.queuedAt = new Date().toISOString();
  appendCampaignActivity(campaign, "queued", {
    channel: campaign.channel,
    queueWindow: campaign.queueWindow
  });

  return serializeCampaign(campaign);
}

function exportCampaignBrief(campaign) {
  campaign.exportedAt = new Date().toISOString();
  appendCampaignActivity(campaign, "brief_exported", {
    format: "txt"
  });

  return {
    filename: `${campaign.id}-brief.txt`,
    text: buildCampaignBrief(campaign),
    campaign: serializeCampaign(campaign)
  };
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildShareCard(match, payload) {
  const themes = {
    classic: ["#07111f", "#153157", "#ffd046"],
    energy: ["#0f2e16", "#1d7b4f", "#efff9a"],
    pulse: ["#280d36", "#6d2acb", "#ff8f3a"]
  };

  const themeKey = themes[payload.theme] ? payload.theme : "classic";
  const colors = themes[themeKey];
  const headline = escapeXml(payload.headline || `${payload.supportTeam || match.homeTeam} Matchday`);
  const caption = escapeXml(payload.caption || `${match.homeTeam} vs ${match.awayTeam}`);
  const supportTeam = escapeXml(payload.supportTeam || match.homeTeam);
  const language = escapeXml(getBundle(payload.language).label);
  const matchup = escapeXml(`${match.homeTeam} vs ${match.awayTeam}`);

  return {
    theme: themeKey,
    filename: `matchbuzz-${match.id}-${themeKey}.svg`,
    svg: `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="${colors[0]}"/>
      <stop offset="0.5" stop-color="${colors[1]}"/>
      <stop offset="1" stop-color="#03060c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" rx="32" fill="url(#bg)"/>
  <circle cx="1040" cy="124" r="168" fill="${colors[2]}" opacity="0.15"/>
  <circle cx="140" cy="560" r="200" fill="#ffffff" opacity="0.06"/>
  <text x="80" y="100" fill="#fff7d1" font-family="Avenir Next, Segoe UI, sans-serif" font-size="28" font-weight="700">MATCHBUZZ</text>
  <text x="80" y="182" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="64" font-weight="800">${headline}</text>
  <text x="80" y="246" fill="#d9e7ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="30" font-weight="500">${caption}</text>
  <rect x="80" y="330" width="300" height="108" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="112" y="375" fill="#eff4ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" font-weight="700">SUPPORTED TEAM</text>
  <text x="112" y="418" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" font-weight="800">${supportTeam}</text>
  <rect x="404" y="330" width="300" height="108" rx="24" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="436" y="375" fill="#eff4ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" font-weight="700">MATCHUP</text>
  <text x="436" y="418" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" font-weight="800">${matchup}</text>
  <rect x="728" y="330" width="212" height="108" rx="24" fill="${colors[2]}" fill-opacity="0.16" stroke="${colors[2]}" stroke-opacity="0.45"/>
  <text x="760" y="375" fill="#fff9d6" font-family="Avenir Next, Segoe UI, sans-serif" font-size="22" font-weight="700">LANGUAGE</text>
  <text x="760" y="418" fill="#ffffff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="34" font-weight="800">${language}</text>
  <text x="80" y="548" fill="#d9e7ff" font-family="Avenir Next, Segoe UI, sans-serif" font-size="24" font-weight="600">Interactive World Cup content for fans, creators, and brand teams.</text>
  <text x="80" y="588" fill="${colors[2]}" font-family="Avenir Next, Segoe UI, sans-serif" font-size="28" font-weight="800">matchbuzz global football ops</text>
</svg>
    `.trim()
  };
}

function getSystemStatus() {
  return {
    appHost: APP_HOST,
    port: PORT,
    generation: {
      mode: hasRemoteLlm() ? "remote-llm" : "template",
      configured: hasRemoteLlm(),
      provider: CONFIG.llm.apiUrl ? "GMI Cloud Inference Engine" : "Local template fallback",
      apiUrlConfigured: Boolean(CONFIG.llm.apiUrl),
      modelConfigured: Boolean(CONFIG.llm.model),
      apiStyle: CONFIG.llm.apiStyle,
      model: CONFIG.llm.model || null
    },
    matchData: {
      mode: hasRemoteMatchData() ? "remote-data" : "local-fallback",
      configured: hasRemoteMatchData(),
      apiUrlConfigured: Boolean(CONFIG.matchData.apiUrl),
      apiStyle: CONFIG.matchData.apiStyle,
      cacheMs: CONFIG.matchData.cacheMs
    },
    realFixtures: {
      provider: "TheSportsDB",
      baseUrlConfigured: Boolean(CONFIG.realFixtures.baseUrl),
      leagueId: CONFIG.realFixtures.leagueId,
      season: CONFIG.realFixtures.season,
      cacheMs: CONFIG.realFixtures.cacheMs
    },
    campaigns: getCampaignCounts(),
    requiredEnv: {
      llm: ["GMI_API_URL", "GMI_API_KEY", "GMI_MODEL"],
      matchData: ["MATCH_DATA_API_URL", "MATCH_DATA_API_KEY"],
      realFixtures: ["REAL_FIXTURE_API_URL", "REAL_FIXTURE_LEAGUE_ID", "REAL_FIXTURE_SEASON"]
    }
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/system/status") {
    sendJson(res, 200, getSystemStatus());
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/matches") {
    const data = (await listMatches()).map((match) => ({
      id: match.id,
      homeTeam: match.homeTeam,
      awayTeam: match.awayTeam,
      kickOff: match.kickOff,
      city: match.city,
      stage: match.stage,
      storyline: match.storyline,
      supportPollId: match.supportPollId
    }));
    sendJson(res, 200, {
      matches: data,
      source: hasRemoteMatchData() ? "remote-data-or-fallback" : "local-fallback"
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/matches/")) {
    const matchId = url.pathname.split("/")[3];
    const match = await getMatch(matchId);
    if (!match) {
      sendJson(res, 404, { error: "Match not found" });
      return true;
    }
    sendJson(res, 200, { match });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/fun-facts/")) {
    const matchId = url.pathname.split("/")[3];
    const match = await getMatch(matchId);
    if (!match) {
      sendJson(res, 404, { error: "Match not found" });
      return true;
    }
    const language = sanitizeText(url.searchParams.get("language")) || "en";
    sendJson(res, 200, { facts: getLocalizedFacts(match, language) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/trending/")) {
    const matchId = url.pathname.split("/")[3];
    const match = await getMatch(matchId);
    if (!match) {
      sendJson(res, 404, { error: "Match not found" });
      return true;
    }
    sendJson(res, 200, { tags: match.tags, hotTakes: match.hotTakes });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/real/fixtures") {
    try {
      const scope = sanitizeText(url.searchParams.get("scope")) === "recent" ? "recent" : "upcoming";
      const fixtures = await fetchRealFixturesFeed(scope);
      sendJson(res, 200, {
        scope,
        provider: "TheSportsDB",
        leagueId: CONFIG.realFixtures.leagueId,
        season: CONFIG.realFixtures.season,
        fixtures
      });
    } catch (error) {
      sendJson(res, 502, { error: "Failed to load real fixtures", detail: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/real/fixtures/")) {
    try {
      const matchId = url.pathname.split("/")[4];
      const detail = await getRealFixtureDetail(matchId);
      sendJson(res, 200, {
        provider: "TheSportsDB",
        leagueId: CONFIG.realFixtures.leagueId,
        season: CONFIG.realFixtures.season,
        ...detail
      });
    } catch (error) {
      sendJson(res, 404, { error: "Real fixture not found", detail: error.message });
    }
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/campaigns") {
    sendJson(res, 200, {
      campaigns: listCampaignSummaries()
    });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/activity")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, { activity: serializeCampaign(campaign).activity });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/campaigns/")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, { campaign: serializeCampaign(campaign) });
    return true;
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/polls/") && url.pathname.endsWith("/results")) {
    const parts = url.pathname.split("/");
    const pollId = parts[3];
    const poll = polls.get(pollId);
    if (!poll) {
      sendJson(res, 404, { error: "Poll not found" });
      return true;
    }

    const totalVotes = poll.options.reduce((sum, option) => sum + option.votes, 0);
    sendJson(res, 200, {
      poll: {
        id: poll.id,
        matchId: poll.matchId,
        question: poll.question,
        options: poll.options.map((option) => ({
          id: option.id,
          label: option.label,
          votes: option.votes,
          share: totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100)
        })),
        totalVotes
      }
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/generate") {
    try {
      const payload = await parseBody(req);
      const moderation = moderateText(JSON.stringify(payload));
      if (!moderation.safe) {
        sendJson(res, 400, {
          error: "Unsafe request",
          hits: moderation.hits
        });
        return true;
      }

      const result = await createGeneratedContent({
        matchId: sanitizeText(payload.matchId),
        supportTeam: sanitizeText(payload.supportTeam),
        language: sanitizeText(payload.language) || "en",
        scene: sanitizeText(payload.scene),
        includeFun: Boolean(payload.includeFun),
        targetMarket: sanitizeText(payload.targetMarket),
        channel: sanitizeText(payload.channel),
        angle: sanitizeText(payload.angle),
        match: payload.match || null
      });

      if (result.error) {
        sendJson(res, 404, result);
        return true;
      }

      sendJson(res, 200, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/campaigns") {
    try {
      const payload = await parseBody(req);
      const result = await createCampaign({
        matchId: sanitizeText(payload.matchId),
        supportTeam: sanitizeText(payload.supportTeam),
        language: sanitizeText(payload.language) || "en",
        scene: sanitizeText(payload.scene),
        targetMarket: sanitizeText(payload.targetMarket),
        channel: sanitizeText(payload.channel),
        angle: sanitizeText(payload.angle),
        includeFun: Boolean(payload.includeFun),
        generationSource: sanitizeText(payload.generationSource),
        generatedPollId: sanitizeText(payload.generatedPollId),
        content: payload.content || {},
        funFacts: toStringList(payload.funFacts),
        trending: toStringList(payload.trending),
        hotTakes: toStringList(payload.hotTakes),
        match: payload.match || null
      });

      if (result.error) {
        sendJson(res, 404, result);
        return true;
      }

      sendJson(res, 201, result);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/save-draft")) {
    try {
      const payload = await parseBody(req);
      const campaignId = url.pathname.split("/")[3];
      const campaign = campaigns.get(campaignId);
      if (!campaign) {
        sendJson(res, 404, { error: "Campaign not found" });
        return true;
      }

      sendJson(res, 200, {
        campaign: updateCampaignDraft(campaign, {
          content: payload.content || {},
          targetMarket: sanitizeText(payload.targetMarket),
          channel: sanitizeText(payload.channel),
          angle: sanitizeText(payload.angle)
        })
      });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/queue")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, { campaign: queueCampaign(campaign) });
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/campaigns/") && url.pathname.endsWith("/export-brief")) {
    const campaignId = url.pathname.split("/")[3];
    const campaign = campaigns.get(campaignId);
    if (!campaign) {
      sendJson(res, 404, { error: "Campaign not found" });
      return true;
    }

    sendJson(res, 200, exportCampaignBrief(campaign));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/generate/share-card") {
    try {
      const payload = await parseBody(req);
      const match = await resolveMatchPayload({
        matchId: sanitizeText(payload.matchId),
        match: payload.match || null
      });
      if (!match) {
        sendJson(res, 404, { error: "Match not found" });
        return true;
      }

      const card = buildShareCard(match, {
        matchId: sanitizeText(payload.matchId),
        supportTeam: sanitizeText(payload.supportTeam),
        headline: sanitizeText(payload.headline),
        caption: sanitizeText(payload.caption),
        language: sanitizeText(payload.language) || "en",
        theme: sanitizeText(payload.theme)
      });

      sendJson(res, 200, card);
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/polls") {
    try {
      const payload = await parseBody(req);
      const match = await resolveMatchPayload({
        matchId: sanitizeText(payload.matchId),
        match: payload.match || null
      });
      if (!match) {
        sendJson(res, 404, { error: "Match not found" });
        return true;
      }

      const options = Array.isArray(payload.options)
        ? payload.options.map((option, index) => ({
            id: `opt-${index + 1}`,
            label: sanitizeText(option).slice(0, 80) || `Option ${index + 1}`,
            votes: 0
          }))
        : [];

      const poll = {
        id: `poll-${Date.now()}`,
        matchId: match.id,
        question: sanitizeText(payload.question).slice(0, 160) || "What is your take on this match?",
        options: options.length > 1 ? options : polls.get(match.supportPollId).options.map((option) => ({ ...option })),
        createdAt: new Date().toISOString()
      };

      polls.set(poll.id, poll);
      sendJson(res, 201, { pollId: poll.id });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/polls/") && url.pathname.endsWith("/vote")) {
    try {
      const payload = await parseBody(req);
      const pollId = url.pathname.split("/")[3];
      const poll = polls.get(pollId);
      if (!poll) {
        sendJson(res, 404, { error: "Poll not found" });
        return true;
      }

      const optionId = sanitizeText(payload.optionId);
      const option = poll.options.find((entry) => entry.id === optionId);
      if (!option) {
        sendJson(res, 404, { error: "Option not found" });
        return true;
      }

      option.votes += 1;
      sendJson(res, 200, { success: true });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/moderate") {
    try {
      const payload = await parseBody(req);
      sendJson(res, 200, moderateText(payload.text));
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/report") {
    try {
      const payload = await parseBody(req);
      sendJson(res, 201, {
        success: true,
        message: "Report received",
        reason: sanitizeText(payload.reason).slice(0, 120)
      });
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON body" });
    }
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url)
      .then((handled) => {
        if (!handled) {
          sendJson(res, 404, { error: "API route not found" });
        }
      })
      .catch((error) => {
        sendJson(res, 500, { error: "Internal server error", detail: error.message });
      });
    return;
  }

  const target = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(PUBLIC_DIR, path.normalize(target));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  sendFile(res, filePath);
});

server.listen(PORT, APP_HOST, () => {
  console.log(`MatchBuzz listening on http://${APP_HOST}:${PORT}`);
});
