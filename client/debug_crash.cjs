const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE LOG ERROR:', msg.text());
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  page.on('requestfailed', request => {
    console.log('REQUEST FAILED:', request.url(), request.failure().errorText);
  });

  await page.goto('http://localhost:5173/forensic', { waitUntil: 'networkidle0' });
  console.log("Navigated to forensic. Waiting 2 sec...");
  await new Promise(r => setTimeout(r, 2000));
  
  console.log("Clicking 'Compare Windows' button...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('Compare Windows'));
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 3000));
  
  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  console.log("Navigated to OnlineMonitor...");
  await new Promise(r => setTimeout(r, 3000));
  
  console.log("Clicking 'Drill Window'...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const btn = buttons.find(b => b.innerText.includes('Drill Window'));
    if (btn) btn.click();
  });
  
  await new Promise(r => setTimeout(r, 3000));

  await browser.close();
  console.log("Done.");
})();
