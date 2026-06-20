const MODULE_ID = "pf1e-party-folder";
const PARTY_FLAG = "isParty";
const PARTY_FOLDER_FLAG = "isPartyFolder";
const STASH_TRANSFER_FLAG = "stashTransfer";
const METAGAME_FLAG = "metagame";
const MEMBERS_FLAG = "members";
const STASH_FLAG = "stash";
const ACTIVITIES_FLAG = "activities";
const PUBLIC_SNAPSHOT_FLAG = "publicSnapshot";
const SHEET_ID = `${MODULE_ID}.PF1PartyActorSheet`;
const PARTY_ICON = `modules/${MODULE_ID}/assets/party-hood.svg`;
const MODULE_VERSION_LABEL = "v1.0.11-fix";
const STASH_QUANTITY_SAVE_DELAY_MS = 120;

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


function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  return { value, max };
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
    const baseLabel = getSkillLabel(id, skill);
    const label = parentLabel && !baseLabel.includes(parentLabel) ? `${parentLabel}: ${baseLabel}` : baseLabel;
    if (Number.isFinite(mod)) {
      result.push({ id, label: formatSkillLabel(label), bonus: mod, actorId: actor.id, actorName: actor.name });
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
      if (!existing || skill.bonus > existing.best) {
        byId.set(skill.id, {
          id: skill.id,
          label: skill.label,
          best: skill.bonus,
          bestActorId: actor.id,
          bestActorName: actor.name
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
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
  return Math.max(0, toNumber(gprop(itemData, "system.quantity") ?? gprop(itemData, "system.qty") ?? gprop(itemData, "data.data.quantity") ?? 1, 1));
}

function setItemQuantity(itemData, quantity) {
  const value = Math.max(0, Math.floor(toNumber(quantity, 1)));
  if (has(itemData, "system.quantity") || !has(itemData, "data.data.quantity")) sprop(itemData, "system.quantity", value);
  else sprop(itemData, "data.data.quantity", value);
  return itemData;
}

function getItemWeightEach(itemData) {
  return Math.max(0, toNumber(gprop(itemData, "system.weight") ?? gprop(itemData, "system.weight.value") ?? gprop(itemData, "data.data.weight") ?? 0, 0));
}

function getItemPriceGpEach(itemData) {
  const raw = gprop(itemData, "system.price") ?? gprop(itemData, "system.price.value") ?? gprop(itemData, "data.data.price") ?? 0;
  return parsePriceToGp(raw);
}

function setItemPriceGpEach(itemData, priceGp) {
  const value = Math.max(0, toNumber(priceGp, 0));
  if (has(itemData, "system.price.value")) sprop(itemData, "system.price.value", value);
  else if (has(itemData, "data.data.price")) sprop(itemData, "data.data.price", value);
  else sprop(itemData, "system.price", value);
  return itemData;
}

function setItemWeightEach(itemData, weight) {
  const value = Math.max(0, toNumber(weight, 0));
  if (has(itemData, "system.weight.value")) sprop(itemData, "system.weight.value", value);
  else if (has(itemData, "data.data.weight")) sprop(itemData, "data.data.weight", value);
  else sprop(itemData, "system.weight", value);
  return itemData;
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
    const data = item.toObject ? item.toObject() : item;
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
    const data = item.toObject ? item.toObject() : item;
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
    search: `${stashItem.name || data.name || ""} ${stashItem.type || data.type || ""}`.toLowerCase()
  };
}

function getStashItemSource(stashItem) {
  const source = deepClone(stashItem?.stashId && stashItem?.data ? stashItem.data : stashItem ?? {});
  source._id = source._id || foundry.utils.randomID();
  source.name = source.name || stashItem?.name || "Предмет";
  source.type = source.type || stashItem?.type || "loot";
  source.img = source.img || stashItem?.img || "icons/svg/item-bag.svg";
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

async function updateStashItemSource(partyActor, stashId, itemSource) {
  const stash = getStash(partyActor);
  const index = stash.items.findIndex(i => i.stashId === stashId);
  if (index < 0) return null;
  stash.items[index] = buildStashItemEntry(stash.items[index], itemSource);
  await setStash(partyActor, stash);
  return stash.items[index];
}

function itemSourceFromFallbackForm(itemSource, form) {
  const data = new FormData(form);
  const source = getStashItemSource(itemSource);
  source.name = String(data.get("name") || source.name || "Предмет").trim() || "Предмет";
  source.type = String(data.get("type") || source.type || "loot").trim() || "loot";
  source.img = String(data.get("img") || source.img || "icons/svg/item-bag.svg").trim() || "icons/svg/item-bag.svg";
  source.system = source.system || {};
  sprop(source, "system.quantity", Math.max(0, Math.floor(toNumber(data.get("quantity"), 1))));
  sprop(source, "system.price", toNumber(data.get("price"), 0));
  sprop(source, "system.weight", toNumber(data.get("weight"), 0));
  sprop(source, "system.description.value", String(data.get("description") || ""));
  return source;
}

function renderStashItemFallbackDialog(partyActor, stashId, stashItem, itemSource, { editable = false } = {}) {
  const description = getItemDescriptionHTML(itemSource).trim() || "<em>Описание не заполнено.</em>";
  const quantity = getItemQuantity(itemSource);
  const price = fmtNumber(getItemPriceGpEach(itemSource));
  const weight = fmtNumber(getItemWeightEach(itemSource));
  const content = editable ? `
    <form class="pf1-party-dialog pf1-stash-item-dialog">
      <div class="pf1-stash-item-dialog-head">
        <img src="${escapeHTML(itemSource.img || stashItem.img || "icons/svg/item-bag.svg")}" alt="">
        <div>
          <h3>${escapeHTML(itemSource.name || stashItem.name || "Предмет")}</h3>
          <p>Запасной редактор предмета тайника</p>
        </div>
      </div>
      <div class="form-group"><label>Название</label><input type="text" name="name" value="${escapeHTML(itemSource.name || stashItem.name || "Предмет")}"></div>
      <div class="form-group"><label>Тип PF1</label><input type="text" name="type" value="${escapeHTML(itemSource.type || stashItem.type || "loot")}"></div>
      <div class="form-group"><label>Картинка</label><input type="text" name="img" value="${escapeHTML(itemSource.img || stashItem.img || "icons/svg/item-bag.svg")}"></div>
      <div class="form-group"><label>Количество</label><input type="number" name="quantity" value="${quantity}" min="0" step="1"></div>
      <div class="form-group"><label>Цена за штуку, зм</label><input type="number" name="price" value="${price}" min="0" step="0.01"></div>
      <div class="form-group"><label>Вес за штуку, фнт.</label><input type="number" name="weight" value="${weight}" min="0" step="0.01"></div>
      <div class="form-group stacked"><label>Описание</label><textarea name="description" rows="8">${escapeHTML(getItemDescriptionHTML(itemSource))}</textarea></div>
    </form>` : `
    <article class="pf1-party-dialog pf1-stash-item-dialog">
      <div class="pf1-stash-item-dialog-head">
        <img src="${escapeHTML(itemSource.img || stashItem.img || "icons/svg/item-bag.svg")}" alt="">
        <div>
          <h3>${escapeHTML(itemSource.name || stashItem.name || "Предмет")}</h3>
          <p>${escapeHTML(itemSource.type || stashItem.type || "loot")} · ${quantity} шт. · ${fmtNumber(getItemPriceGpEach(itemSource) * quantity)} зм · ${fmtNumber(getItemWeightEach(itemSource) * quantity)} фнт.</p>
        </div>
      </div>
      <div class="pf1-stash-item-dialog-description">${description}</div>
    </article>`;

  new Dialog({
    title: itemSource.name || stashItem.name || "Предмет",
    content,
    buttons: editable ? {
      save: {
        label: "Сохранить",
        callback: async html => {
          const form = html.find("form")[0];
          if (!form) return;
          const source = itemSourceFromFallbackForm(itemSource, form);
          await updateStashItemSource(partyActor, stashId, source);
          renderOpenPartySheets();
        }
      },
      close: { label: "Отмена" }
    } : { close: { label: "Закрыть" } },
    default: editable ? "save" : "close"
  }).render(true);
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
  if (type === "equipment") return "armor";
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

function actorSummary(actor, activities = {}) {
  const skills = collectSkills(actor);
  const activity = activities[actor.id] ?? {};
  const activitySkill = skills.find(s => s.id === activity.skillId);
  return {
    id: actor.id,
    name: actor.name,
    img: actor.img || PARTY_ICON,
    hp: getHp(actor),
    ac: getAc(actor),
    saves: getSaves(actor),
    perception: getSkillBonus(actor, "per"),
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

function buildPartyStatsData(members, activities, stash) {
  const skills = buildPartySkillSummaries(members);
  const languages = [...new Set(members.flatMap(getLanguages))].sort((a, b) => a.localeCompare(b, game.i18n.lang));
  return {
    members: members.map(actor => actorSummary(actor, activities)),
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
  const members = getPartyMembers(partyActor, { ignorePermissions: true });
  const snapshot = buildPartyStatsData(members, activities, stash);
  const current = getPublicPartySnapshot(partyActor);
  if (JSON.stringify(current) !== JSON.stringify(snapshot)) await partyActor.setFlag(MODULE_ID, PUBLIC_SNAPSHOT_FLAG, snapshot);
  return snapshot;
}

async function rollSkill(actor, skillId, { flavor = null, extraBonus = 0, dc = null } = {}) {
  if (!actor) return;
  if (typeof actor.rollSkill === "function" && !extraBonus && !dc) {
    return actor.rollSkill(skillId, { event: null });
  }
  const bonus = getSkillBonus(actor, skillId) + toNumber(extraBonus, 0);
  const roll = await new Roll(`1d20 + ${bonus}`).roll({ async: true });
  const total = roll.total;
  const dcText = dc ? `; СЛ ${dc}${total >= dc ? " — успех" : " — провал"}` : "";
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: flavor || `Проверка навыка: ${skillId}${dcText}`
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
    const metagame = mergeObject(defaultMetagameSettings(), this.actor.getFlag(MODULE_ID, METAGAME_FLAG) ?? {}, { inplace: false });
    const liveStats = buildPartyStatsData(members, activities, stash);
    if (game.user.isGM) await refreshPublicPartySnapshot(this.actor);
    const publicStats = getPublicPartySnapshot(this.actor);
    const stats = !game.user.isGM && metagame.showPartyStats && publicStats?.members?.length ? publicStats : liveStats;

    return mergeObject(data, {
      party: {
        id: this.actor.id,
        uuid: this.actor.uuid,
        name: this.actor.name,
        img: this.actor.img || PARTY_ICON,
        tokenImg: gprop(this.actor, "prototypeToken.texture.src") || this.actor.img || PARTY_ICON,
        permissionLabel: this.actor.testUserPermission(game.user, "OWNER") ? "НЕОГРАНИЧЕННАЯ" : "ОГРАНИЧЕННАЯ",
        moduleVersion: MODULE_VERSION_LABEL
      },
      members: stats.members,
      languages: stats.languages,
      skills: stats.skills.filter(isPartyOverviewSkill),
      knowledgeSkills: stats.skills.filter(isKnowledgeSkill),
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
    html.find(".pf1-stash-quantity").on("wheel", event => this._onStashQuantityWheel(event));
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
    event.preventDefault();
    const data = TextEditor.getDragEventData(event);
    if (!data) return;

    if (data.type === "Actor") {
      const actor = data.uuid ? await fromUuid(data.uuid) : game.actors.get(data.id);
      if (actor) await addMember(this.actor, actor.id);
      return this.render(false);
    }

    if (data.type === "Item") {
      const item = data.uuid ? await fromUuid(data.uuid) : null;
      const itemSource = item ?? data.data;
      if (!itemSource) return ui.notifications.warn("Не удалось прочитать предмет.");
      const sourceData = itemSource.toObject ? itemSource.toObject() : itemSource;
      const sourceType = String(sourceData.type || "").toLowerCase();
      const stashSource = sourceType === "spell" ? await createItemFromDroppedSpell(itemSource) : itemSource;
      if (!stashSource) return;
      await this._storeItem(stashSource, event);
      return this.render(false);
    }
  }

  async _storeItem(item, event) {
    const stash = getStash(this.actor);
    const stashItem = normalizeItemForStash(item);
    stash.items.push(stashItem);
    await setStash(this.actor, stash);

    const parent = item.parent;
    const shouldMove = parent?.documentName === "Actor" && parent.testUserPermission(game.user, "OWNER") && !event.ctrlKey;
    if (shouldMove) await parent.deleteEmbeddedDocuments("Item", [item.id]);

  }


  _onStashItemDragStart(event) {
    const stashId = event.currentTarget.dataset.itemId;
    const stash = getStash(this.actor);
    const item = stash.items.find(i => i.stashId === stashId);
    if (!item) return;
    const source = deepClone(item.data ?? item);
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
    await this._openStashItem(event.currentTarget.dataset.itemId);
  }

  async _openStashItem(stashId) {
    await this._saveQueuedStashQuantity(stashId);
    const stash = getStash(this.actor);
    const stashItem = stash.items.find(i => i.stashId === stashId);
    if (!stashItem) return;

    const source = getStashItemSource(stashItem);
    const editable = this.actor.testUserPermission(game.user, "OWNER");
    try {
      const ItemClass = CONFIG.Item?.documentClass ?? globalThis.Item;
      if (!ItemClass) throw new Error("Item document class is not available.");
      const item = new ItemClass(source, { parent: this.actor });
      const originalTestUserPermission = item.testUserPermission?.bind(item);
      item.testUserPermission = (user, permission, ...args) => editable || originalTestUserPermission?.(user, permission, ...args) || false;
      item.update = async (changes = {}, options = {}) => {
        if (!editable) return item;
        if (typeof item.updateSource === "function") item.updateSource(changes, options);
        const expanded = foundry.utils.expandObject(changes ?? {});
        const nextSource = item.toObject
          ? item.toObject()
          : mergeObject(source, expanded, { inplace: false });
        await updateStashItemSource(this.actor, stashId, nextSource);
        renderOpenPartySheets();
        return item;
      };
      item.delete = async () => {
        if (editable) await this._deleteStashItem(stashId);
        return item;
      };
      const sheet = item.sheet;
      if (!sheet) throw new Error("Item sheet is not available.");
      if (sheet.options) sheet.options.editable = editable;
      sheet.render(true);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not open stash item sheet`, err);
      renderStashItemFallbackDialog(this.actor, stashId, stashItem, source, { editable });
    }
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
    await setStash(this.actor, stash);
    this.render(false);
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
    this.render(false);
  }

  _onStashQuantityWheel(event) {
    event.preventDefault();
    const nativeEvent = event.originalEvent ?? event;
    const delta = nativeEvent.deltaY < 0 ? 1 : -1;
    this._changeStashQuantity(event.currentTarget.dataset.itemId, delta, {
      row: $(event.currentTarget).closest(".pf1-stash-item")
    });
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
      case "roll-skill":
        await rollSkill(actor, button.dataset.skillId, { flavor: `${actor?.name}: ${button.textContent.trim()}` });
        break;
      case "set-activity":
        await this._setActivity(actor);
        break;
      case "roll-activity":
        await this._rollActivity(actor);
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
    }

    this.render(false);
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

  async _rollActivity(actor) {
    if (!actor) return;
    const activities = this.actor.getFlag(MODULE_ID, ACTIVITIES_FLAG) ?? {};
    const activity = activities[actor.id];
    if (!activity?.skillId) return;
    await rollSkill(actor, activity.skillId, {
      flavor: `${actor.name}: ${activity.title || "Активность"}`,
      extraBonus: activity.bonus,
      dc: activity.dc
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

    const source = deepClone(item.data ?? item);
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
    const source = await itemDialog(category);
    if (!source) return;
    const stash = getStash(this.actor);
    stash.items.push(normalizeItemForStash(source));
    await setStash(this.actor, stash);
  }

  _filterStash(query, html) {
    const q = String(query || "").trim().toLowerCase();
    html.find(".pf1-stash-item").each((_, element) => {
      const row = $(element);
      const name = row.find(".pf1-stash-item-name").text().toLowerCase();
      row.toggle(!q || name.includes(q));
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
    if (app instanceof PF1PartyActorSheet) app.render(false);
  }
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
Hooks.on("updateActor", renderOpenPartySheets);
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
