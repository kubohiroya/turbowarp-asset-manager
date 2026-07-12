from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected one match, found {count}')
    return text.replace(old, new, 1)


extension_path = Path('src/extension.ts')
extension = extension_path.read_text()
extension = replace_once(
    extension,
    "export const EXTENSION_VERSION = '2026-07-12-project-local-assets';",
    "export const EXTENSION_VERSION = '2026-07-12-colon-resource-identifiers';",
    'extension version',
)
extension = extension.replace(
    "splitSourceAndAssetName(payload, 'costume')",
    "splitLocalResourcePair(payload, 'costume')",
)
extension = extension.replace(
    "splitSourceAndAssetName(payload, 'sound')",
    "splitLocalResourcePair(payload, 'sound')",
)
extension = replace_once(
    extension,
    """    case 'background': {
      if (!payload) throw new Error('Background name is empty.');
      return {kind: 'background', backgroundName: payload};
    }""",
    """    case 'background': {
      return {kind: 'background', backgroundName: parseLocalResourceName(payload, 'Background')};
    }""",
    'background parser',
)
extension = replace_once(
    extension,
    """function splitSourceAndAssetName(payload: string, scheme: string): [string, string] {
  const commaIndex = payload.indexOf(',');
  if (commaIndex < 0) {
    throw new Error(`${scheme} resource must specify a source and asset name separated by a comma.`);
  }
  const sourceName = payload.slice(0, commaIndex).trim();
  const assetName = payload.slice(commaIndex + 1).trim();
  if (!sourceName) throw new Error(`${scheme} source name is empty.`);
  if (!assetName) throw new Error(`${scheme} asset name is empty.`);
  return [sourceName, assetName];
}""",
    """function splitLocalResourcePair(payload: string, scheme: string): [string, string] {
  const parts = payload.split(':');
  if (parts.length !== 2) {
    throw new Error(`${scheme} resource must specify a source and asset name separated by exactly one colon.`);
  }
  const sourceName = parts[0]?.trim() ?? '';
  const assetName = parts[1]?.trim() ?? '';
  if (!sourceName) throw new Error(`${scheme} source name is empty.`);
  if (!assetName) throw new Error(`${scheme} asset name is empty.`);
  return [sourceName, assetName];
}

function parseLocalResourceName(payload: string, label: string): string {
  const name = payload.trim();
  if (!name) throw new Error(`${label} name is empty.`);
  if (name.includes(':')) throw new Error(`${label} name must not contain a colon.`);
  return name;
}""",
    'local resource pair parser',
)
extension_path.write_text(extension)


test_path = Path('tests/extension.test.ts')
tests = test_path.read_text()
for old, new in {
    'costume:Hero,normal': 'costume:Hero:normal',
    'sound:@stage,opening': 'sound:@stage:opening',
    'sound:Hero,hello': 'sound:Hero:hello',
}.items():
    tests = tests.replace(old, new)
tests = replace_once(
    tests,
    """  it('rejects unknown schemes and incomplete identifiers', () => {
    expect(() => parseResourceIdentifier('ftp://example.com/a.png')).toThrow('Unsupported resource scheme');
    expect(() => parseResourceIdentifier('costume:Hero')).toThrow('separated by a comma');
    expect(() => parseResourceIdentifier('background:')).toThrow('Background name is empty');
  });""",
    """  it('allows commas as ordinary characters without quoting or escaping', () => {
    expect(parseResourceIdentifier('costume:人物,主人公:通常,正面')).toEqual({
      kind: 'costume', spriteName: '人物,主人公', costumeName: '通常,正面'
    });
  });

  it('rejects the old comma separator and ambiguous colon usage', () => {
    expect(() => parseResourceIdentifier('ftp://example.com/a.png')).toThrow('Unsupported resource scheme');
    expect(() => parseResourceIdentifier('costume:Hero,normal')).toThrow('exactly one colon');
    expect(() => parseResourceIdentifier('costume:Hero:normal:alternate')).toThrow('exactly one colon');
    expect(() => parseResourceIdentifier('sound:Hero')).toThrow('exactly one colon');
    expect(() => parseResourceIdentifier('background:')).toThrow('Background name is empty');
    expect(() => parseResourceIdentifier('background:forest:night')).toThrow('must not contain a colon');
  });""",
    'parser rejection tests',
)
test_path.write_text(tests)


readme_path = Path('README.md')
readme = readme_path.read_text()
readme = readme.replace('costume:Sprite1,costume1', 'costume:Sprite1:costume1')
readme = readme.replace('sound:Sprite1,sound1', 'sound:Sprite1:sound1')
readme = readme.replace('sound:@stage,stage-sound1', 'sound:@stage:stage-sound1')
readme = replace_once(
    readme,
    'An empty `RESOURCE_ID` reloads the external asset named by `NAME` from IndexedDB. The comma in `costume:` and `sound:` separates the source target name from the costume or sound name.',
    'An empty `RESOURCE_ID` reloads the external asset named by `NAME` from IndexedDB. In `costume:` and `sound:` identifiers, exactly one colon separates the source target name from the costume or sound name. Colons cannot be used inside local sprite, costume, backdrop, or sound names. Commas are ordinary name characters. Double quotes and backslashes have no quoting or escaping role and are not interpreted specially.',
    'README syntax explanation',
)
readme_path.write_text(readme)


package_path = Path('package.json')
package_json = package_path.read_text()
package_json = replace_once(package_json, '"version": "0.2.0"', '"version": "0.2.1"', 'package version')
package_path.write_text(package_json)
