type RuntimeEnv = Record<string, any>;

function clientConfig() {
  try {
    let { APP, LLMTOKEN } = JSON.parse(atob(window.appsettings ?? ""));
    return { app: APP, token: LLMTOKEN };
  } catch {
    return { app: "chatbib", token: "" };
  }
}

function serverConfig() {
  return {
    app: process.env.APP ?? "chatbib",
    token: process.env.LLMTOKEN ?? "",
  };
}

const { app, token } =
  typeof window === "undefined" ? serverConfig() : clientConfig();

const chatbib: RuntimeEnv = {
  APP: "chatbib",
};
const skolegpt: RuntimeEnv = {
  APP: "skolegpt",
  BASE_URL: "https://glyph-gate.dbc.dk/",
  API_KEY: token,
  ENABLE_TTSASR: true,
  SHOW_SETTINGS: "true",
  CUSTOM_MODELS:
    "google/gemma-4-26B-A4B-it,mitcfu-rag,science-rag",
  CHAT_DISCLAIMER:
    "SkoleGPT kan tage fejl. Tjek altid vigtige oplysninger og råd med en pålidelig kilde.",
  APP_TITLE: "SkoleGPT",
  APP_TAGLINE: "Chatassistent til skolen",
  CONTAINER_CSS_CLASS: "skolegpt",
  DISABLE_GOOGLE_FONTS: true,
  HOMEPAGE_IS_MASKLIST: true,
  STYLE: "skolegpt",
  SCROLLBAR_ON_SCROLL: true,
  TRASH_DELETE_ICON: true,
  CONFIRM_DELETE_CHAT: true,
  SIDEBAR_INLINE_LOGO: true,
  SIDEBAR_HIDE_BUILTIN_NOTE: true,
  SIDEBAR_LARGE_BUTTONS: true,
  CLEANUP_EMPTY_SESSIONS: "true",
  DEFAULT_NEW_CHAT: "skolegptv3",
  SYSTEM_PROMPT_IN_SIDEBAR: "true",
  DISABLE_MODELS: "true",
  DISABLE_FEEDBACK: "true",
  LOCALE: "skolegpt",
  INJECT_ANALYTICS:
    "<script> var _paq = window._paq = window._paq || []; _paq.push(['disableCookies']); _paq.push(['trackPageView']); _paq.push(['enableLinkTracking']); (function() { var u='https://stats.dbc.dk/'; _paq.push(['setTrackerUrl', u+'matomo.php']); _paq.push(['setSiteId', '43']); var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0]; g.async=true; g.src=u+'matomo.js'; s.parentNode.insertBefore(g,s); })(); </script>",
  DEFAULT_MASK: "SkoleGPT",
  USE_MASK_AS_SESSION_NAME: false,
  DISABLE_BOT_HELLO: "true",
  MASK_BUTTON: "true",
  MASKS_ONLY: "true",
  DEFAULT_MESSAGE_COUNT: "16",
  DEFAULT_MODEL: "google/gemma-4-26B-A4B-it",
  DISABLE_MULTI_LLM: "true",
  BUILTIN_MASK_PROFILE: "skolegpt",
  // the model that can read images. messages with images are sent here
  // (skolegpt-v3 can't read images). change this if the image model changes.
  IMAGE_MODEL: "google/gemma-4-26B-A4B-it",
  // attaching files/images is only for SkoleGPT. leave this out of the other
  // apps so their chat stays the same.
  ENABLE_ATTACHMENTS: "true",
};
const chatdbc: RuntimeEnv = {
  APP: "chatdbc",
  BASE_URL: "https://llm.dbc.dk/",
  API_KEY: token,
  SHOW_SETTINGS: "true",
  CUSTOM_MODELS:
    "chatbib,gemma3-12b,hawkeye,mitcfu-rag,science-rag,skolegpt-gemma3,skolegpt-mixtral,skolegpt,skolegpt-v3",
  CHAT_DISCLAIMER:
    'ChatDBC er en proof-of-concept lokal DBC-udgave chatbib/skolegpt, der udstiller alle de modeller vi kører på llm.dbc.dk, så vi kan eksperimentere og "eat our own dogfood".',
  APP_TITLE: "ChatDBC",
  APP_TAGLINE: "",
  APP_LOGO: "chatdbc/dbcdigital.svg",
  CONTAINER_CSS_CLASS: "skolegpt",
  DISABLE_GOOGLE_FONTS: true,
  HOMEPAGE_IS_MASKLIST: true,
  STYLE: "chatbib",
  CLEANUP_EMPTY_SESSIONS: "true",
  DEFAULT_NEW_CHAT: "skolegptv3",
  SYSTEM_PROMPT_IN_SIDEBAR: true,
  DISABLE_MODELS: false,
  DISABLE_FEEDBACK: "true",
  LOCALE: "skolegpt",
  DEFAULT_MASK: "DBC",
  USE_MASK_AS_SESSION_NAME: "true",
  DISABLE_BOT_HELLO: false,
  MASK_BUTTON: true,
  MASKS_ONLY: true,
  DEFAULT_MESSAGE_COUNT: "32",
  DEFAULT_MODEL: "gemma3-12b",
  DISABLE_MULTI_LLM: "true",
  BUILTIN_MASK_PROFILE: "chatdbc",
};

const settings: Record<string, RuntimeEnv> = { chatbib, skolegpt, chatdbc };

export const env: RuntimeEnv = settings[app] ?? chatbib;
export const SKOLEGPT_RETIRED_MODEL_ALIASES = ["skolegpt", "skolegpt-v3"];
export const SKOLEGPT_REPLACEMENT_MODEL = "google/gemma-4-26B-A4B-it";