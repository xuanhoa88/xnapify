const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log('CONSOLE:', msg.type(), msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('PAGE_ERROR:', err.toString());
  });

  try {
    await page.goto('http://localhost:1337/features', {waitUntil: 'networkidle0'});
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('Page goto failed:', e.message);
  }
  
  await browser.close();
})();
