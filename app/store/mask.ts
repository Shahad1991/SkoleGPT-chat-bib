import { BUILTIN_MASKS } from "../masks";
import { getLang, Lang } from "../locales";
import { DEFAULT_TOPIC, ChatMessage } from "./chat";
import { ModelConfig, useAppConfig } from "./config";
import { StoreKey } from "../constant";
import { nanoid } from "nanoid";
import { createPersistStore } from "../utils/store";
import { MODEL_NAMES } from "../dbc";
import { env, SKOLEGPT_RETIRED_MODEL_ALIASES, SKOLEGPT_REPLACEMENT_MODEL } from "../utils/appsettings";

export type Mask = {
  id: string;
  createdAt: number;
  avatar: string;
  name: string;
  hideContext?: boolean;
  hideSystemPrompt?: boolean;
  context: ChatMessage[];
  syncGlobalConfig?: boolean;
  modelConfig: ModelConfig;
  lang: Lang;
  builtin: boolean;
  availableModels?: MODEL_NAMES[];
  plugin?: unknown[];
};

// Owned/session masks carry `hideSystemPrompt` directly (it's saved on the
// object itself). Builtin masks are read-only templates and can't be saved
// to, so their hidden state instead lives in the app config's
// `hiddenSystemPromptMaskIds`, keyed by mask id. A mask's own
// `hideSystemPrompt` (true or false) wins over that list, so a session made
// from a hidden builtin can still be un-hidden.
export function isSystemPromptHidden(
  mask: Pick<Mask, "id" | "builtin" | "hideSystemPrompt">,
  hiddenBuiltinMaskIds: string[],
): boolean {
  if (mask.hideSystemPrompt !== undefined) return mask.hideSystemPrompt;
  return mask.builtin && hiddenBuiltinMaskIds.includes(mask.id);
}

// Hidden system prompts are shared as base64url in the `p` link param, so the
// prompt isn't readable as plain text in the link. This only obscures it; it
// is not encryption.
export function encodeHiddenPrompt(prompt: string): string {
  const bytes = new TextEncoder().encode(prompt);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeHiddenPrompt(encoded: string): string | undefined {
  try {
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    // fatal: a truncated/corrupted link throws instead of decoding to U+FFFD.
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return undefined;
  }
}

export const DEFAULT_MASK_STATE = {
  masks: {} as Record<string, Mask>,
};

export type MaskState = typeof DEFAULT_MASK_STATE;

export const DEFAULT_MASK_AVATAR = "gpt-bot";
export const createEmptyMask = () =>
  ({
    id: nanoid(),
    avatar: DEFAULT_MASK_AVATAR,
    name: DEFAULT_TOPIC,
    context: [{ role: "system", content: "" }],
    syncGlobalConfig: true, // use global config as default
    modelConfig: { ...useAppConfig.getState().modelConfig },
    lang: getLang(),
    builtin: false,
    createdAt: Date.now(),
  }) as Mask;

export const useMaskStore = createPersistStore(
  { ...DEFAULT_MASK_STATE },

  (set, get) => ({
    create(mask?: Partial<Mask>) {
      const masks = get().masks;
      const id = nanoid();
      masks[id] = {
        ...createEmptyMask(),
        ...mask,
        id,
        builtin: false,
      };

      set(() => ({ masks }));
      get().markUpdate();

      return masks[id];
    },
    updateMask(id: string, updater: (mask: Mask) => void) {
      const masks = get().masks;
      const mask = masks[id];
      if (!mask) return;
      const updateMask = { ...mask };
      updater(updateMask);
      masks[id] = updateMask;
      set(() => ({ masks }));
      get().markUpdate();
    },
    delete(id: string) {
      const masks = get().masks;
      delete masks[id];
      set(() => ({ masks }));
      get().markUpdate();
    },

    get(id?: string) {
      return get().masks[id ?? 1145141919810];
    },
    getAll() {
      const userMasks = Object.values(get().masks).sort(
        (a, b) => b.createdAt - a.createdAt,
      );
      const config = useAppConfig.getState();
      if (config.hideBuiltinMasks) return userMasks;
      const buildinMasks = BUILTIN_MASKS.map(
        (m) =>
          ({
            ...m,
            modelConfig: {
              ...config.modelConfig,
              ...m.modelConfig,
            },
          }) as Mask,
      );
      return userMasks.concat(buildinMasks);
    },
    search(text: string) {
      return Object.values(get().masks);
    },
  }),
  {
    name: StoreKey.Mask,
    version: 3.2,

    migrate(state, version) {
      const newState = JSON.parse(JSON.stringify(state)) as MaskState;

      // migrate mask id to nanoid
      if (version < 3) {
        Object.values(newState.masks).forEach((m) => (m.id = nanoid()));
      }

      if (version < 3.1) {
        const updatedMasks: Record<string, Mask> = {};
        Object.values(newState.masks).forEach((m) => {
          updatedMasks[m.id] = m;
        });
        newState.masks = updatedMasks;
      }

      if (version < 3.2 && env.APP === "skolegpt") {
        Object.values(newState.masks).forEach((m) => {
          if (SKOLEGPT_RETIRED_MODEL_ALIASES.includes(m.modelConfig?.model)) {
            m.modelConfig.model = SKOLEGPT_REPLACEMENT_MODEL;
          }
        });
      }

      return newState as any;
    },
  },
);
