const MODULE_ID = "pf1e-party-folder";
const PARTY_FLAG = "isParty";
const PARTY_FOLDER_FLAG = "isPartyFolder";
const STASH_TRANSFER_FLAG = "stashTransfer";
const METAGAME_FLAG = "metagame";
const MEMBERS_FLAG = "members";
const STASH_FLAG = "stash";
const ACTIVITIES_FLAG = "activities";
const PUBLIC_SNAPSHOT_FLAG = "publicSnapshot";
const HERO_POINTS_FLAG = "heroPoints";
const SHEET_ID = `${MODULE_ID}.PF1PartyActorSheet`;
const PARTY_ICON = `modules/${MODULE_ID}/assets/party-hood.svg`;
const HERO_POINT_ICON = `modules/${MODULE_ID}/assets/pf2e-sheet/heads.webp`;
const HERO_POINTS_MAX = 3;
const MODULE_VERSION_LABEL = "v1.5.6";
const STASH_QUANTITY_SAVE_DELAY_MS = 120;
const HERO_POINT_SAVE_DELAY_MS = 180;
const HERO_POINT_PRE_ROLL_BONUS = 8;
const HERO_POINT_CHAT_BONUS = 4;
let publicSnapshotRefreshTimer = null;
const pendingHeroPointUpdates = new Map();
const heroPointSaveTimers = new Map();
const openStashItemSources = new Map();

const PARTY_SCROLL_SELECTORS = [
  ".window-content",
  ".pf1-party-sheet-root",
  ".pf1-party-body",
  ".pf1-party-body > .tab",
  ".pf1-party-body > .tab.active",
  ".pf1-party-body > .tab[data-tab='overview']",
  ".pf1-party-body > .tab[data-tab='exploration']",
  ".pf1-party-body > .tab[data-tab='stash']",
  ".pf1-party-stash-layout",
  ".pf1-party-stash-main",
  ".pf1-stash-inventory-list",
  ".pf1-party-exploration-main",
  ".pf1-party-overview-box"
];

const SKILL_LABELS_RU = {
  acr: "АКРОБАТИКА",
  apr: "ОЦЕНКА",
  blf: "ОБМАН",
  clm: "ЛАЗАНИЕ",
  crf: "РЕМЕСЛО",
  dev: "ВЗЛОМ",
  dip: "ДИПЛОМАТИЯ",
  dis: "МАСКИРОВКА",
  esc: "ВЫПУТЫВАНИЕ",
  fly: "ПОЛЁТ",
  han: "ДРЕССИРОВКА",
  hea: "МЕДИЦИНА",
  int: "ЗАПУГИВАНИЕ",
  kar: "ЗНАНИЕ (МАГИЯ)",
  kdu: "ЗНАНИЕ (ПОДЗЕМЕЛЬЯ)",
  ken: "ЗНАНИЕ (ИНЖЕНЕРНОЕ ДЕЛО)",
  kge: "ЗНАНИЕ (ГЕОГРАФИЯ)",
  khi: "ЗНАНИЕ (ИСТОРИЯ)",
  klo: "ЗНАНИЕ (КРАЕВЕДЕНИЕ)",
  kna: "ЗНАНИЕ (ПРИРОДА)",
  kno: "ЗНАНИЕ (ВЫСШИЙ СВЕТ)",
  kpl: "ЗНАНИЕ (ПЛАНЫ)",
  kre: "ЗНАНИЕ (РЕЛИГИЯ)",
  lin: "ЛИНГВИСТИКА",
  lor: "ЗНАНИЕ",
  per: "ВНИМАНИЕ",
  prf: "ВЫСТУПЛЕНИЕ",
  pro: "ПРОФЕССИЯ",
  rid: "ВЕРХОВАЯ ЕЗДА",
  sen: "ПРОНИЦАТЕЛЬНОСТЬ",
  slt: "ЛОВКОСТЬ РУК",
  spl: "МАГИЧЕСКОЕ ИСКУССТВО",
  ste: "СКРЫТНОСТЬ",
  sur: "ВЫЖИВАНИЕ",
  swm: "ПЛАВАНИЕ",
  umd: "ИСПОЛЬЗОВАНИЕ МАГ. УСТРОЙСТВ"
};

const KNOWLEDGE_KEYS = new Set(["kar", "kdu", "ken", "kge", "khi", "klo", "kna", "kno", "kpl", "kre"]);
const IGNORED_SENSE_MARKERS = new Set(["enabled", "disabled", "value", "custom", "selected", "true", "false", "null", "none"]);

const CURRENCY_META = {
  pp: { label: "ПМ", aliases: ["pp", "platinum"], cp: 1000, img: `modules/${MODULE_ID}/assets/platinum-pieces.webp` },
  gp: { label: "ЗМ", aliases: ["gp", "gold"], cp: 100, img: `modules/${MODULE_ID}/assets/gold-pieces.webp` },
  sp: { label: "СМ", aliases: ["sp", "silver"], cp: 10, img: `modules/${MODULE_ID}/assets/silver-pieces.webp` },
  cp: { label: "ММ", aliases: ["cp", "copper"], cp: 1, img: `modules/${MODULE_ID}/assets/copper-pieces.webp` }
};

function gprop(obj, path) {
  return foundry.utils.getProperty(obj, path);
}

function sprop(obj, path, value) {
  return foundry.utils.setProperty(obj, path, value);
}

function has(obj, path) {
  return foundry.utils.hasProperty(obj, path);
}

function deepClone(value) {
  return foundry.utils.deepClone(value);
}

function mergeObject(original, other, options = {}) {
  return foundry.utils.mergeObject(original, other, options);
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object") {
    if (value.total !== undefined) return toNumber(value.total, fallback);
    if (value.value !== undefined) return toNumber(value.value, fallback);
    if (value.base !== undefined) return toNumber(value.base, fallback);
  }
  const cleaned = String(value).replace(/,/g, ".").replace(/[^0-9.+\-]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function fmtNumber(value, decimals = 2) {
  const n = toNumber(value, 0);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

function signed(value) {
  const n = toNumber(value, 0);
  return `${n >= 0 ? "+" : ""}${n}`;
}

function clampNumber(value, min, max) {
  const n = toNumber(value, min);
  return Math.min(max, Math.max(min, n));
}


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function renderCompendiumBrowserCandidate(browser, tabNames = ["item", "items", "equipment"]) {
  if (!browser || typeof browser !== "object") return false;

  const uniqueTabs = [...new Set(tabNames.filter(Boolean))];
  for (const tab of uniqueTabs) {
    for (const method of ["renderWith", "openTab", "browse"]) {
      if (typeof browser[method] !== "function") continue;
      try {
        await browser[method](tab);
        return true;
      } catch (err) {
        console.debug(`${MODULE_ID} | Compendium browser ${method}(${tab}) failed`, err);
      }
    }
  }

  if (typeof browser.open === "function") {
    for (const tab of uniqueTabs) {
      try {
        await browser.open({ tab });
        return true;
      } catch (err) {
        console.debug(`${MODULE_ID} | Compendium browser open(${tab}) failed`, err);
      }
    }
    try {
      await browser.open();
      return true;
    } catch (err) {
      console.debug(`${MODULE_ID} | Compendium browser open() failed`, err);
    }
  }

  if (typeof browser.render === "function") {
    try {
      browser.render(true);
      if (typeof browser.activateTab === "function") {
        for (const tab of uniqueTabs) {
          try {
            browser.activateTab(tab);
            break;
          } catch (err) {
            console.debug(`${MODULE_ID} | Compendium browser activateTab(${tab}) failed`, err);
          }
        }
      }
      return true;
    } catch (err) {
      console.debug(`${MODULE_ID} | Compendium browser render() failed`, err);
    }
  }

  return false;
}

async function openNativePF1ItemBrowser(category = null) {
  const categoryTabs = {
    weapons: ["item", "items", "weapon", "weapons", "equipment"],
    armor: ["item", "items", "armor", "equipment"],
    consumables: ["item", "items", "consumable", "consumables", "equipment"],
    equipment: ["item", "items", "equipment"],
    ammo: ["item", "items", "ammunition", "ammo", "equipment"],
    misc: ["item", "items", "equipment"],
    goods: ["item", "items", "equipment"],
    containers: ["item", "items", "equipment"]
  };
  const tabNames = categoryTabs[category] ?? ["item", "items", "equipment"];
  const pf1 = game.pf1 ?? globalThis.pf1 ?? {};
  const candidates = [
    game.compendiumBrowser,
    pf1.compendiumBrowser,
    pf1.compendiumBrowser?.items,
    pf1.compendiumBrowser?.item,
    pf1.applications?.compendiumBrowser,
    pf1.applications?.compendiumBrowser?.items,
    pf1.applications?.compendiums?.items,
    pf1.applications?.compendiums?.item,
    ui.compendiumBrowser,
    ui.compendiumBrowser?.items,
    ui.compendiumBrowser?.item
  ].filter(Boolean);

  for (const browser of candidates) {
    if (await renderCompendiumBrowserCandidate(browser, tabNames)) {
      scheduleCompendiumBrowserCategoryFilters(category);
      return true;
    }
  }

  const BrowserClass = pf1.applications?.compendiumBrowser?.ItemBrowser
    ?? pf1.applications?.compendiums?.ItemBrowser
    ?? pf1.compendiumBrowser?.ItemBrowser
    ?? globalThis.ItemBrowser;
  if (typeof BrowserClass === "function") {
    try {
      const browser = new BrowserClass();
      if (await renderCompendiumBrowserCandidate(browser, tabNames)) {
        scheduleCompendiumBrowserCategoryFilters(category);
        return true;
      }
    } catch (err) {
      console.debug(`${MODULE_ID} | Could not create PF1 item browser`, err);
    }
  }

  return false;
}

function normalizeBrowserFilterText(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase(game.i18n?.lang || "ru")
    .replace(/\s+/g, " ");
}

function scheduleCompendiumBrowserCategoryFilters(category) {
  if (!category) return;
  for (const delay of [80, 250, 600]) {
    setTimeout(() => applyCompendiumBrowserCategoryFilters(category), delay);
  }
}

function getCompendiumBrowserCategoryFilters(category) {
  const filterGroups = {
    weapons: [{ section: "тип", labels: ["оружие"] }],
    armor: [
      { section: "тип", labels: ["снаряжение"] },
      { section: "тип снаряжения", labels: ["броня", "щит"] }
    ],
    consumables: [{ section: "тип", labels: ["расходник"] }],
    equipment: [
      { section: "тип", labels: ["снаряжение"] },
      { section: "тип снаряжения", labels: ["другой"] },
      { section: "разное", labels: ["снаряжение"] }
    ],
    ammo: [
      { section: "тип", labels: ["разное"] },
      { section: "разное", labels: ["боеприпасы"] }
    ],
    goods: [
      { section: "тип", labels: ["разное"] },
      { section: "разное", labels: ["товары"] }
    ],
    misc: [
      { section: "тип", labels: ["разное"] },
      { section: "разное", labels: ["разное"] }
    ],
    containers: [{ section: "тип", labels: ["container", "контейнер"] }]
  };
  return filterGroups[category] ?? [];
}

function checkboxLabelText(input) {
  const element = $(input);
  const id = element.attr("id");
  const explicit = id ? $("label").filter((_, label) => label.getAttribute("for") === id).first().text() : "";
  return normalizeBrowserFilterText(explicit || element.closest("label").text() || element.parent().text());
}

function checkboxSectionText(input) {
  const element = $(input);
  const group = element.closest("fieldset, .filter, .filter-group, .filter-container, .form-group, section, div");
  const headings = group
    .find("legend, h1, h2, h3, h4, summary, button, .filter-title, .filter-header, .filter-label")
    .map((_, el) => normalizeBrowserFilterText(el.textContent))
    .get()
    .filter(Boolean);
  return headings.join(" ");
}

function applyCompendiumBrowserCategoryFilters(category) {
  const filters = getCompendiumBrowserCategoryFilters(category);
  if (!filters.length) return;
  const windows = $(".window-app").filter((_, element) => {
    const title = normalizeBrowserFilterText($(element).find(".window-title").first().text());
    const text = normalizeBrowserFilterText($(element).text());
    return title.includes("compendium browser") || title.includes("предмет") || text.includes("filtered items");
  });
  const labelsToManage = new Set([
    "оружие", "снаряжение", "расходник", "container", "контейнер", "разное",
    "броня", "щит", "волшебная вещица", "одежда", "другой", "боеприпасы", "товары"
  ]);

  for (const windowElement of windows) {
    const root = $(windowElement);
    const checkboxes = root.find('input[type="checkbox"]');
    let changed = false;
    checkboxes.each((_, input) => {
      const label = checkboxLabelText(input);
      if (!label || !labelsToManage.has(label)) return;
      const section = checkboxSectionText(input);
      const shouldCheck = filters.some(filter => {
        const labelMatches = filter.labels.some(candidate => label === normalizeBrowserFilterText(candidate));
        const sectionMatches = !filter.section || section.includes(normalizeBrowserFilterText(filter.section));
        return labelMatches && sectionMatches;
      });
      if (input.checked !== shouldCheck) {
        input.checked = shouldCheck;
        input.dispatchEvent(new Event("change", { bubbles: true }));
        changed = true;
      }
    });
    if (changed) {
      const update = root.find("button").filter((_, el) => /обновить|update/i.test(el.textContent)).first();
      update.trigger("click");
    }
  }
}

function formatSkillLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const locale = game.i18n?.lang || "ru";
  const lower = raw.toLocaleLowerCase(locale);
  return lower.charAt(0).toLocaleUpperCase(locale) + lower.slice(1);
}

function normalizeDedupeKey(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase(game.i18n?.lang || "ru")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function localizeConfigValue(config, key) {
  if (!key) return "";
  if (config && Object.prototype.hasOwnProperty.call(config, key)) return game.i18n.localize(config[key]);
  return String(key);
}

function parseTextList(value, depth = 0) {
  if (!value || depth > 4) return [];
  if (Array.isArray(value)) return value.flatMap(v => parseTextList(v, depth + 1));
  if (typeof value === "object") {
    const result = [];
    if (value.value !== undefined) result.push(...parseTextList(value.value, depth + 1));
    if (value.custom !== undefined) result.push(...parseTextList(value.custom, depth + 1));
    if (value.selected && typeof value.selected === "object") {
      for (const [key, selected] of Object.entries(value.selected)) if (selected) result.push(key);
    }
    for (const [key, entry] of Object.entries(value)) {
      if (["value", "custom", "selected"].includes(key)) continue;
      if (entry === true) result.push(key);
      else if (typeof entry === "string" || Array.isArray(entry)) result.push(...parseTextList(entry, depth + 1));
      else if (entry && typeof entry === "object" && depth < 2) result.push(...parseTextList(entry, depth + 1));
    }
    return result.map(v => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,;\n]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

function collectStringLeaves(value, depth = 0) {
  if (!value || depth > 5) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(v => collectStringLeaves(v, depth + 1));
  if (typeof value === "object") return Object.values(value).flatMap(v => collectStringLeaves(v, depth + 1));
  return [];
}

function getPartyActor() {
  return game.actors?.find(a => a.getFlag(MODULE_ID, PARTY_FLAG)) ?? null;
}

function getPartyFolder() {
  return game.folders?.find(f => f.type === "Actor" && f.getFlag(MODULE_ID, PARTY_FOLDER_FLAG)) ?? null;
}

async function ensurePartyFolder(name = null) {
  let folder = getPartyFolder();
  const folderName = name || game.settings.get(MODULE_ID, "partyName") || "The Party";
  if (folder) {
    if (game.user.isGM && folder.name !== folderName) await folder.update({ name: folderName });
    return folder;
  }
  if (!game.user.isGM) return null;
  return Folder.create({
    name: folderName,
    type: "Actor",
    color: "#7a0000",
    flags: { [MODULE_ID]: { [PARTY_FOLDER_FLAG]: true } }
  });
}

async function ensurePartyActor({ notify = true } = {}) {
  const partyName = game.settings.get(MODULE_ID, "partyName") || "The Party";
  const folder = await ensurePartyFolder(partyName);
  let actor = getPartyActor();
  if (actor) {
    const updates = {};
    if (actor.getFlag("core", "sheetClass") !== SHEET_ID) updates[`flags.core.sheetClass`] = SHEET_ID;
    if (!actor.img || actor.img === "icons/svg/mystery-man.svg") updates.img = PARTY_ICON;
    if (actor.folder) updates.folder = null;
    if (Object.keys(updates).length && actor.isOwner) await actor.update(updates);
    return actor;
  }

  if (!game.user.isGM) {
    if (notify) ui.notifications.warn("Папка партии ещё не создана. Её должен создать ГМ.");
    return null;
  }

  const ownershipLevel = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  actor = await Actor.create({
    name: partyName,
    type: "character",
    folder: null,
    img: PARTY_ICON,
    ownership: { default: ownershipLevel },
    prototypeToken: {
      name: partyName,
      texture: { src: PARTY_ICON },
      actorLink: true,
      disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
      displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
    },
    flags: {
      core: { sheetClass: SHEET_ID },
      [MODULE_ID]: {
        [PARTY_FLAG]: true,
        [MEMBERS_FLAG]: [],
        [ACTIVITIES_FLAG]: {},
        [HERO_POINTS_FLAG]: {},
        [STASH_FLAG]: defaultStash()
      }
    }
  });
  if (notify) ui.notifications.info("Папка партии создана.");
  return actor;
}

function defaultStash() {
  return {
    currency: { pp: 0, gp: 0, sp: 0, cp: 0 },
    items: []
  };
}

function getStash(actor) {
  const stash = actor?.getFlag(MODULE_ID, STASH_FLAG) ?? defaultStash();
  return mergeObject(defaultStash(), deepClone(stash), { inplace: false });
}

async function setStash(actor, stash) {
  await actor.setFlag(MODULE_ID, STASH_FLAG, stash);
}

function isMemberCandidate(actor) {
  return actor && actor.type === "character" && !actor.getFlag(MODULE_ID, PARTY_FLAG);
}

function getPartyMembers(partyActor, { ignorePermissions = false } = {}) {
  const ids = new Set(partyActor?.getFlag(MODULE_ID, MEMBERS_FLAG) ?? []);
  const folder = getPartyFolder();
  if (folder) {
    for (const actor of game.actors ?? []) {
      if (actor.folder?.id === folder.id && isMemberCandidate(actor)) ids.add(actor.id);
    }
  }

  if (game.settings.get(MODULE_ID, "autoUserCharacters")) {
    for (const user of game.users ?? []) {
      if (user.isGM) continue;
      const actor = user.character;
      if (isMemberCandidate(actor)) ids.add(actor.id);
    }
  }

  if (game.user.isGM && game.settings.get(MODULE_ID, "autoOwnedCharacters")) {
    for (const actor of game.actors ?? []) {
      if (!isMemberCandidate(actor)) continue;
      const ownedByPlayer = game.users.some(user => !user.isGM && actor.testUserPermission(user, "OWNER"));
      if (ownedByPlayer) ids.add(actor.id);
    }
  }

  return [...ids]
    .map(id => game.actors.get(id))
    .filter(actor => isMemberCandidate(actor) && (ignorePermissions || actor.testUserPermission(game.user, "OBSERVER")));
}

async function addMember(partyActor, actorId) {
  const actor = game.actors.get(actorId);
  if (!isMemberCandidate(actor)) return ui.notifications.warn("В партию можно добавить только персонажа.");
  const ids = new Set(partyActor.getFlag(MODULE_ID, MEMBERS_FLAG) ?? []);
  ids.add(actor.id);
  await partyActor.setFlag(MODULE_ID, MEMBERS_FLAG, [...ids]);
  const folder = await ensurePartyFolder(partyActor.name);
  if (folder && game.user.isGM && actor.folder?.id !== folder.id) await actor.update({ folder: folder.id });
  ui.notifications.info(`${actor.name} добавлен(а) в партию.`);
}

async function removeMember(partyActor, actorId) {
  const ids = new Set(partyActor.getFlag(MODULE_ID, MEMBERS_FLAG) ?? []);
  ids.delete(actorId);
  await partyActor.setFlag(MODULE_ID, MEMBERS_FLAG, [...ids]);
  const actor = game.actors.get(actorId);
  const folder = getPartyFolder();
  if (actor && folder && game.user.isGM && actor.folder?.id === folder.id) await actor.update({ folder: null });
}

function getStoredHeroPoints(partyActor) {
  return deepClone(partyActor?.getFlag(MODULE_ID, HERO_POINTS_FLAG) ?? {});
}

function getHeroPoints(partyActor) {
  const stored = getStoredHeroPoints(partyActor);
  const pending = partyActor?.id ? pendingHeroPointUpdates.get(partyActor.id) : null;
  return pending ? mergeObject(stored, pending, { inplace: false }) : stored;
}

function getHeroPointValue(heroPoints, actorId) {
  return Math.floor(clampNumber(heroPoints?.[actorId], 0, HERO_POINTS_MAX));
}

function getHeroPointState(heroPoints, actorId) {
  const value = getHeroPointValue(heroPoints, actorId);
  return {
    value,
    max: HERO_POINTS_MAX,
    icon: HERO_POINT_ICON,
    pips: Array.from({ length: HERO_POINTS_MAX }, (_, index) => ({
      index: index + 1,
      filled: index < value
    }))
  };
}

async function setActorHeroPoints(partyActor, actorId, value) {
  if (!partyActor || !actorId) return false;
  if (!partyActor.testUserPermission(game.user, "OWNER")) {
    ui.notifications.warn("Недостаточно прав для изменения геройских очков партии.");
    return false;
  }
  const heroPoints = getHeroPoints(partyActor);
  const next = Math.floor(clampNumber(value, 0, HERO_POINTS_MAX));
  if (getHeroPointValue(heroPoints, actorId) === next) {
    refreshHeroPointControls(actorId);
    return true;
  }
  const pending = mergeObject(pendingHeroPointUpdates.get(partyActor.id) ?? {}, { [actorId]: next }, { inplace: false });
  pendingHeroPointUpdates.set(partyActor.id, pending);
  refreshHeroPointControls(actorId);
  scheduleHeroPointSave(partyActor);
  return true;
}

function scheduleHeroPointSave(partyActor) {
  if (!partyActor?.id) return;
  const currentTimer = heroPointSaveTimers.get(partyActor.id);
  if (currentTimer) clearTimeout(currentTimer);
  const partyId = partyActor.id;
  heroPointSaveTimers.set(partyId, setTimeout(() => {
    heroPointSaveTimers.delete(partyId);
    const party = game.actors.get(partyId);
    flushHeroPointSave(party).catch(err => console.warn(`${MODULE_ID} | Hero point save failed`, err));
  }, HERO_POINT_SAVE_DELAY_MS));
}

async function flushHeroPointSave(partyActor) {
  if (!partyActor?.id || !partyActor.testUserPermission(game.user, "OWNER")) return;
  const pending = pendingHeroPointUpdates.get(partyActor.id);
  if (!pending) return;
  const nextHeroPoints = mergeObject(getStoredHeroPoints(partyActor), pending, { inplace: false });
  const scrollSnapshots = captureOpenPartySheetScrolls();
  await partyActor.update({ [`flags.${MODULE_ID}.${HERO_POINTS_FLAG}`]: nextHeroPoints }, { render: false, diff: true });
  if (pendingHeroPointUpdates.get(partyActor.id) === pending) pendingHeroPointUpdates.delete(partyActor.id);
  else scheduleHeroPointSave(partyActor);
  schedulePublicPartySnapshotRefresh(partyActor);
  restoreOpenPartySheetScrolls(scrollSnapshots);
}

async function changeActorHeroPoints(partyActor, actorId, delta) {
  const heroPoints = getHeroPoints(partyActor);
  return setActorHeroPoints(partyActor, actorId, getHeroPointValue(heroPoints, actorId) + toNumber(delta, 0));
}

async function spendHeroPoint(partyActor, actorId) {
  const heroPoints = getHeroPoints(partyActor);
  const current = getHeroPointValue(heroPoints, actorId);
  if (current <= 0) {
    const actorName = game.actors.get(actorId)?.name || "персонажа";
    ui.notifications.warn(`У ${actorName} нет геройских очков.`);
    return false;
  }
  return setActorHeroPoints(partyActor, actorId, current - 1);
}

function heroPointPipsHTML(state) {
  return state.pips.map(pip => pip.filled
    ? `<img class="pf1-hero-point-pip is-filled" data-index="${pip.index}" src="${escapeHTML(state.icon)}" alt="">`
    : `<span class="pf1-hero-point-pip is-empty" data-index="${pip.index}"></span>`
  ).join("");
}

function heroPointControlHTML(actorId, state, { className = "" } = {}) {
  return `<a class="pf1-hero-points ${className}" data-action="adjust-hero-points" data-actor-id="${escapeHTML(actorId)}" title="Геройские очки: ${state.value} / ${state.max}. ЛКМ +1, ПКМ −1.">
    ${heroPointPipsHTML(state)}
  </a>`;
}

function refreshHeroPointControls(actorId) {
  const party = getPartyActor();
  if (!party || !actorId) return;
  const state = getHeroPointState(getHeroPoints(party), actorId);
  $(`.pf1-hero-points[data-actor-id="${actorId}"]`).each((_, element) => {
    const control = $(element);
    control.attr("title", `Геройские очки: ${state.value} / ${state.max}. ЛКМ +1, ПКМ −1.`);
    updateHeroPointControlElement(element, state);
  });
}

function updateHeroPointControlElement(element, state) {
  const children = Array.from(element?.children ?? []);
  if (children.length !== state.max) {
    $(element).html(heroPointPipsHTML(state));
    return;
  }
  for (const pip of state.pips) {
    const child = children[pip.index - 1];
    if (!child) continue;
    const isFilled = child.tagName === "IMG";
    if (isFilled === pip.filled) {
      child.classList.toggle("is-filled", pip.filled);
      child.classList.toggle("is-empty", !pip.filled);
      child.classList.add("pf1-hero-point-pip");
      child.dataset.index = String(pip.index);
      if (pip.filled && child.getAttribute("src") !== state.icon) child.setAttribute("src", state.icon);
      continue;
    }
    const next = document.createElement(pip.filled ? "img" : "span");
    next.className = `pf1-hero-point-pip ${pip.filled ? "is-filled" : "is-empty"}`;
    next.dataset.index = String(pip.index);
    if (pip.filled) {
      next.setAttribute("src", state.icon);
      next.setAttribute("alt", "");
    }
    child.replaceWith(next);
  }
}

function capturePartySheetScroll(app) {
  const element = app?.element;
  const body = element?.find?.(".pf1-party-body")[0];
  const activeTab = element?.find?.(".pf1-party-body > .tab.active")[0];
  const content = element?.find?.(".window-content")[0];
  if (!body && !activeTab && !content) return null;
  const scrollContainers = PARTY_SCROLL_SELECTORS.map(selector => {
    const node = element?.find?.(selector)[0];
    if (!node) return null;
    return {
      selector,
      top: node.scrollTop ?? 0,
      left: node.scrollLeft ?? 0
    };
  }).filter(Boolean);
  return {
    bodyTop: body?.scrollTop ?? 0,
    bodyLeft: body?.scrollLeft ?? 0,
    activeTabTop: activeTab?.scrollTop ?? 0,
    activeTabLeft: activeTab?.scrollLeft ?? 0,
    contentTop: content?.scrollTop ?? 0,
    contentLeft: content?.scrollLeft ?? 0,
    scrollContainers,
    windowTop: globalThis.window?.scrollY ?? 0,
    windowLeft: globalThis.window?.scrollX ?? 0
  };
}

function restorePartySheetScroll(app, position) {
  if (!position) return;
  const restore = () => {
    const element = app?.element;
    const body = element?.find?.(".pf1-party-body")[0];
    const activeTab = element?.find?.(".pf1-party-body > .tab.active")[0];
    const content = element?.find?.(".window-content")[0];
    if (body) {
      body.scrollTop = position.bodyTop ?? position.top ?? 0;
      body.scrollLeft = position.bodyLeft ?? position.left ?? 0;
    }
    if (activeTab) {
      activeTab.scrollTop = position.activeTabTop ?? 0;
      activeTab.scrollLeft = position.activeTabLeft ?? 0;
    }
    if (content) {
      content.scrollTop = position.contentTop ?? 0;
      content.scrollLeft = position.contentLeft ?? 0;
    }
    for (const saved of position.scrollContainers ?? []) {
      const node = element?.find?.(saved.selector)[0];
      if (!node) continue;
      node.scrollTop = saved.top ?? 0;
      node.scrollLeft = saved.left ?? 0;
    }
    globalThis.window?.scrollTo?.(position.windowLeft ?? 0, position.windowTop ?? 0);
  };
  restore();
  globalThis.requestAnimationFrame?.(restore);
  setTimeout(restore, 0);
}

function getPartySheetScrollLock(app) {
  const lock = app?._pf1PartyScrollLock;
  if (!lock) return null;
  if (Date.now() > lock.until) {
    delete app._pf1PartyScrollLock;
    return null;
  }
  return lock.position;
}

function captureOpenPartySheetScrolls() {
  return Object.values(ui.windows ?? {})
    .map(app => ({ app, position: capturePartySheetScroll(app) }))
    .filter(snapshot => snapshot.position);
}

function restoreOpenPartySheetScrolls(snapshots) {
  for (const snapshot of snapshots ?? []) {
    restorePartySheetScroll(snapshot.app, snapshot.position);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 50);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 150);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 300);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 650);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 1000);
  }
}

