export async function groupTabIfMatched(tab, orgs) {
    if (!tab.url) return;

    const tabUrl = new URL(tab.url);
    const tabHost = tabUrl.hostname;
    const fullUrl = tab.url.toLowerCase();

    const suffixes = [
        ".force.com",
        ".salesforce.com",
        ".salesforce-setup.com",
        ".site.com"
    ];

    const isSalesforceTab = suffixes.some(suffix => tabHost.endsWith(suffix));
    if (!isSalesforceTab) return;

    for (const org of orgs) {
        try {
            const matchType = org.matchType || "equals";
            const criteria = org.criteria?.toLowerCase();
            if (!criteria) continue;

            let isMatch = false;

            if (matchType === "equals") {
                const orgUrl = new URL(criteria);
                const orgHostPrefix = orgUrl.hostname.split('.')[0];
                isMatch = tabHost.startsWith(orgHostPrefix);
            }

            else if (matchType === "contains") {
                isMatch = fullUrl.includes(criteria);
            }

            if (isMatch) {
                const existingGroups = await chrome.tabGroups.query({});
                const targetGroup = existingGroups.find(g => g.title === org.name);

                let groupId;
                if (targetGroup) {
                    groupId = targetGroup.id;
                    await chrome.tabs.group({ groupId, tabIds: [tab.id] });
                } else {
                    groupId = await chrome.tabs.group({ tabIds: [tab.id] });
                    await chrome.tabGroups.update(groupId, {
                        title: org.name,
                        color: org.color
                    });
                }

                return;
            }
        } catch (e) {
            console.error("Fehler beim Matching:", e);
        }
    }
}