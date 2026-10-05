/**
 * YouTube answers 403 to InnerTube player requests whose Origin is the extension
 * (chrome-extension://…). This session rule rewrites the Origin of the extension's
 * own requests to the player and caption endpoints to https://www.youtube.com.
 * It never touches requests from YouTube pages themselves.
 */
const RULE_ID = 1;

export async function installYoutubeRequestRules(): Promise<void> {
  const dnr = browser.declarativeNetRequest;
  if (!dnr?.updateSessionRules) return;
  await dnr.updateSessionRules({
    removeRuleIds: [RULE_ID],
    addRules: [
      {
        id: RULE_ID,
        priority: 1,
        action: {
          type: 'modifyHeaders',
          requestHeaders: [
            { header: 'origin', operation: 'set', value: 'https://www.youtube.com' },
          ],
        },
        condition: {
          regexFilter: '^https://www\\.youtube\\.com/(youtubei/v1/player|api/timedtext)',
          initiatorDomains: [browser.runtime.id],
          resourceTypes: ['xmlhttprequest', 'other'],
        },
      },
    ],
  });
}