function restoreOpenPartySheetScrollsBriefly(snapshots) {
  for (const snapshot of snapshots ?? []) {
    restorePartySheetScroll(snapshot.app, snapshot.position);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 50);
    setTimeout(() => restorePartySheetScroll(snapshot.app, snapshot.position), 125);
  }
}

function lockOpenPartySheetScrolls(snapshots, durationMs = 3500) {
  if (!snapshots?.length) return;
  const until = Date.now() + durationMs;
  for (const snapshot of snapshots) {
    if (snapshot.app && snapshot.position) snapshot.app._pf1PartyScrollLock = { position: snapshot.position, until };
  }
  restoreOpenPartySheetScrolls(snapshots);
  const started = Date.now();
  const timer = setInterval(() => {
    restoreOpenPartySheetScrolls(snapshots);
    if (Date.now() - started >= durationMs) clearInterval(timer);
  }, 75);
}

function renderPartySheetPreservingScroll(app) {
  const position = getPartySheetScrollLock(app) ?? capturePartySheetScroll(app);
  app.render(false);
  restorePartySheetScroll(app, position);
  setTimeout(() => restorePartySheetScroll(app, position), 100);
  setTimeout(() => restorePartySheetScroll(app, position), 300);
  setTimeout(() => restorePartySheetScroll(app, position), 650);
}

function getHp(actor) {
  const value = firstNumber(actor, [
    "system.attributes.hp.value",
    "system.attributes.hp.current",
    "system.hp.value",
    "data.data.attributes.hp.value",
    "data.data.attributes.hp.current"
  ], 0);
  const max = firstNumber(actor, [
    "system.attributes.hp.max",
    "system.attributes.hp.total",
    "system.hp.max",
    "data.data.attributes.hp.max",
    "data.data.attributes.hp.total"
  ], value);
  const width = max > 0 ? `${clampNumber((value / max) * 100, 0, 100)}%` : "0%";
  return { value, max, width };
}

function firstNumber(actor, paths, fallback = 0) {
  for (const path of paths) {
    const value = gprop(actor, path);
    if (value !== undefined && value !== null && value !== "") return toNumber(value, fallback);
  }
  return fallback;
}

function getAc(actor) {
  return firstNumber(actor, [
    "system.attributes.ac.normal.total",
    "system.attributes.ac.value",
    "system.attributes.ac.total",
    "data.data.attributes.ac.normal.total",
    "data.data.attributes.ac.value"
  ], 10);
}

function getSaves(actor) {
  return {
    fort: firstNumber(actor, [
      "system.attributes.savingThrows.fort.total",
      "system.attributes.savingThrows.fort.value",
      "system.attributes.saves.fort.total",
      "system.saves.fort.total",
      "data.data.attributes.savingThrows.fort.total"
    ], 0),
    ref: firstNumber(actor, [
      "system.attributes.savingThrows.ref.total",
      "system.attributes.savingThrows.ref.value",
      "system.attributes.saves.ref.total",
      "system.saves.ref.total",
      "data.data.attributes.savingThrows.ref.total"
    ], 0),
    will: firstNumber(actor, [
      "system.attributes.savingThrows.will.total",
      "system.attributes.savingThrows.will.value",
      "system.attributes.saves.will.total",
      "system.saves.will.total",
      "data.data.attributes.savingThrows.will.total"
    ], 0)
  };
}

function getSpeed(actor) {
  const speed = firstNumber(actor, [
    "system.attributes.speed.land.total",
    "system.attributes.speed.land.base",
    "system.attributes.speed.base",
    "system.attributes.speed.value",
    "data.data.attributes.speed.land.total",
    "data.data.attributes.speed.land.base",
    "data.data.attributes.speed.value"
  ], 30);
  return speed || 0;
}

function isEnabledFlag(value) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined || value === "") return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return !["false", "0", "disabled", "none", "null", "no", "off"].includes(normalized);
  }
  if (Array.isArray(value)) return value.some(isEnabledFlag);
  if (typeof value === "object") {
    for (const key of ["enabled", "active", "value", "selected"]) {
      if (value[key] !== undefined) return isEnabledFlag(value[key]);
    }
    return Object.values(value).some(isEnabledFlag);
  }
  return Boolean(value);
}

function getSenses(actor) {
  const raw = [
    gprop(actor, "system.traits.senses"),
    gprop(actor, "system.attributes.senses"),
    gprop(actor, "data.data.traits.senses"),
    gprop(actor, "data.data.attributes.senses")
  ].find(v => v !== undefined && v !== null && v !== "");

  const senses = new Set();
  for (const item of parseTextList(raw)) {
    const label = localizeSense(item);
    if (label) senses.add(label);
  }

  const darkvision = firstNumber(actor, [
    "system.traits.senses.dv",
    "system.attributes.senses.darkvision",
    "system.attributes.senses.darkvision.range",
    "data.data.traits.senses.dv"
  ], 0);
  if (darkvision) senses.add(`Тёмное зрение ${darkvision} фт`);

  const lowLight = [
    gprop(actor, "system.traits.senses.ll"),
    gprop(actor, "system.attributes.senses.lowLight"),
    gprop(actor, "system.attributes.senses.lowLightVision"),
    gprop(actor, "data.data.traits.senses.ll")
  ].some(isEnabledFlag);
  if (lowLight) senses.add("Сумеречное зрение");

  return senses.size ? [...senses].join(", ") : "Без особых чувств";
}

function localizeSense(value) {
  const key = String(value || "").trim();
  if (!key) return "";
  const lower = key.toLowerCase();
  if (IGNORED_SENSE_MARKERS.has(lower)) return "";
  if (["ll", "low-light", "low light", "low-light vision", "сумеречное зрение"].includes(lower)) return "Сумеречное зрение";
  if (["dv", "darkvision", "dark vision", "тёмное зрение", "темное зрение"].includes(lower)) return "Тёмное зрение";
  return key;
}

function addLanguageToMap(map, raw, langConfig) {
  const localized = localizeConfigValue(langConfig, raw);
  const label = String(localized || raw || "").trim();
  if (!label) return;
  const key = normalizeDedupeKey(label);
  if (!map.has(key)) map.set(key, label);
}

function findLanguageLikeValues(obj, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 5) return [];
  const result = [];
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = String(key).toLowerCase();
    const isLanguageKey = lowerKey.includes("language") || lowerKey.includes("languages") || lowerKey === "lang" || lowerKey === "langs";
    if (isLanguageKey) result.push(...parseTextList(value));
    if (value && typeof value === "object") result.push(...findLanguageLikeValues(value, depth + 1));
  }
  return result;
}

function getItemGrantedLanguages(item) {
  const data = item.toObject ? item.toObject() : item;
  const type = String(data.type || "").toLowerCase();
  const name = String(data.name || "").toLowerCase();
  const isRaceLike = type === "race" || type === "racial" || name.includes("народ") || name.includes("race") || name.includes("подтип") || name.includes("catfolk");
  if (!isRaceLike) return [];
  const rawValues = [
    gprop(data, "system.languages"),
    gprop(data, "system.languages.value"),
    gprop(data, "system.languages.custom"),
    gprop(data, "system.traits.languages"),
    gprop(data, "system.traits.languages.value"),
    gprop(data, "system.traits.languages.custom"),
    gprop(data, "system.details.languages"),
    gprop(data, "system.details.languages.value"),
    gprop(data, "system.details.languages.custom"),
    gprop(data, "system.granted.languages"),
    gprop(data, "system.granted.languages.value"),
    gprop(data, "system.proficiencies.languages"),
    gprop(data, "system.proficiencies.languages.value"),
    gprop(data, "data.data.languages"),
    gprop(data, "data.data.languages.value"),
    gprop(data, "data.data.languages.custom"),
    gprop(data, "data.data.traits.languages"),
    gprop(data, "data.data.traits.languages.value"),
    gprop(data, "data.data.traits.languages.custom"),
    gprop(data, "data.data.details.languages"),
    gprop(data, "data.data.details.languages.value"),
    gprop(data, "data.data.details.languages.custom"),
    gprop(data, "data.data.granted.languages"),
    gprop(data, "data.data.granted.languages.value"),
    gprop(data, "data.data.proficiencies.languages"),
    gprop(data, "data.data.proficiencies.languages.value")
  ];
  return [...rawValues.flatMap(parseTextList), ...findLanguageLikeValues(data.system), ...findLanguageLikeValues(gprop(data, "data.data"))];
}

function getLanguages(actor) {
  const langConfig = CONFIG.PF1?.languages ?? CONFIG.PF1?.creatureLanguages ?? {};
  const rawValues = [
    gprop(actor, "system.traits.languages"),
    gprop(actor, "system.traits.languages.value"),
    gprop(actor, "system.traits.languages.custom"),
    gprop(actor, "system.details.languages"),
    gprop(actor, "system.details.languages.value"),
    gprop(actor, "system.details.languages.custom"),
    gprop(actor, "data.data.traits.languages"),
    gprop(actor, "data.data.traits.languages.value"),
    gprop(actor, "data.data.traits.languages.custom"),
    gprop(actor, "data.data.details.languages"),
    gprop(actor, "data.data.details.languages.value"),
    gprop(actor, "data.data.details.languages.custom"),
    gprop(actor, "system.customLanguages"),
    gprop(actor, "system.traits.customLanguages"),
    gprop(actor, "system.details.customLanguages"),
    gprop(actor, "data.data.customLanguages"),
    gprop(actor, "data.data.traits.customLanguages"),
    gprop(actor, "data.data.details.customLanguages")
  ];

  const languages = new Map();
  for (const raw of rawValues) for (const item of parseTextList(raw)) addLanguageToMap(languages, item, langConfig);
  for (const item of actor.items ?? []) for (const lang of getItemGrantedLanguages(item)) addLanguageToMap(languages, lang, langConfig);

  return [...languages.values()].sort((a, b) => a.localeCompare(b, game.i18n.lang));
}

function collectSkills(actor) {
  const skills = gprop(actor, "system.skills") ?? gprop(actor, "data.data.skills") ?? {};
  const result = [];

  const addSkill = (id, skill, parentLabel = "") => {
    if (!skill || typeof skill !== "object") return;
    const mod = getSkillBonusFromObject(skill);
    const ranks = getSkillRanksFromObject(skill);
    const baseLabel = getSkillLabel(id, skill);
    const label = parentLabel && !baseLabel.includes(parentLabel) ? `${parentLabel}: ${baseLabel}` : baseLabel;
    if (Number.isFinite(mod)) {
      result.push({ id, label: formatSkillLabel(label), bonus: mod, ranks, actorId: actor.id, actorName: actor.name });
    }

    const subSkills = skill.subSkills || skill.subskills || skill.children;
    if (subSkills && typeof subSkills === "object") {
      for (const [subId, subSkill] of Object.entries(subSkills)) addSkill(`${id}.${subId}`, subSkill, baseLabel);
    }
  };

  for (const [id, skill] of Object.entries(skills)) {
    if (id.startsWith("_")) continue;
    addSkill(id, skill);
  }

  return result;
}

function getSkillBonus(actor, skillId) {
  if (!skillId) return 0;
  const skills = collectSkills(actor);
  const direct = skills.find(s => s.id === skillId);
  if (direct) return direct.bonus;
  const fallback = gprop(actor, `system.skills.${skillId}.mod`) ?? gprop(actor, `data.data.skills.${skillId}.mod`);
  return toNumber(fallback, 0);
}

function getSkillBonusFromObject(skill) {
  for (const path of ["mod", "total", "value", "bonus", "base", "rollBonus"]) {
    const value = gprop(skill, path);
    if (value !== undefined && value !== null && value !== "") return toNumber(value, 0);
  }
  return 0;
}

function getSkillRanksFromObject(skill) {
  for (const path of ["rank", "ranks", "points", "point", "rt", "baseRank", "baseRanks", "data.rank", "data.ranks"]) {
    const value = gprop(skill, path);
    if (value !== undefined && value !== null && value !== "") return Math.max(0, toNumber(value, 0));
  }
  return 0;
}

