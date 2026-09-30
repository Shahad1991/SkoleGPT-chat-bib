import { IconButton } from "./button";
import { ErrorBoundary } from "./error";

import styles from "./mask.module.scss";

import DownloadIcon from "../icons/download.svg";
import UploadIcon from "../icons/upload.svg";
import EditIcon from "../icons/edit.svg";
import AddIcon from "../icons/add.svg";
import CloseIcon from "../icons/close.svg";
import DeleteIcon from "../icons/delete.svg";
import EyeIcon from "../icons/eye.svg";
import EyeOffIcon from "../icons/eye-off.svg";
import CopyIcon from "../icons/copy.svg";
import DragIcon from "../icons/drag.svg";
import ShareIcon from "../icons/share.svg";
import QrIcon from "../icons/qr.svg";

import {
  DEFAULT_MASK_AVATAR,
  isSystemPromptHidden,
  encodeHiddenPrompt,
  Mask,
  useMaskStore,
} from "../store/mask";
import {
  ChatMessage,
  createMessage,
  ModelConfig,
  ModelType,
  useAppConfig,
  useChatStore,
} from "../store";
import { MultimodalContent, ROLES } from "../client/api";
import {
  Input,
  List,
  ListItem,
  Modal,
  Popover,
  Select,
  showConfirm,
} from "./ui-lib";
import { Avatar, AvatarPicker } from "./emoji";
import Locale, { AllLangs, ALL_LANG_OPTIONS, Lang } from "../locales";
import { useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";

import chatStyle from "./chat.module.scss";
import { useEffect, useRef, useState } from "react";
import {
  copyToClipboard,
  downloadAs,
  getMessageImages,
  readFromFile,
} from "../utils";
import { MessageRole, Updater } from "../typing";
import { ModelConfigList } from "./model-config";
import { FileName, Path } from "../constant";
import { BUILTIN_MASK_STORE } from "../masks";
import { nanoid } from "nanoid";
import {
  DragDropContext,
  Droppable,
  Draggable,
  OnDragEndResponder,
} from "@hello-pangea/dnd";
import { getMessageTextContent } from "../utils";
import { InputRange } from "./input-range";

// drag and drop helper function
function reorder<T>(list: T[], startIndex: number, endIndex: number): T[] {
  const result = [...list];
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

// Build an app link with the assistant name and optional system prompt.
// URLSearchParams does the URL encoding.
function buildAssistantParamLink(
  mask: Mask,
  path: string,
  hideSystemPrompt: boolean,
): string {
  const systemPrompt = mask.context?.[0]
    ? getMessageTextContent(mask.context[0]).trim()
    : "";
  const url = new URL(path, location.origin);
  url.searchParams.set("name", mask.name);
  if (systemPrompt && hideSystemPrompt) {
    url.searchParams.set("p", encodeHiddenPrompt(systemPrompt));
  } else if (systemPrompt) {
    url.searchParams.set("prompt", systemPrompt);
  }
  if (hideSystemPrompt) url.searchParams.set("h", "1");
  return url.toString();
}

export function buildSkoletubeShareLink(
  mask: Mask,
  hideSystemPrompt: boolean,
): string {
  const systemPrompt = mask.context?.[0]
    ? getMessageTextContent(mask.context[0]).trim()
    : "";

  // SkoleTube needs embed_code, so we wrap the launch page in an iframe.
  const launchLink = buildAssistantParamLink(
    mask,
    Path.Skoletube,
    hideSystemPrompt,
  );
  const embedCode = `<iframe src="${launchLink}" width="100%" height="400" frameborder="0"></iframe>`;

  // Open SkoleTube's publish page with this assistant prefilled.
  const publishUrl = new URL("https://www.skoletube.dk/media/publish/");
  publishUrl.searchParams.set("method", "embed");
  publishUrl.searchParams.set("embed_code", embedCode);
  publishUrl.searchParams.set("iframe", "true");
  publishUrl.searchParams.set("title", mask.name);
  if (systemPrompt && !hideSystemPrompt)
    publishUrl.searchParams.set("description", systemPrompt);
  publishUrl.searchParams.set("keyword", "skolegpt assistent");

  return publishUrl.toString();
}

export function MaskAvatar(props: { avatar: string; model?: ModelType }) {
  return props.avatar !== DEFAULT_MASK_AVATAR ? (
    <Avatar avatar={props.avatar} />
  ) : (
    <Avatar model={props.model} />
  );
}

export function MaskConfig(props: {
  mask: Mask;
  updateMask: Updater<Mask>;
  extraListItems?: JSX.Element;
  readonly?: boolean;
  shouldSyncFromGlobal?: boolean;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const updateConfig = (updater: (config: ModelConfig) => void) => {
    if (props.readonly) return;

    const config = { ...props.mask.modelConfig };
    updater(config);
    props.updateMask((mask) => {
      mask.modelConfig = config;
      // if user changed current session mask, it will disable auto sync
      mask.syncGlobalConfig = false;
    });
  };

  const copyMaskLink = () => {
    const maskLink = `${location.protocol}//${location.host}/#${Path.NewChat}?mask=${props.mask.id}`;
    copyToClipboard(maskLink);
  };

  const globalConfig = useAppConfig();

  const [showSimpleSettings, setShowSimpleSettings] = useState(true);
  if (showSimpleSettings) {
    // readonly (builtin) masks can't be saved to directly, so their hidden
    // state is tracked separately in the app config by mask id instead.
    const hiddenBuiltinMaskIds = globalConfig.hiddenSystemPromptMaskIds ?? [];
    const systemPromptHidden = isSystemPromptHidden(
      props.mask,
      hiddenBuiltinMaskIds,
    );

    const toggleSystemPromptHidden = () => {
      if (props.readonly) {
        globalConfig.update((c) => {
          const ids = new Set(c.hiddenSystemPromptMaskIds ?? []);
          if (ids.has(props.mask.id)) {
            ids.delete(props.mask.id);
          } else {
            ids.add(props.mask.id);
          }
          c.hiddenSystemPromptMaskIds = Array.from(ids);
        });
      } else {
        props.updateMask((mask) => {
          mask.hideSystemPrompt = !systemPromptHidden;
        });
      }
    };

    return (
      <>
        <div style={{ fontSize: 14, marginBottom: 8 }}>Systemprompt:</div>
        <div
          className={chatStyle["context-prompt"]}
          style={{ marginBottom: 4 }}
        >
          <div className={chatStyle["context-prompt-row"]}>
            <div style={{ position: "relative", flex: 1, maxWidth: "100%" }}>
              <Input
                value={(props.mask.context?.[0]?.content as string) || ""}
                type="text"
                className={chatStyle["context-content"]}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  paddingRight: 32,
                  ...(systemPromptHidden ? { color: "#d0d0d0" } : {}),
                }}
                rows={5}
                onInput={(e) =>
                  props.updateMask((mask) => {
                    mask.context = [
                      {
                        ...(mask.context[0] || {}),
                        role: MessageRole.System,
                        content: e.currentTarget.value,
                      },
                    ];
                  })
                }
              />
              <IconButton
                icon={systemPromptHidden ? <EyeOffIcon /> : <EyeIcon />}
                onClick={toggleSystemPromptHidden}
                size={2}
                title={systemPromptHidden ? "Vis systemprompt" : "Skjul systemprompt"}
                className={styles["system-prompt-eye"]}
              />
            </div>
          </div>
        </div>
        <List>
          <ListItem title="Vis avancerede indstillinger">
            <input
              aria-label="Vis avancerede indstillinger"
              type="checkbox"
              checked={!showSimpleSettings}
              onChange={() => setShowSimpleSettings(false)}
            ></input>
          </ListItem>
          <ListItem title={Locale.Mask.Config.Avatar}>
            <Popover
              content={
                <AvatarPicker
                  onEmojiClick={(emoji) => {
                    props.updateMask((mask) => (mask.avatar = emoji));
                    setShowPicker(false);
                  }}
                ></AvatarPicker>
              }
              open={showPicker}
              onClose={() => setShowPicker(false)}
            >
              <div
                tabIndex={0}
                aria-label={Locale.Mask.Config.Avatar}
                onClick={() => setShowPicker(true)}
                style={{ cursor: "pointer" }}
              >
                <MaskAvatar
                  avatar={props.mask.avatar}
                  model={props.mask.modelConfig.model}
                />
              </div>
            </Popover>
          </ListItem>
          <ListItem title={Locale.Mask.Config.Name}>
            <input
              aria-label={Locale.Mask.Config.Name}
              type="text"
              value={props.mask.name}
              onInput={(e) =>
                props.updateMask((mask) => {
                  mask.name = e.currentTarget.value;
                })
              }
            ></input>
          </ListItem>
          <ListItem
            title={Locale.Mask.Config.HideContext.Title}
            subTitle={Locale.Mask.Config.HideContext.SubTitle}
          >
            <input
              aria-label={Locale.Mask.Config.HideContext.Title}
              type="checkbox"
              checked={props.mask.hideContext}
              onChange={(e) => {
                props.updateMask((mask) => {
                  mask.hideContext = e.currentTarget.checked;
                });
              }}
            ></input>
          </ListItem>
        </List>
        <List>
          <ListItem
            title={Locale.Settings.HistoryCount.Title}
            subTitle={Locale.Settings.HistoryCount.SubTitle}
          >
            <InputRange
              title={props.mask.modelConfig.historyMessageCount.toString()}
              value={props.mask.modelConfig.historyMessageCount}
              min="0"
              max="64"
              step="1"
              onChange={(e) =>
                updateConfig(
                  (config) =>
                    (config.historyMessageCount = e.target.valueAsNumber),
                )
              }
            ></InputRange>
          </ListItem>
        </List>
      </>
    );
  }

  return (
    <>
      <ContextPrompts
        context={props.mask.context}
        updateContext={(updater) => {
          const context = props.mask.context.slice();
          updater(context);
          props.updateMask((mask) => (mask.context = context));
        }}
      />

      <List>
        <ListItem title="Vis avancerede indstillinger">
          <input
            aria-label="Vis avancerede indstillinger"
            type="checkbox"
            checked={!showSimpleSettings}
            onChange={() => setShowSimpleSettings(true)}
          ></input>
        </ListItem>
        <ListItem title={Locale.Mask.Config.Avatar}>
          <Popover
            content={
              <AvatarPicker
                onEmojiClick={(emoji) => {
                  props.updateMask((mask) => (mask.avatar = emoji));
                  setShowPicker(false);
                }}
              ></AvatarPicker>
            }
            open={showPicker}
            onClose={() => setShowPicker(false)}
          >
            <div
              onClick={() => setShowPicker(true)}
              style={{ cursor: "pointer" }}
            >
              <MaskAvatar
                avatar={props.mask.avatar}
                model={props.mask.modelConfig.model}
              />
            </div>
          </Popover>
        </ListItem>
        <ListItem title={Locale.Mask.Config.Name}>
          <input
            type="text"
            value={props.mask.name}
            onInput={(e) =>
              props.updateMask((mask) => {
                mask.name = e.currentTarget.value;
              })
            }
          ></input>
        </ListItem>
        <ListItem
          title={Locale.Mask.Config.HideContext.Title}
          subTitle={Locale.Mask.Config.HideContext.SubTitle}
        >
          <input
            type="checkbox"
            checked={props.mask.hideContext}
            onChange={(e) => {
              props.updateMask((mask) => {
                mask.hideContext = e.currentTarget.checked;
              });
            }}
          ></input>
        </ListItem>

        {!props.shouldSyncFromGlobal ? (
          <ListItem
            title={Locale.Mask.Config.Share.Title}
            subTitle={Locale.Mask.Config.Share.SubTitle}
          >
            <IconButton
              icon={<CopyIcon />}
              text={Locale.Mask.Config.Share.Action}
              onClick={copyMaskLink}
            />
          </ListItem>
        ) : null}

        {props.shouldSyncFromGlobal ? (
          <ListItem
            title={Locale.Mask.Config.Sync.Title}
            subTitle={Locale.Mask.Config.Sync.SubTitle}
          >
            <input
              type="checkbox"
              checked={props.mask.syncGlobalConfig}
              onChange={async (e) => {
                const checked = e.currentTarget.checked;
                if (
                  checked &&
                  (await showConfirm(Locale.Mask.Config.Sync.Confirm))
                ) {
                  props.updateMask((mask) => {
                    mask.syncGlobalConfig = checked;
                    mask.modelConfig = { ...globalConfig.modelConfig };
                  });
                } else if (!checked) {
                  props.updateMask((mask) => {
                    mask.syncGlobalConfig = checked;
                  });
                }
              }}
            ></input>
          </ListItem>
        ) : null}
      </List>

      <List>
        <ModelConfigList
          modelConfig={{ ...props.mask.modelConfig }}
          updateConfig={updateConfig}
        />
        {props.extraListItems}
      </List>
    </>
  );
}

function ContextPromptItem(props: {
  index: number;
  prompt: ChatMessage;
  update: (prompt: ChatMessage) => void;
  remove: () => void;
}) {
  const [focusingInput, setFocusingInput] = useState(false);

  return (
    <div className={chatStyle["context-prompt-row"]}>
      {!focusingInput && (
        <>
          <div className={chatStyle["context-drag"]}>
            <DragIcon />
          </div>
          <Select
            value={props.prompt.role}
            className={chatStyle["context-role"]}
            onChange={(e) =>
              props.update({
                ...props.prompt,
                role: e.target.value as any,
              })
            }
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </>
      )}
      <Input
        value={getMessageTextContent(props.prompt)}
        type="text"
        className={chatStyle["context-content"]}
        rows={focusingInput ? 5 : 1}
        onFocus={() => setFocusingInput(true)}
        onBlur={() => {
          setFocusingInput(false);
          // If the selection is not removed when the user loses focus, some
          // extensions like "Translate" will always display a floating bar
          window?.getSelection()?.removeAllRanges();
        }}
        onInput={(e) =>
          props.update({
            ...props.prompt,
            content: e.currentTarget.value as any,
          })
        }
      />
      {!focusingInput && (
        <IconButton
          icon={<DeleteIcon />}
          className={chatStyle["context-delete-button"]}
          onClick={() => props.remove()}
          bordered
        />
      )}
    </div>
  );
}

export function ContextPrompts(props: {
  context: ChatMessage[];
  updateContext: (updater: (context: ChatMessage[]) => void) => void;
}) {
  const context = props.context;

  const addContextPrompt = (prompt: ChatMessage, i: number) => {
    props.updateContext((context) => context.splice(i, 0, prompt));
  };

  const removeContextPrompt = (i: number) => {
    props.updateContext((context) => context.splice(i, 1));
  };

  const updateContextPrompt = (i: number, prompt: ChatMessage) => {
    props.updateContext((context) => {
      const images = getMessageImages(context[i]);
      context[i] = prompt;
      if (images.length > 0) {
        const text = getMessageTextContent(context[i]);
        const newContext: MultimodalContent[] = [{ type: "text", text }];
        for (const img of images) {
          newContext.push({ type: "image_url", image_url: { url: img } });
        }
        context[i].content = newContext;
      }
    });
  };

  const onDragEnd: OnDragEndResponder = (result) => {
    if (!result.destination) {
      return;
    }
    const newContext = reorder(
      context,
      result.source.index,
      result.destination.index,
    );
    props.updateContext((context) => {
      context.splice(0, context.length, ...newContext);
    });
  };

  return (
    <>
      <div className={chatStyle["context-prompt"]} style={{ marginBottom: 20 }}>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="context-prompt-list">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {context.map((c, i) => (
                  <Draggable
                    draggableId={c.id || i.toString()}
                    index={i}
                    key={c.id}
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <ContextPromptItem
                          index={i}
                          prompt={c}
                          update={(prompt) => updateContextPrompt(i, prompt)}
                          remove={() => removeContextPrompt(i)}
                        />
                        <div
                          className={chatStyle["context-prompt-insert"]}
                          onClick={() => {
                            addContextPrompt(
                              createMessage({
                                role: MessageRole.User,
                                content: "",
                                date: new Date().toLocaleString(),
                              }),
                              i + 1,
                            );
                          }}
                        >
                          <AddIcon />
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {props.context.length === 0 && (
          <div className={chatStyle["context-prompt-row"]}>
            <IconButton
              icon={<AddIcon />}
              text={Locale.Context.Add}
              bordered
              className={chatStyle["context-prompt-button"]}
              onClick={() =>
                addContextPrompt(
                  createMessage({
                    role: MessageRole.User,
                    content: "",
                    date: "",
                  }),
                  props.context.length,
                )
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

// The three share options shown in the "Del" popover: SkoleTube, a copyable
// link, and a QR code of that same link. Uses the existing link builders.
function ShareMenu(props: { mask: Mask }) {
  const [showQr, setShowQr] = useState(false);
  const globalConfig = useAppConfig();
  const systemPromptHidden = isSystemPromptHidden(
    props.mask,
    globalConfig.hiddenSystemPromptMaskIds ?? [],
  );
  const shareLink = buildAssistantParamLink(
    props.mask,
    Path.NewChat,
    systemPromptHidden,
  );

  return (
    <div className={styles["share-menu"]}>
      {/* SKOLETUBE OFF. The share on SkoleTube option is turned off until
          release day. To turn it back on remove the comment marks around the
          block below. */}
      <div
        className={`${styles["share-menu-item"]} clickable`}
        onClick={() =>
          window.open(
            buildSkoletubeShareLink(props.mask, systemPromptHidden),
            "_blank",
            "noopener,noreferrer",
          )
        }
      >
        <ShareIcon />
        <span>{Locale.Mask.EditModal.ShareSkoletube}</span>
      </div>
      <div
        className={`${styles["share-menu-item"]} clickable`}
        onClick={() => copyToClipboard(shareLink)}
      >
        <CopyIcon />
        <span>{Locale.Mask.EditModal.ShareLink}</span>
      </div>
      <div
        className={`${styles["share-menu-item"]} clickable`}
        onClick={() => setShowQr((v) => !v)}
      >
        <QrIcon />
        <span>Del via QR</span>
      </div>
      {showQr && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <QRCode value={shareLink} size={180} />
        </div>
      )}
    </div>
  );
}

// Wraps the "Del" button and anchors the ShareMenu directly below it,
// closing when you click anywhere outside (same pattern as Modal's
// click-outside handling).
function ShareButton(props: { mask: Mask }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={anchorRef} className={styles["share-button-anchor"]}>
      <IconButton
        icon={<ShareIcon />}
        bordered
        text="Del"
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div className={styles["share-menu-popup"]}>
          <ShareMenu mask={props.mask} />
        </div>
      )}
    </div>
  );
}

export function MaskPage() {
  const navigate = useNavigate();

  const maskStore = useMaskStore();
  const chatStore = useChatStore();

  const [filterLang, setFilterLang] = useState<Lang | undefined>(
    () => localStorage.getItem("Mask-language") as Lang | undefined,
  );
  useEffect(() => {
    if (filterLang) {
      localStorage.setItem("Mask-language", filterLang);
    } else {
      localStorage.removeItem("Mask-language");
    }
  }, [filterLang]);

  const allMasks = maskStore
    .getAll()
    .filter((m) => !filterLang || m.lang === filterLang);

  const [searchMasks, setSearchMasks] = useState<Mask[]>([]);
  const [searchText, setSearchText] = useState("");
  const masks = searchText.length > 0 ? searchMasks : allMasks;

  // refactored already, now it accurate
  const onSearch = (text: string) => {
    setSearchText(text);
    if (text.length > 0) {
      const result = allMasks.filter((m) =>
        m.name.toLowerCase().includes(text.toLowerCase()),
      );
      setSearchMasks(result);
    } else {
      setSearchMasks(allMasks);
    }
  };

  const [editingMaskId, setEditingMaskId] = useState<string | undefined>();
  const editingMask =
    maskStore.get(editingMaskId) ?? BUILTIN_MASK_STORE.get(editingMaskId);
  const closeMaskModal = () => setEditingMaskId(undefined);

  const downloadAll = () => {
    downloadAs(JSON.stringify(masks.filter((v) => !v.builtin)), FileName.Masks);
  };

  const importFromFile = () => {
    readFromFile().then((content) => {
      try {
        const importMasks = JSON.parse(content);
        if (Array.isArray(importMasks)) {
          for (const mask of importMasks) {
            if (mask.name) {
              maskStore.create(mask);
            }
          }
          return;
        }
        //if the content is a single mask.
        if (importMasks.name) {
          maskStore.create(importMasks);
        }
      } catch { }
    });
  };

  return (
    <ErrorBoundary>
      <div className={styles["mask-page"]}>
        <div className="window-header">
          <div className="window-header-title">
            <div className="window-header-main-title">
              {Locale.Mask.Page.Title}
            </div>
            <div className="window-header-submai-title">
              {Locale.Mask.Page.SubTitle(allMasks.length)}
            </div>
          </div>

          <div className="window-actions">
            <div className="window-action-button">
              <IconButton
                icon={<DownloadIcon />}
                bordered
                onClick={downloadAll}
                text={Locale.UI.Export}
              />
            </div>
            <div className="window-action-button">
              <IconButton
                icon={<UploadIcon />}
                text={Locale.UI.Import}
                bordered
                onClick={() => importFromFile()}
              />
            </div>
            {/*
            <div className="window-action-button">
              <IconButton
                icon={<CloseIcon />}
                bordered
                onClick={() => navigate(-1)}
              />
            </div>
            */}
          </div>
        </div>

        <div className={styles["mask-page-body"]}>
          <div className={styles["mask-filter"]}>
            <input
              type="text"
              className={styles["search-bar"]}
              placeholder={Locale.Mask.Page.Search}
              autoFocus
              onInput={(e) => onSearch(e.currentTarget.value)}
            />
            {/*
            <Select
              className={styles["mask-filter-lang"]}
              value={filterLang ?? Locale.Settings.Lang.All}
              onChange={(e) => {
                const value = e.currentTarget.value;
                if (value === Locale.Settings.Lang.All) {
                  setFilterLang(undefined);
                } else {
                  setFilterLang(value as Lang);
                }
              }}
            >
              <option key="all" value={Locale.Settings.Lang.All}>
                {Locale.Settings.Lang.All}
              </option>
              {AllLangs.map((lang) => (
                <option value={lang} key={lang}>
                  {ALL_LANG_OPTIONS[lang]}
                </option>
              ))}
            </Select>
            */}

            <IconButton
              className={styles["mask-create"]}
              icon={<AddIcon />}
              text={Locale.Mask.Page.Create}
              bordered
              onClick={() => {
                const createdMask = maskStore.create();
                setEditingMaskId(createdMask.id);
              }}
            />
          </div>

          <div>
            {masks.map((m) => (
              <div className={styles["mask-item"]} key={m.id}>
                <div
                  className={styles["mask-header"]}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    chatStore.newSession(m);
                    navigate(Path.Chat);
                  }}
                >
                  <div className={styles["mask-icon"]}>
                    <MaskAvatar avatar={m.avatar} model={m.modelConfig.model} />
                  </div>
                  <div className={styles["mask-title"]}>
                    <div className={styles["mask-name"]}>{m.name}</div>
                    <div className={styles["mask-info"] + " one-line"}>
                      {
                        /*
                      {`${Locale.Mask.Item.Info(m.context.length)} / ${
                        ALL_LANG_OPTIONS[m.lang]
                      } /  ${m.modelConfig.model}`}
                       */ m.modelConfig.model
                      }
                    </div>
                  </div>
                </div>
                <div className={styles["mask-actions"]}>
                  <IconButton
                    icon={<AddIcon />}
                    text={Locale.Mask.Item.Chat}
                    onClick={() => {
                      chatStore.newSession(m);
                      navigate(Path.Chat);
                    }}
                  />
                  {m.builtin ? (
                    <IconButton
                      icon={<EyeIcon />}
                      text={Locale.Mask.Item.View}
                      onClick={() => setEditingMaskId(m.id)}
                    />
                  ) : (
                    <IconButton
                      icon={<EditIcon />}
                      text={Locale.Mask.Item.Edit}
                      onClick={() => setEditingMaskId(m.id)}
                    />
                  )}
                  {!m.builtin && (
                    <IconButton
                      icon={<DeleteIcon />}
                      text={Locale.Mask.Item.Delete}
                      onClick={async () => {
                        if (await showConfirm(Locale.Mask.Item.DeleteConfirm)) {
                          maskStore.delete(m.id);
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {editingMask && (
        <div className="modal-mask">
          <Modal
            title={Locale.Mask.EditModal.Title(editingMask?.builtin)}
            onClose={closeMaskModal}
            actions={[
              <IconButton
                icon={<DownloadIcon />}
                text={Locale.Mask.EditModal.Download}
                key="export"
                bordered
                onClick={() =>
                  downloadAs(
                    JSON.stringify(editingMask),
                    `${editingMask.name}.json`,
                  )
                }
              />,
              <IconButton
                key="copy"
                icon={<CopyIcon />}
                bordered
                text={Locale.Mask.EditModal.Clone}
                onClick={() => {
                  navigate(Path.Masks);
                  maskStore.create(editingMask);
                  setEditingMaskId(undefined);
                }}
              />,
              <ShareButton key="share" mask={editingMask} />,
              <IconButton
                key="close"
                icon={<CloseIcon />}
                bordered
                text={"Gem og luk"}
                onClick={closeMaskModal}
              />,
            ]}
          >
            <MaskConfig
              mask={editingMask}
              updateMask={(updater) =>
                maskStore.updateMask(editingMaskId!, updater)
              }
              readonly={editingMask.builtin}
            />
          </Modal>
        </div>
      )}
    </ErrorBoundary>
  );
}
