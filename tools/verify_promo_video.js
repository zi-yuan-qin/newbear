const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const videoFile = path.resolve(__dirname, "../docs/熊心壮职_30s_宣传视频.webm");
  const videoUrl = `data:video/webm;base64,${fs.readFileSync(videoFile).toString("base64")}`;
  await page.setContent(`<video id="v" src="${videoUrl}" controls muted style="width:540px"></video>`);
  const duration = await page.evaluate(() => new Promise((resolve, reject) => {
    const v = document.getElementById("v");
    if (v.readyState >= 1) {
      resolve(v.duration);
      return;
    }
    const timer = setTimeout(() => reject(new Error("video metadata timeout")), 15000);
    v.onerror = () => reject(new Error("video failed to load"));
    v.onloadedmetadata = () => {
      clearTimeout(timer);
      resolve(v.duration);
    };
  }));
  await page.screenshot({ path: path.resolve(__dirname, "../docs/熊心壮职_30s_宣传视频_preview.png"), fullPage: true });
  await browser.close();
  console.log(`duration=${duration}`);
})();
