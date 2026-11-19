// Check the CI renderer before spending a full suite on an unusable map context.
// Uses the pinned Firefox browser; no application, account or backend is loaded.
const { firefox } = require('@playwright/test');

(async () => {
  const browser = await firefox.launch({ headless: false });
  try {
    const page = await browser.newPage();
    const context = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      if (canvas.getContext('webgl2')) return 'webgl2';
      if (canvas.getContext('webgl')) return 'webgl';
      return null;
    });
    if (!context) throw new Error('Firefox cannot create a WebGL context under Xvfb; the map suite requires a working renderer.');
    console.log(`Firefox ${browser.version()}: ${context} context created under Xvfb`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
