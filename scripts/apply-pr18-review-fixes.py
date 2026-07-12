from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)

source_path = Path('src/extension.ts')
source = source_path.read_text()

source = replace_once(
    source,
    "  private readonly playingAudio = new Set<HTMLAudioElement>();\n",
    "  private readonly playingAudio = new Set<HTMLAudioElement>();\n"
    "  private readonly registrationVersions = new Map<string, number>();\n",
    'registrationVersions field'
)

source = replace_once(
    source,
    "  deleteAllMemoryAssets(): void {\n"
    "    for (const asset of this.externalAssets.values()) this.deleteOwnedSkinIfExists(asset);\n",
    "  deleteAllMemoryAssets(): void {\n"
    "    for (const name of this.registrationVersions.keys()) {\n"
    "      this.registrationVersions.set(name, (this.registrationVersions.get(name) ?? 0) + 1);\n"
    "    }\n"
    "    for (const asset of this.externalAssets.values()) this.deleteOwnedSkinIfExists(asset);\n",
    'delete all invalidation'
)

source = replace_once(
    source,
    "  private async registerExternalAsset(url: string, name: string): Promise<void> {\n"
    "    const record = url\n"
    "      ? await this.fetchAndCache(url, name)\n"
    "      : await this.cacheGet(name);\n"
    "    if (!record) throw new Error(`Asset is not cached and URL is empty: ${name}`);\n"
    "    this.unregisterAsset(name);\n",
    "  private nextRegistrationVersion(name: string): number {\n"
    "    const version = (this.registrationVersions.get(name) ?? 0) + 1;\n"
    "    this.registrationVersions.set(name, version);\n"
    "    return version;\n"
    "  }\n\n"
    "  private async registerExternalAsset(url: string, name: string): Promise<void> {\n"
    "    const version = this.nextRegistrationVersion(name);\n"
    "    const record = url\n"
    "      ? await this.fetchAndCache(url, name)\n"
    "      : await this.cacheGet(name);\n"
    "    if (this.registrationVersions.get(name) !== version) return;\n"
    "    if (!record) throw new Error(`Asset is not cached and URL is empty: ${name}`);\n"
    "    this.unregisterAsset(name);\n",
    'external registration versioning'
)

source = replace_once(
    source,
    "    if (!costume) throw new Error(`Costume not found: ${spriteName}/${costumeName}`);\n"
    "    if (typeof costume.skinId !== 'number') throw new Error(`Costume skin is not available: ${spriteName}/${costumeName}`);\n"
    "    this.unregisterAsset(name);\n",
    "    if (!costume) throw new Error(`Costume not found: ${spriteName}/${costumeName}`);\n"
    "    this.unregisterAsset(name);\n",
    'costume eager skin check'
)

source = replace_once(
    source,
    "    if (!costume) throw new Error(`Background not found: ${backgroundName}`);\n"
    "    if (typeof costume.skinId !== 'number') throw new Error(`Background skin is not available: ${backgroundName}`);\n"
    "    this.unregisterAsset(name);\n",
    "    if (!costume) throw new Error(`Background not found: ${backgroundName}`);\n"
    "    this.unregisterAsset(name);\n",
    'background eager skin check'
)

source = replace_once(
    source,
    "    if (!sound) throw new Error(`Sound not found: ${spriteName}/${soundName}`);\n"
    "    if (!sound.soundId) throw new Error(`Sound ID is not available: ${spriteName}/${soundName}`);\n"
    "    if (!target.sprite?.soundBank) throw new Error(`Sound bank is not available: ${spriteName}`);\n"
    "    this.unregisterAsset(name);\n",
    "    if (!sound) throw new Error(`Sound not found: ${spriteName}/${soundName}`);\n"
    "    this.unregisterAsset(name);\n",
    'sound eager runtime checks'
)

source = replace_once(
    source,
    "  private unregisterAsset(name: string): void {\n"
    "    const kind = this.assetRegistry.get(name);\n",
    "  private unregisterAsset(name: string): void {\n"
    "    this.nextRegistrationVersion(name);\n"
    "    const kind = this.assetRegistry.get(name);\n",
    'unregister invalidation'
)

