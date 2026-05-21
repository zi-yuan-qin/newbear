const path = require("path");
const { pathToFileURL } = require("url");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const videoUrl = pathToFileURL(path.resolve(__dirname, "../docs/熊心壮职_30s_宣传视频.webm")).href;
  await page.setContent(`
    <body style="margin:0;background:#eee">
      <video id="v" src="${videoUrl}" muted playsinline style="width:1080px;height:1920px;object-fit:cover"></video>
    </body>
  `);
  await page.evaluate(() => new Promise((resolve, reject) => {
    const v = document.getElementById("v");
    v.onerror = () => reject(new Error("video load failed"));
    v.onloadeddata = () => resolve();
  }));
  await page.screenshot({ path: path.resolve(__dirname, "../docs/熊心壮职_30s_宣传视频_封面预览.png"), fullPage: true });
  await browser.close();
})();
