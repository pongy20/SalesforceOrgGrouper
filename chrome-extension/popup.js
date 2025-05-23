const addDialog = document.getElementById("addDialog");
const confirmDelete = document.getElementById("confirmDelete");

const orgTableBody = document.querySelector("#orgTable tbody");
const addOrgBtn = document.getElementById("addOrgBtn");
const saveOrgBtn = document.getElementById("saveOrgBtn");
const cancelBtn = document.getElementById("cancelBtn");
const dialogTitle = document.getElementById("dialogTitle");

const matchTypeInput = document.getElementById("matchType");
const criteriaInput = document.getElementById("criteria");
const groupNameInput = document.getElementById("groupName");
const groupColorInput = document.getElementById("groupColor");

let editIndex = null;
let deleteIndex = null;

async function renderTable(orgs) {
    orgTableBody.innerHTML = "";
    const containsText = await getTranslation("add_org_dialog_matching_criteria_contains");
    const equalsText = await getTranslation("add_org_dialog_matching_criteria_equals");
    for (const [index, org] of orgs.entries()) {
        const matchTypeDisplayText = org.matchType === "contains" ? containsText : equalsText;

        const colorKey = `color_${org.color}`;
        const colorTranslated = await getTranslation(colorKey);

        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${org.criteria}</td>
      <td>${matchTypeDisplayText}</td>
      <td>${org.name}</td>
      <td>${colorTranslated}</td>
      <td>
        <button class="icon-btn" title="Bearbeiten" data-index="${index}" data-action="edit">
          <img src="icons/edit.png" alt="Bearbeiten">
        </button>
        <button class="icon-btn" title="Löschen" data-index="${index}" data-action="delete">
          <img src="icons/delete.png" alt="Löschen">
        </button>
      </td>
    `;
        orgTableBody.appendChild(row);
    }
}

function loadOrgs() {
    chrome.storage.local.get(["orgs"], (data) => {
        const orgs = data.orgs || [];
        renderTable(orgs);
    });
}

function saveOrgs(orgs) {
    chrome.storage.local.set({ orgs }, loadOrgs);
}

async function openFormDialog(org = null, index = null) {
    editIndex = index;
    dialogTitle.textContent = index === null ? await getTranslation("add_org_dialog_title") : await getTranslation("edit_org_dialog_title");
    matchTypeInput.value = org?.matchType || "equals";
    criteriaInput.value = org?.criteria || "";
    groupNameInput.value = org?.name || "";
    groupColorInput.value = org?.color || "blue";
    addDialog.showModal();
}

addOrgBtn.addEventListener("click", () => openFormDialog());

saveOrgBtn.addEventListener("click", () => {
    let criteria = criteriaInput.value.trim();
    const matchType = matchTypeInput.value;
    const name = groupNameInput.value.trim();
    const color = groupColorInput.value;

    if (!criteria || !name) return;

    if (matchType === "equals") {
        try {
            const parsedUrl = new URL(criteria);
            criteria = `${parsedUrl.protocol}//${parsedUrl.hostname}`;
        } catch (e) {
            alert("Invalid URL for 'equals'-Matching");
            return;
        }
    }

    const newEntry = { criteria, matchType, name, color };

    chrome.storage.local.get(["orgs"], (data) => {
        const orgs = data.orgs || [];
        if (editIndex !== null) {
            orgs[editIndex] = newEntry;
        } else {
            orgs.push(newEntry);
        }
        chrome.storage.local.set({ orgs }, () => {
            loadOrgs();
            addDialog.close();
            editIndex = null;
        });
    });
});

cancelBtn.addEventListener("click", () => {
    addDialog.close();
    editIndex = null;
});

orgTableBody.addEventListener("click", (e) => {
    const btn = e.target.closest("button.icon-btn");
    if (!btn) return;

    const index = parseInt(btn.dataset.index, 10);
    const action = btn.dataset.action;

    if (action === "edit") {
        chrome.storage.local.get(["orgs"], (data) => {
            const org = data.orgs[index];
            openFormDialog(org, index);
        });
    }

    if (action === "delete") {
        deleteIndex = index;
        confirmDelete.showModal();
    }
});

document.getElementById("deleteCancelBtn").addEventListener("click", () => {
    confirmDelete.close();
    deleteIndex = null;
});

