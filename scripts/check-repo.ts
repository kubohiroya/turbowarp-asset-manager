import {execFile} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {promisify} from 'node:util';

interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  packageManager?: string;
  engines?: {node?: string};
  repository?: {url?: string};
  bugs?: {url?: string};
  files?: string[];
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface RepoPolicy {
  schemaVersion: number;
  productName: string;
  packageType: string;
  licensePolicy: string;
  packageManager: string;
  homepage: string;
  node: {
    minimum: string;
  };
  extension: {
    id: string;
    standaloneBundle: string;
    compositionBundle: string;
    compositionTypes: string;
  };
  exceptions: {
    cache: boolean;
    thirdPartyRuntimeDependencies: boolean;
    compositionApi: boolean;
    legacyOpcodeCompatibility: boolean;
  };
}

interface PackResult {
  version: string;
  files: {path: string}[];
}

const execFileAsync = promisify(execFile);
const errors: string[] = [];

const packageMetadata = JSON.parse(await readFile('package.json', 'utf8')) as PackageMetadata;
const policy = JSON.parse(await readFile('repo-policy.json', 'utf8')) as RepoPolicy;
const readme = await readFile('README.md', 'utf8');
const license = await readFile('LICENSE', 'utf8');
const blockReference = await readFile('docs/block-reference.md', 'utf8');
const compositionApi = await readFile('docs/composition-api.md', 'utf8');
const runtimeContracts = await readFile('docs/runtime-contracts.md', 'utf8');

checkPolicy();
checkPackageMetadata();
checkReadme();
checkSplitDocuments();
checkLicense();
await checkPackContents();

if (errors.length > 0) {
  throw new Error(`Repository policy check failed:\n- ${errors.join('\n- ')}`);
}

process.stdout.write('Repository policy is aligned.\n');

function checkPolicy() {
  if (policy.schemaVersion !== 1) errors.push('repo-policy.json schemaVersion must be 1');
  if (policy.productName !== 'TurboWarp-Asset-Manager') {
    errors.push('repo-policy.json productName must be TurboWarp-Asset-Manager');
  }
  if (policy.packageType !== 'extension-composition') {
    errors.push('repo-policy.json packageType must be extension-composition');
  }
  if (policy.licensePolicy !== 'mpl-2.0') errors.push('repo-policy.json licensePolicy must be mpl-2.0');
  if (policy.packageManager !== 'pnpm') errors.push('repo-policy.json packageManager must be pnpm');
  if (policy.homepage !== 'pages') errors.push('repo-policy.json homepage must record Pages as the user entrypoint');
  if (policy.node?.minimum !== '22') errors.push('repo-policy.json node.minimum must be 22');
  if (!policy.exceptions?.cache || !policy.exceptions?.compositionApi) {
    errors.push('repo-policy.json must record cache and Composition API exceptions');
  }
}

function checkPackageMetadata() {
  for (const key of ['description', 'author', 'license', 'homepage', 'packageManager'] as const) {
    const value = packageMetadata[key];
    if (typeof value !== 'string' || value.trim().length === 0) {
      errors.push(`package.json ${key} must be a non-empty string`);
    }
  }
  if (packageMetadata.license !== 'MPL-2.0') errors.push('package.json license must be MPL-2.0');
  if (packageMetadata.homepage !== 'https://kubohiroya.github.io/turbowarp-asset-manager/') {
    errors.push('package.json homepage must point to the Pages user guide');
  }
  if (packageMetadata.engines?.node !== '>=22.18.0') errors.push('package.json engines.node must be >=22.18.0');
  if (packageMetadata.packageManager !== 'pnpm@11.11.0') {
    errors.push('package.json packageManager must pin pnpm@11.11.0');
  }
  for (const command of ['docs:check', 'check:dist', 'check', 'prepack']) {
    if (/\bnpm run\b/u.test(packageMetadata.scripts?.[command] ?? '')) {
      errors.push(`package.json ${command} must use pnpm commands`);
    }
  }
  for (const file of ['dist/', 'README.md', 'LICENSE']) {
    if (!packageMetadata.files?.includes(file)) errors.push(`package.json files must include ${file}`);
  }
}