function getSkillLabel(id, skill) {
  const baseId = String(id || "").split(".")[0];
  if (baseId === "per") return "Внимание";
  const configSkills = CONFIG.PF1?.skills ?? {};
  const fromConfig = localizeConfigValue(configSkills, baseId);
  const label = skill.label || skill.name || skill.displayName || (fromConfig !== baseId ? fromConfig : null) || SKILL_LABELS_RU[baseId] || baseId;
  return label;
}

function buildPartySkillSummaries(members) {
  const byId = new Map();
  for (const actor of members) {
    for (const skill of collectSkills(actor)) {
      const existing = byId.get(skill.id);
      const entry = existing ?? {
          id: skill.id,
          label: skill.label,
          best: -Infinity,
          bestActorId: actor.id,
          bestActorName: actor.name,
          invested: false,
          members: []
        };
      entry.members.push({
        actorId: actor.id,
        actorName: actor.name,
        bonus: skill.bonus,
        ranks: skill.ranks
      });
      entry.invested = entry.invested || skill.ranks > 0;
      if (skill.bonus > entry.best) {
        entry.best = skill.bonus;
        entry.bestActorId = actor.id;
        entry.bestActorName = actor.name;
      }
      byId.set(skill.id, entry);
    }
  }
  return [...byId.values()]
    .map(entry => {
      const membersList = entry.members
        .sort((a, b) => b.bonus - a.bonus || a.actorName.localeCompare(b.actorName, game.i18n.lang));
      const tooltipHtml = `<div class="pf1-party-skill-tooltip">${membersList.map(member => `
        <div><span>${escapeHTML(member.actorName)}:</span><b>${signed(member.bonus)}</b></div>`
      ).join("")}</div>`;
      return {
        ...entry,
        tooltip: membersList.map(member => `${member.actorName}: ${signed(member.bonus)}`).join("\n"),
        tooltipHtml
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

function isKnowledgeSkill(skill) {
  const id = String(skill.id).split(".")[0];
  if (id === "lor" || id === "lin") return false;
  const label = String(skill.label || "").toLocaleLowerCase(game.i18n?.lang || "ru");
  return KNOWLEDGE_KEYS.has(id) || label.startsWith("знание (") || label.startsWith("knowledge (");
}

function isPartyOverviewSkill(skill) {
  return !isKnowledgeSkill(skill);
}

function normalizedSkillText(skill) {
  return normalizeDedupeKey(`${skill?.id || ""} ${skill?.label || ""}`);
}

function skillToneClass(skill) {
  const best = toNumber(skill?.best, 0);
  if (best > 30) return "is-legendary-burgundy";
  if (best > 20) return "is-legendary-gold";
  if (best > 10) return "is-master-purple";
  if (best > 0) return "is-trained-blue";
  if (best < 0) return "is-negative-red";
  return "is-zero-gray";
}

function withSkillTone(skill) {
  return { ...skill, toneClass: skillToneClass(skill) };
}

function isBackgroundPartySkill(skill) {
  const text = normalizedSkillText(skill);
  return [
    "art", "artistry", "артистизм",
    "han", "handle animal", "дрессировка",
    "prf", "perform", "исполнение",
    "slt", "sleight", "ловкость рук",
    "apr", "appraise", "оценка",
    "lor", "lore", "предания",
    "pro", "profession", "профессия",
    "crf", "craft", "ремесло",
    "lin", "linguistics", "языкознание"
  ].some(term => text.includes(normalizeDedupeKey(term)));
}

function isBackgroundKnowledgeSkill(skill) {
  const id = String(skill?.id || "").split(".")[0];
  const text = normalizedSkillText(skill);
  return ["kno", "kge", "ken", "khi"].includes(id)
    || text.includes("высший свет")
    || text.includes("география")
    || text.includes("инженерное дело")
    || text.includes("история")
    || text.includes("nobility")
    || text.includes("geography")
    || text.includes("engineering")
    || text.includes("history");
}

function buildSkillGroups(skills, backgroundPredicate) {
  const groups = [
    { id: "adventure", label: "Приключенческие", items: [] },
    { id: "background", label: "Фоновые", items: [] }
  ];
  for (const skill of skills.map(withSkillTone)) {
    groups[backgroundPredicate(skill) ? 1 : 0].items.push(skill);
  }
  return groups.filter(group => group.items.length);
}

function readActorCurrency(actor, category = "currency") {
  const currency = gprop(actor, `system.${category}`) ?? gprop(actor, `data.data.${category}`) ?? {};
  const result = { pp: 0, gp: 0, sp: 0, cp: 0 };
  for (const [coin, meta] of Object.entries(CURRENCY_META)) {
    for (const alias of meta.aliases) {
      if (currency[alias] !== undefined) {
        result[coin] = toNumber(currency[alias], 0);
        break;
      }
    }
  }
  return result;
}

function getWeightedCurrency(actor) {
  return readActorCurrency(actor, "currency");
}

function getWeightlessCurrency(actor) {
  return readActorCurrency(actor, "altCurrency");
}

function getCurrency(actor) {
  return addCurrencyObjects(getWeightedCurrency(actor), getWeightlessCurrency(actor));
}

function getCurrencyUpdateData(actor, newCurrency) {
  const currency = gprop(actor, "system.currency") ?? gprop(actor, "data.data.currency") ?? {};
  const root = gprop(actor, "system.currency") !== undefined ? "system.currency" : "data.data.currency";
  const updates = {};
  for (const [coin, meta] of Object.entries(CURRENCY_META)) {
    const existingAlias = meta.aliases.find(alias => currency[alias] !== undefined) ?? coin;
    updates[`${root}.${existingAlias}`] = newCurrency[coin] ?? 0;
  }
  return updates;
}

async function addCurrencyToActor(actor, addition) {
  const current = getWeightedCurrency(actor);
  const updated = {
    pp: current.pp + (addition.pp || 0),
    gp: current.gp + (addition.gp || 0),
    sp: current.sp + (addition.sp || 0),
    cp: current.cp + (addition.cp || 0)
  };
  await actor.update(getCurrencyUpdateData(actor, updated));
}

function currencyToCp(currency) {
  return Object.entries(CURRENCY_META).reduce((sum, [coin, meta]) => sum + toNumber(currency?.[coin], 0) * meta.cp, 0);
}

function cpToCurrency(cp) {
  let rest = Math.max(0, Math.floor(toNumber(cp, 0)));
  const pp = Math.floor(rest / 1000); rest %= 1000;
  const gp = Math.floor(rest / 100); rest %= 100;
  const sp = Math.floor(rest / 10); rest %= 10;
  return { pp, gp, sp, cp: rest };
}

function currencyToGp(currency) {
  return currencyToCp(currency) / 100;
}

function getItemQuantity(itemData) {
  const legacyQuantity = isDocumentLike(itemData) ? undefined : gprop(itemData, "data.data.quantity");
  return Math.max(0, toNumber(gprop(itemData, "system.quantity") ?? gprop(itemData, "system.qty") ?? legacyQuantity ?? 1, 1));
}

function setItemQuantity(itemData, quantity) {
  const value = Math.max(0, Math.floor(toNumber(quantity, 1)));
  if (has(itemData, "system.quantity") || isDocumentLike(itemData) || !has(itemData, "data.data.quantity")) sprop(itemData, "system.quantity", value);
  else sprop(itemData, "data.data.quantity", value);
  return itemData;
}

function getItemWeightEach(itemData) {
  const legacyWeight = isDocumentLike(itemData) ? undefined : gprop(itemData, "data.data.weight");
  return Math.max(0, toNumber(gprop(itemData, "system.weight") ?? gprop(itemData, "system.weight.value") ?? legacyWeight ?? 0, 0));
}

function getItemPriceGpEach(itemData) {
  const legacyPrice = isDocumentLike(itemData) ? undefined : gprop(itemData, "data.data.price");
  const raw = gprop(itemData, "system.price") ?? gprop(itemData, "system.price.value") ?? legacyPrice ?? 0;
  return parsePriceToGp(raw);
}

function setItemPriceGpEach(itemData, priceGp) {
  const value = Math.max(0, toNumber(priceGp, 0));
  if (has(itemData, "system.price.value")) sprop(itemData, "system.price.value", value);
  else if (!isDocumentLike(itemData) && has(itemData, "data.data.price")) sprop(itemData, "data.data.price", value);
  else sprop(itemData, "system.price", value);
  return itemData;
}

function setItemWeightEach(itemData, weight) {
  const value = Math.max(0, toNumber(weight, 0));
  if (has(itemData, "system.weight.value")) sprop(itemData, "system.weight.value", value);
  else if (!isDocumentLike(itemData) && has(itemData, "data.data.weight")) sprop(itemData, "data.data.weight", value);
  else sprop(itemData, "system.weight", value);
  return itemData;
}

function isDocumentLike(value) {
  return Boolean(value && typeof value === "object" && typeof value.toObject === "function");
}

function getItemSourceData(item) {
  if (!item) return {};
  if (typeof item.toObject === "function") return item.toObject(false);
  return item;
}

function parsePriceToGp(raw) {
  if (raw === null || raw === undefined || raw === "") return 0;
  if (typeof raw === "number") return raw;
  if (typeof raw === "object") {
    if (raw.gp !== undefined) return toNumber(raw.gp, 0);
    if (raw.value !== undefined) return parsePriceToGp(raw.value);
    if (raw.amount !== undefined) return parsePriceToGp(raw.amount);
  }
  const text = String(raw).trim().toLowerCase().replace(/,/g, "");
  const match = text.match(/([-+]?\d+(?:\.\d+)?)\s*(pp|gp|sp|cp|пм|зм|см|мм|плат|зол|сер|мед)?/i);
  if (!match) return 0;
  const amount = toNumber(match[1], 0);
  const unit = match[2] || "gp";
  if (["pp", "пм", "плат"].includes(unit)) return amount * 10;
  if (["sp", "см", "сер"].includes(unit)) return amount / 10;
  if (["cp", "мм", "мед"].includes(unit)) return amount / 100;
  return amount;
}

function getActorInventoryItems(actor) {
  const allItems = actor?.allItems;
  if (Array.isArray(allItems) && allItems.length) return allItems;
  return [...(actor?.items ?? [])];
}

function getActorItemValueGp(actor) {
  const preparedValue = [
    "system.inventory.totalValue",
    "system.inventory.itemValue",
    "system.inventory.totalItemValue",
    "system.attributes.inventory.totalValue",
    "system.attributes.inventory.itemValue",
    "data.data.inventory.totalValue",
    "data.data.inventory.itemValue",
    "data.data.inventory.totalItemValue"
  ].map(path => gprop(actor, path)).find(value => value !== undefined && value !== null && value !== "");
  if (preparedValue !== undefined) return parsePriceToGp(preparedValue);

  let itemsGp = 0;
  for (const item of getActorInventoryItems(actor)) {
    const data = getItemSourceData(item);
    const quantity = getItemQuantity(data);
    itemsGp += getItemPriceGpEach(data) * quantity;
  }
  return itemsGp;
}

function getActorCarriedWeight(actor) {
  const preparedWeight = [
    "system.attributes.encumbrance.carriedWeight",
    "system.attributes.encumbrance.value",
    "system.inventory.weight",
    "data.data.attributes.encumbrance.carriedWeight",
    "data.data.attributes.encumbrance.value",
    "data.data.inventory.weight"
  ].map(path => gprop(actor, path)).find(value => value !== undefined && value !== null && value !== "");
  if (preparedWeight !== undefined) return toNumber(preparedWeight, 0);

  let weight = 0;
  for (const item of getActorInventoryItems(actor)) {
    const data = getItemSourceData(item);
    const quantity = getItemQuantity(data);
    weight += getItemWeightEach(data) * quantity;
  }
  return weight;
}

function getActorWealth(actor) {
  const currency = getCurrency(actor);
  const coinGp = currencyToGp(currency);
  const itemsGp = getActorItemValueGp(actor);
  return {
    coinGp: fmtNumber(coinGp),
    wealthGp: fmtNumber(coinGp + itemsGp),
    weight: fmtNumber(getActorCarriedWeight(actor))
  };
}

function normalizeItemForStash(item) {
  const data = item.toObject ? item.toObject() : deepClone(item);
  delete data._id;
  data._id = foundry.utils.randomID();
  ensureItemSourceBasics(data, item);
  const quantity = getItemQuantity(data);
  return {
    stashId: foundry.utils.randomID(),
    sourceActorId: item.parent?.documentName === "Actor" ? item.parent.id : null,
    sourceItemId: item.id ?? null,
    name: data.name || "Предмет",
    type: data.type || "loot",
    img: data.img || "icons/svg/item-bag.svg",
    quantity,
    weight: getItemWeightEach(data) * quantity,
    priceGp: getItemPriceGpEach(data) * quantity,
    data
  };
}

function getStashItemView(stashItem) {
  const data = stashItem.data ?? stashItem;
  const quantity = getItemQuantity(data);
  const priceEach = getItemPriceGpEach(data);
  const weightEach = getItemWeightEach(data);
  const priceTotal = quantity > 0 ? priceEach * quantity : priceEach;
  const weightTotal = quantity > 0 ? weightEach * quantity : weightEach;
  return {
    ...stashItem,
    name: stashItem.name || data.name || "Предмет",
    type: stashItem.type || data.type || "loot",
    img: stashItem.img || data.img || "icons/svg/item-bag.svg",
    quantity,
    emptyStack: quantity <= 0,
    weight: fmtNumber(weightTotal),
    weightEach: fmtNumber(weightEach),
    priceGp: fmtNumber(priceTotal),
    priceEach: fmtNumber(priceEach),
    description: getItemDescriptionHTML(data).trim(),
    search: `${stashItem.name || data.name || ""} ${stashItem.type || data.type || ""}`.toLowerCase()
  };
}

function getStashItemSource(stashItem) {
  const source = deepClone(stashItem?.stashId && stashItem?.data ? stashItem.data : stashItem ?? {});
  ensureItemSourceBasics(source, stashItem);
  return source;
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return null;
}

function firstValidItemType(...values) {
  for (const value of values) {
    const type = String(value ?? "").trim();
    if (type && type.toLowerCase() !== "item") return type;
  }
  return "loot";
}

function ensureItemSourceBasics(source, fallback = {}) {
  if (!source || typeof source !== "object") return source;
  const nestedData = source.data && typeof source.data === "object" ? source.data : {};
  source._id = source._id || fallback?._id || fallback?.id || foundry.utils.randomID();
  source.name = firstNonEmptyString(
    source.name,
    fallback?.name,
    nestedData.name,
    gprop(source, "item.name"),
    gprop(fallback, "data.name"),
    "Предмет"
  );
  source.type = firstValidItemType(
    source.type,
    fallback?.type,
    nestedData.type,
    gprop(source, "item.type"),
    gprop(fallback, "data.type")
  );
  source.img = firstNonEmptyString(
    source.img,
    fallback?.img,
    nestedData.img,
    gprop(source, "item.img"),
    gprop(fallback, "data.img"),
    "icons/svg/item-bag.svg"
  );
  if (!source.system || typeof source.system !== "object") source.system = {};
  return source;
}

function arrayFromMaybeObject(value) {
  if (Array.isArray(value)) return value;
  if (value instanceof Map || (typeof Collection !== "undefined" && value instanceof Collection)) return Array.from(value.values());
  if (Array.isArray(value?.contents)) return value.contents;
  if (value && typeof value === "object") return Object.values(value);
  return [];
}

function normalizeContainerInventoryItems(value) {
  return arrayFromMaybeObject(value)
    .map(item => {
      if (!item) return null;
      const source = item.toObject ? item.toObject() : deepClone(item);
      if (!source || typeof source !== "object") return null;
      ensureItemSourceBasics(source, item);
      const legacySystem = gprop(source, "data.data");
      source.system = mergeObject(
        legacySystem && typeof legacySystem === "object" ? deepClone(legacySystem) : {},
        source.system && typeof source.system === "object" ? source.system : {},
        { inplace: false }
      );
      source.system.description = source.system.description ?? { value: getItemDescriptionHTML(source) };
      if (typeof source.system.description === "string") source.system.description = { value: source.system.description };
      source.system.actions = arrayFromMaybeObject(source.system.actions);
      source.system.changes = arrayFromMaybeObject(source.system.changes);
      source.system.contextNotes = arrayFromMaybeObject(source.system.contextNotes);
      source.system.links = arrayFromMaybeObject(source.system.links);
      normalizeContainerSystem(source);
      delete source.data;
      return source;
    })
    .filter(Boolean);
}

function normalizeContainerSystem(source) {
  if (source.type !== "container" && source.system.inventoryItems == null) return;
  source.system.inventoryItems = normalizeContainerInventoryItems(source.system.inventoryItems);
  const currency = source.system.currency && typeof source.system.currency === "object" ? source.system.currency : {};
  source.system.currency = {
    pp: toNumber(currency.pp, 0),
    gp: toNumber(currency.gp, 0),
    sp: toNumber(currency.sp, 0),
    cp: toNumber(currency.cp, 0)
  };
  source.system.weightReduction = toNumber(source.system.weightReduction, 0);
  source.system.maxWeight ??= null;
  source.system.sellMultiplier ??= 0.5;
}

function parseDropDataTransfer(event) {
  const nativeEvent = event?.originalEvent ?? event;
  const dataTransfer = nativeEvent?.dataTransfer;
  if (!dataTransfer) return null;
  for (const type of ["text/plain", "application/json"]) {
    const raw = dataTransfer.getData(type);
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      if (data && typeof data === "object") return data;
    } catch (err) {
      console.debug(`${MODULE_ID} | Could not parse ${type} drop payload`, err);
    }
  }
  return null;
}

function getPartyDropData(event) {
  const rawData = parseDropDataTransfer(event);
  let editorData = null;
  try {
    editorData = TextEditor.getDragEventData(event);
  } catch (err) {
    console.debug(`${MODULE_ID} | Could not read Foundry drop data`, err);
  }
  if (rawData && editorData) return mergeObject(editorData, rawData, { inplace: false });
  return rawData ?? editorData;
}

function normalizeStashDropData(data) {
  if (!data || typeof data !== "object") return data;
  const normalized = mergeObject({}, data, { inplace: false });
  normalized.containerId ??= gprop(normalized, "data.containerId") ?? gprop(normalized, "item.containerId");
  normalized.containerUuid ??= gprop(normalized, "data.containerUuid") ?? gprop(normalized, "item.containerUuid");
  normalized.itemId ??= gprop(normalized, "data._id") ?? gprop(normalized, "data.id") ?? gprop(normalized, "item._id") ?? gprop(normalized, "item.id");
  return normalized;
}

function getDocumentIdentityValues(document) {
  return [
    document?.id,
    document?._id,
    document?.uuid,
    document?.document?.id,
    document?.document?._id,
    document?.document?.uuid,
    gprop(document, "data._id"),
    gprop(document, "_source._id")
  ].filter(value => value !== null && value !== undefined && String(value).trim() !== "");
}

function registerOpenStashItemSource(item, partyActor, stashId) {
  if (!item || !partyActor?.id || !stashId) return;
  const value = { partyActorId: partyActor.id, stashId, item };
  for (const key of new Set([...getDocumentIdentityValues(item), stashId])) {
    openStashItemSources.set(String(key), value);
  }
}

function unregisterOpenStashItemSource(item) {
  if (!item) return;
  const ref = getOpenStashItemReference(item);
  for (const key of getDocumentIdentityValues(item)) openStashItemSources.delete(String(key));
  if (ref?.stashId) openStashItemSources.delete(String(ref.stashId));
}

function getOpenStashContainerReference(data) {
  const candidates = [
    data?.containerId,
    data?.containerUuid,
    data?.uuid,
    gprop(data, "data.containerId"),
    gprop(data, "data.containerUuid"),
    gprop(data, "data._id"),
    gprop(data, "_id")
  ].filter(value => value !== null && value !== undefined && String(value).trim() !== "");
  for (const candidate of candidates) {
    const ref = openStashItemSources.get(String(candidate));
    if (ref) return ref;
  }
  return null;
}

function getOpenStashItemReference(item) {
  if (!item) return null;
  for (const key of getDocumentIdentityValues(item)) {
    const ref = openStashItemSources.get(String(key));
    if (ref) return ref;
  }
  return null;
}

function getStashContainerContentSource(ref, itemId) {
  if (!ref?.partyActorId || !ref?.stashId || !itemId) return null;
  const party = game.actors.get(ref.partyActorId);
  if (!party) return null;
  const stash = getStash(party);
  const entry = stash.items.find(item => item.stashId === ref.stashId);
  if (!entry) return null;
  const containerSource = prepareStashItemSourceForPF1Sheet(entry);
  const inventory = arrayFromMaybeObject(containerSource.system?.inventoryItems);
  const itemSource = inventory.find(item => item?._id === itemId || item?.id === itemId);
  if (!itemSource) return null;
  return {
    party,
    stashId: ref.stashId,
    containerSource,
    itemSource: ensureItemSourceBasics(deepClone(itemSource))
  };
}

async function deleteStashContainerContent(data) {
  const ref = getOpenStashContainerReference(data);
  const itemId = data?.itemId || gprop(data, "data._id");
  const context = getStashContainerContentSource(ref, itemId);
  if (!context) return false;
  const inventory = arrayFromMaybeObject(context.containerSource.system?.inventoryItems);
  const nextInventory = inventory.filter(item => item?._id !== itemId && item?.id !== itemId);
  if (nextInventory.length === inventory.length) return false;
  context.containerSource.system.inventoryItems = nextInventory;
  await updateStashItemSource(context.party, context.stashId, context.containerSource);
  const tempItem = ref?.item;
  if (tempItem) {
    tempItem.updateSource?.({ "system.inventoryItems": nextInventory });
    tempItem.prepareData?.();
    for (const app of Object.values(tempItem.apps ?? {})) app.render(false);
  }
  return true;
}

function getStashContainerMoveContext(partyActor, data) {
  const ref = getOpenStashContainerReference(data);
  const itemId = data?.itemId || gprop(data, "data._id") || gprop(data, "_id");
  if (!partyActor?.id || !ref?.stashId || !itemId || ref.partyActorId !== partyActor.id) return null;
  const stash = getStash(partyActor);
  const containerIndex = stash.items.findIndex(item => item.stashId === ref.stashId);
  if (containerIndex < 0) return null;
  const containerSource = prepareStashItemSourceForPF1Sheet(stash.items[containerIndex]);
  const inventory = arrayFromMaybeObject(containerSource.system?.inventoryItems);
  const itemIndex = inventory.findIndex(item => item?._id === itemId || item?.id === itemId);
  if (itemIndex < 0) return null;
  const itemSource = ensureItemSourceBasics(deepClone(inventory[itemIndex]));
  return { ref, itemId, stash, containerIndex, containerSource, inventory, itemIndex, itemSource };
}

async function moveStashContainerContentToPartyStash(partyActor, data, event) {
  if (event?.ctrlKey) return false;
  const context = getStashContainerMoveContext(partyActor, data);
  if (!context) return false;
  const nextInventory = context.inventory.filter((_, index) => index !== context.itemIndex);
  context.containerSource.system.inventoryItems = nextInventory;
  context.stash.items[context.containerIndex] = buildStashItemEntry(context.stash.items[context.containerIndex], context.containerSource);
  context.stash.items.push(normalizeItemForStash(context.itemSource));
  await setStash(partyActor, context.stash);

  const tempItem = context.ref?.item;
  if (tempItem) {
    tempItem.updateSource?.({ "system.inventoryItems": nextInventory });
    tempItem.prepareData?.();
    for (const app of Object.values(tempItem.apps ?? {})) app.render(false);
  }
  await renderOpenPartySheets();
  return true;
}

async function getActorFromDropData(data) {
  let source = null;
  if (data?.actorUuid) {
    try {
      source = await fromUuid(data.actorUuid);
    } catch (err) {
      console.debug(`${MODULE_ID} | Could not resolve dropped item actor`, err);
    }
  }
  if (source?.documentName === "Actor") return source;
  if (source?.actor?.documentName === "Actor") return source.actor;
  if (data?.actorId) return game.actors.get(data.actorId) ?? null;
  return null;
}

async function getDroppedContainerContent(data) {
  if (!data?.containerId || !data?.itemId) return null;
  const stashContext = getStashContainerContentSource(getOpenStashContainerReference(data), data.itemId);
  if (stashContext?.itemSource) return stashContext.itemSource;
  const actor = await getActorFromDropData(data);
  if (!actor) return null;
  return actor.containerItems?.find(item => item.id === data.itemId && item.parentItem?.id === data.containerId)
    ?? actor.items?.get(data.containerId)?.getContainerContent?.(data.itemId)
    ?? null;
}

async function deleteDroppedContainerContent(data) {
  if (!data?.containerId || !data?.itemId) return false;
  if (await deleteStashContainerContent(data)) return true;
  const actor = await getActorFromDropData(data);
  const container = actor?.items?.get(data.containerId)
    ?? actor?.containerItems?.find(item => item.id === data.itemId && item.parentItem?.id === data.containerId)?.parentItem
    ?? null;
  if (!container) return false;
  const canDelete = container.isOwner
    || actor?.isOwner
    || container.testUserPermission?.(game.user, "OWNER")
    || container.testUserPermission?.(game.user, 3)
    || actor?.testUserPermission?.(game.user, "OWNER")
    || actor?.testUserPermission?.(game.user, 3)
    || false;
  if (!canDelete) return false;
  if (typeof container.deleteContainerContent === "function") {
    await container.deleteContainerContent(data.itemId);
    return true;
  }
  const inventory = deepClone(container.system?.inventoryItems ?? []);
  const nextInventory = inventory.filter(item => item?._id !== data.itemId);
  if (nextInventory.length === inventory.length) return false;
  await container.update({ "system.inventoryItems": nextInventory });
  return true;
}

async function deleteMovedSourceItem(item, event, dropData = null) {
  if (event?.ctrlKey) return true;
  if (dropData?.containerId && dropData?.itemId) {
    try {
      if (await deleteDroppedContainerContent(dropData)) return true;
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not delete dropped container content`, err);
      return false;
    }
  }
  if (!item) return false;
  if (item.parentItem?.id && typeof item.parentItem.deleteContainerContent === "function") {
    const canDelete = item.parentItem.isOwner
      || item.parentItem.testUserPermission?.(game.user, "OWNER")
      || item.parentItem.testUserPermission?.(game.user, 3)
      || false;
    if (canDelete) {
      try {
        await item.parentItem.deleteContainerContent(item.id);
        return true;
      } catch (err) {
        console.warn(`${MODULE_ID} | Could not delete moved source container content`, err);
        return false;
      }
    }
  }

  const parent = item.parent;
  const parentType = parent?.documentName;
  if (!["Actor", "Item"].includes(parentType)) return true;

  const canDelete = item.testUserPermission
    ? item.testUserPermission(game.user, "OWNER")
    : parent.testUserPermission?.(game.user, "OWNER");
  if (!canDelete) return false;

  try {
    if (typeof item.delete === "function") await item.delete();
    else if (item.id && typeof parent.deleteEmbeddedDocuments === "function") await parent.deleteEmbeddedDocuments(item.documentName ?? "Item", [item.id]);
    return true;
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not delete moved source item`, err);
    ui.notifications.warn("Предмет добавлен в тайник, но исходный предмет не удалось удалить из контейнера.");
    return false;
  }
}

async function storeDroppedItemInPartyStash(partyActor, data, event) {
  data = normalizeStashDropData(data);
  if (!partyActor || data?.type !== "Item") return false;
  const transfer = gprop(data, `data.flags.${MODULE_ID}.${STASH_TRANSFER_FLAG}`) ?? gprop(data, `flags.${MODULE_ID}.${STASH_TRANSFER_FLAG}`);
  if (transfer?.partyActorId === partyActor.id && !data?.containerId && !data?.itemId) return true;

  if (data?.containerId && data?.itemId && await moveStashContainerContentToPartyStash(partyActor, data, event)) return true;

  const containedItem = data?.containerId && data?.itemId ? await getDroppedContainerContent(data) : null;
  const item = containedItem ?? (data.uuid ? await fromUuid(data.uuid) : null);
  const itemSource = item ?? data.data;
  if (!itemSource) {
    ui.notifications.warn("Не удалось прочитать предмет.");
    return false;
  }

  const sourceData = itemSource.toObject ? itemSource.toObject() : itemSource;
  const sourceType = String(sourceData.type || "").toLowerCase();
  const stashSource = sourceType === "spell" ? await createItemFromDroppedSpell(itemSource) : itemSource;
  if (!stashSource) return false;

  const stash = getStash(partyActor);
  const stashItem = normalizeItemForStash(stashSource);
  stash.items.push(stashItem);
  await setStash(partyActor, stash);

  const deletedSource = await deleteMovedSourceItem(sourceType === "spell" ? null : item, event, data);
  if (data?.containerId && !deletedSource && !event?.ctrlKey) {
    const rollbackStash = getStash(partyActor);
    rollbackStash.items = rollbackStash.items.filter(i => i.stashId !== stashItem.stashId);
    await setStash(partyActor, rollbackStash);
    ui.notifications.warn("Не удалось перенести предмет: PF1e не дал удалить его из контейнера.");
    return false;
  }

  await renderOpenPartySheets();
  return true;
}

function buildStashContainerDropPayload(ref, itemId) {
  const context = getStashContainerContentSource(ref, itemId);
  if (!context?.itemSource) return null;
  return {
    type: "Item",
    actorUuid: context.party.uuid,
    actorId: context.party.id,
    containerId: ref.item?.id ?? ref.item?._id ?? ref.stashId,
    itemId,
    data: context.itemSource
  };
}

function writeDragData(dataTransfer, payload) {
  if (!dataTransfer || !payload) return false;
  const serialized = JSON.stringify(payload);
  dataTransfer.setData("text/plain", serialized);
  dataTransfer.setData("application/json", serialized);
  dataTransfer.effectAllowed = "move";
  return true;
}

function injectStashContainerSheetDragData(app, html) {
  const item = app?.object ?? app?.document;
  const ref = getOpenStashItemReference(item);
  if (!ref) return;
  const jq = html?.jquery ? html : $(html ?? app?.element);
  if (!jq?.length) return;
  jq.find("[data-item-id]").attr("draggable", "true");
  jq.off("dragstart.pf1PartyStashContainer", "[data-item-id]");
  jq.on("dragstart.pf1PartyStashContainer", "[data-item-id]", event => {
    const nativeEvent = event.originalEvent ?? event;
    const itemId = event.currentTarget?.dataset?.itemId || event.currentTarget?.getAttribute?.("data-item-id");
    const payload = buildStashContainerDropPayload(ref, itemId);
    if (!payload) return;
    writeDragData(nativeEvent.dataTransfer, payload);
  });
}

function prepareStashItemSourceForPF1Sheet(stashItem) {
  const source = getStashItemSource(stashItem);
  const legacySystem = gprop(source, "data.data");
  source.system = mergeObject(
    legacySystem && typeof legacySystem === "object" ? deepClone(legacySystem) : {},
    source.system && typeof source.system === "object" ? source.system : {},
    { inplace: false }
  );
  source.system.description = source.system.description ?? { value: getItemDescriptionHTML(source) };
  if (typeof source.system.description === "string") source.system.description = { value: source.system.description };
  source.system.quantity = getItemQuantity(source);
  source.system.weight = getItemWeightEach(source);
  source.system.price = getItemPriceGpEach(source);
  source.system.actions = arrayFromMaybeObject(source.system.actions);
  source.system.changes = arrayFromMaybeObject(source.system.changes);
  source.system.contextNotes = arrayFromMaybeObject(source.system.contextNotes);
  source.system.links = arrayFromMaybeObject(source.system.links);
  normalizeContainerSystem(source);
  delete source.data;
  return source;
}

function getItemDescriptionHTML(itemSource) {
  const raw = gprop(itemSource, "system.description.value")
    ?? gprop(itemSource, "system.description")
    ?? gprop(itemSource, "data.data.description.value")
    ?? gprop(itemSource, "data.data.description")
    ?? "";
  if (raw && typeof raw === "object") return raw.value ?? raw.chat ?? "";
  return String(raw || "");
}

function buildStashItemEntry(oldEntry, itemSource) {
  const source = getStashItemSource(itemSource);
  const quantity = getItemQuantity(source);
  return {
    ...oldEntry,
    name: source.name || oldEntry?.name || "Предмет",
    type: source.type || oldEntry?.type || "loot",
    img: source.img || oldEntry?.img || "icons/svg/item-bag.svg",
    quantity,
    weight: getItemWeightEach(source) * quantity,
    priceGp: getItemPriceGpEach(source) * quantity,
    data: source
  };
}

function defaultStashItemSource(category = "equipment") {
  const base = {
    name: "Новый предмет",
    type: "loot",
    img: "icons/svg/item-bag.svg",
    system: {
      quantity: 1,
      price: 0,
      weight: 0,
      description: { value: "" }
    }
  };
  const setKind = (path, value) => sprop(base, path, value);

  switch (category) {
    case "weapons":
      base.name = "Новое оружие";
      base.type = "weapon";
      base.img = "icons/svg/sword.svg";
      break;
    case "armor":
      base.name = "Новая броня";
      base.type = "equipment";
      base.img = "icons/svg/shield.svg";
      setKind("system.equipmentType", "armor");
      setKind("system.subType", "armor");
      break;
    case "consumables":
      base.name = "Новый расходник";
      base.type = "consumable";
      base.img = "icons/svg/potion.svg";
      setKind("system.consumableType", "potion");
      setKind("system.subType", "potion");
      break;
    case "ammo":
      base.name = "Новые боеприпасы";
      base.type = "loot";
      base.img = "icons/svg/acid.svg";
      setKind("system.subType", "ammo");
      break;
    case "goods":
      base.name = "Новый товар";
      base.type = "loot";
      setKind("system.subType", "tradegoods");
      break;
    case "misc":
      base.name = "Новый предмет";
      base.type = "loot";
      setKind("system.subType", "misc");
      break;
    case "containers":
      base.name = "Новый контейнер";
      base.type = "container";
      base.img = "icons/containers/bags/pack-leather-white-tan.webp";
      break;
    case "equipment":
    default:
      base.name = "Новое снаряжение";
      base.type = "equipment";
      setKind("system.equipmentType", "gear");
      setKind("system.subType", "gear");
      break;
  }
  return base;
}

async function updateStashItemSource(partyActor, stashId, itemSource) {
  const stash = getStash(partyActor);
  const index = stash.items.findIndex(i => i.stashId === stashId);
  if (index < 0) return null;
  stash.items[index] = buildStashItemEntry(stash.items[index], itemSource);
  await setStash(partyActor, stash);
  return stash.items[index];
}

function categoryForItem(item) {
  const data = item.data ?? item;
  const type = String(item.type || data.type || "loot").toLocaleLowerCase(game.i18n?.lang || "ru");
  const name = String(item.name || data.name || "").toLocaleLowerCase(game.i18n?.lang || "ru");
  const subType = String(
    item.subType
      ?? gprop(data, "system.subType")
      ?? gprop(data, "data.data.subType")
      ?? "gear"
  ).toLocaleLowerCase(game.i18n?.lang || "ru");

  if (type === "weapon") return "weapons";
  if (type === "consumable") return "consumables";
  if (type === "container") return "containers";
  if (type === "loot") {
    if (subType === "ammo" || subType.includes("ammo") || subType.includes("боеприп")) return "ammo";
    if (subType === "tradegoods" || subType.includes("trade") || subType.includes("товар")) return "goods";
    if (subType === "misc" || subType.includes("misc") || subType.includes("разное")) return "misc";
    return "equipment";
  }

  const directKind = [
    gprop(data, "system.subType"),
    gprop(data, "system.itemType"),
    gprop(data, "system.equipmentType"),
    gprop(data, "system.category"),
    gprop(data, "system.subTypeLabel"),
    gprop(data, "system.typeName"),
    gprop(data, "system.type"),
    gprop(data, "system.type.value"),
    gprop(data, "system.type.label"),
    gprop(data, "data.data.subType"),
    gprop(data, "data.data.itemType"),
    gprop(data, "data.data.equipmentType"),
    gprop(data, "data.data.category"),
    gprop(data, "data.data.subTypeLabel"),
    gprop(data, "data.data.typeName"),
    gprop(data, "data.data.type"),
    gprop(data, "data.data.type.value"),
    gprop(data, "data.data.type.label")
  ].flatMap(parseTextList).join(" ").toLocaleLowerCase(game.i18n?.lang || "ru");
  if (type === "equipment") {
    if (directKind.includes("armor") || directKind.includes("Р±СЂРѕРЅ") || directKind.includes("РґРѕСЃРїРµС…") || directKind.includes("shield") || directKind.includes("С‰РёС‚")) return "armor";
    if (directKind.includes("trade good") || directKind.includes("goods") || directKind.includes("С‚РѕРІР°СЂ")) return "goods";
    return "equipment";
  }
  const text = [
    name,
    type,
    directKind,
    gprop(data, "system.tags"),
    gprop(data, "data.data.tags"),
    collectStringLeaves(data.system),
    collectStringLeaves(gprop(data, "data.data")),
    gprop(data, "system.description.value"),
    gprop(data, "data.data.description.value")
  ].flatMap(parseTextList).join(" ").toLocaleLowerCase(game.i18n?.lang || "ru");

  const hasEquipment = directKind.includes("снаряж") || directKind.includes("gear") || directKind.includes("equipment") || directKind.includes("adventuring gear");
  const hasMisc = directKind.includes("разное") || directKind.includes("misc");
  const hasConsumable = type.includes("consumable") || text.includes("consumable") || text.includes("расход") || text.includes("зель") || text.includes("масл") || text.includes("potion") || text.includes("oil") || text.includes("wand") || text.includes("жезл") || text.includes("scroll") || text.includes("свит");
  const isSpellComponentPouch = name.includes("сумка с реагент") || name.includes("spell component pouch");

  if (text.includes("ammo") || text.includes("ammunition") || text.includes("боеприп") || text.includes("стрел") || text.includes("болт") || text.includes("патрон")) return "ammo";
  if (hasConsumable) return "consumables";
  if (type.includes("weapon") || text.includes("weapon") || text.includes("оруж") || text.includes("shield") || text.includes("щит")) return "weapons";
  if (type.includes("armor") || text.includes("armor") || text.includes("доспех") || text.includes("брон") || directKind.includes("одежд") || directKind.includes("clothing")) return "armor";
  if (directKind.includes("товар") || directKind.includes("trade good") || directKind.includes("goods")) return "goods";
  if (hasMisc || directKind.includes("добыча разное")) return "misc";
  if (isSpellComponentPouch || hasEquipment || type.includes("equipment")) return "equipment";
  if (type.includes("container") || directKind.includes("container") || directKind.includes("контейнер")) return "containers";
  if (type.includes("loot") || type.includes("treasure") || directKind.includes("loot") || directKind.includes("добыча")) return "misc";
  return "equipment";
}

function buildStashView(stash) {
  const categories = [
    { id: "weapons", label: "Оружие и щиты", items: [] },
    { id: "armor", label: "Броня/Снаряжение", items: [] },
    { id: "consumables", label: "Расходники", items: [] },
    { id: "equipment", label: "Снаряжение", items: [] },
    { id: "ammo", label: "Боеприпасы", items: [] },
    { id: "misc", label: "Разное", items: [] },
    { id: "goods", label: "Товары", items: [] },
    { id: "containers", label: "Контейнеры", items: [] }
  ];
  const byId = new Map(categories.map(c => [c.id, c]));

  for (const raw of stash.items ?? []) {
    const item = getStashItemView(raw);
    const category = byId.get(categoryForItem(item)) ?? byId.get("equipment");
    category.items.push(item);
  }

  for (const category of categories) {
    category.items.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
  }

  return {
    currency: stash.currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 },
    currencyArray: Object.entries(CURRENCY_META).map(([key, meta]) => ({ key, ...meta, value: stash.currency?.[key] ?? 0 })),
    categories
  };
}

function buildStashTotals(stash) {
  const coinGp = currencyToGp(stash.currency);
  let itemsGp = 0;
  let weight = 0;
  for (const item of stash.items ?? []) {
    const data = item.data ?? item;
    const q = getItemQuantity(data);
    itemsGp += getItemPriceGpEach(data) * q;
    weight += getItemWeightEach(data) * q;
  }
  return {
    coinGp: fmtNumber(coinGp),
    wealthGp: fmtNumber(coinGp + itemsGp),
    weight: fmtNumber(weight)
  };
}

function addCurrencyObjects(a = {}, b = {}) {
  return {
    pp: toNumber(a.pp, 0) + toNumber(b.pp, 0),
    gp: toNumber(a.gp, 0) + toNumber(b.gp, 0),
    sp: toNumber(a.sp, 0) + toNumber(b.sp, 0),
    cp: toNumber(a.cp, 0) + toNumber(b.cp, 0)
  };
}

function buildPartyTotals(stash, members) {
  let currency = deepClone(stash.currency ?? { pp: 0, gp: 0, sp: 0, cp: 0 });
  let itemsGp = 0;
  let weight = 0;
  for (const item of stash.items ?? []) {
    const data = item.data ?? item;
    const q = getItemQuantity(data);
    itemsGp += getItemPriceGpEach(data) * q;
    weight += getItemWeightEach(data) * q;
  }
  for (const actor of members) {
    currency = addCurrencyObjects(currency, getCurrency(actor));
    itemsGp += getActorItemValueGp(actor);
    weight += getActorCarriedWeight(actor);
  }
  const coinGp = currencyToGp(currency);
  return {
    coinGp: fmtNumber(coinGp),
    wealthGp: fmtNumber(coinGp + itemsGp),
    weight: fmtNumber(weight)
  };
}

function buildTravel(members) {
  const speeds = members.map(m => getSpeed(m)).filter(s => s > 0);
  const speed = speeds.length ? Math.min(...speeds) : 0;
  return {
    speed,
    feetPerMinute: fmtNumber(speed * 10, 0),
    milesPerHour: fmtNumber(speed / 10, 1),
    milesPerDay: fmtNumber(speed * 0.8, 1),
    activitySlots: members.length || 0
  };
}

function actorSummary(actor, activities = {}, heroPoints = {}) {
  const skills = collectSkills(actor);
  const activity = activities[actor.id] ?? {};
  const activitySkill = skills.find(s => s.id === activity.skillId);
  const investedSkills = skills
    .filter(skill => skill.id !== "per" && !isKnowledgeSkill(skill) && skill.ranks > 0)
    .sort((a, b) => b.bonus - a.bonus || a.label.localeCompare(b.label, game.i18n.lang));
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img || PARTY_ICON,
    heroPoints: getHeroPointState(heroPoints, actor.id),
    hp: getHp(actor),
    ac: getAc(actor),
    saves: getSaves(actor),
    perception: getSkillBonus(actor, "per"),
    investedSkills,
    senses: getSenses(actor),
    speed: getSpeed(actor),
    wealth: getActorWealth(actor),
    activity: {
      title: activity.title || activitySkill?.label || "Активность",
      subtitle: activity.skillId ? `${activitySkill?.label || activity.skillId} ${signed(getSkillBonus(actor, activity.skillId) + toNumber(activity.bonus, 0))}${activity.dc ? ` против СЛ ${activity.dc}` : ""}` : "Слот доступен",
      skillId: activity.skillId || "",
      dc: activity.dc || "",
      bonus: activity.bonus || 0
    }
  };
}

function buildPartyStatsData(members, activities, stash, heroPoints = {}) {
  const skills = buildPartySkillSummaries(members);
  const languages = [...new Set(members.flatMap(getLanguages))].sort((a, b) => a.localeCompare(b, game.i18n.lang));
  return {
    members: members.map(actor => actorSummary(actor, activities, heroPoints)),
    languages,
    skills,
    travel: buildTravel(members),
    partyTotals: buildPartyTotals(stash, members)
  };
}

function getPublicPartySnapshot(partyActor) {
  return partyActor?.getFlag(MODULE_ID, PUBLIC_SNAPSHOT_FLAG) ?? null;
}

async function refreshPublicPartySnapshot(partyActor = getPartyActor()) {
  if (!game.user.isGM || !partyActor?.isOwner) return null;
  const activities = partyActor.getFlag(MODULE_ID, ACTIVITIES_FLAG) ?? {};
  const stash = getStash(partyActor);
  const heroPoints = getHeroPoints(partyActor);
  const members = getPartyMembers(partyActor, { ignorePermissions: true });
  const snapshot = buildPartyStatsData(members, activities, stash, heroPoints);
  const current = getPublicPartySnapshot(partyActor);
  if (JSON.stringify(current) !== JSON.stringify(snapshot)) await partyActor.setFlag(MODULE_ID, PUBLIC_SNAPSHOT_FLAG, snapshot);
  return snapshot;
}

function schedulePublicPartySnapshotRefresh(partyActor = getPartyActor()) {
  if (!game.user.isGM || !partyActor?.isOwner) return;
  if (publicSnapshotRefreshTimer) clearTimeout(publicSnapshotRefreshTimer);
  const partyId = partyActor.id;
  publicSnapshotRefreshTimer = setTimeout(() => {
    publicSnapshotRefreshTimer = null;
    const party = game.actors.get(partyId);
    refreshPublicPartySnapshot(party).catch(err => console.warn(`${MODULE_ID} | Public party snapshot refresh failed`, err));
  }, 150);
}

async function rollSkill(actor, skillId, { flavor = null, extraBonus = 0, dc = null, heroPointBonus = 0, partyActor = null } = {}) {
  if (!actor) return;
  const heroBonus = toNumber(heroPointBonus, 0);
  const party = partyActor ?? getPartyActor();
  if (heroBonus > 0) {
    const spent = await spendHeroPoint(party, actor.id);
    if (!spent) return null;
  }
  if (typeof actor.rollSkill === "function" && !extraBonus && !dc && !heroBonus) {
    return actor.rollSkill(skillId, { event: null });
  }
  const bonus = getSkillBonus(actor, skillId) + toNumber(extraBonus, 0) + heroBonus;
  const formula = bonus >= 0 ? `1d20 + ${bonus}` : `1d20 - ${Math.abs(bonus)}`;
  const roll = await new Roll(formula).roll({ async: true });
  const total = roll.total;
  const dcText = dc ? `; СЛ ${dc}${total >= dc ? " — успех" : " — провал"}` : "";
  const heroText = heroBonus > 0 ? " (+8 геройское очко)" : "";
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: flavor ? `${flavor}${heroText}${dcText}` : `Проверка навыка: ${skillId}${heroText}${dcText}`,
    flags: {
      [MODULE_ID]: {
        actorId: actor.id,
        partyActorId: party?.id ?? null,
        skillId,
        heroPointPreBonusUsed: heroBonus > 0,
        heroPointChatBonusUsed: false
      }
    }
  });
}

