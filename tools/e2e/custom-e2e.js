const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    const port = process.env.XNAPIFY_PORT || 1337;
    const url = `http://localhost:${port}`;

    console.log(`Navigating to ${url}/login...`);
    await page.goto(`${url}/login`);

    console.log('Logging in...');
    await page.waitForSelector('input[name="email"]');
    await page.type('input[name="email"]', 'admin@test.com');
    await page.type('input[name="password"]', 'admin123');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('button[type="submit"]'),
    ]);

    console.log('Navigating to /admin/extensions...');
    await page.goto(`${url}/admin/extensions`);

    console.log('Uploading extension...');
    const fileInputSelector = 'input[type="file"]';
    await page.waitForSelector(fileInputSelector, { hidden: true });

    const fileInput = await page.$(fileInputSelector);
    await fileInput.uploadFile(
      '/Users/xuanguyen/Workspaces/react-starter-kit/test-fixtures/sample-extension.zip',
    );

    console.log('Waiting for confirm modal...');
    const installButtonSelector = '::-p-text(Install)';
    await page.waitForSelector(installButtonSelector, { visible: true });
    console.log('Confirming install...');
    await page.click(installButtonSelector);

    console.log('Waiting for success toast...');
    await page.waitForSelector('::-p-text(Extension installed successfully)', {
      visible: true,
      timeout: 5000,
    });

    console.log('Verifying extension card...');
    await page.waitForSelector('::-p-text(sample-extension)', {
      visible: true,
    });
    console.log('Test Case 1 Passed!');

    console.log('Refreshing page for Test Case 2...');
    await page.reload({ waitUntil: 'networkidle0' });

    console.log('Verifying extension card persists after refresh...');
    await page.waitForSelector('::-p-text(sample-extension)', {
      visible: true,
    });

    console.log('Test Case 2 Passed!');

    await browser.close();
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    await browser.close();
    process.exit(1);
  }
})();