document.getElementById("deleteConfirmBtn").addEventListener("click", () => {
    chrome.storage.local.get(["orgs"], (data) => {
        const orgs = data.orgs || [];
        if (deleteIndex !== null) {
            orgs.splice(deleteIndex, 1);
            saveOrgs(orgs);
        }
        confirmDelete.close();
        deleteIndex = null;
    });
});

import { groupTabIfMatched } from "./utils.js";

document.getElementById("applyGroupsBtn").addEventListener("click", async () => {
    const { orgs = [] } = await chrome.storage.local.get("orgs");
    const tabs = await chrome.tabs.query({});

    const tabGroups = await chrome.tabGroups.query({});

    for (const group of tabGroups) {
        const isManagedGroup = orgs.some(org => org.name === group.title);
        if (isManagedGroup) {
            const groupTabs = await chrome.tabs.query({ groupId: group.id });
            const tabIds = groupTabs.map(t => t.id);
            await chrome.tabs.ungroup(tabIds);
        }
    }

    for (const tab of tabs) {
        await groupTabIfMatched(tab, orgs);
    }
});

const settingsBtn = document.getElementById("settingsBtn");
const settingsDialog = document.getElementById("settingsDialog");
const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

const autoGroupSwitch = document.getElementById("autoGroupSwitch");
const languageSelect = document.getElementById("languageSelect");

settingsBtn.addEventListener("click", async () => {
    const { settings = {} } = await chrome.storage.local.get("settings");
    autoGroupSwitch.checked = settings.autoGroup !== false;
    const defaultLang = chrome.runtime.getManifest().default_locale || "en";
    languageSelect.value = settings.language || defaultLang;
    settingsDialog.showModal();
    const manifest = chrome.runtime.getManifest();
    document.getElementById("appVersion").textContent = `Version: ${manifest.version}`;
});

cancelSettingsBtn.addEventListener("click", () => {
    settingsDialog.close();
});

saveSettingsBtn.addEventListener("click", () => {
    const settings = {
        autoGroup: autoGroupSwitch.checked,
        language: languageSelect.value
    };
    chrome.storage.local.set({ settings }, () => {
        settingsDialog.close();
        chrome.runtime.reload();
    });
});

let i18nData = {};

async function loadLocale(lang) {
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    const json = await res.json();

    i18nData = Object.fromEntries(
        Object.entries(json).map(([key, val]) => [key, val.message])
    );
}

async function getTranslation(key) {
    if (i18nData[key]) return i18nData[key];
    const url = chrome.runtime.getURL(`_locales/${lang}/messages.json`);
    const res = await fetch(url);
    const json = await res.json();
    i18nData = Object.fromEntries(
        Object.entries(json).map(([key, val]) => [key, val.message])
    );
    return i18nData[key];
}

function applyTranslations() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        const key = el.getAttribute("data-i18n");
        const translation = i18nData[key];
        if (translation) el.textContent = translation;
    });
}

function populateColorOptions() {
    const colorSelect = document.getElementById("groupColor");
    colorSelect.innerHTML = ""; // leeren

    const colors = [
        "grey", "blue", "red", "yellow", "green", "pink", "purple", "cyan", "orange"
    ];

    colors.forEach(color => {
        const option = document.createElement("option");
        option.value = color;
        const translationKey = `color_${color}`;
        option.textContent = i18nData[translationKey] || color;
        colorSelect.appendChild(option);
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    const { settings = {} } = await chrome.storage.local.get("settings");
    const lang = settings.language || "en";

    try {
        await loadLocale(lang);
        applyTranslations();
        populateColorOptions();
        loadOrgs();
    } catch (e) {
        console.error("Fehler beim Laden der Sprache:", e);
    }
});

document.getElementById("exportOrgsBtn").addEventListener("click", async () => {
    const { orgs = [] } = await chrome.storage.local.get("orgs");

    const blob = new Blob([JSON.stringify(orgs, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "sf-org.grouper-export.json";
    a.click();

    URL.revokeObjectURL(url);
});

const importFileInput = document.getElementById("importOrgsFile");

document.getElementById("importOrgsBtn").addEventListener("click", () => {
    importFileInput.click();
});

importFileInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const importedOrgs = JSON.parse(text);

        if (!Array.isArray(importedOrgs)) throw new Error("Invalid Format");

        chrome.storage.local.set({ orgs: importedOrgs }, () => {
            loadOrgs();
            alert("Orgs have been imported successfully.");
        });
    } catch (err) {
        alert("Error while importing orgs: " + err.message);
    }

    importFileInput.value = "";
});