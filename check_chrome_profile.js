// check_chrome_profile.js
import { chromium } from "playwright";

(async () => {
  // ✅ あなたのログイン済みChromeプロファイル
  const userDataDir = "/Users/bluedp-10/Library/Application Support/Google/Chrome/Profile 53";

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });

  const page = await context.newPage();
  await page.goto("https://documentcloud.adobe.com/");
  console.log("✅ 既存ChromeプロファイルでAdobeを開きました！");
})();