function getSkillOptions(actor) {
  const skills = collectSkills(actor);
  const byId = new Map();
  for (const skill of skills) if (!byId.has(skill.id)) byId.set(skill.id, skill);
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
}

function dialogPromise({ title, content, buttons, defaultButton = "ok", render = null }) {
  return new Promise(resolve => {
    const wrappedButtons = {};
    for (const [id, button] of Object.entries(buttons)) {
      wrappedButtons[id] = {
        ...button,
        callback: html => resolve(button.callback ? button.callback(html) : true)
      };
    }
    new Dialog({
      title,
      content,
      buttons: wrappedButtons,
      default: defaultButton,
      render,
      close: () => resolve(null)
    }).render(true);
  });
}

async function activityDialog(actor, current = {}) {
  const skills = getSkillOptions(actor);
  const options = skills.map(s => `<option value="${s.id}" ${s.id === current.skillId ? "selected" : ""}>${s.label} ${signed(s.bonus)}</option>`).join("");
  const content = `
    <form class="pf1-party-dialog">
      <div class="form-group"><label>Название</label><input type="text" name="title" value="${escapeHTML(current.title || "Активность")}"></div>
      <div class="form-group"><label>Навык</label><select name="skillId">${options}</select></div>
      <div class="form-group"><label>Доп. бонус</label><input type="number" name="bonus" value="${toNumber(current.bonus, 0)}"></div>
      <div class="form-group"><label>СЛ</label><input type="number" name="dc" value="${current.dc || ""}" placeholder="необязательно"></div>
    </form>`;
  return dialogPromise({
    title: `Активность: ${actor.name}`,
    content,
    buttons: {
      clear: { label: "Очистить", callback: () => ({ clear: true }) },
      ok: {
        label: "Сохранить",
        callback: html => {
          const form = html.find("form")[0];
          const data = new FormData(form);
          return {
            title: data.get("title") || "Активность",
            skillId: data.get("skillId"),
            bonus: toNumber(data.get("bonus"), 0),
            dc: data.get("dc") ? toNumber(data.get("dc"), 0) : null
          };
        }
      }
    }
  });
}

