import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const installed = process.env.RATION_PLAYWRIGHT_PACKAGE;
const { chromium } = await import(installed ? pathToFileURL(path.resolve(installed, 'index.mjs')).href : 'playwright');
async function verify() {
  const browser = await chromium.launch({ timeout: 20000 });
  const output = path.resolve('output/playwright');
  await mkdir(output, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const issues = [];
    page.on('pageerror', (error) => issues.push(error.message));
    page.setDefaultTimeout(15000);
    await page.goto(process.env.RATION_PREVIEW_URL ?? 'http://127.0.0.1:3001/');
    const heading = (name) => page.getByRole('heading', { name, exact: true }).waitFor();
    const button = (name) => page.getByRole('button', { name, exact: true });
    await button('I moved to another state').click();
    await heading('Use your card in another state');
    const first = await page.locator('.rs-quote blockquote').innerText();
    await page.locator('.rs-edge-list button').nth(1).click();
    assert.notEqual(await page.locator('.rs-quote blockquote').innerText(), first);
    assert.match(await page.getByRole('link', { name: 'Open official source' }).getAttribute('href'), /dfpd\.gov\.in/);
    await page.screenshot({ path: path.join(output, 'ration-saathi-guide.png'), fullPage: true });
    await button('The ration shop refused me').click();
    await heading('Ration was refused');
    assert.doesNotMatch(await page.locator('.rs-proof-canvas').innerText(), /Portability Claim/);

    async function askGuide(question) {
      await page.locator('#ration-question').fill(question);
      await page.locator('#ration-question').press('Enter');
    }

    for (const [question, expected] of [
      ['how do I apply for a new ration card?', 'Apply for a new ration card'],
      ['My fingerprint is not working', 'When fingerprint verification fails'],
      ['fingerprnt', 'When fingerprint verification fails'],
      ['how many kg can I collect?', 'Check how much ration you can collect'],
      ['does the solar eclipse end at midnight?', 'I couldn’t find enough evidence for that question.'],
    ]) {
      await askGuide(question);
      await heading(expected);
    }
    await button('हिन्दी').click();
    await askGuide('मुझे नया राशन कार्ड चाहिए');
    await heading('नया राशन कार्ड बनवाएँ');
    assert.match(await page.locator('.rs-proof-canvas').innerText(), /राज्य खाद्य पोर्टल/);
    await page.setViewportSize({ width: 390, height: 845 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await page.screenshot({ path: path.join(output, 'ration-saathi-hindi-mobile.png'), fullPage: true });
    if (process.env.RATION_GUIDE_ONLY === '1') {
      assert.deepEqual(issues, []);
      console.log('PASS: final bilingual guide, dynamic citations, choice ranking and mobile layout.');
      return;
    }
    await button('English').click();
    await page.setViewportSize({ width: 1440, height: 1100 });
    await button('Evidence lab').click();
    async function upload(file) {
      const [chooser] = await Promise.all([page.waitForEvent('filechooser'), button('Upload file').click()]);
      await chooser.setFiles(file);
    }

    await upload(path.resolve('public/demo/fictional-district-desk.csv'));
    await page.getByText('112 admitted · 16 for review', { exact: true }).waitFor();
    await button('Review (16)').click();
    await page.getByRole('button', { name: 'Mark reviewed', exact: true }).first().click();
    await button('Reviewed · undo').waitFor();
    await button('Source graph').click();
    await button('Next concepts').click();
    await page.getByText('2 / 4', { exact: true }).waitFor();
    await button('Try a multi-hop question').click();
    await heading('Cited source passages');
    await page.getByRole('heading', { name: 'Query evidence graph' }).waitFor();
    await page.getByText('How the search ranked evidence').click();
    await page.getByText('Lexical BM25', { exact: true }).waitFor();
    assert.match(await page.locator('.rs-query-result .rs-quote').innerText(), /Acacia/);
    await page.screenshot({ path: path.join(output, 'ration-saathi-upload.png'), fullPage: true });
    await page.locator('#ration-lab-question').fill('How is Acacia Help Desk related to Pine Visit Plan?');
    await button('Search source').click();
    await heading('Insufficient evidence to answer');
    assert.equal(await page.getByText('Supported paths', { exact: true }).count(), 0);

    await upload({ name: 'shift.txt', mimeType: 'text/plain', buffer: Buffer.from('Map Desk uses Duty Register. Duty Register feeds Callback Queue.') });
    await page.getByText('2 admitted · 0 for review', { exact: true }).waitFor();
    await page.locator('#ration-lab-question').fill('How is Map Desk related to Callback Queue?');
    await button('Search source').click();
    await heading('Cited source passages');
    assert.match(await page.locator('.rs-query-result .rs-proof-canvas').innerText(), /Duty Register/);
    await upload({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0) });
    await page.getByRole('alert').getByText('Choose a file containing text.').waitFor();
    assert.deepEqual(issues, []);
    console.log('PASS: guided ranking, Hindi, source links, dynamic graph, two real uploads, 128-row review, pagination, path evidence, abstention, and mobile width.');
  } finally { await browser.close(); }
}

verify().catch((error) => { console.error(error); process.exitCode = 1; });
