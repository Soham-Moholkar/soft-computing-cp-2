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
  await page.goto(process.env.RATION_PREVIEW_URL ?? 'http://127.0.0.1:3001/', {
    waitUntil: 'networkidle',
  });
  const button = (name) => page.getByRole('button', { name, exact: true });
  assert.equal(
    await button('Policy explorer').getAttribute('aria-pressed'),
    'true',
  );
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
  assert.equal(
    coverage[1],
    coverage[2],
    'Every indexed entry should have evidence',
  );
  assert.ok(
    Number(coverage[3]) >= 103,
    'Expected funding, eligibility and documents for at least 103 profiles',
  );
  await button('Show more').click();
  await page.locator('.policy-match').nth(7).waitFor();

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
  await button('Eligibility & requirements').click();
  assert.match(
    await proof('Eligibility & requirements graph').innerText(),
    /BPL households/,
  );
  await page
    .getByText('Extract from a policy document', { exact: true })
    .click();
  await page.getByLabel('Document title').fill('Synthetic policy test');
  await page
    .getByLabel('Policy document text')
    .fill(
      'Eligibility:\nApplicants must be aged 18 or older AND\nreside in Maharashtra.\nDocuments required:\n- Proof of residence.',
    );
  await button('Review extracted passages').click();
  await button('Add selected passages to graph').click();
  const eligibility = proof('Eligibility & requirements graph');
  const inspector = eligibility.locator('.requirements-inspector');
  assert.match(
    await inspector.innerText(),
    /Document excerpt you supplied.*Synthetic policy test/s,
  );
  await inspector.getByText('Read the surrounding text').click();
  assert.match(await inspector.innerText(), /AND\s+reside in Maharashtra/);
  const versions = page.getByLabel('Document version');
  const previousVersion = await versions.inputValue();
  const differentVersion = await versions
    .locator('option')
    .evaluateAll(
      (options, selected) =>
        options.find((option) => option.value !== selected)?.value,
      previousVersion,
    );
  assert.ok(differentVersion);
  await versions.selectOption(differentVersion);
  assert.equal(
    await eligibility.getByRole('button', { name: /Added excerpt/ }).count(),
    0,
  );
  await versions.selectOption(previousVersion);
  assert.equal(
    await eligibility.getByRole('button', { name: /Added excerpt/ }).count(),
    3,
  );
  await button('Get help').click();
  await button('Policy explorer').click();
  assert.equal(
    await eligibility.getByRole('button', { name: /Added excerpt/ }).count(),
    3,
  );
  await page
    .getByText('Extract from a policy document', { exact: true })
    .click();
  const upload = eligibility.getByLabel('Choose a text file');
  await upload.setInputFiles({
    name: 'unsupported.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('not a supported file'),
  });
  await eligibility.getByText(/Choose a TXT or Markdown file/).waitFor();
  assert.equal(
    await eligibility.getByLabel('Policy document text').inputValue(),
    '',
  );
  await upload.setInputFiles({
    name: 'synthetic-criteria.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from(
      '## Eligibility\n- Applicants must be currently enrolled.',
    ),
  });
  await button('Review extracted passages').click();
  await button('Add selected passages to graph').click();
  assert.match(await inspector.innerText(), /synthetic-criteria\.md/);
  assert.equal(
    await eligibility.getByRole('button', { name: /Added excerpt/ }).count(),
    1,
  );
  await button('Remove added passages').click();
  assert.equal(
    await eligibility.getByRole('button', { name: /Added excerpt/ }).count(),
    0,
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
  await button('Eligibility & requirements').click();
  const scholarshipGraph = proof('Eligibility & requirements graph');
  await scholarshipGraph
    .getByRole('button', { name: /2,50,000/ })
    .first()
    .click();
  const scholarshipSource = scholarshipGraph.locator('.requirements-inspector');
  assert.match(
    await scholarshipSource.innerText(),
    /Recorded source excerpt.*Eligibility/s,
  );
  assert.match(
    await scholarshipSource.getByRole('link').getAttribute('href'),
    /mahadbt\.maharashtra\.gov\.in\/SchemeData/,
  );
  await mkdir('output/playwright', { recursive: true });
  await scholarshipGraph.screenshot({
    path: 'output/playwright/policy-eligibility-desktop.png',
  });
  for (const [tab, region, section, content] of [
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
  await ask('I am a single parent and need support for my child');
  await current
    .getByRole('heading', {
      name: 'Mission Vatsalya · Child Sponsorship',
      exact: true,
    })
    .waitFor();
  await button('Eligibility & requirements').click();
  assert.match(
    await proof('Eligibility & requirements graph').innerText(),
    /Widowed, divorced or abandoned/,
  );
  await button('Money').click();
  assert.match(
    await proof('Funding evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /non-institutional-care/,
  );
  assert.match(
    await proof('Funding evidence graph').innerText(),
    /₹4,000 per child per month/,
  );
  await ask('What help is available for orphans in Maharashtra?');
  await pick('Bal Sangopan Yojana');
  await button('Documents').click();
  assert.match(
    await proof('Document evidence graph')
      .locator('.rs-quote a')
      .getAttribute('href'),
    /202305301635125530/,
  );
  await page.route('**/api/policy/interpret', async (route) => {
    await route.fulfill({ json: { status: 'ready', intent: 'single_parent' } });
  });
  await ask(
    "My children's other parent left. I'm looking after both kids by myself and need help.",
  );
  await button('Try local interpretation').click();
  await button('Search for single parent support').click();
  await current
    .getByRole('heading', {
      name: 'Mission Vatsalya · Child Sponsorship',
      exact: true,
    })
    .waitFor();
  await page.unroute('**/api/policy/interpret');
  await ask('video code');
  await button('Did you mean widow support?').click();
  assert.match(
    await page.locator('.policy-interpretation').innerText(),
    /Widowhood/,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await button('Eligibility & requirements').click();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    true,
  );
  await proof('Eligibility & requirements graph').screenshot({
    path: 'output/playwright/policy-eligibility-mobile.png',
  });
  await ask('satellite telescope repair');
  await current
    .getByRole('heading', {
      name: 'There’s no matching policy in this collection.',
    })
    .waitFor();
  await button('Reset search and filters').click();
  await current.getByLabel('Document version').waitFor();
  assert.deepEqual(errors, []);
  console.log(
    'PASS: catalogue coverage, widow and bereavement queries, eligibility and source links, funding and document graphs, scholarships, vehicle goals, jurisdiction, history and mobile layout.',
  );
} finally {
  await browser.close();
}