source = replace_once(
    source,
    "    const playPromise = audio.play();\n"
    "    if (!waitUntilDone) {\n"
    "      void playPromise.catch((error) => console.warn(`Failed to play audio asset \"${name}\"`, error));\n"
    "      return;\n"
    "    }\n"
    "    await playPromise;\n",
    "    const playPromise = audio.play();\n"
    "    if (!waitUntilDone) {\n"
    "      void playPromise.catch((error) => {\n"
    "        console.warn(`Failed to play audio asset \"${name}\"`, error);\n"
    "        cleanup();\n"
    "      });\n"
    "      return;\n"
    "    }\n"
    "    try {\n"
    "      await playPromise;\n"
    "    } catch (error) {\n"
    "      cleanup();\n"
    "      throw error;\n"
    "    }\n",
    'audio rejection cleanup'
)

source_path.write_text(source)

tests_path = Path('tests/extension.test.ts')
tests = tests_path.read_text()

tests = replace_once(
    tests,
    "import {beforeEach, describe, expect, it, vi} from 'vitest';\n",
    "import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';\n",
    'afterEach import'
)

tests = replace_once(
    tests,
    "} from '../src/extension.js';\n\n",
    "} from '../src/extension.js';\n\n"
    "interface TestExternalAsset {\n"
    "  kind: 'external';\n"
    "  name: string;\n"
    "  url: string;\n"
    "  mimeType: string;\n"
    "  data: ArrayBuffer;\n"
    "  cachedAt: number;\n"
    "  skinId: number | null;\n"
    "}\n\n"
    "interface TestExtensionInternals {\n"
    "  externalAssets: Map<string, TestExternalAsset>;\n"
    "  assetRegistry: Map<string, 'external' | 'costume' | 'sound'>;\n"
    "  fetchAndCache(url: string, name: string): Promise<TestExternalAsset>;\n"
    "}\n\n"
    "function deferred<T>() {\n"
    "  let resolve!: (value: T) => void;\n"
    "  let reject!: (reason?: unknown) => void;\n"
    "  const promise = new Promise<T>((resolvePromise, rejectPromise) => {\n"
    "    resolve = resolvePromise;\n"
    "    reject = rejectPromise;\n"
    "  });\n"
    "  return {promise, resolve, reject};\n"
    "}\n\n",
    'test helpers'
)

tests = replace_once(
    tests,
    "  beforeEach(() => {\n",
    "  afterEach(() => {\n"
    "    vi.unstubAllGlobals();\n"
    "  });\n\n"
    "  beforeEach(() => {\n",
    'global cleanup'
)

tests = replace_once(
    tests,
    "  it('borrows costume and backdrop skins without destroying them', async () => {\n",
    "  it('allows project images to register before renderer skins are initialized', async () => {\n"
    "    const extension = new AssetManagerExtension();\n"
    "    const heroCostume = sprite.sprite?.costumes[0];\n"
    "    const forestBackdrop = stage.sprite?.costumes[0];\n"
    "    if (!heroCostume || !forestBackdrop) throw new Error('Test costumes are missing.');\n\n"
    "    delete heroCostume.skinId;\n"
    "    await extension.registerAsset({RESOURCE_ID: 'costume:Hero,normal', NAME: 'hero-lazy'});\n"
    "    heroCostume.skinId = 42;\n"
    "    await extension.setStageSkin({NAME: 'hero-lazy'});\n"
    "    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(0, 42);\n\n"
    "    delete forestBackdrop.skinId;\n"
    "    await extension.registerAsset({RESOURCE_ID: 'background:forest', NAME: 'forest-lazy'});\n"
    "    forestBackdrop.skinId = 99;\n"
    "    await extension.setThisSpriteSkin({NAME: 'forest-lazy'}, {target: sprite});\n"
    "    expect(updateDrawableSkinId).toHaveBeenLastCalledWith(7, 99);\n"
    "  });\n\n"
    "  it('borrows costume and backdrop skins without destroying them', async () => {\n",
    'lazy image registration test'
)

