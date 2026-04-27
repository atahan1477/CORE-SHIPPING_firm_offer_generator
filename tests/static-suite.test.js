const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

test('main suite pages share the core UI stylesheet and local logo asset', () => {
  for (const page of ['index.html', 'firm-generator.html', 'customize.html']) {
    const html = read(page);
    assert.match(html, /href="\.\/styles\/core-ui\.css"/, `${page} should load shared CSS`);
    assert.match(html, /src="\.\/assets\/core-shipping-logo\.png"/, `${page} should use local logo asset`);
  }

  assert.ok(fs.existsSync(path.join(root, 'styles/core-ui.css')), 'shared stylesheet should exist');
  assert.ok(fs.existsSync(path.join(root, 'assets/core-shipping-logo.png')), 'local logo asset should exist');
});

test('firm generator exposes the compact wizard, mobile actions, validation, and download actions', () => {
  const html = read('firm-generator.html');
  const app = read('js/firm-offer-app.js');

  for (const step of ['1', '2', '3']) {
    assert.match(html, new RegExp(`data-step-content="${step}"`), `missing step content ${step}`);
    assert.match(html, new RegExp(`data-step-pill="${step}"`), `missing step pill ${step}`);
  }

  for (const id of [
    'wizardBackBtn',
    'wizardNextBtn',
    'mobileBackBtn',
    'mobileNextBtn',
    'mobilePreviewBtn',
    'mobileCopyBtn',
    'downloadRawBtn',
    'downloadHtmlBtn',
    'validationSummary'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  assert.match(app, /function\s+setStep\(/, 'wizard should have setStep state');
  assert.match(app, /function\s+downloadTextFile\(/, 'download helper should exist');
  assert.match(app, /function\s+getValidationWarnings\(/, 'validation helper should exist');
});

test('customize page uses inline dialogs instead of native prompt and confirm flows', () => {
  const html = read('customize.html');
  const app = read('js/customize-app.js');

  for (const id of ['saveDialog', 'addVesselDialog', 'removeVesselDialog']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  for (const id of ['extraClausePortRulesList', 'addExtraClausePortRuleBtn']) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }

  assert.doesNotMatch(app, /window\.prompt\(/, 'customize app should not use prompt');
  assert.doesNotMatch(app, /window\.confirm\(/, 'customize app should not use confirm');
  assert.match(app, /function\s+renderExtraClausePortRulesList\(/, 'customize app should render POL\/POD extra clause rules');
  assert.doesNotMatch(
    app,
    /\.filter\(\(rule\)\s*=>\s*rule\.clause\.trim\(\)\s*\|\|\s*rule\.pol\.trim\(\)\s*\|\|\s*rule\.pod\.trim\(\)\)/,
    'customize app should keep blank starter POL/POD rule rows'
  );
});

test('firm generator includes POL/POD auto extra-clause sync', () => {
  const html = read('firm-generator.html');
  const app = read('js/firm-offer-app.js');
  const config = read('shared/config.js');

  assert.match(html, /id="portSuggestions"/, 'firm generator should include shared port suggestion datalist');
  assert.match(html, /id="pol"[^>]*list="portSuggestions"/, 'POL field should use port suggestion datalist');
  assert.match(html, /id="pod"[^>]*list="portSuggestions"/, 'POD field should use port suggestion datalist');

  assert.match(app, /function\s+syncAutoExtraClauses\(/, 'firm app should auto-sync extra clauses');
  assert.match(app, /function\s+splitPortMatcherText\(/, 'firm app should split multi-value POL\/POD matcher text');
  assert.match(app, /function\s+normalizePortMatch\(/, 'firm app should normalize POL\/POD matching values');
  assert.match(app, /function\s+collectPortSuggestionsFromRules\(/, 'firm app should collect autocomplete suggestions');
  assert.match(app, /function\s+updatePortSuggestions\(/, 'firm app should render autocomplete suggestions');
  assert.match(app, /runtimeConfig\.extraClausePortRules/, 'firm app should read runtime POL\/POD rules');
  assert.match(config, /id:\s*'gabon_tax_ports'/, 'default Gabon port rule should be present');
  assert.match(config, /id:\s*'nigeria_tax_ports'/, 'default Nigeria port rule should be present');
  assert.match(config, /id:\s*'senegal_tax_ports'/, 'default Senegal port rule should be present');
});

test('offer output remains compatible for subject, text, html, and mailto generation', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'core-shipping-offer-test-'));
  const configModule = path.join(tempDir, 'config.mjs');
  const logicModule = path.join(tempDir, 'offer-logic.mjs');
  fs.writeFileSync(configModule, `
export function getRuntimeTermBehavior() {
  return {
    'Free In Free Out': { mode: 'laytime', includeLoading: true, includeDischarging: true, meaning: 'Free In Free Out' }
  };
}
export function getRuntimeTermClauses() {
  return {
    'Free In Free Out': { detentionClause: 'Congestion, if any, to count as detention both ends.', speedClause: '' }
  };
}
`);
  fs.writeFileSync(
    logicModule,
    read('shared/offer-logic.js').replace("import { getRuntimeTermBehavior, getRuntimeTermClauses } from './config.js';", "import { getRuntimeTermBehavior, getRuntimeTermClauses } from './config.mjs';")
  );

  const logic = await import(`file://${logicModule}`);
  const data = {
    vessel: 'MV ATA 1',
    account: 'ACME Chartering',
    cargo: 'Steel coils',
    underDeck: 'Under deck',
    cargoStackable: 'Cargo fully stackable',
    pcBasis: 'P/c basis',
    includeVesselSpecs: true,
    vesselSpecs: 'MV ATA 1 or sub\n---------------\nDWT: 6555',
    vesselSpecsHtml: 'MV ATA 1 or sub\nDWT: 6555',
    laycanDate: '01-10 Sep 2024',
    terms: 'Free In Free Out',
    pol: 'Izmir',
    pod: 'Barcelona',
    polSuffix: 'Owners terminal',
    podSuffix: 'Owners terminal',
    currency: 'USD',
    freightTerms: 'pmt',
    freightAmount: '85.00',
    demdetAmount: '10,500',
    includeCongestion: true,
    loadingDays: '2',
    loadingTerms: 'sshinc',
    dischargingDays: '2',
    dischargingTerms: 'sshinc',
    fltLoadingText: 'As fast as vessel can load',
    fltDischargingText: 'As fast as vessel can discharge',
    congestionClause: 'Congestion, if any, to count as detention both ends',
    agentLoad: 'TBA',
    agentDischarge: 'TBA',
    commissionPercentage: '2.5',
    applicableContract: 'Carriers BN',
    extraClauses: 'Sub stowage',
    finalClause: 'Sub all further terms / conditions',
    emailTo: 'ops@example.com',
    emailCc: 'broker@example.com',
    emailSubject: '',
    greeting: 'Dear Sirs,',
    openingParagraph: 'Please find Owners indication as follows:',
    markerLine: '++',
    forLine: 'For',
    endOfferLine: 'End offer',
    closingParagraph: 'Looking forward to hear',
    signOff: 'Best regards,',
    senderName: 'Operator',
    senderTitle: 'Chartering / Operations',
    companyName: 'Core Shipping',
    companyAddress: 'Istanbul',
    senderMobile: '+90',
    senderDirect: '',
    senderEmail: 'operator@example.com',
    senderWeb: 'www.core-shipping.com'
  };

  const email = logic.buildEmailText(data);
  assert.equal(email.subject, 'MV ATA 1 or sub / Izmir - Barcelona / 01-10 Sep 2024 / firm offer');
  assert.match(email.body, /1\. Vessel: MV ATA 1 or sub/);
  assert.match(email.body, /10\. Freight: USD 85\.00 pmt/);
  assert.match(email.body, /%2\.5 ttl commission/);

  const html = logic.buildHtmlEmailDocument(data);
  assert.match(html, /CORE SHIPPING/);
  assert.match(html, /Steel coils/);

  const mailto = logic.buildMailtoUrl(data, { includeBody: true });
  assert.match(mailto, /^mailto:ops%40example\.com\?/);
  assert.match(mailto, /cc=broker%40example\.com/);
});
