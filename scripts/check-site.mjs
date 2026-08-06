import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const siteRoot = fileURLToPath(new URL('../docs/', import.meta.url));
const readmePath = fileURLToPath(new URL('../README.md', import.meta.url));
const htmlFiles = await collectHtml(siteRoot);
const errors = [];

const readme = await readFile(readmePath, 'utf8');
for (const guideUrl of [
  'https://kubohiroya.github.io/turbowarp-asset-manager/',
  'https://kubohiroya.github.io/turbowarp-asset-manager/ja/'
]) {
  if (!readme.includes(guideUrl)) errors.push(`README.md: missing guide link ${guideUrl}`);
}

await checkAppBar([
  path.join(siteRoot, 'index.html'),
  path.join(siteRoot, 'ja/index.html')
]);
await checkAppBarCss(path.join(siteRoot, 'assets/site.css'));

for (const htmlFile of htmlFiles) {
  const source = await readFile(htmlFile, 'utf8');
  const ids = new Set([...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
  const references = [
    ...source.matchAll(/\b(?:href|src)="([^"]+)"/g)
  ].map((match) => match[1]);

  for (const language of ['en', 'ja', 'x-default']) {
    if (!new RegExp(`rel="alternate"\\s+hreflang="${language}"`).test(source)) {
      errors.push(`${relative(htmlFile)}: missing alternate hreflang=${language}`);
    }
  }

  for (const reference of references) {
    if (/^(?:https?:|mailto:|data:)/.test(reference)) continue;

    const [pathname, fragment] = reference.split('#', 2);
    let target = pathname ? path.resolve(path.dirname(htmlFile), pathname) : htmlFile;
    if (await isDirectory(target)) target = path.join(target, 'index.html');

    if (!(await exists(target))) {
      errors.push(`${relative(htmlFile)}: missing local target ${reference}`);
      continue;
    }

    if (fragment) {
      const targetSource = target === htmlFile ? source : await readFile(target, 'utf8');
      const targetIds = target === htmlFile
        ? ids
        : new Set([...targetSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
      if (!targetIds.has(fragment)) {
        errors.push(`${relative(htmlFile)}: missing anchor #${fragment} in ${relative(target)}`);
      }
    }
  }

  for (const figure of source.matchAll(/<figure\b([^>]*)>([\s\S]*?)<\/figure>/g)) {
    const describedBy = figure[1].match(/\baria-describedby="([^"]+)"/)?.[1];
    if (!describedBy || !figure[2].includes(`id="${describedBy}"`)) {
      errors.push(`${relative(htmlFile)}: diagram is missing an in-figure text description`);
    }
  }
}

if (errors.length > 0) {
  throw new Error(`Documentation site check failed:\n- ${errors.join('\n- ')}`);
}

console.log(`Checked ${htmlFiles.length} HTML pages and their local links, anchors, and diagram descriptions.`);

async function collectHtml(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectHtml(entryPath);
    return entry.isFile() && entry.name.endsWith('.html') ? [entryPath] : [];
  }));
  return nested.flat();
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch {
    return false;
  }
}

function relative(target) {
  return path.relative(siteRoot, target) || 'index.html';
}

async function checkAppBar(pages) {
  const sources = await Promise.all(pages.map((page) => readFile(page, 'utf8')));
  const appBars = sources.map((source, index) => {
    const match = source.match(/<header class="app-bar">[\s\S]*?<\/header>/);
    if (!match) {
      errors.push(`${relative(pages[index])}: missing app-bar`);
      return '';
    }
    return match[0];
  });

  const signatures = appBars.map((appBar) => [...appBar.matchAll(/<(\/)?([a-z0-9-]+)([^>]*)>/gi)]
    .map((match) => {
      if (match[1]) return `/${match[2]}`;
      const className = match[3].match(/\bclass="([^"]+)"/)?.[1] ?? '';
      return `${match[2]}.${className}`;
    })
    .join('|'));
  if (signatures[0] !== signatures[1]) errors.push('localized app bars must share the same DOM/class structure');

  const sectionTargets = appBars.map((appBar) => {
    const nav = appBar.match(/<nav class="app-bar-sections"[\s\S]*?<\/nav>/)?.[0] ?? '';
    return [...nav.matchAll(/href="(#[^"]+)"/g)].map((match) => match[1]);
  });
  if (JSON.stringify(sectionTargets[0]) !== JSON.stringify(sectionTargets[1])) {
    errors.push('localized app bars must use the same section order');
  }

  for (const [index, appBar] of appBars.entries()) {
    for (const className of ['app-bar-brand', 'app-bar-sections', 'app-bar-actions', 'app-bar-github', 'app-bar-languages']) {
      if (!appBar.includes(`class="${className}"`)) errors.push(`${relative(pages[index])}: missing ${className}`);
    }
    if (!appBar.includes('>English</a>') || !appBar.includes('>日本語</a>')) {
      errors.push(`${relative(pages[index])}: language names must be English / 日本語`);
    }
    if ((appBar.match(/aria-current="page"/g) ?? []).length !== 1) {
      errors.push(`${relative(pages[index])}: exactly one language must have aria-current=page`);
    }
    for (const language of ['en', 'ja']) {
      if (!new RegExp(`hreflang="${language}"[^>]*lang="${language}"|lang="${language}"[^>]*hreflang="${language}"`).test(appBar)) {
        errors.push(`${relative(pages[index])}: language switch is missing lang/hreflang=${language}`);
      }
    }
  }
}

async function checkAppBarCss(cssPath) {
  const css = await readFile(cssPath, 'utf8');
  const requirements = [
    [/\.app-bar\s*{[\s\S]*?position:\s*sticky/, 'sticky app bar'],
    [/\.app-bar-inner\s*{[\s\S]*?min-height:\s*4rem/, '64px app bar height'],
    [/backdrop-filter:\s*blur\(/, 'backdrop blur'],
    [/border-bottom:/, 'bottom border'],
    [/focus-visible/, 'keyboard focus style'],
    [/overflow-x:\s*clip/, 'horizontal overflow protection'],
    [/@media\s*\(max-width:[^)]+\)[\s\S]*?\.app-bar-sections\s*{\s*display:\s*none/, 'responsive section navigation']
  ];
  for (const [pattern, label] of requirements) {
    if (!pattern.test(css)) errors.push(`${relative(cssPath)}: missing ${label}`);
  }
}
