import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('error', err => {
    console.error('PAGE ERROR CRASH:', err);
  });

  page.on('pageerror', err => {
    console.error('PAGE JS ERROR:', err);
  });

  try {
    console.log("Navigating...");
    await page.goto('http://localhost:3000/admin/inventory', { waitUntil: 'networkidle0', timeout: 10000 });
    console.log("Navigation successful, checking content...");
    const content = await page.content();
    console.log("Content length:", content.length);
  } catch (err) {
    console.error("Navigation failed:", err);
  } finally {
    await browser.close();
  }
})();