tests = replace_once(
    tests,
    "  it('reports explicit type mismatches', async () => {\n",
    "  it('keeps the newest external registration when requests finish out of order', async () => {\n"
    "    const extension = new AssetManagerExtension();\n"
    "    const internals = extension as unknown as TestExtensionInternals;\n"
    "    const slow = deferred<TestExternalAsset>();\n"
    "    const fast = deferred<TestExternalAsset>();\n"
    "    vi.spyOn(internals, 'fetchAndCache').mockImplementation((url) =>\n"
    "      url.includes('slow') ? slow.promise : fast.promise\n"
    "    );\n\n"
    "    const slowRegistration = extension.registerAsset({\n"
    "      RESOURCE_ID: 'https://example.com/slow.png', NAME: 'shared'\n"
    "    });\n"
    "    const fastRegistration = extension.registerAsset({\n"
    "      RESOURCE_ID: 'https://example.com/fast.png', NAME: 'shared'\n"
    "    });\n\n"
    "    fast.resolve({\n"
    "      kind: 'external', name: 'shared', url: 'https://example.com/fast.png',\n"
    "      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 2, skinId: null\n"
    "    });\n"
    "    await fastRegistration;\n"
    "    slow.resolve({\n"
    "      kind: 'external', name: 'shared', url: 'https://example.com/slow.png',\n"
    "      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: null\n"
    "    });\n"
    "    await slowRegistration;\n\n"
    "    expect(internals.externalAssets.get('shared')?.url).toBe('https://example.com/fast.png');\n"
    "  });\n\n"
    "  it('invalidates a pending external registration when the name is unregistered', async () => {\n"
    "    const extension = new AssetManagerExtension();\n"
    "    const internals = extension as unknown as TestExtensionInternals;\n"
    "    const pending = deferred<TestExternalAsset>();\n"
    "    vi.spyOn(internals, 'fetchAndCache').mockReturnValue(pending.promise);\n\n"
    "    const registration = extension.registerAsset({\n"
    "      RESOURCE_ID: 'https://example.com/pending.png', NAME: 'pending'\n"
    "    });\n"
    "    extension.deleteMemoryAsset({NAME: 'pending'});\n"
    "    pending.resolve({\n"
    "      kind: 'external', name: 'pending', url: 'https://example.com/pending.png',\n"
    "      mimeType: 'image/png', data: new ArrayBuffer(0), cachedAt: 1, skinId: null\n"
    "    });\n"
    "    await registration;\n\n"
    "    expect(extension.isLoaded({NAME: 'pending'})).toBe(false);\n"
    "  });\n\n"
    "  it('cleans up external audio when play rejects', async () => {\n"
    "    const extension = new AssetManagerExtension();\n"
    "    const internals = extension as unknown as TestExtensionInternals;\n"
    "    const revokeObjectURL = vi.fn();\n"
    "    vi.stubGlobal('URL', {\n"
    "      createObjectURL: vi.fn(() => 'blob:test-audio'),\n"
    "      revokeObjectURL\n"
    "    });\n"
    "    vi.stubGlobal('Audio', class {\n"
    "      currentTime = 0;\n"
    "      addEventListener = vi.fn();\n"
    "      pause = vi.fn();\n"
    "      play = vi.fn(() => Promise.reject(new Error('play blocked')));\n"
    "      constructor(_url: string) {}\n"
    "    });\n"
    "    internals.externalAssets.set('audio', {\n"
    "      kind: 'external', name: 'audio', url: 'https://example.com/audio.mp3',\n"
    "      mimeType: 'audio/mpeg', data: new ArrayBuffer(0), cachedAt: 1, skinId: null\n"
    "    });\n"
    "    internals.assetRegistry.set('audio', 'external');\n\n"
    "    await expect(extension.playSoundUntilDone({NAME: 'audio'})).rejects.toThrow('play blocked');\n"
    "    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-audio');\n\n"
    "    revokeObjectURL.mockClear();\n"
    "    await extension.playSound({NAME: 'audio'});\n"
    "    await Promise.resolve();\n"
    "    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-audio');\n"
    "  });\n\n"
    "  it('reports explicit type mismatches', async () => {\n",
    'race and cleanup tests'
)

tests_path.write_text(tests)
