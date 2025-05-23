import { groupTabIfMatched } from "./utils.js";

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && tab.url) {
        const { settings = {} } = await chrome.storage.local.get("settings");
        const autoGroup = settings.autoGroup !== false;

        if (!autoGroup) return;

        const { orgs = [] } = await chrome.storage.local.get("orgs");
        await groupTabIfMatched(tab, orgs);
    }
});