async function currencyDialog(title, current = {}) {
  const content = `
    <form class="pf1-party-dialog pf1-currency-dialog">
      ${Object.entries(CURRENCY_META).map(([key, meta]) => `
        <div class="form-group"><label>${meta.label}</label><input type="number" name="${key}" value="${toNumber(current[key], 0)}" min="0" step="1"></div>
      `).join("")}
    </form>`;
  return dialogPromise({
    title,
    content,
    buttons: {
      ok: {
        label: "ОК",
        callback: html => {
          const data = new FormData(html.find("form")[0]);
          return {
            pp: Math.max(0, Math.floor(toNumber(data.get("pp"), 0))),
            gp: Math.max(0, Math.floor(toNumber(data.get("gp"), 0))),
            sp: Math.max(0, Math.floor(toNumber(data.get("sp"), 0))),
            cp: Math.max(0, Math.floor(toNumber(data.get("cp"), 0)))
          };
        }
      }
    }
  });
}

async function itemDialog(category = "equipment") {
  const suggestedType = category === "weapons" ? "weapon" : category === "armor" ? "equipment" : category === "consumables" ? "consumable" : "loot";
  const content = `
    <form class="pf1-party-dialog">
      <div class="form-group"><label>Название</label><input type="text" name="name" value="Новый предмет"></div>
      <div class="form-group"><label>Тип PF1</label><input type="text" name="type" value="${suggestedType}"></div>
      <div class="form-group"><label>Количество</label><input type="number" name="quantity" value="1" min="1" step="1"></div>
      <div class="form-group"><label>Цена за штуку, зм</label><input type="number" name="price" value="0" min="0" step="0.01"></div>
      <div class="form-group"><label>Вес за штуку, фнт.</label><input type="number" name="weight" value="0" min="0" step="0.01"></div>
    </form>`;
  return dialogPromise({
    title: "Создать предмет в тайнике",
    content,
    buttons: {
      ok: {
        label: "Создать",
        callback: html => {
          const data = new FormData(html.find("form")[0]);
          return {
            name: data.get("name") || "Новый предмет",
            type: data.get("type") || suggestedType,
            img: "icons/svg/item-bag.svg",
            system: {
              quantity: Math.max(1, Math.floor(toNumber(data.get("quantity"), 1))),
              price: toNumber(data.get("price"), 0),
              weight: toNumber(data.get("weight"), 0)
            }
          };
        }
      }
    }
  });
}

function localizeOrFallback(key, fallback, data = {}) {
  const localized = game.i18n?.localize?.(key);
  if (localized && localized !== key) return game.i18n.format ? game.i18n.format(key, data) : localized;
  return fallback.replace(/\{(\w+)\}/g, (_, k) => data[k] ?? "");
}

function spellConsumableName(spellName, kind) {
  const keys = {
    potion: ["PF1.CreateItemPotionOf", "Зелье: {name}"],
    scroll: ["PF1.CreateItemScrollOf", "Свиток: {name}"],
    wand: ["PF1.CreateItemWandOf", "Жезл: {name}"]
  };
  const [key, fallback] = keys[kind] ?? keys.potion;
  return localizeOrFallback(key, fallback, { name: spellName });
}

async function createSpellConsumableFallback(spellSource) {
  const SpellClass = CONFIG.Item?.documentClasses?.spell;
  const minimum = SpellClass?.getMinimumCasterLevelBySpellData?.(spellSource) ?? [
    toNumber(gprop(spellSource, "system.level") ?? gprop(spellSource, "data.data.level"), 1),
    1
  ];
  const [sl, cl] = minimum;
  const content = `
    <form class="pf1-party-dialog pf1-spell-consumable-dialog">
      <div class="form-group"><label>Круг заклинания</label><input type="number" name="sl" value="${sl || 1}" min="0" step="1"></div>
      <div class="form-group"><label>Уровень заклинателя</label><input type="number" name="cl" value="${cl || 1}" min="1" step="1"></div>
      <label class="pf1-inline-check"><input type="checkbox" name="identified" checked> Опознано</label>
      <div class="form-group"><label>Неопознанное имя</label><input type="text" name="unidentifiedName" placeholder="${escapeHTML(localizeOrFallback("PF1.CreateItemNamePlaceholder", "Wand, Scroll, or Potion"))}"></div>
    </form>`;

  const build = async (html, kind) => {
    if (kind === "spell") return spellSource;
    const form = html.find("form")[0];
    const data = new FormData(form);
    const source = deepClone(spellSource);
    source.sl = Math.max(0, Math.floor(toNumber(data.get("sl"), sl || 1)));
    source.cl = Math.max(1, Math.floor(toNumber(data.get("cl"), cl || 1)));
    source.identified = data.get("identified") === "on";
    source.unidentifiedName = String(data.get("unidentifiedName") || "");

    if (typeof SpellClass?.toConsumable === "function") {
      const consumable = await SpellClass.toConsumable(source, kind);
      if (consumable?._id) delete consumable._id;
      return consumable;
    }

    return {
      name: spellConsumableName(source.name || "Заклинание", kind),
      type: "consumable",
      img: source.img || "icons/svg/item-bag.svg",
      system: {
        subType: kind,
        quantity: 1,
        price: 0,
        weight: 0,
        description: { value: getItemDescriptionHTML(source) },
        uses: { value: kind === "wand" ? 50 : 1, max: kind === "wand" ? 50 : 1, per: "charges" },
        spell: deepClone(source)
      }
    };
  };

  return dialogPromise({
    title: `Create Item for ${escapeHTML(spellSource.name || "Заклинание")}`,
    content,
    buttons: {
      potion: { label: "Зелье", callback: html => build(html, "potion") },
      scroll: { label: "Свиток", callback: html => build(html, "scroll") },
      wand: { label: "Жезл", callback: html => build(html, "wand") },
      spell: { label: "Заклинание", callback: html => build(html, "spell") }
    },
    defaultButton: "potion"
  });
}

async function createItemFromDroppedSpell(item) {
  const source = item.toObject ? item.toObject() : deepClone(item);
  const systemDialog = globalThis.pf1?.utils?.createConsumableSpellDialog;
  if (typeof systemDialog === "function") {
    const result = await systemDialog(source, { allowSpell: true });
    if (!result) return null;
    return result === "spell" ? source : result;
  }
  return createSpellConsumableFallback(source);
}


function defaultMetagameSettings() {
  return {
    showCheckDC: false,
    showCheckResults: true,
    showRollDetails: false,
    hideDamage: false,
    hideConditionChanges: false,
    sharedVision: false,
    showPartyStats: true,
    npcNameVisibility: false,
    showSecretChecks: false
  };
}

async function longRestDialog() {
  const content = `
    <form class="pf1-party-dialog pf1-rest-dialog">
      <div class="pf1-rest-options">
        <label><input type="checkbox" name="restoreHealth" checked> Восстановить здоровье</label>
        <label><input type="checkbox" name="restoreDaily" checked> Восстановить ежедневный запас</label>
        <label><input type="checkbox" name="longTermCare"> Продолжительный уход</label>
      </div>
      <div class="form-group"><label>Длительность</label><div class="pf1-hours-input"><input type="number" name="hours" value="8" min="0" step="1"><span>Час</span></div></div>
    </form>`;
  return dialogPromise({
    title: "Отдых: группа",
    content,
    buttons: {
      ok: {
        label: "Отдых",
        callback: html => {
          const data = new FormData(html.find("form")[0]);
          return {
            restoreHealth: data.get("restoreHealth") === "on",
            restoreDaily: data.get("restoreDaily") === "on",
            longTermCare: data.get("longTermCare") === "on",
            hours: Math.max(0, toNumber(data.get("hours"), 8))
          };
        }
      }
    }
  });
}

function getPartyCheckSkills(members) {
  return buildPartySkillSummaries(members)
    .filter(isPartyOverviewSkill)
    .map(skill => ({ id: skill.id, label: skill.label, bonus: skill.best }));
}

async function checkRequestDialog(members) {
  const skills = getPartyCheckSkills(members);
  const skillOptions = skills.map(s => `<option value="${s.id}">${escapeHTML(s.label)} ${signed(s.bonus)}</option>`).join("");
  const content = `
    <form class="pf1-party-dialog pf1-check-request-dialog">
      <div class="form-group"><label>Заголовок запроса</label><input type="text" name="title"></div>
      <hr>
      <nav class="pf1-dialog-tabs">
        <a class="active">Заданная СЛ</a>
        <a>Простой СЛ</a>
        <a>СЛ на основе уровня</a>
      </nav>
      <div class="form-group"><label>Заданная СЛ</label><input type="number" name="dc" min="0" step="1"></div>
      <div class="form-group"><label>Регулировать сложность</label><select name="adjustment"><option value="">—</option><option value="-5">Очень легко -5</option><option value="-2">Легко -2</option><option value="2">Сложно +2</option><option value="5">Очень сложно +5</option></select></div>
      <hr>
      <nav class="pf1-dialog-tabs pf1-check-type-tabs">
        <label><input type="radio" name="checkType" value="skill" checked> Навыки</label>
        <label><input type="radio" name="checkType" value="save"> Испытания</label>
      </nav>
      <select name="skillId" class="pf1-check-skill-select">${skillOptions}</select>
      <select name="saveId" class="pf1-check-save-select"><option value="fort">Стойкость</option><option value="ref">Реакция</option><option value="will">Воля</option></select>
      <hr>
      <div class="pf1-check-params"><strong>Параметры броска</strong><label><input type="checkbox" name="secret"> Тайная проверка</label></div>
      <input type="text" name="actions" placeholder="Действия">
      <input type="text" name="rollParams" placeholder="Параметры броска">
    </form>`;
  return dialogPromise({
    title: "Создать проверку",
    content,
    buttons: {
      ok: {
        label: "Создать запрос",
        callback: html => {
          const data = new FormData(html.find("form")[0]);
          return {
            title: data.get("title") || "Проверка партии",
            checkType: data.get("checkType") || "skill",
            skillId: data.get("skillId"),
            saveId: data.get("saveId"),
            dc: data.get("dc") ? toNumber(data.get("dc"), 0) : null,
            adjustment: data.get("adjustment") ? toNumber(data.get("adjustment"), 0) : 0,
            secret: data.get("secret") === "on",
            actions: data.get("actions") || "",
            rollParams: data.get("rollParams") || ""
          };
        }
      },
      cancel: { label: "Отмена", callback: () => null }
    }
  });
}

function metagameDialog(current = {}) {
  const settings = mergeObject(defaultMetagameSettings(), current, { inplace: false });
  const checked = key => settings[key] ? "checked" : "";
  const content = `
    <form class="pf1-party-dialog pf1-metagame-dialog">
      <p>Ограничить доступ к метаигровой информации, к которой имеют доступ ваши игроки.</p>
      <label><span><b>Показывать СЛ проверок</b><em>Игроки могут видеть значения СЛ проверок, сделанных против NPC и других источников, не принадлежащих игрокам.</em></span><input type="checkbox" name="showCheckDC" ${checked("showCheckDC")}></label>
      <label><span><b>Показывать результаты проверок</b><em>Игроки будут видеть степень успешности проверок, сделанных против NPC и других источников, не принадлежащих игрокам.</em></span><input type="checkbox" name="showCheckResults" ${checked("showCheckResults")}></label>
      <label><span><b>Показывать подробности бросков</b><em>Игроки могут видеть составные и суммарные модификаторы бросков.</em></span><input type="checkbox" name="showRollDetails" ${checked("showRollDetails")}></label>
      <label><span><b>Скрыть полученный урон</b><em>Только Мастер видит сообщения о полученном уроне или исцелении у NPC и других источников.</em></span><input type="checkbox" name="hideDamage" ${checked("hideDamage")}></label>
      <label><span><b>Скрыть смену состояния</b><em>Только Мастер видит сообщения об обновлении состояний и напоминания для NPC и других источников.</em></span><input type="checkbox" name="hideConditionChanges" ${checked("hideConditionChanges")}></label>
      <label><span><b>Общее зрение игроков</b><em>Игроки взаимно разделяют общий обзор токенов независимо от разрешений и выбранного токена.</em></span><input type="checkbox" name="sharedVision" ${checked("sharedVision")}></label>
      <label><span><b>Показать статистику членов партии</b><em>Игроки будут видеть статистику своих товарищей по партии в листе партии.</em></span><input type="checkbox" name="showPartyStats" ${checked("showPartyStats")}></label>
      <label><span><b>Видимость имени токена NPC</b><em>Для любого токена персонажа мастера, чья табличка с именем не видна игрокам, его имя также будет скрыто от них в трекере столкновений и сообщениях чата.</em></span><input type="checkbox" name="npcNameVisibility" ${checked("npcNameVisibility")}></label>
      <label><span><b>Показывать тайные проверки</b><em>Игроки могут видеть в чате броски с признаком Тайна.</em></span><input type="checkbox" name="showSecretChecks" ${checked("showSecretChecks")}></label>
    </form>`;
  return dialogPromise({
    title: "Метаигровая информация",
    content,
    buttons: {
      ok: {
        label: "Сохранить изменения",
        callback: html => {
          const data = new FormData(html.find("form")[0]);
          const result = {};
          for (const key of Object.keys(defaultMetagameSettings())) result[key] = data.get(key) === "on";
          return result;
        }
      },
      reset: { label: "Сбросить изменения", callback: () => ({ reset: true }) }
    }
  });
}