function checkReadme() {
  if (!readme.startsWith(`# ${policy.productName}\n`)) {
    errors.push('README.md H1 must match repo-policy.json productName');
  }
  for (const heading of [
    '## User Guide',
    '## What It Does',
    '## Choose an Integration',
    '## Requirements and Safety',
    '## Installation',
    '## Quick Start',
    '## Composition Example',
    '## Integration Overview',
    '## Development',
    '## Release',
    '## License'
  ]) {
    if (!readme.includes(`${heading}\n`)) errors.push(`README.md must include ${heading}`);
  }
  const installLine = `pnpm add --save-exact ${packageMetadata.name}@${packageMetadata.version}`;
  const cdnUrl = `https://cdn.jsdelivr.net/npm/${packageMetadata.name}@${packageMetadata.version}/dist/asset-manager.js`;
  if (!readme.includes(installLine)) errors.push('README.md install example must match package version');
  if (!readme.includes(cdnUrl)) errors.push('README.md CDN URL must match package version');
  if (!readme.includes('corepack enable') || !readme.includes('pnpm install --frozen-lockfile')) {
    errors.push('README.md must document the Node/pnpm baseline');
  }
  if (!readme.includes('docs/composition-api.md') || !readme.includes('docs/runtime-contracts.md')) {
    errors.push('README.md must link to split contract documents');
  }
  if (readme.includes('<!-- BEGIN GENERATED BLOCKS -->') || readme.includes('## Blocks')) {
    errors.push('README.md must stay an entrypoint and not contain the generated block reference');
  }
  if (!readme.includes('SPDX-License-Identifier: MPL-2.0')) {
    errors.push('README.md License section must include the SPDX identifier');
  }
}

function checkSplitDocuments() {
  if (!compositionApi.startsWith('## Composition API\n')) {
    errors.push('docs/composition-api.md must start with the Composition API section');
  }
  for (const phrase of [
    'DOM image resources',
    'Verified remote binary cache',
    'Transactional binary bundles',
    'Session-only binary backing'
  ]) {
    if (!compositionApi.includes(phrase)) errors.push(`docs/composition-api.md must preserve ${phrase}`);
  }
  for (const phrase of [
    '## Resource identifiers',
    '## Runtime text assets',
    '## Diagnostic errors',
    '## Actor animation input',
    '## Loading indicator compatibility'
  ]) {
    if (!runtimeContracts.includes(phrase)) errors.push(`docs/runtime-contracts.md must preserve ${phrase}`);
  }
  if (!blockReference.includes('<!-- BEGIN GENERATED BLOCKS -->') || !blockReference.includes('<!-- END GENERATED BLOCKS -->')) {
    errors.push('docs/block-reference.md must contain generated block markers');
  }
  const legacyPoseNamePattern = new RegExp([
    ['tm', 'pose'].join(''),
    ['TM', 'Pose'].join(''),
    ['TM', 'POSE'].join('')
  ].join('|'), 'u');
  if (legacyPoseNamePattern.test(`${readme}\n${compositionApi}\n${runtimeContracts}\n${blockReference}`)) {
    errors.push('documentation must not retain legacy pose-era naming');
  }
}

function checkLicense() {
  if (!license.startsWith('Mozilla Public License Version 2.0\n==================================')) {
    errors.push('LICENSE must contain the Mozilla Public License Version 2.0 full text');
  }
  if (!license.includes('Exhibit A - Source Code Form License Notice')) {
    errors.push('LICENSE must include the MPL-2.0 Exhibit A text');
  }
}

async function checkPackContents() {
  const {stdout} = await execFileAsync('npm', ['pack', '--dry-run', '--ignore-scripts', '--json']);
  const [pack] = JSON.parse(stdout) as PackResult[];
  if (!pack) {
    errors.push('npm pack must report a package');
    return;
  }
  const files = new Set(pack.files.map((file) => file.path));
  for (const file of [
    'README.md',
    'LICENSE',
    policy.extension.standaloneBundle,
    policy.extension.compositionBundle,
    policy.extension.compositionTypes
  ]) {
    if (!files.has(file)) errors.push(`npm pack must include ${file}`);
  }
  if (pack.version !== packageMetadata.version) {
    errors.push('npm pack version must match package.json version');
  }
}
