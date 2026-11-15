import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const installed = process.env.RATION_PLAYWRIGHT_PACKAGE;
const { chromium } = await import(
  installed
    ? pathToFileURL(path.resolve(installed, 'index.mjs')).href
    : 'playwright'
);

const browser = await chromium.launch({ timeout: 20000 });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1080 },
  });
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.RATION_PREVIEW_URL ?? 'http://127.0.0.1:3001/');
  const button = (name) => page.getByRole('button', { name, exact: true });
  await button('Policy explorer').click();
  const ask = async (question) => {
    await page.getByLabel('Ask in your own words').fill(question);
    await button('Find support').click();
  };
  const pick = (name) =>
    page.locator('.policy-match').filter({ hasText: name }).first().click();
  const current = page.locator('.policy-output .rs-result-card');
  const proof = (name = 'Policy evidence graph') =>
    page.getByRole('region', { name, exact: true });

  const coverage = (await page.locator('.policy-footer').innerText()).match(
    /(\d+) indexed entries · (\d+) evidence profiles · (\d+) with money, eligibility and document graphs/,
  );
  assert.ok(coverage, 'Expected public evidence coverage counts');
  assert.equal(coverage[1], coverage[2], 'Every indexed entry should have evidence');
  assert.ok(Number(coverage[3]) >= 103, 'Expected funding, eligibility and documents for at least 103 profiles');
  await button('Show more').click();
  assert.ok((await page.locator('.policy-match').count()) > 7);

  await ask(
    'I want to buy an auto rickshaw. Can the government help me in that?',
  );
  await current
    .getByRole('heading', { name: 'Pradhan Mantri MUDRA Yojana' })
    .waitFor();
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Purchase a vehicle.*Three-wheeler/s,
  );
  assert.match(
    await proof().locator('.rs-quote a').getAttribute('href'),
    /2249942/,
  );
  await button('Documents').click();
  assert.match(
    await proof('Document evidence graph').innerText(),
    /vehicle quotation/i,
  );
  assert.match(
    await proof('Document evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /s3waas.gov.in/,
  );
  await pick('Prime Minister’s Employment Generation Programme');
  await button('Money').click();
  await page.getByLabel('Illustrate with a project cost (₹)').fill('250000');
  assert.match(
    await proof('Funding evidence graph')
      .locator('.rs-proof-canvas')
      .innerText(),
    /37,500/,
  );
  assert.match(
    await proof('Funding evidence graph')
      .locator('.rs-proof-canvas')
      .innerText(),
    /87,500/,
  );
  await page.getByLabel('Illustrate with a project cost (₹)').fill('2500000');
  await page.getByText(/cost exceeds an indexed scenario/).waitFor();

  await ask(
    'I work for Blinkit and want to buy a bike for delivery. Can the government help?',
  );
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Two-wheeler.*Delivery or platform worker.*Delivery for work/s,
  );
  await page.getByLabel('State', { exact: true }).selectOption('Tamil Nadu');
  assert.equal(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'Tamil Nadu Auto-Rickshaw' })
      .count(),
    0,
  );
  await pick('Tamil Nadu Gig Workers E-Scooter Subsidy');
  await button('Money').click();
  assert.match(await proof('Funding evidence graph').innerText(), /₹20,000/);
  assert.match(
    await proof('Funding evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /tnbudget/,
  );
  await page.locator('.policy-ranking summary').click();
  assert.match(
    await page.locator('.policy-ranking dl').innerText(),
    /activity/i,
  );
  await mkdir('output/playwright', { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: 'output/playwright/policy-explorer-expanded.png',
    fullPage: true,
  });
  await ask('I deliver groceries in Tamil Nadu and need a petrol motorcycle');
  assert.equal(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'Tamil Nadu Gig Workers' })
      .count(),
    0,
  );
  assert.equal(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'PM E-DRIVE' })
      .count(),
    0,
  );
  await page.getByLabel('State', { exact: true }).selectOption('Maharashtra');
  await ask('I want an electric bike for delivery work');
  assert.equal(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'Tamil Nadu Gig Workers' })
      .count(),
    0,
  );
  assert.ok(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'PM E-DRIVE' })
      .count(),
  );

  await page.getByLabel('State', { exact: true }).selectOption('All locations');
  await ask('I want an electric bike for delivery work in Delhi');
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Location\s+Delhi/,
  );
  assert.equal(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'Tamil Nadu Gig Workers' })
      .count(),
    0,
  );
  await ask('I sew clothes for customers and need a sewing machine');
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Buy business equipment/,
  );
  await pick('Pradhan Mantri MUDRA Yojana');
  assert.match(await proof().innerText(), /Equipment and machinery/);
  await ask('আমি ডেলিভারি করি, একটা বাইক চাই');
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Two-wheeler.*Delivery for work/s,
  );

  await ask('Can I get a college scholarship with another scholarship?');
  await pick('PM-USP College Scholarship (CSSS)');
  assert.match(
    await proof().locator('.rs-quote').innerText(),
    /other scholarship or fee reimbursement/,
  );
  await ask('How are unfilled scholarship slots moved?');
  await pick('PM-USP College Scholarship (CSSS)');
  assert.match(
    await proof().locator('.rs-quote').innerText(),
    /cross-category/,
  );
  await ask('How did the PM SVANidhi first loan change?');
  await page.getByLabel('Compare with').selectOption('earlier');
  const table = page.getByRole('table', { name: 'Rules in each document' });
  for (const amount of ['₹15,000', '₹10,000', '₹20,000', '₹25,000']) {
    assert.ok((await table.innerText()).includes(amount));
  }
  await ask('PM SVANidhi first loan in 2024');
  assert.equal(
    await page.getByLabel('Document version').inputValue(),
    'earlier',
  );
  await ask('Does PM SVANidhi link to ration portability?');
  await proof()
    .getByRole('button', {
      name: /SVANidhi se Samriddhi facilitates eligibility checks for One Nation One Ration Card/,
    })
    .click();
  assert.match(
    await proof().locator('.rs-quote a').getAttribute('href'),
    /1816139/,
  );
  await ask('Tarun Plus previous repayment');
  assert.match(
    await proof().locator('.rs-quote').innerText(),
    /successfully repaid/,
  );
  await ask('I am a widow and i need support');
  await current
    .getByRole('heading', {
      name: 'Indira Gandhi National Widow Pension Scheme',
      exact: true,
    })
    .waitFor();
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Find widow support.*Widowhood/s,
  );
  await button('Who qualifies').click();
  assert.match(
    await proof('Eligibility evidence graph').innerText(),
    /BPL households/,
  );
  await button('Money').click();
  assert.match(
    await proof('Funding evidence graph').innerText(),
    /₹300 per month/,
  );
  await proof('Funding evidence graph')
    .locator('.rs-edge-list button')
    .nth(1)
    .click();
  assert.match(
    await proof('Funding evidence graph').locator('.rs-quote').innerText(),
    /₹500 per month/,
  );
  assert.match(
    await proof('Funding evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /2210378/,
  );
  await button('Documents').click();
  await proof('Document evidence graph')
    .locator('.rs-edge-list button')
    .nth(1)
    .click();
  assert.match(
    await proof('Document evidence graph').locator('.rs-quote').innerText(),
    /death certificate/,
  );
  assert.match(
    await proof('Document evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /NSAP_Guidelines_English/,
  );
  await ask('मैं विधवा हूँ और मुझे मदद चाहिए');
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Widowhood/,
  );
  await ask('My husband passed away in Delhi. I need help');
  await pick('Delhi Pension Scheme to Women in Distress');
  await button('Money').click();
  assert.match(
    await proof('Funding evidence graph').innerText(),
    /₹2,500 per month/,
  );
  assert.equal(
    await page
      .locator('.policy-match')
      .filter({ hasText: 'Tamil Nadu Destitute Widow' })
      .count(),
    0,
  );
  await ask('Government of India Post-Matric Scholarship');
  await current
    .getByRole('heading', {
      name: 'Government of India Post-Matric Scholarship',
      exact: true,
    })
    .waitFor();
  for (const [tab, region, section, content] of [
    ['Who qualifies', 'Eligibility evidence graph', 'Eligibility', /2,50,000/],
    ['Money', 'Funding evidence graph', 'Benefits', /Maintenance Allowance/i],
    [
      'Documents',
      'Document evidence graph',
      'Documents Required',
      /Income Certificate/i,
    ],
  ]) {
    await button(tab).click();
    assert.match(await proof(region).locator('.rs-quote').innerText(), content);
    assert.match(
      await proof(region).locator('.rs-quote a').innerText(),
      new RegExp(section),
    );
    assert.match(
      await proof(region).locator('.rs-quote a').getAttribute('href'),
      /mahadbt\.maharashtra\.gov\.in\/SchemeData/,
    );
  }
  await ask(
    'AICTE Pragati Scholarship for Girl Students in Technical Degree Courses',
  );
  await button('Money').click();
  assert.match(
    await proof('Funding evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /AICTE_2010_G\.pdf/,
  );
  await ask('Interest Subsidy Eligibility Certificate (ISEC)');
  await button('Money').click();
  assert.match(
    await proof('Funding evidence graph').locator('.rs-quote').innerText(),
    /concessional interest rate/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await ask('satellite telescope repair');
  await current
    .getByRole('heading', {
      name: 'There’s no matching policy in this collection.',
    })
    .waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: catalogue coverage, widow and bereavement queries, eligibility and source links, funding and document graphs, scholarships, vehicle goals, jurisdiction, history and mobile layout.',
  );
} finally {
  await browser.close();
}