class PF1PartyActorSheet extends ActorSheet {
  constructor(...args) {
    super(...args);
    this._stashQuantityState = new Map();
    this._stashQuantityTimers = new Map();
  }

  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      classes: ["pf1e", "pf1-party-folder", "sheet", "actor"],
      template: `modules/${MODULE_ID}/templates/party-sheet.hbs`,
      width: 760,
      height: 760,
      resizable: true,
      tabs: [
        { navSelector: ".pf1-party-primary-tabs", contentSelector: ".pf1-party-body", initial: "overview" },
        { navSelector: ".pf1-party-overview-tabs", contentSelector: ".pf1-overview-content", initial: "languages" }
      ],
      dragDrop: [{ dragSelector: ".pf1-party-item", dropSelector: ".pf1-party-sheet-root" }]
    });
  }

  get title() {
    return this.actor.name || "The Party";
  }

  _renderPreservingScroll() {
    renderPartySheetPreservingScroll(this);
  }

  async _render(force = false, options = {}) {
    const position = getPartySheetScrollLock(this) ?? capturePartySheetScroll(this);
    const result = await super._render(force, options);
    if (position) {
      this._pf1PartyScrollLock = { position, until: Date.now() + 2500 };
      restorePartySheetScroll(this, position);
      setTimeout(() => restorePartySheetScroll(this, position), 75);
      setTimeout(() => restorePartySheetScroll(this, position), 250);
    }
    return result;
  }

  _withPendingStashQuantities(stash) {
    const nextStash = deepClone(stash);
    for (const [stashId, quantity] of this._stashQuantityState) {
      const index = nextStash.items.findIndex(i => i.stashId === stashId);
      if (index < 0) continue;
      const source = getStashItemSource(nextStash.items[index]);
      setItemQuantity(source, quantity);
      nextStash.items[index] = buildStashItemEntry(nextStash.items[index], source);
    }
    return nextStash;
  }

  async getData(options) {
    const data = await super.getData(options);
    const members = getPartyMembers(this.actor);
    const activities = this.actor.getFlag(MODULE_ID, ACTIVITIES_FLAG) ?? {};
    const stash = this._withPendingStashQuantities(getStash(this.actor));
    const heroPoints = getHeroPoints(this.actor);
    const metagame = mergeObject(defaultMetagameSettings(), this.actor.getFlag(MODULE_ID, METAGAME_FLAG) ?? {}, { inplace: false });
    const liveStats = buildPartyStatsData(members, activities, stash, heroPoints);
    if (game.user.isGM && !getPublicPartySnapshot(this.actor)) schedulePublicPartySnapshotRefresh(this.actor);
    const publicStats = getPublicPartySnapshot(this.actor);
    const stats = !game.user.isGM && metagame.showPartyStats && publicStats?.members?.length ? publicStats : liveStats;
    const skills = stats.skills.filter(isPartyOverviewSkill).map(withSkillTone);
    const knowledgeSkills = stats.skills.filter(isKnowledgeSkill).map(withSkillTone);

    return mergeObject(data, {
      party: {
        id: this.actor.id,
        uuid: this.actor.uuid,
        name: this.actor.name,
        img: this.actor.img || PARTY_ICON,
        tokenImg: gprop(this.actor, "prototypeToken.texture.src") || this.actor.img || PARTY_ICON,
        permissionLabel: "Настройки",
        portraitClass: `pf1-portraits-${game.settings.get(MODULE_ID, "memberPortraitStyle") || "pf2e"}`,
        moduleVersion: MODULE_VERSION_LABEL
      },
      members: stats.members,
      languages: stats.languages,
      skills,
      knowledgeSkills,
      skillGroups: buildSkillGroups(skills, isBackgroundPartySkill),
      knowledgeGroups: buildSkillGroups(knowledgeSkills, isBackgroundKnowledgeSkill),
      travel: stats.travel,
      stash: buildStashView(stash),
      stashTotals: buildStashTotals(stash),
      partyTotals: stats.partyTotals
    }, { inplace: false });
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.find(".pf1-party-token-drag").on("dragstart", event => this._onPartyTokenDragStart(event));

    html.find(".pf1-party-item").on("dragstart", event => this._onStashItemDragStart(event));
    html.find(".pf1-stash-item").on("click", event => this._onStashItemClick(event));
    html.find(".pf1-stash-item").on("contextmenu", event => this._onStashItemContext(event));
    html.find(".pf1-currency-input").on("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    });
    html.find(".pf1-currency-input").on("blur", event => this._onCurrencyInput(event));
    html.find(".pf1-stash-field").on("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    });
    html.find(".pf1-stash-field").on("blur", event => this._onStashFieldInput(event));
    html.find(".pf1-stash-price input").on("mouseenter focus", event => this._showStashPriceEach(event));
    html.find(".pf1-stash-price input").on("mouseleave", event => this._restoreStashPriceTotal(event));
    html.find(".pf1-hero-points").on("contextmenu", event => this._onHeroPointContext(event));
    html.find(".pf1-party-name-input").on("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.currentTarget.blur();
      }
    });
    html.find(".pf1-party-name-input").on("blur", event => this._onPartyNameInput(event));
    html.find("[data-action]").on("click", event => this._onAction(event));
    html.find(".pf1-stash-search").on("input", event => this._filterStash(event.currentTarget.value, html));
  }

  _onPartyTokenDragStart(event) {
    const nativeEvent = event.originalEvent ?? event;
    const dataTransfer = nativeEvent.dataTransfer;
    if (!dataTransfer) return;
    const src = gprop(this.actor, "prototypeToken.texture.src") || this.actor.img || PARTY_ICON;
    const tokenName = gprop(this.actor, "prototypeToken.name") || this.actor.name || "Партия";
    const actorDragData = this.actor.toDragData ? this.actor.toDragData() : { type: "Actor", uuid: this.actor.uuid, id: this.actor.id };
    actorDragData.type = "Actor";
    actorDragData.uuid = this.actor.uuid;
    actorDragData.id = this.actor.id;
    actorDragData.img = src;
    actorDragData.name = tokenName;
    actorDragData.flags = actorDragData.flags || {};
    actorDragData.flags[MODULE_ID] = { partyToken: true };
    dataTransfer.effectAllowed = "copy";
    const payload = JSON.stringify(actorDragData);
    dataTransfer.setData("text/plain", payload);
    dataTransfer.setData("application/json", payload);
  }

  async _onDrop(event) {
    const nativeEvent = event.originalEvent ?? event;
    if (nativeEvent?._pf1PartyStashHandled) return;
    const data = getPartyDropData(event);
    if (!data) return;

    if (data.type === "Actor") {
      event.preventDefault();
      const actor = data.uuid ? await fromUuid(data.uuid) : game.actors.get(data.id);
      if (actor) await addMember(this.actor, actor.id);
      this._renderPreservingScroll();
      return;
    }

    if (data.type === "Item") {
      const target = nativeEvent?.target instanceof Element ? nativeEvent.target : event.currentTarget;
      if (!target?.closest?.(".pf1-party-stash-main")) return;
      event.preventDefault();
      await storeDroppedItemInPartyStash(this.actor, data, event);
      this._renderPreservingScroll();
      return;
    }
  }

  async _storeItem(item, event, { sourceDocument = null, dropData = null } = {}) {
    const data = item?.toDragData?.() ?? { type: "Item", data: item?.toObject ? item.toObject() : item };
    return storeDroppedItemInPartyStash(this.actor, data, event);
  }

  async _deleteMovedSourceItem(item, event, dropData = null) {
    return deleteMovedSourceItem(item, event, dropData);
  }


  _onStashItemDragStart(event) {
    const stashId = event.currentTarget.dataset.itemId;
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!item) return;
    const source = prepareStashItemSourceForPF1Sheet(item);
    delete source._id;
    source.flags = source.flags || {};
    source.flags[MODULE_ID] = source.flags[MODULE_ID] || {};
    source.flags[MODULE_ID][STASH_TRANSFER_FLAG] = { partyActorId: this.actor.id, stashId };
    event.originalEvent.dataTransfer.setData("text/plain", JSON.stringify({
      type: "Item",
      data: source,
      name: source.name || item.name,
      img: source.img || item.img
    }));
  }

  async _onStashItemClick(event) {
    if ($(event.target).closest("button, a, input, select, textarea, [data-action]").length) return;
    event.currentTarget.classList.toggle("is-description-open");
  }

  async _onStashItemContext(event) {
    if ($(event.target).closest("button, a, input, select, textarea, [data-action]").length) return;
    event.preventDefault();
    await this._openStashItem(event.currentTarget.dataset.itemId);
  }

  async _openStashItem(stashId) {
    const scrollSnapshots = captureOpenPartySheetScrolls();
    await this._saveQueuedStashQuantity(stashId);
    restoreOpenPartySheetScrolls(scrollSnapshots);

    const stash = getStash(this.actor);
    const stashItem = stash.items.find(i => i.stashId === stashId);
    if (!stashItem) return;

    const source = prepareStashItemSourceForPF1Sheet(stashItem);
    const editable = this.actor.testUserPermission(game.user, "OWNER");
    try {
      const ItemClass = CONFIG.Item?.documentClass ?? globalThis.Item;
      if (!ItemClass) throw new Error("Item document class is not available.");
      const item = new ItemClass(source, { parent: this.actor });
      registerOpenStashItemSource(item, this.actor, stashId);
      if (typeof item.prepareData === "function") item.prepareData();
      const originalTestUserPermission = item.testUserPermission?.bind(item);
      item.testUserPermission = (user, permission, ...args) => editable || originalTestUserPermission?.(user, permission, ...args) || false;
      item.update = async (changes = {}, options = {}) => {
        if (!editable) return item;
        const updateScrollSnapshots = captureOpenPartySheetScrolls();
        if (typeof item.updateSource === "function") item.updateSource(changes, options);
        if (typeof item.prepareData === "function") item.prepareData();
        const expanded = foundry.utils.expandObject(changes ?? {});
        const nextSource = item.toObject
          ? item.toObject()
          : mergeObject(source, expanded, { inplace: false });
        await updateStashItemSource(this.actor, stashId, nextSource);
        for (const app of Object.values(item.apps ?? {})) {
          if (app.rendered) app.render(false);
        }
        await renderOpenPartySheets();
        restoreOpenPartySheetScrolls(updateScrollSnapshots);
        return item;
      };
      item.delete = async () => {
        if (editable) {
          const deleteScrollSnapshots = captureOpenPartySheetScrolls();
          await this._deleteStashItem(stashId);
          await renderOpenPartySheets();
          restoreOpenPartySheetScrolls(deleteScrollSnapshots);
        }
        return item;
      };
      const sheet = item.sheet;
      if (!sheet) throw new Error("Item sheet is not available.");
      if (sheet.options) sheet.options.editable = editable;
      const scheduleContainerDragDataInjection = () => {
        setTimeout(() => injectStashContainerSheetDragData(sheet, sheet.element), 0);
        setTimeout(() => injectStashContainerSheetDragData(sheet, sheet.element), 150);
        setTimeout(() => injectStashContainerSheetDragData(sheet, sheet.element), 500);
      };
      const originalRender = sheet.render?.bind(sheet);
      if (originalRender) {
        sheet.render = (...args) => {
          const result = originalRender(...args);
          scheduleContainerDragDataInjection();
          return result;
        };
      }
      const restoreItemSheetCloseScrolls = snapshots => {
        if (!snapshots?.length) return;
        for (const snapshot of snapshots) {
          if (snapshot.app?._pf1PartyScrollLock) delete snapshot.app._pf1PartyScrollLock;
        }
        restoreOpenPartySheetScrollsBriefly(snapshots);
      };
      const closeHookNames = ["closeApplication", "closeDocumentSheet", "closeItemSheet", "closeItemSheetPF", "closeItemSheetPF_Container"];
      const closeHooks = [];
      let closeHandled = false;
      const clearCloseHooks = () => {
        for (const [hookName, hookId] of closeHooks) Hooks.off(hookName, hookId);
        closeHooks.length = 0;
      };
      const finishItemSheetClose = snapshots => {
        if (closeHandled) return;
        closeHandled = true;
        clearCloseHooks();
        unregisterOpenStashItemSource(item);
        restoreItemSheetCloseScrolls(snapshots?.length ? snapshots : scrollSnapshots);
      };
      for (const hookName of closeHookNames) {
        const hookId = Hooks.on(hookName, app => {
          if (app !== sheet && app.object !== item && app.document !== item) return;
          finishItemSheetClose(sheet._pf1PartyClosingSnapshots ?? captureOpenPartySheetScrolls());
        });
        closeHooks.push([hookName, hookId]);
      }
      const originalClose = sheet.close?.bind(sheet);
      if (originalClose) {
        sheet.close = async (...args) => {
          const closeScrollSnapshots = captureOpenPartySheetScrolls();
          sheet._pf1PartyClosingSnapshots = closeScrollSnapshots;
          try {
            return await originalClose(...args);
          } finally {
            finishItemSheetClose(closeScrollSnapshots);
          }
        };
      }
      sheet.render(true);
      scheduleContainerDragDataInjection();
      restoreOpenPartySheetScrolls(scrollSnapshots);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not open stash item sheet`, err);
      restoreOpenPartySheetScrolls(scrollSnapshots);
      ui.notifications.error("Не удалось открыть лист предмета PF1e. Подробности в консоли.");
    }
  }

  async _onHeroPointContext(event) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.blur?.();
    await this._adjustHeroPoints(event.currentTarget.dataset.actorId, -1);
  }

  async _adjustHeroPoints(actorId, delta) {
    if (!actorId) return;
    const scrollSnapshots = captureOpenPartySheetScrolls();
    await changeActorHeroPoints(this.actor, actorId, delta);
    restoreOpenPartySheetScrolls(scrollSnapshots);
  }

  async _onCurrencyInput(event) {
    const input = event.currentTarget;
    const coin = input.dataset.coin;
    if (!CURRENCY_META[coin]) return;
    const raw = String(input.value ?? "").trim();
    const stash = getStash(this.actor);
    const current = toNumber(stash.currency[coin], 0);
    if (!raw) {
      input.value = current;
      return;
    }
    let next;
    if (/^[+-]/.test(raw)) next = current + toNumber(raw, 0);
    else next = toNumber(raw, current);
    next = Math.max(0, Math.floor(next));
    if (next === current) {
      input.value = current;
      return;
    }
    stash.currency[coin] = next;
    const scrollSnapshots = captureOpenPartySheetScrolls();
    await setStash(this.actor, stash);
    this._renderPreservingScroll();
    restoreOpenPartySheetScrolls(scrollSnapshots);
  }

  _showStashPriceEach(event) {
    const input = event.currentTarget;
    if (input.dataset.field !== "price") return;
    input.closest(".pf1-stash-price")?.classList.add("is-editing-each");
    input.value = input.dataset.priceEach ?? input.value;
  }

  _restoreStashPriceTotal(event) {
    const input = event.currentTarget;
    if (input.dataset.field !== "price" || document.activeElement === input) return;
    input.closest(".pf1-stash-price")?.classList.remove("is-editing-each");
    input.value = input.dataset.priceTotal ?? input.value;
  }

  _applyStashRowValues(row, source) {
    const rowElement = row?.jquery ? row : $(row);
    if (!rowElement?.length) return;
    const quantity = getItemQuantity(source);
    const priceEach = getItemPriceGpEach(source);
    const weightEach = getItemWeightEach(source);
    const priceTotal = quantity > 0 ? priceEach * quantity : priceEach;
    const weightTotal = quantity > 0 ? weightEach * quantity : weightEach;

    rowElement.toggleClass("is-empty-stack", quantity <= 0);
    rowElement.find(".pf1-stash-quantity-input").val(quantity);

    const priceInput = rowElement.find(".pf1-stash-price input")[0];
    if (priceInput) {
      priceInput.dataset.priceEach = fmtNumber(priceEach);
      priceInput.dataset.priceTotal = fmtNumber(priceTotal);
      const editingEach = document.activeElement === priceInput || priceInput.closest(".pf1-stash-price")?.classList.contains("is-editing-each");
      priceInput.value = editingEach ? priceInput.dataset.priceEach : priceInput.dataset.priceTotal;
    }

    rowElement.find(".pf1-stash-weight input").val(fmtNumber(weightTotal));
  }

  _clearStashQuantityTimer(stashId) {
    const timer = this._stashQuantityTimers.get(stashId);
    if (timer) clearTimeout(timer);
    this._stashQuantityTimers.delete(stashId);
  }

  _queueStashQuantitySave(stashId) {
    this._clearStashQuantityTimer(stashId);
    const timer = setTimeout(() => this._saveQueuedStashQuantity(stashId), STASH_QUANTITY_SAVE_DELAY_MS);
    this._stashQuantityTimers.set(stashId, timer);
  }

  async _saveQueuedStashQuantity(stashId) {
    this._clearStashQuantityTimer(stashId);
    if (!this._stashQuantityState.has(stashId)) return;
    const quantity = this._stashQuantityState.get(stashId);
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!item) {
      this._stashQuantityState.delete(stashId);
      return;
    }
    const source = getStashItemSource(item);
    if (getItemQuantity(source) === quantity) {
      this._stashQuantityState.delete(stashId);
      return;
    }
    setItemQuantity(source, quantity);
    await updateStashItemSource(this.actor, stashId, source);
    if (this._stashQuantityState.get(stashId) === quantity) this._stashQuantityState.delete(stashId);
  }

  async _onStashFieldInput(event) {
    const input = event.currentTarget;
    if (input.dataset.field === "price") input.closest(".pf1-stash-price")?.classList.remove("is-editing-each");
    await this._updateStashItemField(input.dataset.itemId, input.dataset.field, input.value, {
      row: $(input).closest(".pf1-stash-item")
    });
    this._renderPreservingScroll();
  }

  _changeStashQuantity(stashId, delta, { row = null } = {}) {
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!item) return;
    const source = getStashItemSource(item);
    const current = this._stashQuantityState.has(stashId) ? this._stashQuantityState.get(stashId) : getItemQuantity(source);
    const next = Math.max(0, current + Math.floor(toNumber(delta, 0)));
    this._stashQuantityState.set(stashId, next);
    setItemQuantity(source, next);
    this._applyStashRowValues(row, source);
    this._queueStashQuantitySave(stashId);
  }

  async _updateStashItemField(stashId, field, rawValue, { row = null } = {}) {
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!item) return;

    const source = getStashItemSource(item);
    if (this._stashQuantityState.has(stashId)) {
      setItemQuantity(source, this._stashQuantityState.get(stashId));
      this._clearStashQuantityTimer(stashId);
      this._stashQuantityState.delete(stashId);
    }
    const quantity = getItemQuantity(source);
    if (field === "quantity") {
      setItemQuantity(source, Math.floor(toNumber(rawValue, quantity)));
    } else if (field === "price") {
      setItemPriceGpEach(source, Math.max(0, toNumber(rawValue, getItemPriceGpEach(source))));
    } else if (field === "weight") {
      const totalWeight = Math.max(0, toNumber(rawValue, getItemWeightEach(source) * Math.max(1, quantity)));
      setItemWeightEach(source, quantity > 0 ? totalWeight / quantity : totalWeight);
    } else {
      return;
    }
    this._applyStashRowValues(row, source);
    await updateStashItemSource(this.actor, stashId, source);
    this._applyStashRowValues(row, source);
  }

  async _onPartyNameInput(event) {
    const input = event.currentTarget;
    const name = String(input.value || "").trim() || "The Party";
    if (name === this.actor.name) return;
    await this._setPartyName(name);
  }

  async _setPartyName(name) {
    const result = String(name || "The Party").trim() || "The Party";
    await game.settings.set(MODULE_ID, "partyName", result);
    const folder = await ensurePartyFolder(result);
    await this.actor.update({ name: result, "prototypeToken.name": result });
    if (folder && folder.name !== result && game.user.isGM) await folder.update({ name: result });
  }

  async _onAction(event) {
    event.preventDefault();
    const button = event.currentTarget;
    const action = button.dataset.action;
    const actorId = button.dataset.actorId;
    const actor = actorId ? game.actors.get(actorId) : null;
    if (button.dataset.itemId && action !== "change-stash-quantity") await this._saveQueuedStashQuantity(button.dataset.itemId);

    switch (action) {
      case "rename-party":
        await this._renameParty();
        break;
      case "edit-party-img":
        await this._editPartyImage();
        break;
      case "metagame-settings":
        await this._metagameSettings();
        break;
      case "remove-member":
        await removeMember(this.actor, actorId);
        break;
      case "adjust-hero-points":
        button.blur?.();
        await this._adjustHeroPoints(actorId, 1);
        return;
      case "roll-skill":
        if (actor) {
          await rollSkill(actor, button.dataset.skillId, {
            flavor: `${actor.name}: ${button.textContent.trim()}`,
            heroPointBonus: event.shiftKey ? 8 : 0,
            partyActor: this.actor
          });
        } else {
          await this._chooseSkillRoller(button.dataset.skillId, button.dataset.skillLabel || button.textContent.trim(), {
            heroPointBonus: event.shiftKey ? 8 : 0
          });
        }
        break;
      case "set-activity":
        await this._setActivity(actor);
        break;
      case "roll-activity":
        await this._rollActivity(actor, { heroPointBonus: event.shiftKey ? 8 : 0 });
        break;
      case "roll-activities":
        await this._openCheckRequestDialog();
        break;
      case "clear-activities":
        await this.actor.setFlag(MODULE_ID, ACTIVITIES_FLAG, {});
        break;
      case "long-rest":
        await this._longRest();
        break;
      case "edit-currency":
        await this._editCurrency(button.dataset.coin);
        break;
      case "add-currency":
        await this._changeCurrency("add");
        break;
      case "subtract-currency":
        await this._changeCurrency("subtract");
        break;
      case "split-currency":
        await this._splitCurrency();
        break;
      case "split-stash-item":
        await this._splitStashItem(button.dataset.itemId);
        break;
      case "edit-stash-item":
        await this._openStashItem(button.dataset.itemId);
        return;
      case "change-stash-quantity":
        this._changeStashQuantity(button.dataset.itemId, toNumber(button.dataset.delta, 0), {
          row: $(button).closest(".pf1-stash-item")
        });
        return;
      case "take-item":
        await this._takeItem(button.dataset.itemId);
        break;
      case "delete-stash-item":
        await this._deleteStashItem(button.dataset.itemId);
        break;
      case "stash-category-add":
        await this._createStashItem(button.dataset.category);
        break;
      case "open-item-library":
        await this._openItemLibrary(button.dataset.category);
        break;
    }

    this._renderPreservingScroll();
  }

  async _renameParty() {
    const content = `<form class="pf1-party-dialog"><div class="form-group"><label>Название</label><input type="text" name="name" value="${escapeHTML(this.actor.name || "The Party")}"></div></form>`;
    const result = await dialogPromise({
      title: "Переименовать партию",
      content,
      buttons: { ok: { label: "Сохранить", callback: html => String(new FormData(html.find("form")[0]).get("name") || "The Party").trim() } }
    });
    if (!result) return;
    await this._setPartyName(result);
  }

  async _editPartyImage() {
    if (!this.actor.isOwner) return ui.notifications.warn("Недостаточно прав для изменения картинки партии.");
    new FilePicker({
      type: "image",
      current: this.actor.img || PARTY_ICON,
      callback: async path => {
        await this.actor.update({ img: path, "prototypeToken.texture.src": path });
        this.render(false);
        ui.actors?.render(false);
      }
    }).browse();
  }

  async _metagameSettings() {
    const current = this.actor.getFlag(MODULE_ID, METAGAME_FLAG) ?? defaultMetagameSettings();
    const result = await metagameDialog(current);
    if (!result) return;
    if (result.reset) await this.actor.setFlag(MODULE_ID, METAGAME_FLAG, defaultMetagameSettings());
    else await this.actor.setFlag(MODULE_ID, METAGAME_FLAG, result);
  }

  async _chooseSkillRoller(skillId, label, { heroPointBonus = 0 } = {}) {
    const rows = getPartyMembers(this.actor, { ignorePermissions: true })
      .map(actor => ({ actor, bonus: getSkillBonus(actor, skillId) }))
      .sort((a, b) => b.bonus - a.bonus || a.actor.name.localeCompare(b.actor.name, game.i18n.lang));
    if (!rows.length) return;

    const options = rows
      .map(row => `<option value="${escapeHTML(row.actor.id)}">${escapeHTML(row.actor.name)} ${signed(row.bonus)}</option>`)
      .join("");
    const result = await dialogPromise({
      title: `Бросок навыка: ${escapeHTML(label || skillId)}`,
      content: `
        <form class="pf1-party-dialog pf1-skill-roll-dialog">
          <div class="form-group">
            <label>Персонаж</label>
            <select name="actorId">${options}</select>
          </div>
        </form>`,
      buttons: {
        roll: {
          label: "Подтвердить",
          callback: html => String(new FormData(html.find("form")[0]).get("actorId") || "")
        },
        cancel: { label: "Отмена", callback: () => null }
      },
      defaultButton: "roll"
    });
    if (!result) return;
    const actor = game.actors.get(result);
    if (!actor) return;
    await rollSkill(actor, skillId, {
      flavor: `${actor.name}: ${label || skillId}`,
      heroPointBonus,
      partyActor: this.actor
    });
  }

  async _openCheckRequestDialog() {
    const members = getPartyMembers(this.actor);
    const result = await checkRequestDialog(members);
    if (!result) return;
    const dc = result.dc !== null ? result.dc + toNumber(result.adjustment, 0) : null;
    const skill = getPartyCheckSkills(members).find(s => s.id === result.skillId);
    const saveLabels = { fort: "Стойкость", ref: "Реакция", will: "Воля" };
    const checkLabel = result.checkType === "save" ? saveLabels[result.saveId] : skill?.label;
    const content = `
      <div class="pf1-party-chat-request">
        <h2>${escapeHTML(result.title)}</h2>
        <p><b>${result.checkType === "save" ? "Испытание" : "Навык"}:</b> ${escapeHTML(checkLabel || "—")}</p>
        ${dc !== null ? `<p><b>СЛ:</b> ${dc}</p>` : ""}
        ${result.secret ? `<p><b>Тайная проверка</b></p>` : ""}
        ${result.actions ? `<p><b>Действия:</b> ${escapeHTML(result.actions)}</p>` : ""}
        ${result.rollParams ? `<p><b>Параметры броска:</b> ${escapeHTML(result.rollParams)}</p>` : ""}
      </div>`;
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content,
      whisper: result.secret ? ChatMessage.getWhisperRecipients("GM").map(u => u.id) : undefined
    });
  }

  async _setActivity(actor) {
    if (!actor) return;
    const activities = deepClone(this.actor.getFlag(MODULE_ID, ACTIVITIES_FLAG) ?? {});
    const result = await activityDialog(actor, activities[actor.id] ?? {});
    if (!result) return;
    if (result.clear) delete activities[actor.id];
    else activities[actor.id] = result;
    await this.actor.setFlag(MODULE_ID, ACTIVITIES_FLAG, activities);
  }

  async _rollActivity(actor, { heroPointBonus = 0 } = {}) {
    if (!actor) return;
    const activities = this.actor.getFlag(MODULE_ID, ACTIVITIES_FLAG) ?? {};
    const activity = activities[actor.id];
    if (!activity?.skillId) return;
    await rollSkill(actor, activity.skillId, {
      flavor: `${actor.name}: ${activity.title || "Активность"}`,
      extraBonus: activity.bonus,
      dc: activity.dc,
      heroPointBonus,
      partyActor: this.actor
    });
  }

  async _rollActivities() {
    for (const actor of getPartyMembers(this.actor)) await this._rollActivity(actor);
  }

  async _longRest() {
    const rest = await longRestDialog();
    if (!rest) return;

    for (const actor of getPartyMembers(this.actor)) {
      if (!actor.testUserPermission(game.user, "OWNER")) continue;
      let handledBySystem = false;
      if (typeof actor.performRest === "function") {
        try {
          await actor.performRest({
            restoreHealth: rest.restoreHealth,
            restoreDailyUses: rest.restoreDaily,
            longTermCare: rest.longTermCare,
            hours: rest.hours
          });
          handledBySystem = true;
        } catch (err) {
          console.warn(`${MODULE_ID} | performRest failed, using fallback`, err);
        }
      }
      if (!handledBySystem && rest.restoreHealth) {
        const hp = getHp(actor);
        const updatePath = has(actor, "system.attributes.hp.value") ? "system.attributes.hp.value" : "system.attributes.hp.value";
        await actor.update({ [updatePath]: hp.max });
      }
      if (!handledBySystem && rest.restoreDaily) {
        if (typeof actor.resetSpellbookUsage === "function") await actor.resetSpellbookUsage();
        if (typeof actor.rechargeItems === "function") await actor.rechargeItems();
      }
    }
    ui.notifications.info("Отдых применён к доступным персонажам партии.");
  }

  async _editCurrency(coin) {
    const stash = getStash(this.actor);
    const content = `<form class="pf1-party-dialog"><div class="form-group"><label>${CURRENCY_META[coin].label}</label><input type="number" name="value" min="0" step="1" value="${stash.currency[coin] || 0}"></div></form>`;
    const result = await dialogPromise({
      title: `Изменить ${CURRENCY_META[coin].label}`,
      content,
      buttons: {
        ok: { label: "ОК", callback: html => Math.max(0, Math.floor(toNumber(new FormData(html.find("form")[0]).get("value"), 0))) }
      }
    });
    if (result === null) return;
    stash.currency[coin] = result;
    await setStash(this.actor, stash);
  }

  async _changeCurrency(mode) {
    const delta = await currencyDialog(mode === "add" ? "Добавить валюту" : "Вычесть валюту");
    if (!delta) return;
    const stash = getStash(this.actor);
    if (mode === "add") {
      for (const coin of Object.keys(CURRENCY_META)) stash.currency[coin] = (stash.currency[coin] || 0) + delta[coin];
    } else {
      for (const coin of Object.keys(CURRENCY_META)) stash.currency[coin] = Math.max(0, (stash.currency[coin] || 0) - delta[coin]);
    }
    await setStash(this.actor, stash);
  }

  async _splitCurrency() {
    const members = getPartyMembers(this.actor).filter(actor => actor.testUserPermission(game.user, "OWNER"));
    if (!members.length) return ui.notifications.warn("Нет доступных участников партии для распределения монет.");

    const stash = getStash(this.actor);
    const hasCoins = Object.keys(CURRENCY_META).some(coin => toNumber(stash.currency[coin], 0) > 0);
    if (!hasCoins) return ui.notifications.warn("В тайнике нет монет для распределения.");

    const confirmed = await Dialog.confirm({
      title: "Распределить монеты",
      content: `<p>Распределить монеты поровну между доступными участниками партии (${members.length}) без конвертации номиналов? Остаток останется в тайнике.</p>`
    });
    if (!confirmed) return;

    const shareCurrency = { pp: 0, gp: 0, sp: 0, cp: 0 };
    const remainderCurrency = { pp: 0, gp: 0, sp: 0, cp: 0 };
    for (const coin of Object.keys(CURRENCY_META)) {
      const amount = Math.max(0, Math.floor(toNumber(stash.currency[coin], 0)));
      shareCurrency[coin] = Math.floor(amount / members.length);
      remainderCurrency[coin] = amount - shareCurrency[coin] * members.length;
    }
    for (const actor of members) await addCurrencyToActor(actor, shareCurrency);
    stash.currency = remainderCurrency;
    await setStash(this.actor, stash);
    ui.notifications.info("Монеты распределены между участниками партии без конвертации номиналов.");
  }

  async _splitStashItem(stashId) {
    const stash = getStash(this.actor);
    const index = stash.items.findIndex(i => i.stashId === stashId);
    const item = stash.items[index];
    if (!item) return;

    const source = getStashItemSource(item);
    const quantity = getItemQuantity(source);
    if (quantity <= 1) return ui.notifications.warn("Этот предмет нельзя разделить: количество уже равно 1.");

    const content = `
      <form class="pf1-party-dialog">
        <div class="form-group"><label>Отделить количество</label><input type="number" name="amount" min="1" max="${quantity - 1}" step="1" value="1"></div>
        <p class="notes">В исходной стопке останется ${quantity - 1} из ${quantity}.</p>
      </form>`;
    const amount = await dialogPromise({
      title: `Разделить «${escapeHTML(item.name || source.name || "Предмет")}»`,
      content,
      buttons: {
        ok: {
          label: "Разделить",
          callback: html => Math.floor(toNumber(new FormData(html.find("form")[0]).get("amount"), 1))
        },
        cancel: { label: "Отмена", callback: () => null }
      }
    });
    if (!amount) return;

    const splitAmount = Math.min(quantity - 1, Math.max(1, amount));
    const originalSource = setItemQuantity(source, quantity - splitAmount);
    const splitSource = setItemQuantity(deepClone(source), splitAmount);
    splitSource._id = foundry.utils.randomID();

    stash.items[index] = buildStashItemEntry(item, originalSource);
    stash.items.splice(index + 1, 0, buildStashItemEntry({
      ...item,
      stashId: foundry.utils.randomID(),
      sourceItemId: null
    }, splitSource));
    await setStash(this.actor, stash);
  }

  async _takeItem(stashId) {
    const members = getPartyMembers(this.actor).filter(actor => actor.testUserPermission(game.user, "OWNER"));
    if (!members.length) return ui.notifications.warn("Нет доступных листов персонажей.");

    const options = members.map(actor => `<option value="${actor.id}">${actor.name}</option>`).join("");
    const result = await dialogPromise({
      title: "Забрать предмет",
      content: `<form class="pf1-party-dialog"><div class="form-group"><label>Кому передать?</label><select name="actorId">${options}</select></div></form>`,
      buttons: { ok: { label: "Передать", callback: html => new FormData(html.find("form")[0]).get("actorId") } }
    });
    if (!result) return;

    const actor = game.actors.get(result);
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!actor || !item) return;

    const source = prepareStashItemSourceForPF1Sheet(item);
    delete source._id;
    await actor.createEmbeddedDocuments("Item", [source]);
    stash.items = stash.items.filter(i => i.stashId !== stashId);
    await setStash(this.actor, stash);
  }

  async _deleteStashItem(stashId) {
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!item) return;
    const confirmed = await Dialog.confirm({ title: "Удалить предмет", content: `<p>Удалить «${escapeHTML(item.name)}» из общего тайника?</p>` });
    if (!confirmed) return;
    stash.items = stash.items.filter(i => i.stashId !== stashId);
    await setStash(this.actor, stash);
  }

  async _createStashItem(category) {
    const source = defaultStashItemSource(category);
    const stash = getStash(this.actor);
    const entry = normalizeItemForStash(source);
    stash.items.push(entry);
    await setStash(this.actor, stash);
  }

  async _openItemLibrary(category) {
    if (await openNativePF1ItemBrowser(category)) return;

    const categoryTerms = {
      weapons: ["weapon", "оруж"],
      armor: ["armor", "equipment", "брон", "снаряж"],
      consumables: ["potion", "scroll", "wand", "consum", "зель", "свит", "жез", "расход"],
      equipment: ["equipment", "gear", "снаряж"],
      ammo: ["ammo", "ammunition", "боеприп", "стрел"],
      misc: ["loot", "misc", "treasure", "разное", "добыч"],
      goods: ["goods", "trade", "товар"],
      containers: ["container", "контейнер"]
    };
    const packs = [...(game.packs ?? [])].filter(pack => {
      const meta = pack.metadata ?? {};
      return pack.documentName === "Item" && (meta.package === "pf1" || meta.system === "pf1" || String(meta.id || "").startsWith("pf1."));
    });
    if (!packs.length) {
      ui.notifications.warn("Не найдены библиотеки предметов Pathfinder 1e.");
      return;
    }

    const terms = categoryTerms[category] ?? [];
    const preferred = packs.filter(pack => {
      const meta = pack.metadata ?? {};
      const text = `${pack.collection ?? ""} ${meta.id ?? ""} ${meta.label ?? ""} ${pack.title ?? ""}`.toLocaleLowerCase(game.i18n?.lang || "ru");
      return terms.some(term => text.includes(term));
    });
    const matches = preferred.length ? preferred : packs;

    if (matches.length === 1) {
      matches[0].render(true);
      return;
    }

    const rows = matches
      .sort((a, b) => (a.metadata?.label || a.title || a.collection).localeCompare(b.metadata?.label || b.title || b.collection, game.i18n.lang))
      .map(pack => {
        const label = pack.metadata?.label || pack.title || pack.collection;
        return `<button type="button" data-pack="${escapeHTML(pack.collection)}">${escapeHTML(label)}</button>`;
      }).join("");

    new Dialog({
      title: "Библиотеки Pathfinder 1e",
      content: `<div class="pf1-party-dialog pf1-library-dialog">${rows}</div>`,
      buttons: { close: { label: "Закрыть" } },
      render: html => {
        html.find("[data-pack]").on("click", event => {
          const pack = game.packs.get(event.currentTarget.dataset.pack);
          pack?.render(true);
        });
      }
    }).render(true);
  }

  _filterStash(query, html) {
    const q = String(query || "").trim().toLowerCase();
    html.find(".pf1-stash-category").each((_, category) => {
      const categoryElement = $(category);
      let visibleCount = 0;
      categoryElement.find(".pf1-stash-item").each((_, element) => {
        const row = $(element);
        const haystack = String(row.data("search") || "").toLowerCase();
        const visible = !q || haystack.includes(q);
        row.toggleClass("is-filter-hidden", !visible);
        if (visible) visibleCount += 1;
      });
      categoryElement.toggleClass("is-filter-hidden", !!q && visibleCount === 0);
      if (q && visibleCount > 0) category.open = true;
    });
  }
}

function collectionValues(collection) {
  if (!collection) return [];
  if (Array.isArray(collection)) return collection;
  if (Array.isArray(collection.contents)) return collection.contents;
  if (typeof collection.values === "function") return [...collection.values()];
  return [];
}

function getPartyTokenImage(partyActor = getPartyActor()) {
  if (!partyActor) return PARTY_ICON;
  const actorId = partyActor.id;
  const currentCanvas = globalThis.canvas;
  for (const token of currentCanvas?.tokens?.placeables ?? []) {
    if (gprop(token, "document.actorId") !== actorId) continue;
    const src = gprop(token, "document.texture.src") || gprop(token, "document.img") || gprop(token, "texture.src");
    if (src) return src;
  }
  for (const token of collectionValues(currentCanvas?.scene?.tokens)) {
    if ((gprop(token, "actorId") || gprop(token, "actor.id")) !== actorId) continue;
    const src = gprop(token, "texture.src") || gprop(token, "img");
    if (src) return src;
  }
  return gprop(partyActor, "prototypeToken.texture.src") || partyActor.img || PARTY_ICON;
}

function getPartyPrototypeTokenData(partyActor, position = {}) {
  const src = gprop(partyActor, "prototypeToken.texture.src") || partyActor.img || PARTY_ICON;
  const proto = partyActor.prototypeToken?.toObject ? partyActor.prototypeToken.toObject() : deepClone(partyActor.prototypeToken ?? {});
  delete proto._id;
  proto.name = gprop(proto, "name") || partyActor.name || "Партия";
  proto.actorId = partyActor.id;
  proto.actorLink = gprop(proto, "actorLink") ?? true;
  proto.texture = proto.texture || {};
  proto.texture.src = src;
  proto.img = src;
  proto.x = position.x ?? 0;
  proto.y = position.y ?? 0;
  return proto;
}

function getCanvasDropPosition(event, data = {}) {
  if (Number.isFinite(data.x) && Number.isFinite(data.y)) return { x: data.x, y: data.y };
  const clientX = event?.clientX ?? event?.originalEvent?.clientX;
  const clientY = event?.clientY ?? event?.originalEvent?.clientY;
  if (Number.isFinite(clientX) && Number.isFinite(clientY)) {
    let point;
    if (canvas?.canvasCoordinatesFromClient) point = canvas.canvasCoordinatesFromClient({ x: clientX, y: clientY });
    else if (canvas?.stage?.worldTransform) point = canvas.stage.worldTransform.applyInverse(new PIXI.Point(clientX, clientY));
    if (point) {
      const snapped = canvas?.grid?.getSnappedPosition ? canvas.grid.getSnappedPosition(point.x, point.y, 1) : point;
      return { x: snapped.x, y: snapped.y };
    }
  }
  return { x: 0, y: 0 };
}

async function createPartyTokenOnCanvas(data, event = null) {
  if (!canvas?.scene) return false;
  const party = data.actorId ? game.actors.get(data.actorId) : getPartyActor();
  if (!party) return false;
  const position = getCanvasDropPosition(event, data);
  const tokenData = getPartyPrototypeTokenData(party, position);
  await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
  return true;
}

function hidePartyActorRows(html) {
  const actor = getPartyActor();
  if (!actor) return;
  const selectors = [
    `.directory-item.actor[data-document-id="${actor.id}"]`,
    `.directory-item.actor[data-entry-id="${actor.id}"]`,
    `.directory-item.actor[data-actor-id="${actor.id}"]`,
    `.directory-item.actor[data-id="${actor.id}"]`,
    `.directory-item.actor[data-uuid="${actor.uuid}"]`,
    `li.actor[data-document-id="${actor.id}"]`,
    `li.actor[data-entry-id="${actor.id}"]`,
    `li.actor[data-actor-id="${actor.id}"]`,
    `li.actor[data-id="${actor.id}"]`,
    `li.actor[data-uuid="${actor.uuid}"]`
  ];
  html.find(selectors.join(",")).remove();
  html.find(".directory-item.actor, li.actor, .directory-item.document, li.directory-item").each((_, element) => {
    const row = $(element);
    const dataId = row.attr("data-document-id") || row.attr("data-entry-id") || row.attr("data-actor-id") || row.attr("data-id") || row.data("documentId") || row.data("entryId") || row.data("actorId") || row.data("id");
    const dataUuid = row.attr("data-uuid") || row.data("uuid");
    if (dataId === actor.id || dataUuid === actor.uuid) row.remove();
  });
}

function findPartyFolderRow(html, folder) {
  if (!folder) return $();
  const selectors = [
    `.directory-item.folder[data-folder-id="${folder.id}"]`,
    `.folder[data-folder-id="${folder.id}"]`,
    `li.folder[data-folder-id="${folder.id}"]`,
    `.directory-item[data-folder-id="${folder.id}"]`,
    `li[data-folder-id="${folder.id}"]`,
    `.directory-item.folder[data-document-id="${folder.id}"]`,
    `.folder[data-document-id="${folder.id}"]`,
    `li.folder[data-document-id="${folder.id}"]`
  ];
  let row = html.find(selectors.join(",")).first();
  if (row.length) return row;
  html.find(".directory-item.folder, li.folder, .folder").each((_, element) => {
    const candidate = $(element);
    const id = candidate.attr("data-folder-id") || candidate.attr("data-document-id") || candidate.data("folderId") || candidate.data("documentId");
    if (id === folder.id) row = candidate;
  });
  return row;
}

function injectPartyDirectory(html) {
  hidePartyActorRows(html);

  // Убираю старую кнопку из верхней панели, если она осталась после прежней сборки.
  html.find(".pf1-open-party-button").remove();

  const folder = getPartyFolder();
  if (!folder) return;
  const folderRow = findPartyFolderRow(html, folder);
  if (!folderRow.length) return;
  folderRow.find(".pf1-folder-open-party-button").remove();

  const header = folderRow.children(".folder-header").first().length
    ? folderRow.children(".folder-header").first()
    : folderRow.find(".folder-header, header, .folder-name").first();
  if (!header.length) return;

  const buttonImg = getPartyTokenImage(getPartyActor());
  const safeButtonImg = String(buttonImg).replace(/"/g, "%22");
  const buttonStyle = game.settings.get(MODULE_ID, "folderButtonStyle") || "icon";
  const styleClass = buttonStyle === "circle" ? "is-circle" : "is-icon";
  const button = $(
    `<a class="pf1-folder-open-party-button ${styleClass}" title="Открыть меню партии" aria-label="Открыть меню партии">
      <span class="pf1-folder-open-party-icon" aria-hidden="true"><i class="fas fa-users"></i><img src="${escapeHTML(buttonImg)}" alt=""></span>
    </a>`
  );
  button[0]?.style?.setProperty("--pf1-party-folder-icon", `url("${safeButtonImg}")`);

  button.on("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    const party = await ensurePartyActor();
    if (party) {
      party.sheet.render(true);
      hidePartyActorRows(html);
    }
  });

  const insertionTarget = header.find(".create-folder, .folder-create, [data-action='createFolder'], [data-action='folderCreate'], .create-entity, [data-action='createEntity'], [data-action='createActor']").first();
  if (insertionTarget.length) button.insertBefore(insertionTarget);
  else header.append(button);
}

async function renderOpenPartySheets() {
  const actor = getPartyActor();
  if (!actor) return;
  await refreshPublicPartySnapshot(actor);
  for (const app of Object.values(actor.apps ?? {})) {
    if (app instanceof PF1PartyActorSheet) renderPartySheetPreservingScroll(app);
  }
}

function getChatMessageFromContext(li) {
  const jq = li?.jquery ? li : $(li);
  const id = jq.data("messageId") || jq.attr("data-message-id") || jq.attr("data-messageId");
  return id ? game.messages.get(id) : null;
}

function getChatMessageActor(message) {
  const actorId = message?.getFlag?.(MODULE_ID, "actorId") || message?.speaker?.actor;
  return actorId ? game.actors.get(actorId) : null;
}

function getChatMessageParty(message) {
  const partyActorId = message?.getFlag?.(MODULE_ID, "partyActorId");
  return partyActorId ? game.actors.get(partyActorId) : getPartyActor();
}

function getChatMessageRollTotal(message) {
  const rolls = message?.rolls?.length ? message.rolls : (message?.roll ? [message.roll] : []);
  const total = rolls[0]?.total;
  return Number.isFinite(total) ? total : null;
}

function canUseHeroPointOnChatMessage(message) {
  if (!message || message.getFlag?.(MODULE_ID, "heroPointChatBonusUsed")) return false;
  if (message.getFlag?.(MODULE_ID, "heroPointPreBonusUsed")) return false;
  if (getChatMessageRollTotal(message) === null) return false;
  const actor = getChatMessageActor(message);
  const party = getChatMessageParty(message);
  if (!actor || !party) return false;
  const isPartyMember = getPartyMembers(party, { ignorePermissions: true }).some(member => member.id === actor.id);
  if (!isPartyMember) return false;
  const canSpend = game.user.isGM || actor.testUserPermission(game.user, "OWNER") || party.testUserPermission(game.user, "OWNER");
  if (!canSpend) return false;
  return getHeroPointValue(getHeroPoints(party), actor.id) > 0;
}

async function useHeroPointOnChatMessage(message) {
  if (!canUseHeroPointOnChatMessage(message)) return;
  const actor = getChatMessageActor(message);
  const party = getChatMessageParty(message);
  const total = getChatMessageRollTotal(message);
  const spent = await spendHeroPoint(party, actor.id);
  if (!spent) return;

  const finalTotal = total + HERO_POINT_CHAT_BONUS;
  const note = `
    <div class="pf1-hero-point-chat-bonus">
      <span class="pf1-hero-point-chat-icon"><img src="${HERO_POINT_ICON}" alt=""></span>
      <div class="pf1-hero-point-chat-text">
        <strong>Использовано геройское очко</strong>
        <span>${escapeHTML(actor.name)}: ${fmtNumber(total)} + ${HERO_POINT_CHAT_BONUS} = <b>${fmtNumber(finalTotal)}</b></span>
      </div>
    </div>`;
  const flags = {
    [`flags.${MODULE_ID}.heroPointChatBonusUsed`]: true,
    [`flags.${MODULE_ID}.heroPointChatBonus`]: HERO_POINT_CHAT_BONUS,
    [`flags.${MODULE_ID}.heroPointOriginalTotal`]: total,
    [`flags.${MODULE_ID}.heroPointFinalTotal`]: finalTotal,
    [`flags.${MODULE_ID}.actorId`]: actor.id,
    [`flags.${MODULE_ID}.partyActorId`]: party.id
  };

  try {
    await message.update({ content: `${message.content || ""}${note}`, ...flags });
  } catch (err) {
    console.warn(`${MODULE_ID} | Could not update roll message with hero point bonus`, err);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: note,
      flags: foundry.utils.expandObject(flags).flags
    });
  }
  await renderOpenPartySheets();
}

function actorIsInParty(actor, party = getPartyActor()) {
  if (!actor || !party) return false;
  return getPartyMembers(party, { ignorePermissions: true }).some(member => member.id === actor.id);
}

function injectActorSheetHeroPoints(app, html) {
  const actor = app?.actor ?? app?.object;
  const party = getPartyActor();
  if (!actorIsInParty(actor, party)) return;
  const root = html?.jquery ? html : $(html);
  if (root.find(".pf1-actor-hero-points").length) return;

  const state = getHeroPointState(getHeroPoints(party), actor.id);
  const control = $(heroPointControlHTML(actor.id, state, { className: "pf1-actor-hero-points" }));
  control.on("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    await changeActorHeroPoints(party, actor.id, 1);
  });
  control.on("contextmenu", async event => {
    event.preventDefault();
    event.stopPropagation();
    await changeActorHeroPoints(party, actor.id, -1);
  });

  const nameInput = root.find('input[name="name"], input[name="actor.name"], input[name="data.name"]').first();
  if (nameInput.length) {
    nameInput.parent().addClass("pf1-actor-name-hero-wrap");
    nameInput.after(control);
    return;
  }

  const fallback = root.find(".charname, .character-name, h1, header").first();
  if (fallback.length) fallback.append(control);
}

function inferActorFromRollDialog(app, html) {
  const candidates = [
    app?.actor,
    app?.object?.actor,
    app?.object,
    app?.options?.actor,
    app?.data?.actor
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (candidate?.documentName === "Actor") return candidate;
    if (candidate?.actor?.documentName === "Actor") return candidate.actor;
  }
  const speakerActor = app?.data?.speaker?.actor ?? app?.options?.speaker?.actor;
  if (speakerActor && game.actors?.has(speakerActor)) return game.actors.get(speakerActor);
  const title = normalizeBrowserFilterText(`${app?.title ?? ""} ${html.closest(".window-app").find(".window-title").first().text()}`);
  return [...(game.actors ?? [])].find(actor => title.includes(normalizeBrowserFilterText(actor.name))) ?? null;
}

function findRollDialogBaseDiceRow(root) {
  const labels = root.find("label, span, h3, h4, div").filter((_, element) => /base dice|базов/i.test(element.textContent || ""));
  for (const label of labels) {
    const row = $(label).closest(".form-group, .form-fields, .form-row, li, tr, div");
    if (row.length) return row.first();
  }
  const diceInput = root.find("input[name]").filter((_, element) => /dice|base/i.test(element.name || "")).first();
  return diceInput.length ? diceInput.closest(".form-group, .form-fields, .form-row, li, tr, div").first() : $();
}

function findRollDialogSituationalBonusRow(root) {
  const labels = root.find("label, span, h3, h4, div").filter((_, element) => /ситуатив|situational/i.test(element.textContent || ""));
  for (const label of labels) {
    const row = $(label).closest(".form-group, .form-fields, .form-row, li, tr, div");
    if (row.find("input, textarea").length) return row.first();
  }
  const input = root.find("input[name], textarea[name]").filter((_, element) => {
    const name = String(element.name || "").toLocaleLowerCase();
    return /bonus|modifier|mod|extra|circumstance|situational/.test(name);
  }).first();
  return input.length ? input.closest(".form-group, .form-fields, .form-row, li, tr, div").first() : $();
}

function findRollDialogSituationalBonusInput(root) {
  const namedInput = root.find("input[name], textarea[name]").filter((_, element) => {
    const name = String(element.name || "").toLocaleLowerCase();
    if (/dice|base|dc|notes?|flavor|rollmode|mode/.test(name)) return false;
    return /bonus|modifier|mod|extra|circumstance|situational/.test(name);
  }).first();
  if (namedInput.length) return namedInput;

  const labels = root.find("label, span").filter((_, element) => /ситуатив(?:ный)?\s+бонус|situational\s+bonus/i.test((element.textContent || "").trim()));
  for (const label of labels) {
    let row = $(label);
    for (let depth = 0; depth < 5 && row.length; depth++) {
      const inputs = row.find("input, textarea").filter((_, element) => {
        const name = String(element.name || "").toLocaleLowerCase();
        const placeholder = String(element.placeholder || "").toLocaleLowerCase();
        return !/dice|base|dc|notes?|flavor|rollmode|mode|2d20/.test(`${name} ${placeholder}`);
      });
      if (inputs.length === 1) return inputs.first();
      row = row.parent();
    }
  }
  return $();
}

function appendFormulaBonus(value, bonus) {
  const raw = String(value ?? "").trim();
  if (!raw) return String(bonus);
  const numeric = Number(raw);
  if (Number.isFinite(numeric)) return String(numeric + bonus);
  return `(${raw}) + ${bonus}`;
}

function applyHeroPointBonusToRollDialog(root) {
  const form = root.find("form").first();
  const bonus = HERO_POINT_PRE_ROLL_BONUS;
  const inputs = form.find('input[name], textarea[name]').filter((_, element) => {
    const name = String(element.name || "").toLocaleLowerCase();
    if (/dice|base|dc|notes?|flavor|rollmode|mode/.test(name)) return false;
    return /bonus|modifier|mod|extra|circumstance|situational/.test(name);
  });
  const target = inputs.first();
  if (target.length) {
    target.val(appendFormulaBonus(target.val(), bonus)).trigger("change");
    return;
  }
  form.append(`<input type="hidden" name="bonus" value="${bonus}">`);
}

function isHeroPointRollButton(element) {
  const text = normalizeBrowserFilterText(element?.textContent ?? "");
  const action = normalizeBrowserFilterText(element?.dataset?.button ?? element?.dataset?.action ?? element?.name ?? "");
  return /обычн|normal|take 10|take10|take 20|take20/.test(`${text} ${action}`);
}

function injectHeroPointRollDialog(app, html) {
  const root = html?.jquery ? html : $(html);
  if (root.find(".pf1-hero-roll-toggle").length) return;
  if (!/base dice|take 10|take 20|обычн|базов/i.test(root.text())) return;

  const actor = inferActorFromRollDialog(app, root);
  const party = getPartyActor();
  if (!actorIsInParty(actor, party)) return;
  if (getHeroPointValue(getHeroPoints(party), actor.id) <= 0) return;

  const situationalInput = findRollDialogSituationalBonusInput(root);
  if (!situationalInput.length) return;
  const row = situationalInput.closest(".form-group, .form-fields, .form-row, li, tr, div").first();
  const toggle = $(`<button type="button" class="pf1-hero-roll-toggle" title="Геройское очко: +${HERO_POINT_PRE_ROLL_BONUS} к броску"><img src="${HERO_POINT_ICON}" alt=""></button>`);
  toggle.on("click", event => {
    event.preventDefault();
    event.stopPropagation();
    toggle.toggleClass("is-active");
  });
  row.addClass("pf1-hero-roll-row");
  toggle.insertBefore(situationalInput);

  const rootElement = root[0];
  rootElement.addEventListener("click", event => {
    const button = event.target?.closest?.("button");
    if (!button || !isHeroPointRollButton(button)) return;
    if (!toggle.hasClass("is-active") || rootElement.dataset.pf1HeroPointSpent === "true") return;
    rootElement.dataset.pf1HeroPointSpent = "true";
    applyHeroPointBonusToRollDialog(root);
    spendHeroPoint(party, actor.id).then(() => refreshHeroPointControls(actor.id));
  }, true);
}

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "partyName", {
    name: "Название партии",
    hint: "Имя актёра-партии, который появится в списке актёров.",
    scope: "world",
    config: true,
    type: String,
    default: "The Party"
  });

  game.settings.register(MODULE_ID, "autoCreateParty", {
    name: "Создавать партию автоматически",
    hint: "ГМ создаст актёра партии при входе в мир, если его ещё нет.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoUserCharacters", {
    name: "Автоматически добавлять назначенных персонажей игроков",
    hint: "В обзор партии попадут персонажи, выбранные у игроков в поле Character.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "autoOwnedCharacters", {
    name: "ГМу автоматически видеть всех персонажей игроков",
    hint: "Для ГМа в партию будут добавлены все персонажи, которыми владеет хотя бы один игрок.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "folderButtonStyle", {
    name: "Вид кнопки партии в папке",
    hint: "Белая иконка выравнивается с кнопками справа. Круг оставляет старый вид и вписывает в него картинку партии.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      icon: "Белая иконка",
      circle: "Круг с картинкой партии"
    },
    default: "icon",
    onChange: () => ui.actors?.render(false)
  });

  game.settings.register(MODULE_ID, "memberPortraitStyle", {
    name: "Вид портретов в листе партии",
    hint: "PF2e убирает лишние поля у картинок. Круг включает старый вариант портретов в круглой рамке.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      pf2e: "PF2e без лишних полей",
      circle: "Старые круглые портреты"
    },
    default: "pf2e",
    onChange: () => renderOpenPartySheets()
  });

  Handlebars.registerHelper("signed", signed);
  Handlebars.registerHelper("fmt", fmtNumber);

  Actors.registerSheet(MODULE_ID, PF1PartyActorSheet, {
    types: ["character"],
    makeDefault: false,
    label: "PF1e Party Folder"
  });
});

Hooks.once("ready", async () => {
  if (game.system.id !== "pf1") {
    ui.notifications.warn("PF1e Party Folder рассчитан на систему Pathfinder 1e.");
    return;
  }

  if (game.user.isGM && game.settings.get(MODULE_ID, "autoCreateParty")) await ensurePartyActor({ notify: false });
  await refreshPublicPartySnapshot();
  ui.actors?.render(false);
});

Hooks.on("renderActorDirectory", (app, html) => injectPartyDirectory(html));
Hooks.on("renderActorSheet", (app, html) => injectActorSheetHeroPoints(app, html));
Hooks.on("renderDialog", (app, html) => injectHeroPointRollDialog(app, html));
Hooks.on("renderItemSheet", injectStashContainerSheetDragData);
Hooks.on("renderItemSheetPF", injectStashContainerSheetDragData);
Hooks.on("renderItemSheetPF_Container", injectStashContainerSheetDragData);
Hooks.once("ready", () => {
  document.addEventListener("dragover", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const stashArea = target.closest(".window-app.pf1-party-folder .pf1-party-stash-main");
    if (!stashArea) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }, true);
  document.addEventListener("drop", event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const stashArea = target.closest(".window-app.pf1-party-folder .pf1-party-stash-main");
    if (!stashArea) return;
    const data = getPartyDropData(event);
    if (data?.type !== "Item") return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    event._pf1PartyStashHandled = true;
    const appId = stashArea.closest(".app")?.dataset?.appid;
    const app = appId ? ui.windows?.[appId] : null;
    const party = app instanceof PF1PartyActorSheet ? app.actor : getPartyActor();
    if (!party) return;
    storeDroppedItemInPartyStash(party, data, event).catch(err => console.warn(`${MODULE_ID} | Manual stash drop failed`, err));
  }, true);
});
Hooks.on("getChatLogEntryContext", (html, options) => {
  options.push({
    name: "Использовать геройское очко",
    icon: `<img class="pf1-hero-point-context-icon" src="${HERO_POINT_ICON}" alt="">`,
    condition: li => canUseHeroPointOnChatMessage(getChatMessageFromContext(li)),
    callback: li => useHeroPointOnChatMessage(getChatMessageFromContext(li))
  });
});
Hooks.on("dropCanvasData", async (canvas, data, event) => {
  if (data?.type === "PF1EPartyToken") {
    event?.preventDefault?.();
    await createPartyTokenOnCanvas(data, event);
    return false;
  }
});
Hooks.on("updateFolder", async (folder, changed) => {
  if (folder.type !== "Actor" || !folder.getFlag(MODULE_ID, PARTY_FOLDER_FLAG) || changed.name === undefined) return;
  if (!game.user.isGM) return;
  const newName = String(folder.name || "The Party").trim() || "The Party";
  if (game.settings.get(MODULE_ID, "partyName") !== newName) await game.settings.set(MODULE_ID, "partyName", newName);
  const party = getPartyActor();
  if (party && party.name !== newName) await party.update({ name: newName, "prototypeToken.name": newName });
  renderOpenPartySheets();
});

Hooks.on("createActor", renderOpenPartySheets);
Hooks.on("updateActor", (actor, changed) => {
  const party = getPartyActor();
  const changedHeroPoints = has(changed, `flags.${MODULE_ID}.${HERO_POINTS_FLAG}`);
  if (party && actor?.id === party.id && changedHeroPoints) {
    for (const actorId of Object.keys(getHeroPoints(party))) refreshHeroPointControls(actorId);
    return;
  }
  renderOpenPartySheets();
});
Hooks.on("deleteActor", renderOpenPartySheets);
Hooks.on("createItem", async (item, options, userId) => {
  const transfer = item.getFlag?.(MODULE_ID, STASH_TRANSFER_FLAG) ?? gprop(item, `flags.${MODULE_ID}.${STASH_TRANSFER_FLAG}`);
  if (transfer && item.parent?.documentName === "Actor" && item.parent.id !== transfer.partyActorId && game.user.id === userId) {
    const party = game.actors.get(transfer.partyActorId);
    if (party && party.testUserPermission(game.user, "OWNER")) {
      const stash = getStash(party);
      const before = stash.items.length;
      stash.items = stash.items.filter(i => i.stashId !== transfer.stashId);
      if (stash.items.length !== before) await setStash(party, stash);
    }
    if (item.isOwner && typeof item.unsetFlag === "function") await item.unsetFlag(MODULE_ID, STASH_TRANSFER_FLAG).catch(() => {});
  }
  renderOpenPartySheets();
});
Hooks.on("updateItem", renderOpenPartySheets);
Hooks.on("deleteItem", renderOpenPartySheets);

window.PF1EPartyFolder = {
  ensurePartyActor,
  getPartyActor,
  getPartyFolder,
  PF1PartyActorSheet,
  version: MODULE_VERSION_LABEL
};
