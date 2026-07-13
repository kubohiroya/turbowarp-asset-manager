// Name: Asset Manager
// ID: twAssetManager
// Description: Register, cache, display, and play external or project-local image and audio assets in TurboWarp.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  const extensionName = "Asset Manager";
  const blocks = [{ "opcode": "registerAsset", "blockType": "COMMAND", "text": "register resource [RESOURCE_ID] as asset [NAME]", "description": "Registers an external URL, cached asset, sprite costume, stage backdrop, or project sound under one asset name.", "arguments": { "RESOURCE_ID": { "type": "STRING", "defaultValue": "https://example.com/asset.png" }, "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "loadAsset", "blockType": "COMMAND", "text": "load asset from URL [URL] or cache as [NAME]", "description": "Legacy compatibility block. Loads an external image or audio asset from the supplied URL, or from IndexedDB when the URL is empty.", "arguments": { "URL": { "type": "STRING", "defaultValue": "https://example.com/asset.png" }, "NAME": { "type": "STRING", "defaultValue": "asset1" } }, "hideFromPalette": true }, { "opcode": "deleteMemoryAsset", "blockType": "COMMAND", "text": "delete asset [NAME] from memory", "description": "Unregisters one asset. Owned external renderer skins are released; project costumes and sounds are left unchanged.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "deleteAllMemoryAssets", "blockType": "COMMAND", "text": "delete all assets from memory", "description": "Unregisters all assets, releases owned external renderer skins, and stops tracked external audio playback.", "arguments": {} }, { "opcode": "deleteCachedAsset", "blockType": "COMMAND", "text": "delete asset [NAME] from cache", "description": "Deletes one named external asset from the IndexedDB cache.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "deleteAllCachedAssets", "blockType": "COMMAND", "text": "delete all assets from cache", "description": "Clears all external assets from the IndexedDB cache.", "arguments": {} }, { "opcode": "isLoaded", "blockType": "BOOLEAN", "text": "asset [NAME] is loaded", "description": "Returns whether the named external or project-local asset is currently registered.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "setThisSpriteSkin", "blockType": "COMMAND", "text": "set this sprite skin to asset [NAME]", "description": "Applies a registered external image, sprite costume, or stage backdrop to the current sprite or clone.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "setSpriteSkin", "blockType": "COMMAND", "text": "set [SPRITE] skin to asset [NAME] (compatibility)", "description": "Applies a registered external image, sprite costume, or stage backdrop to a named sprite. This block is retained for compatibility.", "arguments": { "SPRITE": { "type": "STRING", "defaultValue": "Sprite1" }, "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "setStageSkin", "blockType": "COMMAND", "text": "set stage backdrop to asset [NAME]", "description": "Applies a registered external image, sprite costume, or stage backdrop to the stage drawable.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "backdrop1" } } }, { "opcode": "playSound", "blockType": "COMMAND", "text": "play asset [NAME] as sound", "description": "Starts playback of a registered external audio asset or project sound without waiting for completion.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "sound1" } } }, { "opcode": "playSoundUntilDone", "blockType": "COMMAND", "text": "play asset [NAME] as sound until done", "description": "Plays a registered external audio asset or project sound and waits until playback ends or fails.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "sound1" } } }, { "opcode": "getAssetMimeType", "blockType": "REPORTER", "text": "MIME type of asset [NAME]", "description": "Returns the normalized MIME type of a registered external or project-local asset.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "getVersion", "blockType": "REPORTER", "text": "Asset Manager version", "description": "Returns the Asset Manager implementation version.", "arguments": {} }];
  const definitions = {
    extensionName,
    blocks
  };
  const EXTENSION_ID = "twAssetManager";
  const EXTENSION_VERSION = "2026-07-13-backdrop-resource-identifier";
  const DB_NAME = "tw-asset-manager";
  const DB_VERSION = 1;
  const STORE_NAME = "assets";
  const STAGE_RESOURCE_NAME = "@stage";
  const blockDefinitions = definitions.blocks;
  function normalizeName(value) {
    return String(value ?? "").trim();
  }
  function guessMimeType(value) {
    const name = String(value ?? "").toLowerCase().split("?")[0]?.split("#")[0] ?? "";
    const types = [
      [[".svg"], "image/svg+xml"],
      [[".png"], "image/png"],
      [[".jpg", ".jpeg"], "image/jpeg"],
      [[".webp"], "image/webp"],
      [[".gif"], "image/gif"],
      [[".mp3"], "audio/mpeg"],
      [[".wav"], "audio/wav"],
      [[".ogg"], "audio/ogg"],
      [[".m4a"], "audio/mp4"],
      [[".aac"], "audio/aac"]
    ];
    return types.find(([extensions]) => extensions.some((extension) => name.endsWith(extension)))?.[1] ?? "application/octet-stream";
  }
  function normalizeMimeType(mimeType, urlOrName) {
    const raw = String(mimeType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    return !raw || raw === "application/octet-stream" || raw === "binary/octet-stream" ? guessMimeType(urlOrName) : raw;
  }
  function parseResourceIdentifier(value) {
    const resourceId = normalizeName(value);
    if (!resourceId) return { kind: "cache" };
    if (/^https?:\/\//i.test(resourceId)) return { kind: "external", url: resourceId };
    const separatorIndex = resourceId.indexOf(":");
    if (separatorIndex < 0) {
      throw new Error(`Unsupported resource identifier: ${resourceId}`);
    }
    const scheme = resourceId.slice(0, separatorIndex).trim().toLowerCase();
    const payload = resourceId.slice(separatorIndex + 1).trim();
    switch (scheme) {
      case "costume": {
        const [spriteName, costumeName] = splitLocalResourcePair(payload, "costume");
        return { kind: "costume", spriteName, costumeName };
      }
      case "backdrop": {
        return { kind: "backdrop", backdropName: parseLocalResourceName(payload, "Backdrop") };
      }
      case "sound": {
        const [spriteName, soundName] = splitLocalResourcePair(payload, "sound");
        return { kind: "sound", spriteName, soundName };
      }
      default:
        throw new Error(`Unsupported resource scheme: ${scheme}`);
    }
  }
  function splitLocalResourcePair(payload, scheme) {
    const parts = payload.split(":");
    if (parts.length !== 2) {
      throw new Error(`${scheme} resource must specify a source and asset name separated by exactly one colon.`);
    }
    const sourceName = parts[0]?.trim() ?? "";
    const assetName = parts[1]?.trim() ?? "";
    if (!sourceName) throw new Error(`${scheme} source name is empty.`);
    if (!assetName) throw new Error(`${scheme} asset name is empty.`);
    return [sourceName, assetName];
  }
  function parseLocalResourceName(payload, label) {
    const name = payload.trim();
    if (!name) throw new Error(`${label} name is empty.`);
    if (name.includes(":")) throw new Error(`${label} name must not contain a colon.`);
    return name;
  }
  class AssetManagerExtension {
    constructor() {
      __publicField(this, "runtime", Scratch.vm.runtime);
      __publicField(this, "renderer", this.runtime.renderer);
      __publicField(this, "externalAssets", /* @__PURE__ */ new Map());
      __publicField(this, "costumeAssets", /* @__PURE__ */ new Map());
      __publicField(this, "soundAssets", /* @__PURE__ */ new Map());
      __publicField(this, "assetRegistry", /* @__PURE__ */ new Map());
      __publicField(this, "playingAudio", /* @__PURE__ */ new Set());
      __publicField(this, "registrationVersions", /* @__PURE__ */ new Map());
    }
    getInfo() {
      return {
        id: EXTENSION_ID,
        name: Scratch.translate(definitions.extensionName),
        color1: "#5b7cfa",
        color2: "#425ed8",
        color3: "#2f46aa",
        blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
      };
    }
    async registerAsset(args) {
      const name = this.requireAssetName(args.NAME);
      const resource = parseResourceIdentifier(args.RESOURCE_ID);
      switch (resource.kind) {
        case "cache":
          await this.registerExternalAsset("", name);
          return;
        case "external":
          await this.registerExternalAsset(resource.url, name);
          return;
        case "costume":
          this.registerCostumeReference(name, resource.spriteName, resource.costumeName);
          return;
        case "backdrop":
          this.registerBackdropReference(name, resource.backdropName);
          return;
        case "sound":
          this.registerSoundReference(name, resource.spriteName, resource.soundName);
      }
    }
    /** Legacy opcode retained for existing projects. */
    async loadAsset(args) {
      const name = this.requireAssetName(args.NAME);
      await this.registerExternalAsset(normalizeName(args.URL), name);
    }
    deleteMemoryAsset(args) {
      this.unregisterAsset(normalizeName(args.NAME));
    }
    deleteAllMemoryAssets() {
      for (const name of this.registrationVersions.keys()) {
        this.registrationVersions.set(name, (this.registrationVersions.get(name) ?? 0) + 1);
      }
      for (const asset of this.externalAssets.values()) this.deleteOwnedSkinIfExists(asset);
      this.externalAssets.clear();
      this.costumeAssets.clear();
      this.soundAssets.clear();
      this.assetRegistry.clear();
      for (const audio of this.playingAudio) {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch {
        }
      }
      this.playingAudio.clear();
    }
    async deleteCachedAsset(args) {
      await this.cacheDelete(normalizeName(args.NAME));
    }
    async deleteAllCachedAssets() {
      await this.cacheClear();
    }
    isLoaded(args) {
      return this.assetRegistry.has(normalizeName(args.NAME));
    }
    async setThisSpriteSkin(args, util) {
      if (!util.target || util.target.isStage) throw new Error("This block must be used on a sprite or its clone.");
      this.applySkinToTarget(util.target, await this.resolveSkin(args.NAME));
    }
    async setSpriteSkin(args) {
      const name = normalizeName(args.SPRITE);
      const target = this.findTargetByName(name);
      if (!target) throw new Error(`Sprite not found: ${name}`);
      this.applySkinToTarget(target, await this.resolveSkin(args.NAME));
    }
    async setStageSkin(args) {
      const stage = this.getStageTarget();
      this.applySkinToTarget(stage, await this.resolveSkin(args.NAME));
    }
    async playSound(args) {
      await this.playResolvedSound(args.NAME, false);
    }
    async playSoundUntilDone(args) {
      await this.playResolvedSound(args.NAME, true);
    }
    getAssetMimeType(args) {
      const name = normalizeName(args.NAME);
      const kind = this.assetRegistry.get(name);
      if (!kind) return "";
      switch (kind) {
        case "external": {
          const asset = this.externalAssets.get(name);
          return asset ? normalizeMimeType(asset.mimeType, asset.url || name) : "";
        }
        case "costume": {
          const { costume } = this.resolveCostumeReference(name);
          return this.projectAssetMimeType(costume.dataFormat, "image");
        }
        case "sound": {
          const { sound } = this.resolveSoundReference(name);
          return this.projectAssetMimeType(sound.dataFormat, "audio");
        }
      }
    }
    getVersion() {
      return EXTENSION_VERSION;
    }
    toScratchBlock(block) {
      return {
        opcode: block.opcode,
        blockType: Scratch.BlockType[block.blockType],
        text: Scratch.translate(block.text),
        ...block.hideFromPalette ? { hideFromPalette: true } : {},
        ...Object.keys(block.arguments).length > 0 ? {
          arguments: Object.fromEntries(
            Object.entries(block.arguments).map(([name, argument]) => [
              name,
              {
                type: Scratch.ArgumentType[argument.type],
                defaultValue: argument.defaultValue
              }
            ])
          )
        } : {}
      };
    }
    requireAssetName(value) {
      const name = normalizeName(value);
      if (!name) throw new Error("Asset name is empty.");
      return name;
    }
    nextRegistrationVersion(name) {
      const version = (this.registrationVersions.get(name) ?? 0) + 1;
      this.registrationVersions.set(name, version);
      return version;
    }
    async registerExternalAsset(url, name) {
      const version = this.nextRegistrationVersion(name);
      const record = url ? await this.fetchAndCache(url, name) : await this.cacheGet(name);
      if (this.registrationVersions.get(name) !== version) return;
      if (!record) throw new Error(`Asset is not cached and URL is empty: ${name}`);
      this.unregisterAsset(name);
      this.externalAssets.set(name, {
        ...record,
        kind: "external",
        mimeType: normalizeMimeType(record.mimeType, record.url || name),
        skinId: null
      });
      this.assetRegistry.set(name, "external");
    }
    registerCostumeReference(name, spriteName, costumeName) {
      const target = this.findTargetByName(spriteName);
      if (!target) throw new Error(`Sprite not found: ${spriteName}`);
      const costume = this.findCostume(target, costumeName, null);
      if (!costume) throw new Error(`Costume not found: ${spriteName}/${costumeName}`);
      this.unregisterAsset(name);
      this.costumeAssets.set(name, {
        kind: "costume",
        name,
        targetId: target.id,
        targetName: spriteName,
        isStage: false,
        costumeName,
        assetId: costume.assetId ?? null
      });
      this.assetRegistry.set(name, "costume");
    }
    registerBackdropReference(name, backdropName) {
      const stage = this.getStageTarget();
      const costume = this.findCostume(stage, backdropName, null);
      if (!costume) throw new Error(`Backdrop not found: ${backdropName}`);
      this.unregisterAsset(name);
      this.costumeAssets.set(name, {
        kind: "costume",
        name,
        targetId: stage.id,
        targetName: STAGE_RESOURCE_NAME,
        isStage: true,
        costumeName: backdropName,
        assetId: costume.assetId ?? null
      });
      this.assetRegistry.set(name, "costume");
    }
    registerSoundReference(name, spriteName, soundName) {
      const isStage = spriteName.toLowerCase() === STAGE_RESOURCE_NAME;
      const target = isStage ? this.getStageTarget() : this.findTargetByName(spriteName);
      if (!target) throw new Error(`Sound source not found: ${spriteName}`);
      const sound = this.findSound(target, soundName, null);
      if (!sound) throw new Error(`Sound not found: ${spriteName}/${soundName}`);
      this.unregisterAsset(name);
      this.soundAssets.set(name, {
        kind: "sound",
        name,
        targetId: target.id,
        targetName: isStage ? STAGE_RESOURCE_NAME : spriteName,
        isStage,
        soundName,
        assetId: sound.assetId ?? null
      });
      this.assetRegistry.set(name, "sound");
    }
    unregisterAsset(name) {
      this.nextRegistrationVersion(name);
      const kind = this.assetRegistry.get(name);
      if (!kind) return;
      if (kind === "external") {
        this.deleteOwnedSkinIfExists(this.externalAssets.get(name));
        this.externalAssets.delete(name);
      } else if (kind === "costume") {
        this.costumeAssets.delete(name);
      } else {
        this.soundAssets.delete(name);
      }
      this.assetRegistry.delete(name);
    }
    openDatabase() {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME, { keyPath: "name" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async transaction(mode, action) {
      const database = await this.openDatabase();
      return new Promise((resolve, reject) => {
        const request = action(database.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async cacheGet(name) {
      return await this.transaction("readonly", (store) => store.get(name)) ?? null;
    }
    async cachePut(record) {
      await this.transaction("readwrite", (store) => store.put(record));
    }
    async cacheDelete(name) {
      await this.transaction("readwrite", (store) => store.delete(name));
    }
    async cacheClear() {
      await this.transaction("readwrite", (store) => store.clear());
    }
    async fetchAndCache(url, name) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch asset "${name}": ${response.status} ${response.statusText}`);
      const blob = await response.blob();
      const record = {
        name,
        url,
        mimeType: normalizeMimeType(blob.type || response.headers.get("Content-Type"), url),
        data: await blob.arrayBuffer(),
        cachedAt: Date.now()
      };
      await this.cachePut(record);
      return record;
    }
    getStageTarget() {
      const stage = this.runtime.targets.find((target) => target.isStage);
      if (!stage) throw new Error("Stage not found.");
      return stage;
    }
    findTargetByName(name) {
      const targets = this.runtime.targets;
      return targets.find((target) => !target.isStage && target.isOriginal && target.sprite?.name === name) ?? targets.find((target) => !target.isStage && target.sprite?.name === name) ?? null;
    }
    resolveReferencedTarget(targetId, targetName, isStage) {
      const byId = this.runtime.targets.find((target) => target.id === targetId);
      if (byId) return byId;
      if (isStage) return this.getStageTarget();
      const byName = this.findTargetByName(targetName);
      if (!byName) throw new Error(`Asset source target no longer exists: ${targetName}`);
      return byName;
    }
    findCostume(target, costumeName, assetId) {
      const costumes = target.sprite?.costumes ?? [];
      return (assetId ? costumes.find((costume) => costume.assetId === assetId) : void 0) ?? costumes.find((costume) => costume.name === costumeName) ?? null;
    }
    findSound(target, soundName, assetId) {
      const sounds = target.sprite?.sounds ?? [];
      return (assetId ? sounds.find((sound) => sound.assetId === assetId) : void 0) ?? sounds.find((sound) => sound.name === soundName) ?? null;
    }
    async resolveSkin(value) {
      const name = normalizeName(value);
      const kind = this.assetRegistry.get(name);
      if (!kind) throw new Error(`Asset is not loaded: ${name}`);
      if (kind === "external") return this.ensureExternalSkin(name);
      if (kind === "costume") return this.resolveCostumeReference(name).costume.skinId;
      throw new Error(`Asset is not an image: ${name}`);
    }
    async ensureExternalSkin(name) {
      const asset = this.externalAssets.get(name);
      if (!asset) throw new Error(`External asset is not loaded: ${name}`);
      asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!asset.mimeType.startsWith("image/")) throw new Error(`Asset is not an image: ${name} (${asset.mimeType})`);
      if (asset.skinId !== null) return asset.skinId;
      const blob = new Blob([asset.data], { type: asset.mimeType });
      asset.skinId = asset.mimeType === "image/svg+xml" ? this.renderer.createSVGSkin(await blob.text()) : this.renderer.createBitmapSkin(await createImageBitmap(blob), 1);
      return asset.skinId;
    }
    resolveCostumeReference(name) {
      const reference = this.costumeAssets.get(name);
      if (!reference) throw new Error(`Costume asset is not registered: ${name}`);
      const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
      const costume = this.findCostume(target, reference.costumeName, reference.assetId);
      if (!costume) throw new Error(`Costume no longer exists: ${reference.targetName}/${reference.costumeName}`);
      if (typeof costume.skinId !== "number") {
        throw new Error(`Costume skin is not available: ${reference.targetName}/${reference.costumeName}`);
      }
      return { target, costume };
    }
    resolveSoundReference(name) {
      const reference = this.soundAssets.get(name);
      if (!reference) throw new Error(`Sound asset is not registered: ${name}`);
      const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
      const sound = this.findSound(target, reference.soundName, reference.assetId);
      if (!sound) throw new Error(`Sound no longer exists: ${reference.targetName}/${reference.soundName}`);
      if (!sound.soundId) throw new Error(`Sound ID is not available: ${reference.targetName}/${reference.soundName}`);
      if (!target.sprite?.soundBank) throw new Error(`Sound bank is not available: ${reference.targetName}`);
      return { target, sound };
    }
    deleteOwnedSkinIfExists(asset) {
      if (!asset || asset.skinId === null) return;
      try {
        this.renderer.destroySkin(asset.skinId);
      } catch (error) {
        console.warn("Failed to destroy skin", error);
      }
      asset.skinId = null;
    }
    applySkinToTarget(target, skinId) {
      if (target.drawableID === void 0 || target.drawableID === null) {
        throw new Error(`Target drawable not found: ${target.sprite?.name ?? "unknown"}`);
      }
      this.renderer.updateDrawableSkinId(target.drawableID, skinId);
      target.emitVisualChange?.();
      this.runtime.requestRedraw?.();
    }
    async playResolvedSound(value, waitUntilDone) {
      const name = normalizeName(value);
      const kind = this.assetRegistry.get(name);
      if (!kind) throw new Error(`Asset is not loaded: ${name}`);
      if (kind === "external") {
        await this.playExternalSound(name, waitUntilDone);
        return;
      }
      if (kind === "sound") {
        await this.playProjectSound(name, waitUntilDone);
        return;
      }
      throw new Error(`Asset is not audio: ${name}`);
    }
    async playExternalSound(name, waitUntilDone) {
      const asset = this.externalAssets.get(name);
      if (!asset) throw new Error(`External asset is not loaded: ${name}`);
      asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!asset.mimeType.startsWith("audio/")) throw new Error(`Asset is not audio: ${name} (${asset.mimeType})`);
      const objectUrl = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));
      const audio = new Audio(objectUrl);
      this.playingAudio.add(audio);
      const cleanup = () => {
        this.playingAudio.delete(audio);
        URL.revokeObjectURL(objectUrl);
      };
      audio.addEventListener("ended", cleanup, { once: true });
      audio.addEventListener("error", cleanup, { once: true });
      const playPromise = audio.play();
      if (!waitUntilDone) {
        void playPromise.catch((error) => {
          console.warn(`Failed to play audio asset "${name}"`, error);
          cleanup();
        });
        return;
      }
      try {
        await playPromise;
      } catch (error) {
        cleanup();
        throw error;
      }
      await new Promise((resolve) => {
        audio.addEventListener("ended", () => resolve(), { once: true });
        audio.addEventListener("error", () => resolve(), { once: true });
      });
    }
    async playProjectSound(name, waitUntilDone) {
      const { target, sound } = this.resolveSoundReference(name);
      const playResult = target.sprite?.soundBank?.playSound(target, sound.soundId);
      const playPromise = Promise.resolve(playResult);
      if (!waitUntilDone) {
        void playPromise.catch((error) => console.warn(`Failed to play project sound asset "${name}"`, error));
        return;
      }
      await playPromise;
    }
    projectAssetMimeType(dataFormat, kind) {
      if (dataFormat) {
        const guessed = guessMimeType(`asset.${dataFormat}`);
        if (guessed !== "application/octet-stream") return guessed;
      }
      return kind === "image" ? "image/x-scratch-costume" : "audio/x-scratch-sound";
    }
  }
  if (!Scratch.extensions.unsandboxed) {
    throw new Error("Asset Manager must run unsandboxed.");
  }
  Scratch.extensions.register(new AssetManagerExtension());

})(Scratch);
