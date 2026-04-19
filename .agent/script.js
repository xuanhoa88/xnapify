const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[${msg.type()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[pageerror] ${err.message}`);
  });

  try {
    await page.goto('http://localhost:1337/', { waitUntil: 'networkidle0' });
  } catch (e) {
    console.log('Error loading page:', e);
  }
  
  await browser.close();
})();
