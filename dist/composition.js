const extensionName = "Asset Manager";
const blocks = [{ "opcode": "registerAsset", "blockType": "COMMAND", "text": "register resource [RESOURCE_ID] as asset [NAME]", "description": "Registers an external URL, cached asset, sprite costume, stage backdrop, project sound, or runtime text variable under one asset name.", "arguments": { "RESOURCE_ID": { "type": "STRING", "defaultValue": "https://example.com/asset.png" }, "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "assetErrorType", "blockType": "REPORTER", "text": "asset registration error type", "description": "Returns the stable error code for the most recent asset registration failure, or an empty string when the latest registration succeeded.", "arguments": {} }, { "opcode": "assetErrorLabel", "blockType": "REPORTER", "text": "asset registration error label", "description": "Returns the relevant asset, resource, or actor name for the most recent registration failure, or an empty string when the latest registration succeeded.", "arguments": {} }, { "opcode": "loadAsset", "blockType": "COMMAND", "text": "load asset from URL [URL] or cache as [NAME]", "description": "Legacy compatibility block. Loads an external image or audio asset from the supplied URL, or from IndexedDB when the URL is empty.", "arguments": { "URL": { "type": "STRING", "defaultValue": "https://example.com/asset.png" }, "NAME": { "type": "STRING", "defaultValue": "asset1" } }, "hideFromPalette": true }, { "opcode": "deleteMemoryAsset", "blockType": "COMMAND", "text": "delete asset [NAME] from memory", "description": "Unregisters one asset. Owned external renderer skins are released; project costumes, sounds, and runtime variables are left unchanged.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "deleteAllMemoryAssets", "blockType": "COMMAND", "text": "delete all assets from memory", "description": "Unregisters all assets, releases owned external renderer skins, stops actor animations, and stops tracked external audio playback.", "arguments": {} }, { "opcode": "deleteCachedAsset", "blockType": "COMMAND", "text": "delete asset [NAME] from cache", "description": "Deletes one named external asset from the IndexedDB cache.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "deleteAllCachedAssets", "blockType": "COMMAND", "text": "delete all assets from cache", "description": "Clears all external assets from the IndexedDB cache.", "arguments": {} }, { "opcode": "isLoaded", "blockType": "BOOLEAN", "text": "asset [NAME] is loaded", "description": "Returns whether the named external, project-local, or runtime text asset is currently registered.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "setTextValue", "blockType": "COMMAND", "text": "set text asset [NAME] to [VALUE]", "description": "Sets the runtime text value for a text asset using Asset Manager's internal namespace.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "Narration" }, "VALUE": { "type": "STRING", "defaultValue": "Once upon a time..." } } }, { "opcode": "setTextStyle", "blockType": "COMMAND", "text": "set text asset [NAME] style [PROPERTY] to [VALUE]", "description": "Sets one runtime style property for a text asset. Supported properties are animation, font, color, width, and align. An empty value restores the default.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "Narration" }, "PROPERTY": { "type": "STRING", "defaultValue": "font" }, "VALUE": { "type": "STRING", "defaultValue": "Sans Serif" } } }, { "opcode": "setThisSpriteSkin", "blockType": "COMMAND", "text": "show asset [NAME] on this sprite", "description": "Applies a registered image asset or displays a registered runtime text asset on the current sprite or clone.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "setSpriteSkin", "blockType": "COMMAND", "text": "show asset [NAME] on [SPRITE] (compatibility)", "description": "Stops any actor animation and applies a registered image asset or displays a registered runtime text asset on a named sprite. This block is retained for compatibility.", "arguments": { "SPRITE": { "type": "STRING", "defaultValue": "Sprite1" }, "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "startActorLoop", "blockType": "COMMAND", "text": "loop actor [ACTOR] through assets [ASSETS] for seconds [DURATIONS]", "description": "Starts or replaces a background loop. ASSETS contains registered image or audio asset names. DURATIONS must have the same number of items; each item is the interval before the next asset, including the last-to-first interval. A zero makes the next asset start together with the preceding asset. If a simultaneous group has multiple image assets, only its last image is applied. Empty ASSETS and DURATIONS stop the actor animation.", "arguments": { "ACTOR": { "type": "STRING", "defaultValue": "Sprite1" }, "ASSETS": { "type": "STRING", "defaultValue": "asset1,asset2" }, "DURATIONS": { "type": "STRING", "defaultValue": "0.5,0.5" } } }, { "opcode": "startActorSequence", "blockType": "COMMAND", "text": "play actor [ACTOR] through assets [ASSETS] for seconds [DURATIONS] once in background", "description": "Starts or replaces a one-shot background sequence and returns immediately. ASSETS contains registered image or audio asset names. DURATIONS must have exactly one fewer item; each item is the interval before the next asset. A zero makes the next asset start together with the preceding asset. If a simultaneous group has multiple image assets, only its last image is applied.", "arguments": { "ACTOR": { "type": "STRING", "defaultValue": "Sprite1" }, "ASSETS": { "type": "STRING", "defaultValue": "asset1,asset2" }, "DURATIONS": { "type": "STRING", "defaultValue": "0.5" } } }, { "opcode": "stopActorAnimation", "blockType": "COMMAND", "text": "stop animation of actor [ACTOR]", "description": "Stops the actor's current loop or sequence and leaves the currently displayed skin unchanged.", "arguments": { "ACTOR": { "type": "STRING", "defaultValue": "Sprite1" } } }, { "opcode": "finishAllActorSequences", "blockType": "COMMAND", "text": "finish all actor sequences", "description": "Finishes every one-shot actor sequence on its final image without stopping loops.", "arguments": {} }, { "opcode": "setStageSkin", "blockType": "COMMAND", "text": "set stage backdrop to asset [NAME]", "description": "Applies a registered external image, sprite costume, or stage backdrop to the stage drawable.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "backdrop1" } } }, { "opcode": "playSound", "blockType": "COMMAND", "text": "play asset [NAME] as sound", "description": "Starts playback of a registered external audio asset or project sound without waiting for completion.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "sound1" } } }, { "opcode": "playSoundUntilDone", "blockType": "COMMAND", "text": "play asset [NAME] as sound until done", "description": "Plays a registered external audio asset or project sound and waits until playback ends or fails.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "sound1" } } }, { "opcode": "stopSound", "blockType": "COMMAND", "text": "stop asset sound [NAME]", "description": "Stops every active playback of one registered external or project sound asset without stopping other sounds.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "sound1" } } }, { "opcode": "stopAllSounds", "blockType": "COMMAND", "text": "stop all asset sounds", "description": "Stops all external and project sounds currently tracked by Asset Manager.", "arguments": {} }, { "opcode": "getAssetMimeType", "blockType": "REPORTER", "text": "MIME type of asset [NAME]", "description": "Returns the normalized MIME type of a registered external, project-local, or runtime text asset.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "asset1" } } }, { "opcode": "getVersion", "blockType": "REPORTER", "text": "Asset Manager version", "description": "Returns the Asset Manager implementation version.", "arguments": {} }];
const definitions = {
  extensionName,
  blocks
};
class AssetManagerError extends Error {
  code;
  operation;
  assetName;
  resourceId;
  actorName;
  expectedKind;
  actualKind;
  hint;
  candidates;
  constructor(code, message, context) {
    const hintText = context.hint ? ` ${context.hint}` : "";
    super(`[Asset Manager][${code}] ${message}${hintText}`, { cause: context.cause });
    this.name = "AssetManagerError";
    this.code = code;
    this.operation = context.operation;
    this.assetName = context.assetName;
    this.resourceId = context.resourceId;
    this.actorName = context.actorName;
    this.expectedKind = context.expectedKind;
    this.actualKind = context.actualKind;
    this.hint = context.hint;
    this.candidates = context.candidates ?? [];
  }
}
function editDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        (current[rightIndex - 1] ?? 0) + 1,
        (previous[rightIndex] ?? 0) + 1,
        (previous[rightIndex - 1] ?? 0) + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1)
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length] ?? 0;
}
function suggestNames(value, choices, limit = 3) {
  const input = String(value ?? "").trim();
  if (!input || limit <= 0) return [];
  const normalizedInput = input.toLocaleLowerCase();
  const unique = [...new Set([...choices].map((choice) => choice.trim()).filter(Boolean))];
  return unique.map((choice, index) => ({
    choice,
    index,
    exactCaseInsensitive: choice.toLocaleLowerCase() === normalizedInput,
    distance: editDistance(normalizedInput, choice.toLocaleLowerCase())
  })).sort(
    (left, right) => Number(right.exactCaseInsensitive) - Number(left.exactCaseInsensitive) || left.distance - right.distance || left.index - right.index
  ).slice(0, limit).map(({ choice }) => choice);
}
function suggestionHint(candidates) {
  if (candidates.length === 0) return void 0;
  if (candidates.length === 1) return `Did you mean "${candidates[0]}"?`;
  return `Did you mean one of: ${candidates.map((candidate) => `"${candidate}"`).join(", ")}?`;
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function configuredFlag(name) {
  const configured = globalThis.__TW_ASSET_MANAGER_FEATURE_FLAGS__?.[name];
  return configured === true || configured === "true";
}
const FEATURE_FLAGS = Object.freeze({
  ENABLE_LIVE_ASSET_REPLACEMENT: configuredFlag("ENABLE_LIVE_ASSET_REPLACEMENT"),
  ENABLE_STRICT_ASSET_KIND_REPLACEMENT: configuredFlag("ENABLE_STRICT_ASSET_KIND_REPLACEMENT")
});
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";
const XML_NAMESPACE = "http://www.w3.org/XML/1998/namespace";
const XMLNS_NAMESPACE = "http://www.w3.org/2000/xmlns/";
const FORBIDDEN_SVG_ELEMENTS = /* @__PURE__ */ new Set([
  "animate",
  "animatemotion",
  "animatetransform",
  "discard",
  "embed",
  "foreignobject",
  "iframe",
  "object",
  "script",
  "set"
]);
const SAFE_DATA_IMAGE_REFERENCE = /^data:image\/(?:avif|bmp|gif|jpeg|png|webp);base64,[a-z0-9+/=\s]+$/i;
async function createDOMImageResourceBacking(input, onIdle) {
  const normalizedInput = { ...input, mimeType: normalizedImageMimeType(input.mimeType) };
  const verified = normalizedInput.mimeType === "image/svg+xml" ? verifySVGImage(normalizedInput) : await verifyRasterImage(normalizedInput);
  const objectURL = URL.createObjectURL(new Blob(
    [copyArrayBuffer(verified.bytes)],
    { type: verified.mimeType }
  ));
  let leaseCount = 0;
  let revoked = false;
  let idleListener = onIdle;
  const backing = Object.freeze({
    acquire(onRelease) {
      if (revoked) throw new Error("DOM image resource backing has been released.");
      leaseCount += 1;
      let released = false;
      let releaseListener = onRelease;
      let backingReference = backing;
      const resource = Object.freeze({
        url: objectURL,
        mimeType: verified.mimeType,
        width: verified.width,
        height: verified.height,
        get released() {
          return released;
        },
        release() {
          if (released) return;
          released = true;
          leaseCount -= 1;
          const releasedBacking = backingReference;
          backingReference = void 0;
          try {
            if (leaseCount === 0) {
              revoked = true;
              URL.revokeObjectURL(objectURL);
            }
          } finally {
            const listener = releaseListener;
            releaseListener = void 0;
            try {
              listener?.(resource);
            } finally {
              if (revoked) {
                const listener2 = idleListener;
                idleListener = void 0;
                if (releasedBacking) listener2?.(releasedBacking);
              }
            }
          }
        }
      });
      return resource;
    }
  });
  return backing;
}
function verifySVGImage(input) {
  let source;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
  } catch (error) {
    throw invalidResource(input.name, "SVG bytes are not valid UTF-8.", error);
  }
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet\b/i.test(source)) {
    throw unsafeSVG(input.name, "DOCTYPE, entity, and stylesheet processing instructions are forbidden.");
  }
  if (typeof DOMParser !== "function" || typeof XMLSerializer !== "function") {
    throw new AssetManagerError(
      "DEPENDENCY_MISSING",
      "DOMParser and XMLSerializer are required to validate SVG image resources.",
      {
        operation: "resolveDOMImageResource",
        assetName: input.name,
        hint: "Resolve SVG resources in a browser DOM environment."
      }
    );
  }
  let document;
  try {
    document = new DOMParser().parseFromString(source, "image/svg+xml");
  } catch (error) {
    throw invalidResource(input.name, "SVG markup is not well-formed XML.", error);
  }
  const root = document.documentElement;
  if (root.localName.toLowerCase() === "parsererror" || document.getElementsByTagName("parsererror").length > 0) {
    throw invalidResource(input.name, "SVG markup is not well-formed XML.");
  }
  if (root.namespaceURI !== SVG_NAMESPACE || root.localName.toLowerCase() !== "svg") {
    throw invalidResource(input.name, "SVG resource must have an SVG root element.");
  }
  validateSVGElement(input.name, root);
  for (const element of root.getElementsByTagName("*")) {
    validateSVGElement(input.name, element);
  }
  const { width, height } = svgIntrinsicSize(input.name, root);
  const serialized = new XMLSerializer().serializeToString(document);
  return {
    bytes: new TextEncoder().encode(serialized),
    mimeType: "image/svg+xml",
    width,
    height
  };
}
function validateSVGElement(name, element) {
  const localName = element.localName.toLowerCase();
  if (element.namespaceURI !== SVG_NAMESPACE) {
    throw unsafeSVG(name, `Element namespace is not allowed: ${element.namespaceURI ?? "(none)"}.`);
  }
  if (FORBIDDEN_SVG_ELEMENTS.has(localName)) {
    throw unsafeSVG(name, `SVG <${localName}> elements are forbidden.`);
  }
  if (localName === "style") validateCSSReferences(name, element.textContent ?? "");
  for (const attribute of [...element.attributes]) {
    const attributeName = attribute.localName.toLowerCase();
    if (attributeName.startsWith("on")) {
      throw unsafeSVG(name, `SVG event handler attribute ${attribute.name} is forbidden.`);
    }
    if (attribute.namespaceURI && ![
      XLINK_NAMESPACE,
      XML_NAMESPACE,
      XMLNS_NAMESPACE
    ].includes(attribute.namespaceURI)) {
      throw unsafeSVG(name, `Attribute namespace is not allowed: ${attribute.namespaceURI}.`);
    }
    if (attributeName === "base" && attribute.namespaceURI === XML_NAMESPACE) {
      throw unsafeSVG(name, "SVG xml:base is forbidden.");
    }
    if (attributeName === "href" || attributeName === "src") {
      validateImageReference(name, attribute.value);
    }
    if (attributeName === "style" || /url\s*\(/i.test(attribute.value)) {
      validateCSSReferences(name, attribute.value);
    }
  }
}
function validateImageReference(name, rawReference) {
  const reference = rawReference.trim();
  if (!reference || reference.startsWith("#") || SAFE_DATA_IMAGE_REFERENCE.test(reference)) return;
  throw unsafeSVG(name, `External SVG reference is forbidden: ${safeLabel(reference)}.`);
}
function validateCSSReferences(name, css) {
  if (/[\\@]|\/\*|expression\s*\(|-moz-binding\s*:|(?:-webkit-)?image(?:-set)?\s*\(|cross-fade\s*\(|(?:https?|file|ftp|javascript):|\/\//i.test(css)) {
    throw unsafeSVG(name, "Imported, obfuscated, external, or executable SVG CSS is forbidden.");
  }
  for (const match of css.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi)) {
    validateImageReference(name, match[2] ?? "");
  }
}
function svgIntrinsicSize(name, root) {
  const rawWidth = root.getAttribute("width");
  const rawHeight = root.getAttribute("height");
  const rawViewBox = root.getAttribute("viewBox");
  const width = absoluteSVGLength(rawWidth);
  const height = absoluteSVGLength(rawHeight);
  const viewBox = svgViewBox(rawViewBox);
  if (rawWidth !== null && width === null) {
    throw invalidResource(name, "SVG width must be a positive absolute length.");
  }
  if (rawHeight !== null && height === null) {
    throw invalidResource(name, "SVG height must be a positive absolute length.");
  }
  if (rawViewBox !== null && viewBox === null) {
    throw invalidResource(name, "SVG viewBox must contain four finite values and positive dimensions.");
  }
  if (width !== null && height !== null) return { width, height };
  if (width !== null && viewBox) {
    return { width, height: width * viewBox.height / viewBox.width };
  }
  if (height !== null && viewBox) {
    return { width: height * viewBox.width / viewBox.height, height };
  }
  if (viewBox) return { width: viewBox.width, height: viewBox.height };
  throw invalidResource(
    name,
    "SVG resource must declare positive absolute width/height or a positive viewBox."
  );
}
function absoluteSVGLength(raw) {
  if (raw === null || !raw.trim()) return null;
  const match = /^([+]?(?:\d+\.?\d*|\.\d+))(px|in|cm|mm|q|pt|pc)?$/i.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  const factor = (/* @__PURE__ */ new Map([
    ["", 1],
    ["px", 1],
    ["in", 96],
    ["cm", 96 / 2.54],
    ["mm", 96 / 25.4],
    ["q", 96 / 101.6],
    ["pt", 96 / 72],
    ["pc", 16]
  ])).get((match[2] ?? "").toLowerCase());
  const pixels = value * (factor ?? Number.NaN);
  return Number.isFinite(pixels) && pixels > 0 ? pixels : null;
}
function svgViewBox(raw) {
  if (raw === null) return null;
  const values = raw.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || !(values[2] > 0) || !(values[3] > 0)) return null;
  return { width: values[2], height: values[3] };
}
async function verifyRasterImage(input) {
  const detectedMimeType = sniffRasterMimeType(input.bytes);
  if (!detectedMimeType || detectedMimeType !== input.mimeType) {
    throw new AssetManagerError(
      "ASSET_TYPE_MISMATCH",
      `Image asset "${input.name}" bytes do not match MIME type ${input.mimeType}.`,
      {
        operation: "resolveDOMImageResource",
        assetName: input.name,
        expectedKind: input.mimeType,
        actualKind: detectedMimeType ?? "unrecognized image bytes",
        hint: "Use PNG, JPEG, GIF, WebP, BMP, or AVIF bytes with the matching MIME type."
      }
    );
  }
  if (typeof createImageBitmap !== "function") {
    throw new AssetManagerError(
      "DEPENDENCY_MISSING",
      "createImageBitmap is required to validate raster image dimensions.",
      {
        operation: "resolveDOMImageResource",
        assetName: input.name,
        hint: "Resolve raster resources in a browser that supports createImageBitmap."
      }
    );
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(new Blob(
      [copyArrayBuffer(input.bytes)],
      { type: input.mimeType }
    ));
  } catch (error) {
    throw invalidResource(input.name, "Raster image bytes could not be decoded.", error);
  }
  try {
    if (!Number.isFinite(bitmap.width) || bitmap.width <= 0 || !Number.isFinite(bitmap.height) || bitmap.height <= 0) {
      throw invalidResource(input.name, "Raster image has invalid intrinsic dimensions.");
    }
    return {
      bytes: input.bytes,
      mimeType: input.mimeType,
      width: bitmap.width,
      height: bitmap.height
    };
  } finally {
    bitmap.close();
  }
}
function sniffRasterMimeType(bytes) {
  if (startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) {
    return "image/png";
  }
  if (startsWith(bytes, [255, 216, 255])) return "image/jpeg";
  if (ascii(bytes, 0, 6) === "GIF87a" || ascii(bytes, 0, 6) === "GIF89a") return "image/gif";
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp";
  if (ascii(bytes, 0, 2) === "BM") return "image/bmp";
  if (ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}
function normalizedImageMimeType(value) {
  const mimeType = value.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mimeType === "image/jpg" || mimeType === "image/pjpeg") return "image/jpeg";
  if (mimeType === "image/x-png") return "image/png";
  if (mimeType === "image/x-ms-bmp") return "image/bmp";
  return mimeType;
}
function startsWith(bytes, prefix) {
  return prefix.every((value, index) => bytes[index] === value);
}
function ascii(bytes, offset, length) {
  if (bytes.byteLength < offset + length) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}
function copyArrayBuffer(bytes) {
  return Uint8Array.from(bytes).buffer;
}
function invalidResource(name, message, cause) {
  return new AssetManagerError("RESOURCE_ID_INVALID", message, {
    operation: "resolveDOMImageResource",
    assetName: name,
    hint: "Provide a well-formed image with verifiable intrinsic dimensions.",
    cause
  });
}
function unsafeSVG(name, message) {
  return new AssetManagerError("RESOURCE_ID_INVALID", message, {
    operation: "resolveDOMImageResource",
    assetName: name,
    hint: "Remove scripts, event handlers, embedded HTML, and external references from the SVG."
  });
}
function safeLabel(value) {
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
  return JSON.stringify(normalized || "(empty)");
}
const TEXT_RUNTIME_NAMESPACE = "text";
const TEXT_STYLE_RUNTIME_NAMESPACE = "textStyle";
const TEXT_STYLE_PROPERTIES = [
  "animation",
  "font",
  "color",
  "width",
  "align"
];
const DEFAULT_STAGE_WIDTH = 480;
const DEFAULT_FONT = "Handwriting";
const DEFAULT_COLOR = "#ffffff";
const DEFAULT_ALIGNMENT = "center";
const DEFAULT_OUTLINE_WIDTH = 2;
const DEFAULT_OUTLINE_COLOR = "#000000";
function textRuntimeVariableName(name) {
  return `${TEXT_RUNTIME_NAMESPACE}:${name}`;
}
function textStyleRuntimeVariableName(name, property) {
  return `${TEXT_STYLE_RUNTIME_NAMESPACE}:${name}:${property}`;
}
function normalizeTextStyleProperty(value) {
  const property = String(value ?? "").trim().toLowerCase();
  if (TEXT_STYLE_PROPERTIES.includes(property)) {
    return property;
  }
  throw new Error(`Unknown text style property: ${property || "(empty)"}`);
}
function normalizeTextStyleValue(property, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  switch (property) {
    case "animation": {
      const animation = raw.toLowerCase() === "typing" ? "type" : raw.toLowerCase();
      if (animation === "none" || animation === "type" || animation === "rainbow" || animation === "zoom" || animation === "shake") {
        return animation;
      }
      throw new Error(`Invalid text animation: ${raw}`);
    }
    case "font":
      return raw;
    case "color": {
      if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
      const shortColor = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(raw);
      if (shortColor) {
        return `#${shortColor[1]}${shortColor[1]}${shortColor[2]}${shortColor[2]}${shortColor[3]}${shortColor[3]}`.toLowerCase();
      }
      throw new Error(`Invalid text color: ${raw}`);
    }
    case "width": {
      const width = Number(raw);
      if (!Number.isFinite(width) || width <= 0) {
        throw new Error(`Text width must be a positive number: ${raw}`);
      }
      return String(width);
    }
    case "align": {
      const align = raw.toLowerCase();
      if (align === "left" || align === "center" || align === "right") return align;
      throw new Error(`Invalid text alignment: ${raw}`);
    }
  }
}
function resolveTextStyle(name, stageWidth, getRuntimeVariable) {
  const width = Number(stageWidth);
  const defaults = {
    animation: "none",
    font: DEFAULT_FONT,
    color: DEFAULT_COLOR,
    width: Number.isFinite(width) && width > 0 ? width : DEFAULT_STAGE_WIDTH,
    align: DEFAULT_ALIGNMENT
  };
  const read = (property) => normalizeTextStyleValue(
    property,
    getRuntimeVariable(textStyleRuntimeVariableName(name, property))
  );
  const animation = read("animation");
  const font = read("font");
  const color = read("color");
  const configuredWidth = read("width");
  const align = read("align");
  return {
    animation: animation ? animation : defaults.animation,
    font: font || defaults.font,
    color: color || defaults.color,
    width: configuredWidth ? Number(configuredWidth) : defaults.width,
    align: align ? align : defaults.align
  };
}
const EXTENSION_ID = "kubohiroyaassetmanager";
const EXTENSION_VERSION = "0.12.1";
const EXTENSION_DOCS_URI = "https://kubohiroya.github.io/turbowarp-asset-manager/";
const BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path fill="#fff" d="M19 47 29 17h7l10 30h-7l-2-7H27l-2 7h-6Zm10-13h6l-3-10-3 10Z"/></svg>'
)}`;
const DB_NAME = "tw-asset-manager";
const DB_VERSION = 1;
const STORE_NAME = "assets";
const STAGE_RESOURCE_NAME = "@stage";
const blockDefinitions = definitions.blocks;
blockDefinitions.unshift(
  {
    opcode: "validateProjectAssetAddress",
    blockType: "REPORTER",
    text: "validate project asset address [RESOURCE_ID] for [NAME]",
    description: "Returns a JSON validation result without fetching, caching, registering, or rendering the asset.",
    arguments: {
      RESOURCE_ID: {
        type: "STRING",
        defaultValue: "costume:Sprite1:costume1"
      },
      NAME: {
        type: "STRING",
        defaultValue: "asset1"
      }
    },
    hideFromPalette: true
  },
  {
    opcode: "setLoadingBackdrop",
    blockType: "COMMAND",
    text: "set loading backdrop asset to [NAME]",
    description: "Configures the image asset shown behind the loading indicator.",
    arguments: {
      NAME: {
        type: "STRING",
        defaultValue: "loadingBackdrop"
      }
    },
    hideFromPalette: true
  },
  {
    opcode: "setLoadingCostumes",
    blockType: "COMMAND",
    text: "set loading costume assets to [NAMES]",
    description: "Configures the comma-separated image assets used by the loading indicator.",
    arguments: {
      NAMES: {
        type: "STRING",
        defaultValue: "loading1,loading2"
      }
    },
    hideFromPalette: true
  },
  {
    opcode: "prepareLoadingAssets",
    blockType: "COMMAND",
    text: "prioritize loading assets in list [LIST]",
    description: "Moves configured loading assets to the front of the named asset definition list.",
    arguments: {
      LIST: {
        type: "STRING",
        defaultValue: "assetList"
      }
    },
    hideFromPalette: true
  },
  {
    opcode: "loadingAssetCount",
    blockType: "REPORTER",
    text: "loading asset count",
    description: "Returns the number of configured loading assets present in the prepared asset list.",
    arguments: {},
    hideFromPalette: true
  },
  {
    opcode: "loadingBackdrop",
    blockType: "REPORTER",
    text: "loading backdrop asset",
    description: "Returns the configured loading backdrop asset name.",
    arguments: {},
    hideFromPalette: true
  },
  {
    opcode: "loadingCostumeAt",
    blockType: "REPORTER",
    text: "loading costume for asset number [INDEX]",
    description: "Returns the configured loading costume asset for a one-based regular asset number.",
    arguments: {
      INDEX: {
        type: "NUMBER",
        defaultValue: "1"
      }
    },
    hideFromPalette: true
  }
);
function normalizeName(value) {
  return String(value ?? "").trim();
}
function literalProjectName(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty literal string.`);
  }
  return value;
}
function parseProjectAssetLocator(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Project asset locator must be an object.");
  }
  const input = value;
  const kind = input.kind;
  const allowed = kind === "costume" ? /* @__PURE__ */ new Set(["kind", "name", "target"]) : kind === "sound" ? /* @__PURE__ */ new Set(["kind", "name", "target"]) : /* @__PURE__ */ new Set(["kind", "name"]);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new Error("Project asset locator contains an unknown field.");
  }
  const name = literalProjectName(input.name, "Project asset source name");
  if (kind === "backdrop") {
    if (Object.hasOwn(input, "target")) {
      throw new Error("Backdrop locator must not provide target.");
    }
    return Object.freeze({ kind, name });
  }
  if (kind === "costume") {
    return Object.freeze({
      kind,
      name,
      target: literalProjectName(input.target, "Costume target name")
    });
  }
  if (kind === "sound") {
    return Object.freeze({
      kind,
      name,
      ...Object.hasOwn(input, "target") ? { target: literalProjectName(input.target, "Sound target name") } : {}
    });
  }
  throw new Error("Project asset locator kind must be backdrop, costume, or sound.");
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
function parseResourceIdentifier(value, fallbackAssetName) {
  const resourceId = normalizeName(value);
  if (!resourceId) return { kind: "cache" };
  if (/^https?:\/\//i.test(resourceId)) return { kind: "external", url: resourceId };
  const separatorIndex = resourceId.indexOf(":");
  if (separatorIndex < 0) {
    const fallbackName = normalizeName(fallbackAssetName);
    const bareScheme = resourceId.toLowerCase();
    if (bareScheme === "costume" && fallbackName) {
      return { kind: "costume", spriteName: fallbackName, costumeName: null };
    }
    if (bareScheme === "backdrop" && fallbackName) {
      return { kind: "backdrop", backdropName: fallbackName };
    }
    if (bareScheme === "sound" && fallbackName) {
      return { kind: "sound", spriteName: STAGE_RESOURCE_NAME, soundName: fallbackName };
    }
    if (bareScheme === "text" && fallbackName) {
      const name = parseLocalResourceName(fallbackName, "Text variable");
      return { kind: "text", runtimeVariableName: textRuntimeVariableName(name) };
    }
    throw new Error(`Unsupported resource identifier: ${resourceId}`);
  }
  const scheme = resourceId.slice(0, separatorIndex).trim().toLowerCase();
  const payload = resourceId.slice(separatorIndex + 1).trim();
  switch (scheme) {
    case "costume": {
      const [spriteName, costumeName] = splitLocalResourcePair(payload, "costume", fallbackAssetName);
      return { kind: "costume", spriteName, costumeName };
    }
    case "backdrop": {
      return { kind: "backdrop", backdropName: parseLocalResourceName(payload, "Backdrop") };
    }
    case "sound": {
      const [spriteName, soundName] = splitLocalResourcePair(payload, "sound", fallbackAssetName);
      return { kind: "sound", spriteName, soundName };
    }
    case "text": {
      const name = parseLocalResourceName(payload, "Text variable");
      return { kind: "text", runtimeVariableName: textRuntimeVariableName(name) };
    }
    default:
      throw new Error(`Unsupported resource scheme: ${scheme}`);
  }
}
function splitLocalResourcePair(payload, scheme, fallbackAssetName) {
  if (!payload.includes(":") && fallbackAssetName !== void 0) {
    const spriteName = payload.trim();
    const assetName2 = normalizeName(fallbackAssetName);
    if (!spriteName) throw new Error(`${scheme} source name is empty.`);
    if (!assetName2) throw new Error(`${scheme} asset name is empty.`);
    return [spriteName, assetName2];
  }
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
function requireAssetNameValue(value, operation = "registerAsset") {
  const name = normalizeName(value);
  if (!name) {
    throw new AssetManagerError("INVALID_ASSET_NAME", "Asset name is empty.", {
      operation,
      assetName: name,
      hint: "Provide a non-empty asset name."
    });
  }
  return name;
}
function requireTextAssetNameValue(value, operation = "registerAsset") {
  const name = requireAssetNameValue(value, operation);
  if (name.includes(":")) {
    throw new AssetManagerError(
      "INVALID_ASSET_NAME",
      `Text asset name "${name}" must not contain a colon.`,
      { operation, assetName: name, hint: "Use a logical name without a colon." }
    );
  }
  return name;
}
function copyEmbeddedBytes(value, assetName) {
  let bytes;
  if (value instanceof ArrayBuffer) {
    bytes = new Uint8Array(value);
  } else if (value instanceof Uint8Array) {
    bytes = value;
  } else {
    throw new AssetManagerError(
      "RESOURCE_ID_INVALID",
      `Embedded asset "${assetName}" must provide an ArrayBuffer or Uint8Array.`,
      {
        operation: "registerEmbeddedAsset",
        assetName,
        hint: "Pass validated binary image or audio bytes."
      }
    );
  }
  if (bytes.byteLength === 0) {
    throw new AssetManagerError(
      "RESOURCE_ID_INVALID",
      `Embedded asset "${assetName}" is empty.`,
      {
        operation: "registerEmbeddedAsset",
        assetName,
        hint: "Pass at least one byte."
      }
    );
  }
  return Uint8Array.from(bytes).buffer;
}
function embeddedBitmapResolution(value, mimeType, assetName) {
  if (value === void 0) return 1;
  if (!mimeType.startsWith("image/") || mimeType === "image/svg+xml") {
    throw new AssetManagerError(
      "ASSET_TYPE_MISMATCH",
      `Embedded asset "${assetName}" can specify bitmapResolution only for bitmap images.`,
      {
        operation: "registerEmbeddedAsset",
        assetName,
        expectedKind: "bitmap image",
        actualKind: mimeType,
        hint: "Remove bitmapResolution or use a bitmap image MIME type."
      }
    );
  }
  if (value !== 1 && value !== 2) {
    throw new AssetManagerError(
      "RESOURCE_ID_INVALID",
      `Embedded bitmap asset "${assetName}" must use bitmapResolution 1 or 2.`,
      {
        operation: "registerEmbeddedAsset",
        assetName,
        hint: "Use Scratch bitmap resolution 1 or 2."
      }
    );
  }
  return value;
}
function findStageTarget(runtime) {
  const stage = runtime.targets.find((target) => target.isStage);
  if (!stage) {
    throw new AssetManagerError("SPRITE_NOT_FOUND", "Stage target was not found.", {
      operation: "resolveStage",
      actorName: STAGE_RESOURCE_NAME,
      hint: "Load a project with a valid stage target."
    });
  }
  return stage;
}
function findProjectTargetByName(runtime, name) {
  return runtime.targets.find(
    (target) => !target.isStage && target.isOriginal && target.sprite?.name === name
  ) ?? runtime.targets.find(
    (target) => !target.isStage && target.sprite?.name === name
  ) ?? null;
}
function findProjectCostume(target, costumeName, assetId) {
  const costumes = target.sprite?.costumes ?? [];
  return (assetId ? costumes.find((costume) => costume.assetId === assetId) : void 0) ?? costumes.find((costume) => costume.name === costumeName) ?? null;
}
function findProjectSound(target, soundName, assetId) {
  const sounds = target.sprite?.sounds ?? [];
  return (assetId ? sounds.find((sound) => sound.assetId === assetId) : void 0) ?? sounds.find((sound) => sound.name === soundName) ?? null;
}
function resolveCostumeAddress(runtime, name, spriteName, costumeName) {
  const target = findProjectTargetByName(runtime, spriteName);
  if (!target) {
    const candidates = suggestNames(
      spriteName,
      runtime.targets.flatMap(
        (candidate) => !candidate.isStage && candidate.sprite?.name ? [candidate.sprite.name] : []
      )
    );
    throw new AssetManagerError("SPRITE_NOT_FOUND", `Sprite not found: ${spriteName}.`, {
      operation: "registerAsset",
      assetName: name,
      actorName: spriteName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  const costumes = target.sprite?.costumes ?? [];
  const costume = costumeName === null ? costumes.find((candidate) => candidate.name === name) ?? (costumes.length === 1 ? costumes[0] : null) : findProjectCostume(target, costumeName, null);
  if (!costume && costumeName === null && costumes.length > 1) {
    const candidates = suggestNames(name, costumes.map((candidate) => candidate.name));
    throw new AssetManagerError(
      "SOURCE_ASSET_NOT_FOUND",
      `Costume shorthand is ambiguous: ${spriteName} has multiple costumes and none is named ${name}.`,
      {
        operation: "registerAsset",
        assetName: name,
        actorName: spriteName,
        candidates,
        hint: suggestionHint(candidates) ?? "Specify the costume name explicitly."
      }
    );
  }
  const resolvedCostumeName = costume?.name ?? costumeName ?? name;
  if (!costume) {
    const candidates = suggestNames(
      resolvedCostumeName,
      costumes.map((candidate) => candidate.name)
    );
    throw new AssetManagerError(
      "SOURCE_ASSET_NOT_FOUND",
      `Costume not found: ${spriteName}/${resolvedCostumeName}.`,
      {
        operation: "registerAsset",
        assetName: name,
        actorName: spriteName,
        candidates,
        hint: suggestionHint(candidates)
      }
    );
  }
  return { target, costume, costumeName: resolvedCostumeName };
}
function resolveBackdropAddress(runtime, backdropName) {
  const target = findStageTarget(runtime);
  const costume = findProjectCostume(target, backdropName, null);
  if (!costume) {
    const candidates = suggestNames(
      backdropName,
      (target.sprite?.costumes ?? []).map((candidate) => candidate.name)
    );
    throw new AssetManagerError("SOURCE_ASSET_NOT_FOUND", `Backdrop not found: ${backdropName}.`, {
      operation: "registerAsset",
      assetName: backdropName,
      actorName: STAGE_RESOURCE_NAME,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  return { target, costume };
}
function resolveSoundAddress(runtime, spriteName, soundName, assetName = soundName) {
  const isStage = spriteName.toLowerCase() === STAGE_RESOURCE_NAME;
  const target = isStage ? findStageTarget(runtime) : findProjectTargetByName(runtime, spriteName);
  if (!target) {
    const candidates = suggestNames(
      spriteName,
      runtime.targets.flatMap((candidate) => candidate.sprite?.name ? [candidate.sprite.name] : [])
    );
    throw new AssetManagerError("SPRITE_NOT_FOUND", `Sound source not found: ${spriteName}.`, {
      operation: "registerAsset",
      assetName,
      actorName: spriteName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  const sound = findProjectSound(target, soundName, null);
  if (!sound) {
    const candidates = suggestNames(
      soundName,
      (target.sprite?.sounds ?? []).map((candidate) => candidate.name)
    );
    throw new AssetManagerError("SOURCE_ASSET_NOT_FOUND", `Sound not found: ${spriteName}/${soundName}.`, {
      operation: "registerAsset",
      assetName,
      actorName: spriteName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  return { target, sound, isStage };
}
function resolveLiteralSoundAddress(runtime, targetName, soundName, assetName) {
  const isStage = targetName === void 0;
  const target = isStage ? findStageTarget(runtime) : findProjectTargetByName(runtime, targetName);
  if (!target) {
    const candidates = suggestNames(
      targetName ?? STAGE_RESOURCE_NAME,
      runtime.targets.flatMap(
        (candidate) => !candidate.isStage && candidate.sprite?.name ? [candidate.sprite.name] : []
      )
    );
    throw new AssetManagerError("SPRITE_NOT_FOUND", "Structured sound target was not found.", {
      operation: "registerProjectAsset",
      assetName,
      actorName: targetName,
      candidates,
      hint: suggestionHint(candidates)
    });
  }
  const sound = findProjectSound(target, soundName, null);
  if (!sound) {
    const candidates = suggestNames(
      soundName,
      (target.sprite?.sounds ?? []).map((candidate) => candidate.name)
    );
    throw new AssetManagerError(
      "SOURCE_ASSET_NOT_FOUND",
      "Structured project sound was not found.",
      {
        operation: "registerProjectAsset",
        assetName,
        actorName: targetName,
        candidates,
        hint: suggestionHint(candidates)
      }
    );
  }
  return { target, sound, isStage, targetName: targetName ?? STAGE_RESOURCE_NAME };
}
function validateProjectAssetAddress(runtime, assetName, resourceIdentifier) {
  let fallbackType = "asset-name";
  let fallbackLabel = normalizeName(assetName);
  try {
    const name = requireAssetNameValue(assetName);
    const resourceId = normalizeName(resourceIdentifier);
    if (resourceId === "text" || resourceId.startsWith("text:")) {
      requireTextAssetNameValue(name);
    }
    fallbackType = "resource-id";
    fallbackLabel = resourceId;
    const resource = parseResourceIdentifier(resourceIdentifier, name);
    switch (resource.kind) {
      case "costume":
        resolveCostumeAddress(runtime, name, resource.spriteName, resource.costumeName);
        break;
      case "backdrop":
        resolveBackdropAddress(runtime, resource.backdropName);
        break;
      case "sound":
        resolveSoundAddress(runtime, resource.spriteName, resource.soundName, name);
        break;
      case "text":
        requireTextAssetNameValue(name);
        break;
    }
    return {
      ok: true,
      kind: resource.kind,
      projectLocal: resource.kind !== "cache" && resource.kind !== "external"
    };
  } catch (error) {
    return {
      ok: false,
      type: error instanceof AssetManagerError ? error.code : fallbackType === "asset-name" ? "INVALID_ASSET_NAME" : "RESOURCE_ID_INVALID",
      label: error instanceof AssetManagerError ? error.code === "SPRITE_NOT_FOUND" ? error.actorName ?? error.assetName ?? fallbackLabel : error.code === "RESOURCE_ID_INVALID" ? error.resourceId ?? error.assetName ?? fallbackLabel : error.assetName ?? error.actorName ?? error.resourceId ?? fallbackLabel : fallbackLabel,
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
class AssetManagerExtension {
  runtime = Scratch.vm.runtime;
  renderer = this.runtime.renderer;
  externalAssets = /* @__PURE__ */ new Map();
  costumeAssets = /* @__PURE__ */ new Map();
  soundAssets = /* @__PURE__ */ new Map();
  textAssets = /* @__PURE__ */ new Map();
  assetRegistry = /* @__PURE__ */ new Map();
  displayedAssets = /* @__PURE__ */ new Map();
  playingAudio = /* @__PURE__ */ new Map();
  registrationVersions = /* @__PURE__ */ new Map();
  successfulRegistrationVersions = /* @__PURE__ */ new Map();
  registrationCancellationVersions = /* @__PURE__ */ new Map();
  registrationCommits = /* @__PURE__ */ new Map();
  committedCacheRecords = /* @__PURE__ */ new Map();
  featureFlags;
  loadingBackdropName = "";
  lastAssetErrorType = "";
  lastAssetErrorLabel = "";
  assetErrorVersion = 0;
  domImageResourceVersions = /* @__PURE__ */ new Map();
  domImageResourceBackings = /* @__PURE__ */ new Map();
  activeDOMImageResources = /* @__PURE__ */ new Set();
  activeDOMImageResourcesByName = /* @__PURE__ */ new Map();
  domImageCapabilityValue;
  listeningForDOMImageLifecycle = false;
  releaseAllDOMImageResourcesForLifecycle = () => {
    this.releaseAllDOMImageResources();
  };
  releaseDOMImageResourcesForRuntimeDispose = () => {
    this.releaseAllDOMImageResources();
    this.stopListeningForDOMImageLifecycle();
  };
  constructor(featureFlags = FEATURE_FLAGS) {
    this.featureFlags = Object.freeze({ ...featureFlags });
    this.runtime.on?.("STOP_FOR_TARGET", (target) => {
      if (target && !this.runtime.targets.includes(target)) {
        this.displayedAssets.delete(target.id);
      }
    });
  }
  setLoadingBackdrop(args) {
    this.loadingBackdropName = normalizeName(args.NAME);
    this.loadingAssetCountValue = 0;
  }
  setLoadingCostumes(args) {
    const seen = /* @__PURE__ */ new Set();
    this.loadingCostumes = String(args.NAMES ?? "").split(",").map((name) => normalizeName(name)).filter((name) => {
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
    this.loadingAssetCountValue = 0;
  }
  prepareLoadingAssets(args, util) {
    const listName = normalizeName(args.LIST);
    const list = util.target?.lookupVariableByNameAndType?.(listName, "list");
    if (!list || !Array.isArray(list.value)) {
      throw new Error(`Loading asset list not found: ${listName || "(empty)"}`);
    }
    const loadingBackdrop = this.loadingBackdropName;
    const loadingCostumes = this.loadingCostumes ?? [];
    const loadingCostumeNames = new Set(loadingCostumes);
    const loadingNames = new Set(
      [loadingBackdrop, ...loadingCostumes].filter((name) => name.length > 0)
    );
    const entries = list.value.map((entry) => String(entry));
    const declaredNames = new Set(entries.map((entry) => {
      const separatorIndex = entry.indexOf(",");
      return normalizeName(separatorIndex < 0 ? entry : entry.slice(0, separatorIndex));
    }));
    const missingNames = [...loadingNames].filter((name) => !declaredNames.has(name));
    if (missingNames.length > 0) {
      throw new Error(`Loading asset is not declared: ${missingNames.join(", ")}`);
    }
    const backdropEntries = [];
    const prioritized = [];
    const regular = [];
    for (const entry of entries) {
      const separatorIndex = entry.indexOf(",");
      const assetName = normalizeName(separatorIndex < 0 ? entry : entry.slice(0, separatorIndex));
      if (loadingBackdrop && assetName === loadingBackdrop) {
        backdropEntries.push(entry);
      } else {
        (loadingCostumeNames.has(assetName) ? prioritized : regular).push(entry);
      }
    }
    list.value.splice(0, list.value.length, ...backdropEntries, ...prioritized, ...regular);
    this.loadingAssetCountValue = backdropEntries.length + prioritized.length;
  }
  loadingAssetCount() {
    return this.loadingAssetCountValue ?? 0;
  }
  loadingBackdrop() {
    return this.loadingBackdropName;
  }
  loadingCostumeAt(args) {
    const loadingCostumes = this.loadingCostumes ?? [];
    if (loadingCostumes.length === 0) return "";
    const numericIndex = Number(args.INDEX);
    const index = Number.isFinite(numericIndex) ? Math.max(1, Math.trunc(numericIndex)) : 1;
    return loadingCostumes[(index - 1) % loadingCostumes.length];
  }
  getInfo() {
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      docsURI: EXTENSION_DOCS_URI,
      blockIconURI: BLOCK_ICON_URI,
      color1: "#5b7cfa",
      color2: "#425ed8",
      color3: "#2f46aa",
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
    };
  }
  /**
   * Exposes the stock extension registry through a host-neutral DOM image
   * resource contract for other unsandboxed extensions.
   */
  getDOMImageCapability() {
    this.startListeningForDOMImageLifecycle();
    this.domImageCapabilityValue ??= Object.freeze({
      isRegistered: (name) => this.assetRegistry.has(normalizeName(name)),
      getMimeType: (name) => this.getAssetMimeType({ NAME: name }),
      resolveDOMImageResource: (name) => this.resolveExtensionDOMImageResource(name)
    });
    return this.domImageCapabilityValue;
  }
  validateProjectAssetAddress(args) {
    return JSON.stringify(
      validateProjectAssetAddress(this.runtime, args.NAME, args.RESOURCE_ID)
    );
  }
  async registerProjectAssetLiteral(assetName, locatorInput) {
    const name = requireAssetNameValue(assetName, "registerProjectAsset");
    let locator;
    try {
      locator = parseProjectAssetLocator(locatorInput);
    } catch (error) {
      throw new AssetManagerError("RESOURCE_ID_INVALID", errorMessage(error), {
        operation: "registerProjectAsset",
        assetName: name,
        hint: "Pass a structured backdrop, costume, or sound locator.",
        cause: error
      });
    }
    switch (locator.kind) {
      case "backdrop":
        await this.registerBackdropReference(name, locator.name);
        return;
      case "costume":
        await this.registerCostumeReference(name, locator.target, locator.name);
        return;
      case "sound":
        await this.registerLiteralSoundReference(name, locator.target, locator.name);
        return;
    }
  }
  async registerAsset(args) {
    const errorVersion = ++this.assetErrorVersion;
    this.clearAssetError();
    let fallbackType = "asset-name";
    let fallbackLabel = normalizeName(args.NAME);
    try {
      const name = this.requireAssetName(args.NAME);
      const resourceId = normalizeName(args.RESOURCE_ID);
      if (resourceId === "text" || resourceId.startsWith("text:")) {
        this.requireTextAssetName(name);
      }
      fallbackType = "resource-id";
      fallbackLabel = resourceId;
      let resource;
      try {
        resource = parseResourceIdentifier(args.RESOURCE_ID, name);
      } catch (error) {
        throw new AssetManagerError("RESOURCE_ID_INVALID", errorMessage(error), {
          operation: "registerAsset",
          assetName: name,
          resourceId,
          hint: "Use an HTTP(S) URL or a supported costume, backdrop, sound, or text resource ID.",
          cause: error
        });
      }
      switch (resource.kind) {
        case "cache":
          fallbackType = "cache";
          fallbackLabel = name;
          await this.registerExternalAsset("", name);
          return;
        case "external":
          fallbackType = "external";
          fallbackLabel = resource.url;
          await this.registerExternalAsset(resource.url, name);
          return;
        case "costume":
          fallbackType = "costume";
          fallbackLabel = resource.costumeName ?? name;
          await this.registerCostumeReference(name, resource.spriteName, resource.costumeName);
          return;
        case "backdrop":
          fallbackType = "backdrop";
          fallbackLabel = resource.backdropName;
          await this.registerBackdropReference(name, resource.backdropName);
          return;
        case "sound":
          fallbackType = "sound";
          fallbackLabel = resource.soundName;
          await this.registerSoundReference(name, resource.spriteName, resource.soundName);
          return;
        case "text":
          fallbackType = "text";
          fallbackLabel = resource.runtimeVariableName;
          await this.registerTextReference(name, resource.runtimeVariableName);
          return;
      }
    } catch (error) {
      const diagnostic = error instanceof AssetManagerError ? error : new AssetManagerError("REPLACEMENT_FAILED", errorMessage(error), {
        operation: "registerAsset",
        assetName: fallbackType === "asset-name" ? fallbackLabel : normalizeName(args.NAME),
        resourceId: normalizeName(args.RESOURCE_ID),
        hint: "The previous registration and display were kept. Check the resource and try again.",
        cause: error
      });
      if (this.assetErrorVersion === errorVersion) {
        if (diagnostic instanceof AssetManagerError) {
          this.lastAssetErrorType = diagnostic.code;
          this.lastAssetErrorLabel = diagnostic.code === "SPRITE_NOT_FOUND" ? diagnostic.actorName ?? diagnostic.assetName ?? fallbackLabel : diagnostic.code === "RESOURCE_ID_INVALID" ? diagnostic.resourceId ?? diagnostic.assetName ?? fallbackLabel : diagnostic.assetName ?? diagnostic.actorName ?? diagnostic.resourceId ?? fallbackLabel;
        }
      }
      throw diagnostic;
    }
  }
  async registerEmbeddedAsset(input) {
    const name = this.requireAssetName(input.name, "registerEmbeddedAsset");
    const sourceName = normalizeName(input.sourceName) || name;
    const mimeType = normalizeMimeType(input.mimeType, sourceName);
    const mediaKind = mimeType.startsWith("image/") ? "image" : mimeType.startsWith("audio/") ? "audio" : "unknown";
    if (mediaKind === "unknown") {
      throw new AssetManagerError(
        "ASSET_TYPE_MISMATCH",
        `Embedded asset "${name}" has unsupported MIME type ${mimeType}.`,
        {
          operation: "registerEmbeddedAsset",
          assetName: name,
          expectedKind: "image or audio",
          actualKind: mimeType,
          hint: "Use an image/* or audio/* MIME type."
        }
      );
    }
    const bitmapResolution = embeddedBitmapResolution(input.bitmapResolution, mimeType, name);
    const data = copyEmbeddedBytes(input.bytes, name);
    const token = this.beginRegistration(name);
    const prepared = {
      kind: "external",
      name,
      url: sourceName,
      mimeType,
      data,
      cachedAt: Date.now(),
      skinId: null,
      ...mediaKind === "image" && mimeType !== "image/svg+xml" ? { bitmapResolution } : {}
    };
    await this.commitPreparedAsset(name, "external", prepared, token);
    return Object.freeze({ name, mimeType });
  }
  assetErrorType() {
    return this.lastAssetErrorType;
  }
  assetErrorLabel() {
    return this.lastAssetErrorLabel;
  }
  /** Legacy opcode retained for existing projects. */
  async loadAsset(args) {
    const name = this.requireAssetName(args.NAME, "loadAsset");
    const resourceId = normalizeName(args.URL);
    try {
      await this.registerExternalAsset(resourceId, name);
    } catch (error) {
      if (error instanceof AssetManagerError) throw error;
      throw new AssetManagerError("REPLACEMENT_FAILED", errorMessage(error), {
        operation: "loadAsset",
        assetName: name,
        resourceId,
        hint: "The previous registration and display were kept. Check the URL or cache.",
        cause: error
      });
    }
  }
  deleteMemoryAsset(args) {
    this.unregisterAsset(normalizeName(args.NAME));
  }
  deleteAllMemoryAssets() {
    this.releaseAllDOMImageResources();
    for (const name of this.registrationVersions.keys()) {
      this.cancelRegistrations(name);
    }
    for (const asset of this.externalAssets.values()) this.deleteOwnedSkinIfExists(asset);
    this.externalAssets.clear();
    this.costumeAssets.clear();
    this.soundAssets.clear();
    this.textAssets.clear();
    this.assetRegistry.clear();
    this.displayedAssets.clear();
    for (const audio of [...this.playingAudio.keys()]) this.stopExternalAudio(audio);
    this.playingAudio.clear();
  }
  async deleteCachedAsset(args) {
    const name = normalizeName(args.NAME);
    await this.cacheDelete(name);
    this.committedCacheRecords.set(name, null);
  }
  async deleteAllCachedAssets() {
    await this.cacheClear();
    this.committedCacheRecords.clear();
  }
  isLoaded(args) {
    return this.assetRegistry.has(normalizeName(args.NAME));
  }
  async setThisSpriteSkin(args, util) {
    if (!util.target || util.target.isStage) {
      throw new AssetManagerError(
        "SPRITE_NOT_FOUND",
        "This block must be used on a sprite or its clone.",
        { operation: "setThisSpriteSkin", hint: "Run this block from a sprite target." }
      );
    }
    await this.applyAssetToTarget(util.target, args.NAME, util);
  }
  async setSpriteSkin(args, util) {
    const name = normalizeName(args.SPRITE);
    const target = this.findTargetByName(name);
    if (!target) {
      const candidates = suggestNames(
        name,
        this.runtime.targets.flatMap(
          (candidate) => !candidate.isStage && candidate.sprite?.name ? [candidate.sprite.name] : []
        )
      );
      throw new AssetManagerError("SPRITE_NOT_FOUND", `Sprite not found: ${name}.`, {
        operation: "setSpriteSkin",
        actorName: name,
        candidates,
        hint: suggestionHint(candidates)
      });
    }
    await this.applyAssetToTarget(target, args.NAME, util);
  }
  async setStageSkin(args) {
    await this.applyAssetToTarget(this.getStageTarget(), args.NAME);
  }
  async playSound(args) {
    await this.playResolvedSound(args.NAME, false);
  }
  async playSoundUntilDone(args) {
    await this.playResolvedSound(args.NAME, true);
  }
  stopSound(args) {
    const name = normalizeName(args.NAME);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered("stopSound", name);
    if (kind === "external") {
      const asset = this.externalAssets.get(name);
      if (!asset) throw this.assetNotRegistered("stopSound", name);
      asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!asset.mimeType.startsWith("audio/")) {
        throw this.assetTypeMismatch("stopSound", name, "audio", `external/${this.externalMediaKind(asset)}`);
      }
      for (const [audio, assetName] of [...this.playingAudio]) {
        if (assetName === name) this.stopExternalAudio(audio);
      }
      return;
    }
    if (kind === "sound") {
      const { target, sound } = this.resolveSoundReference(name);
      target.sprite.soundBank.stop(target, sound.soundId);
      return;
    }
    throw this.assetTypeMismatch("stopSound", name, "audio", kind);
  }
  stopAllSounds() {
    for (const audio of [...this.playingAudio.keys()]) this.stopExternalAudio(audio);
    this.playingAudio.clear();
    for (const target of this.runtime.targets) {
      target.sprite?.soundBank?.stopAllSounds(target);
    }
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
      case "costume":
      case "backdrop": {
        const { costume } = this.resolveCostumeReference(name);
        return this.projectAssetMimeType(costume.dataFormat, "image");
      }
      case "sound": {
        const { sound } = this.resolveSoundReference(name);
        return this.projectAssetMimeType(sound.dataFormat, "audio");
      }
      case "text": {
        return "text/plain";
      }
    }
  }
  async resolveImageAssetBytes(args) {
    const name = normalizeName(args.NAME);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered("resolveDOMImageResource", name);
    if (kind === "external") {
      const asset = this.externalAssets.get(name);
      if (!asset) throw this.assetNotRegistered("resolveDOMImageResource", name);
      const mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
      if (!mimeType.startsWith("image/")) {
        throw this.assetTypeMismatch(
          "resolveDOMImageResource",
          name,
          "image",
          `external/${this.externalMediaKind(asset)}`
        );
      }
      return Object.freeze({ bytes: new Uint8Array(asset.data.slice(0)), mimeType });
    }
    if (kind === "costume" || kind === "backdrop") {
      const { costume } = this.resolveCostumeReference(name);
      const mimeType = this.projectAssetMimeType(costume.dataFormat, "image");
      const asset = await this.resolveProjectImageStorageAsset(name, costume);
      const source = asset.data instanceof Uint8Array ? asset.data : new Uint8Array(asset.data);
      return Object.freeze({ bytes: Uint8Array.from(source), mimeType });
    }
    throw this.assetTypeMismatch("resolveDOMImageResource", name, "image", kind);
  }
  getVersion() {
    return EXTENSION_VERSION;
  }
  async setTextValue(args) {
    const name = this.requireTextAssetName(args.NAME, "setTextValue");
    const kind = this.assetRegistry.get(name);
    if (kind !== void 0 && kind !== "text") {
      throw this.assetTypeMismatch("setTextValue", name, "text", kind);
    }
    const reference = this.textAssets.get(name);
    this.setRuntimeVariable(
      reference?.runtimeVariableName ?? textRuntimeVariableName(name),
      String(args.VALUE ?? "")
    );
    const targets = this.runtime.targets.filter(
      (target) => this.displayedAssets.get(target.id)?.assetName === name
    );
    await Promise.all(
      targets.map(async (target) => {
        await this.applyTextToTarget(target, name, { runtime: this.runtime, target });
        this.setDisplayBinding(target, name, "text");
      })
    );
  }
  setTextStyle(args) {
    const name = this.requireTextAssetName(args.NAME, "setTextStyle");
    const kind = this.assetRegistry.get(name);
    if (kind !== void 0 && kind !== "text") {
      throw this.assetTypeMismatch("setTextStyle", name, "text", kind);
    }
    let property;
    try {
      property = normalizeTextStyleProperty(args.PROPERTY);
    } catch (error) {
      throw new AssetManagerError("STYLE_PROPERTY_INVALID", errorMessage(error), {
        operation: "setTextStyle",
        assetName: name,
        hint: "Use animation, font, color, width, or align.",
        cause: error
      });
    }
    let value;
    try {
      value = normalizeTextStyleValue(property, args.VALUE);
    } catch (error) {
      throw new AssetManagerError("STYLE_VALUE_INVALID", errorMessage(error), {
        operation: "setTextStyle",
        assetName: name,
        hint: `Provide a valid ${property} value.`,
        cause: error
      });
    }
    this.setRuntimeVariable(textStyleRuntimeVariableName(name, property), value);
  }
  assetNotRegistered(operation, name) {
    const candidates = suggestNames(name, this.assetRegistry.keys());
    return new AssetManagerError(
      "ASSET_NOT_REGISTERED",
      `Cannot ${operation} asset "${name}": no registered asset has that name.`,
      {
        operation,
        assetName: name,
        candidates,
        hint: suggestionHint(candidates) ?? "Register the asset before using it."
      }
    );
  }
  assetTypeMismatch(operation, name, expectedKind, actualKind) {
    return new AssetManagerError(
      "ASSET_TYPE_MISMATCH",
      `Cannot ${operation} asset "${name}": expected ${expectedKind}, but it is ${actualKind}.`,
      {
        operation,
        assetName: name,
        expectedKind,
        actualKind,
        hint: `Use an asset registered as ${expectedKind}.`
      }
    );
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
  requireAssetName(value, operation = "registerAsset") {
    return requireAssetNameValue(value, operation);
  }
  requireTextAssetName(value, operation = "registerAsset") {
    return requireTextAssetNameValue(value, operation);
  }
  clearAssetError() {
    this.lastAssetErrorType = "";
    this.lastAssetErrorLabel = "";
  }
  beginRegistration(name) {
    const version = (this.registrationVersions.get(name) ?? 0) + 1;
    this.registrationVersions.set(name, version);
    return {
      version,
      cancellationVersion: this.registrationCancellationVersions.get(name) ?? 0
    };
  }
  cancelRegistrations(name) {
    const cancellationVersion = (this.registrationCancellationVersions.get(name) ?? 0) + 1;
    this.registrationCancellationVersions.set(name, cancellationVersion);
  }
  isRegistrationCancellationCurrent(name, token) {
    return (this.registrationCancellationVersions.get(name) ?? 0) === token.cancellationVersion;
  }
  async registerExternalAsset(url, name) {
    const token = this.beginRegistration(name);
    const record = url ? await this.fetchExternalAsset(url, name) : this.committedCacheRecords.has(name) ? this.committedCacheRecords.get(name) ?? null : await this.cacheGet(name);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    if (!record) {
      const candidates = suggestNames(name, this.assetRegistry.keys());
      throw new AssetManagerError(
        "ASSET_NOT_REGISTERED",
        `Asset "${name}" is not cached and no URL was provided.`,
        {
          operation: "registerAsset",
          assetName: name,
          candidates,
          hint: suggestionHint(candidates) ?? "Register an HTTP(S) URL before loading from cache."
        }
      );
    }
    const prepared = {
      ...record,
      kind: "external",
      mimeType: normalizeMimeType(record.mimeType, record.url || name),
      skinId: null
    };
    await this.commitPreparedAsset(name, "external", prepared, token, url ? record : void 0);
  }
  async registerCostumeReference(name, spriteName, costumeName) {
    const token = this.beginRegistration(name);
    const { target, costume, costumeName: resolvedCostumeName } = resolveCostumeAddress(this.runtime, name, spriteName, costumeName);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, "costume", {
      kind: "costume",
      name,
      targetId: target.id,
      targetName: spriteName,
      isStage: false,
      costumeName: resolvedCostumeName,
      assetId: costume.assetId ?? null
    }, token);
  }
  async registerBackdropReference(name, backdropName) {
    const token = this.beginRegistration(name);
    const { target: stage, costume } = resolveBackdropAddress(this.runtime, backdropName);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, "backdrop", {
      kind: "backdrop",
      name,
      targetId: stage.id,
      targetName: STAGE_RESOURCE_NAME,
      isStage: true,
      costumeName: backdropName,
      assetId: costume.assetId ?? null
    }, token);
  }
  async registerSoundReference(name, spriteName, soundName) {
    const token = this.beginRegistration(name);
    const { target, sound, isStage } = resolveSoundAddress(
      this.runtime,
      spriteName,
      soundName,
      name
    );
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, "sound", {
      kind: "sound",
      name,
      targetId: target.id,
      targetName: isStage ? STAGE_RESOURCE_NAME : spriteName,
      isStage,
      soundName,
      assetId: sound.assetId ?? null
    }, token);
  }
  async registerLiteralSoundReference(name, targetName, soundName) {
    const token = this.beginRegistration(name);
    const resolved = resolveLiteralSoundAddress(this.runtime, targetName, soundName, name);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, "sound", {
      kind: "sound",
      name,
      targetId: resolved.target.id,
      targetName: resolved.targetName,
      isStage: resolved.isStage,
      soundName,
      assetId: resolved.sound.assetId ?? null
    }, token);
  }
  async registerTextReference(name, runtimeVariableName) {
    const token = this.beginRegistration(name);
    this.requireTextAssetName(name);
    if (!this.isRegistrationCancellationCurrent(name, token)) return;
    await this.commitPreparedAsset(name, "text", {
      kind: "text",
      name,
      runtimeVariableName
    }, token);
  }
  unregisterAsset(name) {
    this.cancelRegistrations(name);
    this.invalidateDOMImageResources(name);
    const kind = this.assetRegistry.get(name);
    if (!kind) return;
    const asset = this.getRegisteredAsset(name, kind);
    this.removeRegisteredAsset(name, kind);
    this.disposeRegisteredAsset(asset);
    this.assetRegistry.delete(name);
    for (const [targetId, binding] of this.displayedAssets) {
      if (binding.assetName === name) this.displayedAssets.delete(targetId);
    }
  }
  async commitPreparedAsset(name, kind, prepared, token, cacheRecord) {
    const previousCommit = this.registrationCommits.get(name) ?? Promise.resolve();
    const commit = previousCommit.catch(() => void 0).then(async () => {
      if (!this.isRegistrationCancellationCurrent(name, token) || token.version < (this.successfulRegistrationVersions.get(name) ?? 0)) {
        this.disposeRegisteredAsset(prepared);
        return;
      }
      const currentKind = this.assetRegistry.get(name);
      const current = currentKind ? this.getRegisteredAsset(name, currentKind) : void 0;
      this.assertReplacementKind(name, currentKind, current, kind, prepared);
      let previousCached;
      let nextCached;
      if (cacheRecord) {
        previousCached = this.committedCacheRecords.has(name) ? this.committedCacheRecords.get(name) ?? null : await this.cacheGet(name);
        if (!this.isRegistrationCancellationCurrent(name, token)) {
          this.disposeRegisteredAsset(prepared);
          return;
        }
        nextCached = { ...cacheRecord, generation: token.version };
        await this.cachePut(nextCached);
        if (!this.isRegistrationCancellationCurrent(name, token)) {
          await this.restoreCacheIfGeneration(name, token.version, previousCached);
          this.disposeRegisteredAsset(prepared);
          return;
        }
      }
      try {
        await this.commitPreparedAssetNow(name, kind, prepared, token);
      } catch (error) {
        if (cacheRecord) {
          await this.restoreCacheIfGeneration(name, token.version, previousCached ?? null);
        }
        throw error;
      }
      this.invalidateDOMImageResources(name);
      if (!this.isRegistrationCancellationCurrent(name, token)) {
        if (cacheRecord) {
          await this.restoreCacheIfGeneration(name, token.version, previousCached ?? null);
        }
        return;
      }
      this.successfulRegistrationVersions.set(name, token.version);
      if (nextCached) this.committedCacheRecords.set(name, nextCached);
    });
    this.registrationCommits.set(name, commit);
    try {
      await commit;
    } finally {
      if (this.registrationCommits.get(name) === commit) this.registrationCommits.delete(name);
    }
  }
  async commitPreparedAssetNow(name, kind, prepared, token) {
    const currentKind = this.assetRegistry.get(name);
    const current = currentKind ? this.getRegisteredAsset(name, currentKind) : void 0;
    this.assertReplacementKind(name, currentKind, current, kind, prepared);
    if (currentKind === kind && current && this.featureFlags.ENABLE_LIVE_ASSET_REPLACEMENT) {
      await this.replaceRegisteredAsset(name, kind, current, prepared, token);
      return;
    }
    if (currentKind) this.removeRegisteredAsset(name, currentKind);
    this.installRegisteredAsset(name, kind, prepared);
    this.disposeRegisteredAsset(current);
    for (const [targetId, binding] of this.displayedAssets) {
      if (binding.assetName === name) this.displayedAssets.delete(targetId);
    }
  }
  assertReplacementKind(name, currentKind, current, nextKind, next) {
    if (!currentKind || !this.featureFlags.ENABLE_STRICT_ASSET_KIND_REPLACEMENT) return;
    let expectedKind = currentKind;
    let actualKind = nextKind;
    if (currentKind === "external" && nextKind === "external" && current?.kind === "external" && next.kind === "external") {
      const currentMedia = this.externalMediaKind(current);
      const nextMedia = this.externalMediaKind(next);
      if (currentMedia === nextMedia || currentMedia === "unknown" || nextMedia === "unknown") return;
      expectedKind = `external/${currentMedia}`;
      actualKind = `external/${nextMedia}`;
    } else if (currentKind === nextKind) {
      return;
    }
    throw new AssetManagerError(
      "ASSET_TYPE_CHANGE",
      `Cannot replace asset "${name}": it is currently registered as ${expectedKind}, but the new resource is ${actualKind}.`,
      {
        operation: "registerAsset",
        assetName: name,
        expectedKind,
        actualKind,
        hint: "Delete the existing asset first if this type change is intentional."
      }
    );
  }
  async replaceRegisteredAsset(name, kind, current, prepared, token) {
    const managedDisplays = [...this.displayedAssets].filter(
      ([, binding]) => binding.assetName === name && binding.assetKind === kind
    ).flatMap(([targetId, binding]) => {
      const target = this.runtime.targets.find((candidate) => candidate.id === targetId);
      if (target && this.isDisplayBindingCurrent(target, binding)) {
        return [{ target, binding }];
      }
      this.displayedAssets.delete(targetId);
      return [];
    });
    let preparedDisplays;
    try {
      const skin = kind === "text" || managedDisplays.length === 0 ? null : await this.resolveSkinFromAsset(name, kind, prepared);
      preparedDisplays = managedDisplays.map(({ target, binding }) => ({ target, binding, skin }));
    } catch (error) {
      this.disposeRegisteredAsset(prepared);
      throw new AssetManagerError(
        "REPLACEMENT_FAILED",
        `Cannot prepare replacement asset "${name}": ${errorMessage(error)}`,
        {
          operation: "registerAsset",
          assetName: name,
          hint: "The old registration and display were kept.",
          cause: error
        }
      );
    }
    if (!this.isRegistrationCancellationCurrent(name, token)) {
      this.disposeRegisteredAsset(prepared);
      return;
    }
    this.installRegisteredAsset(name, kind, prepared);
    const attemptedTargets = [];
    try {
      for (const display of preparedDisplays) {
        if (!this.isRegistrationCancellationCurrent(name, token)) break;
        if (!this.runtime.targets.includes(display.target)) {
          this.displayedAssets.delete(display.target.id);
          continue;
        }
        if (this.displayedAssets.get(display.target.id) !== display.binding) continue;
        if (!this.isDisplayBindingCurrent(display.target, display.binding)) {
          this.displayedAssets.delete(display.target.id);
          continue;
        }
        attemptedTargets.push(display.target);
        if (kind === "text") {
          await this.applyTextReferenceToTarget(
            display.target,
            name,
            prepared,
            { runtime: this.runtime, target: display.target }
          );
        } else if (display.skin) {
          this.applySkinToTarget(display.target, display.skin);
        }
        if (this.isRegistrationCancellationCurrent(name, token)) {
          this.setDisplayBinding(display.target, name, kind, display.skin?.skinId);
        }
      }
    } catch (error) {
      if (!this.isRegistrationCancellationCurrent(name, token)) {
        this.disposeRegisteredAsset(current);
        return;
      }
      this.installRegisteredAsset(name, kind, current);
      let rollbackError;
      for (const target of attemptedTargets) {
        if (!this.runtime.targets.includes(target)) continue;
        try {
          if (kind === "text") {
            await this.applyTextReferenceToTarget(
              target,
              name,
              current,
              { runtime: this.runtime, target }
            );
          } else {
            const currentSkin = await this.resolveSkinFromAsset(name, kind, current);
            this.applySkinToTarget(target, currentSkin);
            this.setDisplayBinding(target, name, kind, currentSkin.skinId);
            continue;
          }
          this.setDisplayBinding(target, name, kind);
        } catch (rollbackFailure) {
          rollbackError ??= rollbackFailure;
        }
      }
      this.disposeRegisteredAsset(prepared);
      throw new AssetManagerError(
        "REPLACEMENT_FAILED",
        `Cannot replace asset "${name}": ${errorMessage(error)}`,
        {
          operation: "registerAsset",
          assetName: name,
          hint: rollbackError ? `The old registration was restored, but its display could not be reapplied: ${errorMessage(rollbackError)}` : "The old registration and display were restored.",
          cause: error
        }
      );
    }
    this.disposeRegisteredAsset(current);
  }
  getRegisteredAsset(name, kind) {
    if (kind === "external") return this.externalAssets.get(name);
    if (kind === "costume" || kind === "backdrop") return this.costumeAssets.get(name);
    if (kind === "sound") return this.soundAssets.get(name);
    return this.textAssets.get(name);
  }
  installRegisteredAsset(name, kind, asset) {
    if (kind === "external") this.externalAssets.set(name, asset);
    else if (kind === "costume" || kind === "backdrop") {
      this.costumeAssets.set(name, asset);
    } else if (kind === "sound") this.soundAssets.set(name, asset);
    else this.textAssets.set(name, asset);
    this.assetRegistry.set(name, kind);
  }
  removeRegisteredAsset(name, kind) {
    if (kind === "external") this.externalAssets.delete(name);
    else if (kind === "costume" || kind === "backdrop") this.costumeAssets.delete(name);
    else if (kind === "sound") this.soundAssets.delete(name);
    else this.textAssets.delete(name);
  }
  disposeRegisteredAsset(asset) {
    if (asset?.kind === "external") this.deleteOwnedSkinIfExists(asset);
  }
  externalMediaKind(asset) {
    const mimeType = normalizeMimeType(asset.mimeType, asset.url || asset.name);
    if (mimeType.startsWith("image/")) return "image";
    if (mimeType.startsWith("audio/")) return "audio";
    return "unknown";
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
  async restoreCacheIfGeneration(name, generation, previous) {
    const database = await this.openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(name);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const current = request.result;
        if (current?.generation !== generation) return;
        if (previous) store.put(previous);
        else store.delete(name);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });
  }
  async fetchExternalAsset(url, name) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch asset "${name}": ${response.status} ${response.statusText}`);
    const blob = await response.blob();
    return {
      name,
      url,
      mimeType: normalizeMimeType(blob.type || response.headers.get("Content-Type"), url),
      data: await blob.arrayBuffer(),
      cachedAt: Date.now()
    };
  }
  getStageTarget() {
    return findStageTarget(this.runtime);
  }
  findTargetByName(name) {
    return findProjectTargetByName(this.runtime, name);
  }
  resolveReferencedTarget(targetId, targetName, isStage) {
    const byId = this.runtime.targets.find((target) => target.id === targetId);
    if (byId) return byId;
    if (isStage) return this.getStageTarget();
    const byName = this.findTargetByName(targetName);
    if (!byName) {
      const candidates = suggestNames(
        targetName,
        this.runtime.targets.flatMap((target) => target.sprite?.name ? [target.sprite.name] : [])
      );
      throw new AssetManagerError(
        "SPRITE_NOT_FOUND",
        `Asset source target no longer exists: ${targetName}.`,
        {
          operation: "resolveAsset",
          actorName: targetName,
          candidates,
          hint: suggestionHint(candidates)
        }
      );
    }
    return byName;
  }
  findCostume(target, costumeName, assetId) {
    return findProjectCostume(target, costumeName, assetId);
  }
  findSound(target, soundName, assetId) {
    return findProjectSound(target, soundName, assetId);
  }
  async resolveSkin(value) {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered("show", name);
    const asset = this.getRegisteredAsset(name, kind);
    if (!asset) throw this.assetNotRegistered("show", name);
    return this.resolveSkinFromAsset(name, kind, asset);
  }
  async applyAssetToTarget(target, value, util) {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    let skinId;
    if (!kind) throw this.assetNotRegistered("show", name);
    if (!this.runtime.targets.includes(target)) return;
    if (kind === "text") {
      await this.applyTextToTarget(target, name, util);
    } else if (kind === "external" || kind === "costume" || kind === "backdrop") {
      const skin = await this.resolveSkin(name);
      if (!this.runtime.targets.includes(target)) return;
      this.applySkinToTarget(target, skin);
      skinId = skin.skinId;
    } else {
      throw this.assetTypeMismatch("show", name, "image or text", kind);
    }
    if (!this.runtime.targets.includes(target)) return;
    this.setDisplayBinding(target, name, kind, skinId);
  }
  setDisplayBinding(target, name, kind, skinId) {
    if (kind === "sound") {
      this.displayedAssets.delete(target.id);
      return;
    }
    this.displayedAssets.set(target.id, {
      assetName: name,
      assetKind: kind,
      skinId: skinId ?? null
    });
  }
  isDisplayBindingCurrent(target, binding) {
    if (binding.assetKind === "text") return true;
    if (binding.skinId === null || target.drawableID === void 0 || target.drawableID === null) {
      return false;
    }
    return this.renderer._allDrawables?.[target.drawableID]?.skin?.id === binding.skinId;
  }
  applyResolvedSkinToTarget(target, name, skin) {
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered("show", name);
    if (kind !== "external" && kind !== "costume" && kind !== "backdrop") {
      throw this.assetTypeMismatch("show", name, "image", kind);
    }
    this.applySkinToTarget(target, skin);
    this.setDisplayBinding(target, name, kind, skin.skinId);
  }
  async applyTextToTarget(target, name, util) {
    if (target.isStage) throw this.assetTypeMismatch("show on stage", name, "image", "text");
    const reference = this.textAssets.get(name);
    if (!reference) throw this.assetNotRegistered("show", name);
    await this.applyTextReferenceToTarget(target, name, reference, util);
  }
  async applyTextReferenceToTarget(target, name, reference, util) {
    if (target.isStage) throw this.assetTypeMismatch("show on stage", name, "image", "text");
    const temporaryVariables = this.requireTemporaryVariables("show", name);
    const getRuntimeVariable = (variableName) => temporaryVariables.getRuntimeVariable({ VAR: variableName });
    let style;
    try {
      style = resolveTextStyle(name, this.runtime.stageWidth, getRuntimeVariable);
    } catch (error) {
      throw new AssetManagerError("STYLE_VALUE_INVALID", errorMessage(error), {
        operation: "show",
        assetName: name,
        hint: "Correct the stored text style value before showing this asset.",
        cause: error
      });
    }
    const setFont = this.requireAnimatedTextOpcode("text_setFont", name);
    const setColor = this.requireAnimatedTextOpcode("text_setColor", name);
    const setWidth = this.requireAnimatedTextOpcode("text_setWidth", name);
    const setOutlineWidth = this.runtime.getOpcodeFunction?.("text_setOutlineWidth");
    const setOutlineColor = this.runtime.getOpcodeFunction?.("text_setOutlineColor");
    const displayText = this.requireAnimatedTextOpcode(
      style.animation === "none" ? "text_setText" : "text_animateText",
      name
    );
    const blockUtility = { ...util, target, runtime: util?.runtime ?? this.runtime };
    const text = getRuntimeVariable(reference.runtimeVariableName);
    await Promise.resolve(setFont({ FONT: style.font }, blockUtility));
    await Promise.resolve(setColor({ COLOR: style.color }, blockUtility));
    await Promise.resolve(setWidth({ WIDTH: style.width, ALIGN: style.align }, blockUtility));
    if (setOutlineWidth) {
      await Promise.resolve(setOutlineWidth({ WIDTH: DEFAULT_OUTLINE_WIDTH }, blockUtility));
    }
    if (setOutlineColor) {
      await Promise.resolve(setOutlineColor({ COLOR: DEFAULT_OUTLINE_COLOR }, blockUtility));
    }
    const displayResult = displayText(
      style.animation === "none" ? { TEXT: String(text ?? "") } : { ANIMATE: style.animation, TEXT: String(text ?? "") },
      blockUtility
    );
    if (style.animation === "none") {
      await Promise.resolve(displayResult);
    } else {
      void Promise.resolve(displayResult).catch((error) => {
        console.error(new AssetManagerError(
          "ANIMATION_FAILED",
          `Animated Text failed for asset "${name}": ${errorMessage(error)}`,
          {
            operation: "animateText",
            assetName: name,
            hint: "Check the Animated Text extension and animation value.",
            cause: error
          }
        ));
      });
    }
  }
  requireTemporaryVariables(operation = "setTextValue", assetName) {
    const temporaryVariables = this.runtime.ext_lmsTempVars2;
    if (!temporaryVariables?.getRuntimeVariable) {
      throw new AssetManagerError(
        "DEPENDENCY_MISSING",
        "Temporary Variables extension is not loaded.",
        {
          operation,
          assetName,
          hint: "Load the lmsTempVars2 extension before using runtime text assets."
        }
      );
    }
    return temporaryVariables;
  }
  setRuntimeVariable(name, value) {
    const assetName = name.split(":")[1];
    const temporaryVariables = this.requireTemporaryVariables("setRuntimeVariable", assetName);
    if (!temporaryVariables.setRuntimeVariable) {
      throw new AssetManagerError(
        "DEPENDENCY_MISSING",
        "Temporary Variables extension does not support setting runtime variables.",
        {
          operation: "setRuntimeVariable",
          assetName,
          hint: "Load a Temporary Variables version that provides setRuntimeVariable."
        }
      );
    }
    temporaryVariables.setRuntimeVariable({ VAR: name, STRING: value });
  }
  requireAnimatedTextOpcode(opcode, assetName) {
    const implementation = this.runtime.getOpcodeFunction?.(opcode);
    if (!implementation) {
      throw new AssetManagerError(
        "DEPENDENCY_MISSING",
        `Animated Text extension is not loaded or does not provide ${opcode}.`,
        {
          operation: "show",
          assetName,
          hint: "Load a compatible Animated Text extension before showing text assets."
        }
      );
    }
    return implementation;
  }
  async ensureExternalSkin(name) {
    const asset = this.externalAssets.get(name);
    if (!asset) throw this.assetNotRegistered("show", name);
    return this.ensureExternalAssetSkin(asset, name);
  }
  async resolveProjectImageStorageAsset(name, costume) {
    if (costume.asset?.data) return costume.asset;
    const assetId = costume.assetId;
    const dataFormat = costume.dataFormat?.toLowerCase();
    const storage = this.runtime.storage;
    if (!assetId || !dataFormat || !storage) {
      throw new AssetManagerError(
        "SOURCE_ASSET_NOT_FOUND",
        `Project image bytes are unavailable for asset "${name}".`,
        {
          operation: "resolveDOMImageResource",
          assetName: name,
          hint: "Resolve the resource while its project costume and VM storage are available."
        }
      );
    }
    const cached = storage.get?.(assetId);
    if (cached?.data) return cached;
    const assetType = dataFormat === "svg" ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap;
    const loaded = await storage.load?.(assetType, assetId, dataFormat);
    if (!loaded?.data) {
      throw new AssetManagerError(
        "SOURCE_ASSET_NOT_FOUND",
        `Project image bytes are unavailable for asset "${name}".`,
        {
          operation: "resolveDOMImageResource",
          assetName: name,
          hint: "Keep the project asset available in VM storage until the resource is resolved."
        }
      );
    }
    return loaded;
  }
  cancelledDOMImageResolution(name) {
    const error = new Error(`DOM image resource resolution was cancelled: ${JSON.stringify(name)}`);
    error.name = "AbortError";
    return error;
  }
  async resolveExtensionDOMImageResource(nameInput) {
    const name = normalizeName(nameInput);
    const version = this.domImageResourceVersions.get(name) ?? 0;
    let entry = this.domImageResourceBackings.get(name);
    if (entry?.version !== version) {
      let nextEntry;
      const promise = (async () => {
        const resolved = await this.resolveImageAssetBytes({ NAME: name });
        const backing2 = await createDOMImageResourceBacking(
          { name, bytes: resolved.bytes, mimeType: resolved.mimeType },
          (idleBacking) => {
            if (this.domImageResourceBackings.get(name) === nextEntry && nextEntry.backing === idleBacking) {
              this.domImageResourceBackings.delete(name);
            }
          }
        );
        nextEntry.backing = backing2;
        return backing2;
      })();
      nextEntry = { version, promise };
      entry = nextEntry;
      this.domImageResourceBackings.set(name, entry);
      try {
        await promise;
      } catch (error) {
        if (this.domImageResourceBackings.get(name) === entry) {
          this.domImageResourceBackings.delete(name);
        }
        throw error;
      }
    }
    const backing = await entry.promise;
    let controller;
    const resource = backing.acquire(() => {
      if (controller) this.releaseActiveDOMImageResource(controller);
    });
    if ((this.domImageResourceVersions.get(name) ?? 0) !== version || !this.assetRegistry.has(name)) {
      resource.release();
      throw this.cancelledDOMImageResolution(name);
    }
    controller = { name, resource };
    this.activeDOMImageResources.add(controller);
    const named = this.activeDOMImageResourcesByName.get(name) ?? /* @__PURE__ */ new Set();
    named.add(controller);
    this.activeDOMImageResourcesByName.set(name, named);
    return resource;
  }
  releaseActiveDOMImageResource(controller) {
    this.activeDOMImageResources.delete(controller);
    const named = this.activeDOMImageResourcesByName.get(controller.name);
    named?.delete(controller);
    if (named?.size === 0) this.activeDOMImageResourcesByName.delete(controller.name);
  }
  invalidateDOMImageResources(name) {
    this.domImageResourceVersions.set(
      name,
      (this.domImageResourceVersions.get(name) ?? 0) + 1
    );
    this.domImageResourceBackings.delete(name);
    for (const controller of [...this.activeDOMImageResourcesByName.get(name) ?? []]) {
      controller.resource.release();
    }
  }
  releaseAllDOMImageResources() {
    const names = /* @__PURE__ */ new Set([
      ...this.domImageResourceBackings.keys(),
      ...this.activeDOMImageResourcesByName.keys()
    ]);
    for (const name of names) {
      this.domImageResourceVersions.set(
        name,
        (this.domImageResourceVersions.get(name) ?? 0) + 1
      );
    }
    this.domImageResourceBackings.clear();
    for (const controller of [...this.activeDOMImageResources]) {
      controller.resource.release();
    }
  }
  startListeningForDOMImageLifecycle() {
    if (this.listeningForDOMImageLifecycle || !this.runtime.on) return;
    this.listeningForDOMImageLifecycle = true;
    this.runtime.on("PROJECT_STOP_ALL", this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.on("PROJECT_LOADED", this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.on("RUNTIME_DISPOSED", this.releaseDOMImageResourcesForRuntimeDispose);
  }
  stopListeningForDOMImageLifecycle() {
    if (!this.listeningForDOMImageLifecycle || !this.runtime.off) return;
    this.listeningForDOMImageLifecycle = false;
    this.runtime.off("PROJECT_STOP_ALL", this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.off("PROJECT_LOADED", this.releaseAllDOMImageResourcesForLifecycle);
    this.runtime.off("RUNTIME_DISPOSED", this.releaseDOMImageResourcesForRuntimeDispose);
  }
  async ensureExternalAssetSkin(asset, name) {
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith("image/")) {
      throw this.assetTypeMismatch("show", name, "image", `external/${this.externalMediaKind(asset)}`);
    }
    if (asset.skinId !== null) return asset.skinId;
    const blob = new Blob([asset.data], { type: asset.mimeType });
    asset.skinId = asset.mimeType === "image/svg+xml" ? this.renderer.createSVGSkin(await blob.text()) : this.renderer.createBitmapSkin(await createImageBitmap(blob), asset.bitmapResolution ?? 1);
    return asset.skinId;
  }
  async resolveSkinFromAsset(name, kind, asset) {
    if (kind === "external" && asset.kind === "external") {
      return { skinId: await this.ensureExternalAssetSkin(asset, name), sourceSize: null };
    }
    if ((kind === "costume" || kind === "backdrop") && (asset.kind === "costume" || asset.kind === "backdrop")) {
      const { target, costume } = this.resolveCostumeAssetReference(name, asset);
      return {
        skinId: costume.skinId,
        sourceSize: target.isStage || !Number.isFinite(target.size) ? null : target.size
      };
    }
    throw this.assetTypeMismatch("show", name, "image", kind);
  }
  resolveCostumeReference(name) {
    const reference = this.costumeAssets.get(name);
    if (!reference) throw this.assetNotRegistered("show", name);
    return this.resolveCostumeAssetReference(name, reference);
  }
  resolveCostumeAssetReference(name, reference) {
    const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
    const costume = this.findCostume(target, reference.costumeName, reference.assetId);
    if (!costume) {
      const candidates = suggestNames(
        reference.costumeName,
        (target.sprite?.costumes ?? []).map((candidate) => candidate.name)
      );
      throw new AssetManagerError(
        "SOURCE_ASSET_NOT_FOUND",
        `Costume no longer exists: ${reference.targetName}/${reference.costumeName}.`,
        {
          operation: "show",
          assetName: name,
          actorName: reference.targetName,
          candidates,
          hint: suggestionHint(candidates)
        }
      );
    }
    if (typeof costume.skinId !== "number") {
      throw new AssetManagerError(
        "SOURCE_ASSET_NOT_FOUND",
        `Costume skin is not available: ${reference.targetName}/${reference.costumeName}.`,
        {
          operation: "show",
          assetName: name,
          actorName: reference.targetName,
          hint: "Wait for the project costume to finish loading and try again."
        }
      );
    }
    return { target, costume };
  }
  resolveSoundReference(name) {
    const reference = this.soundAssets.get(name);
    if (!reference) throw this.assetNotRegistered("playSound", name);
    const target = this.resolveReferencedTarget(reference.targetId, reference.targetName, reference.isStage);
    const sound = this.findSound(target, reference.soundName, reference.assetId);
    if (!sound) {
      const candidates = suggestNames(
        reference.soundName,
        (target.sprite?.sounds ?? []).map((candidate) => candidate.name)
      );
      throw new AssetManagerError(
        "SOURCE_ASSET_NOT_FOUND",
        `Sound no longer exists: ${reference.targetName}/${reference.soundName}.`,
        {
          operation: "playSound",
          assetName: name,
          actorName: reference.targetName,
          candidates,
          hint: suggestionHint(candidates)
        }
      );
    }
    if (!sound.soundId) {
      throw new AssetManagerError(
        "SOURCE_ASSET_NOT_FOUND",
        `Sound ID is not available: ${reference.targetName}/${reference.soundName}.`,
        {
          operation: "playSound",
          assetName: name,
          actorName: reference.targetName,
          hint: "Wait for the project sound to finish loading and try again."
        }
      );
    }
    if (!target.sprite?.soundBank) {
      throw new AssetManagerError(
        "DEPENDENCY_MISSING",
        `Sound bank is not available: ${reference.targetName}.`,
        {
          operation: "playSound",
          assetName: name,
          actorName: reference.targetName,
          hint: "Use a TurboWarp runtime with sound support."
        }
      );
    }
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
  applySkinToTarget(target, skin) {
    if (target.drawableID === void 0 || target.drawableID === null) {
      throw new AssetManagerError(
        "SPRITE_NOT_FOUND",
        `Target drawable not found: ${target.sprite?.name ?? "unknown"}.`,
        {
          operation: "show",
          actorName: target.sprite?.name ?? target.id,
          hint: "Use a live target with an initialized renderer drawable."
        }
      );
    }
    this.renderer.updateDrawableSkinId(target.drawableID, skin.skinId);
    if (!target.isStage && target.isOriginal && skin.sourceSize !== null && target.size !== skin.sourceSize) {
      target.setSize(skin.sourceSize);
    }
    target.emitVisualChange?.();
    this.runtime.requestRedraw?.();
  }
  async playResolvedSound(value, waitUntilDone) {
    const name = normalizeName(value);
    const kind = this.assetRegistry.get(name);
    if (!kind) throw this.assetNotRegistered("playSound", name);
    if (kind === "external") {
      await this.playExternalSound(name, waitUntilDone);
      return;
    }
    if (kind === "sound") {
      await this.playProjectSound(name, waitUntilDone);
      return;
    }
    throw this.assetTypeMismatch("playSound", name, "audio", kind);
  }
  async playExternalSound(name, waitUntilDone) {
    const asset = this.externalAssets.get(name);
    if (!asset) throw this.assetNotRegistered("playSound", name);
    asset.mimeType = normalizeMimeType(asset.mimeType, asset.url || name);
    if (!asset.mimeType.startsWith("audio/")) {
      throw this.assetTypeMismatch(
        "playSound",
        name,
        "audio",
        `external/${this.externalMediaKind(asset)}`
      );
    }
    const objectUrl = URL.createObjectURL(new Blob([asset.data], { type: asset.mimeType }));
    const audio = new Audio(objectUrl);
    this.playingAudio.set(audio, name);
    let resolvePlayback;
    const playbackFinished = new Promise((resolve) => {
      resolvePlayback = resolve;
    });
    const cleanup = () => {
      this.playingAudio.delete(audio);
      URL.revokeObjectURL(objectUrl);
      resolvePlayback();
    };
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", cleanup, { once: true });
    const playPromise = audio.play();
    if (!waitUntilDone) {
      void playPromise.catch((error) => {
        cleanup();
        console.error(this.playbackError(name, error));
      });
      return;
    }
    try {
      await playPromise;
    } catch (error) {
      cleanup();
      throw this.playbackError(name, error);
    }
    await playbackFinished;
  }
  stopExternalAudio(audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.dispatchEvent(new Event("ended"));
    } catch {
    } finally {
      this.playingAudio.delete(audio);
    }
  }
  async playProjectSound(name, waitUntilDone) {
    const { target, sound } = this.resolveSoundReference(name);
    const playResult = target.sprite?.soundBank?.playSound(target, sound.soundId);
    const playPromise = Promise.resolve(playResult);
    if (!waitUntilDone) {
      void playPromise.catch((error) => console.error(this.playbackError(name, error)));
      return;
    }
    try {
      await playPromise;
    } catch (error) {
      throw this.playbackError(name, error);
    }
  }
  playbackError(name, cause) {
    return new AssetManagerError(
      "PLAYBACK_FAILED",
      `Failed to play audio asset "${name}": ${errorMessage(cause)}`,
      {
        operation: "playSound",
        assetName: name,
        hint: "Check browser audio permissions and the registered audio resource.",
        cause
      }
    );
  }
  projectAssetMimeType(dataFormat, kind) {
    if (dataFormat) {
      const guessed = guessMimeType(`asset.${dataFormat}`);
      if (guessed !== "application/octet-stream") return guessed;
    }
    return kind === "image" ? "image/x-scratch-costume" : "audio/x-scratch-sound";
  }
}
const DEFAULT_DATABASE_NAME$1 = "tw-asset-manager-binary-bundles-v1";
const DATABASE_VERSION$2 = 1;
const BUNDLE_STORE$1 = "bundles";
const METADATA_STORE$1 = "bundleMetadata";
const LAST_ACCESSED_INDEX = "lastAccessedAt";
const FORMAT_VERSION$1 = 1;
const DEFAULT_MAX_FILES_PER_BUNDLE = 256;
const DEFAULT_MAX_BUNDLE_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_STORED_BUNDLES = 1024;
const DEFAULT_MAX_STORE_BYTES = 256 * 1024 * 1024;
const DEFAULT_TTL_MS$1 = 30 * 24 * 60 * 60 * 1e3;
const MAX_NAMESPACE_LENGTH$1 = 512;
const MAX_NAME_LENGTH$1 = 256;
const MAX_PATH_LENGTH$1 = 1024;
const MAX_DATABASE_NAME_LENGTH$3 = 256;
const ABSOLUTE_MAX_FILES_PER_BUNDLE = 4096;
const ABSOLUTE_MAX_STORED_BUNDLES = 65536;
function bundleError(code, message, cause) {
  const error = new Error(message, cause === void 0 ? void 0 : { cause });
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  return error;
}
function abortError$2() {
  const error = bundleError("ASSET_BINARY_BUNDLE_ABORTED", "Binary bundle operation was aborted.");
  error.name = "AbortError";
  return error;
}
function releasedError() {
  return bundleError(
    "ASSET_BINARY_BUNDLE_RELEASED",
    "The binary bundle store has been released."
  );
}
function assertNotAborted$2(signal) {
  if (signal?.aborted) throw abortError$2();
}
function operationSignal$1(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw bundleError(
      "ASSET_BINARY_BUNDLE_INPUT_INVALID",
      "Binary bundle operation options must be an object."
    );
  }
  const signal = options.signal;
  if (signal === void 0) return void 0;
  if (!signal || typeof signal !== "object" || typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function") {
    throw bundleError(
      "ASSET_BINARY_BUNDLE_INPUT_INVALID",
      "Binary bundle AbortSignal is invalid."
    );
  }
  return signal;
}
function requireString$1(value, label, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0")) {
    throw bundleError(
      "ASSET_BINARY_BUNDLE_INPUT_INVALID",
      `${label} must be a non-empty string of at most ${maxLength} code units.`
    );
  }
  return value;
}
function requireLimit$1(value, fallback, label, maximum = Number.MAX_SAFE_INTEGER) {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized <= 0 || normalized > maximum) {
    throw new TypeError(`${label} must be a positive safe integer no greater than ${maximum}.`);
  }
  return normalized;
}
function normalizeIntegrity$1(value, label) {
  const integrity = requireString$1(value, label, 96);
  if (!integrityIsCanonical$1(integrity)) {
    throw bundleError(
      "ASSET_BINARY_BUNDLE_INPUT_INVALID",
      `${label} must contain canonical SHA-256 hex or base64.`
    );
  }
  return integrity;
}
function integrityIsCanonical$1(value) {
  if (!value.startsWith("sha256-")) return false;
  const payload = value.slice("sha256-".length);
  if (/^[0-9a-f]{64}$/u.test(payload)) return true;
  if (!/^[A-Za-z0-9+/]{43}=$/u.test(payload)) return false;
  try {
    const decoded = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    return decoded.byteLength === 32 && toBase64$1(decoded) === payload;
  } catch {
    return false;
  }
}
function safePath(value) {
  const path = requireString$1(value, "binary bundle file path", MAX_PATH_LENGTH$1);
  if (!pathIsSafe$1(path)) {
    throw bundleError(
      "ASSET_BINARY_BUNDLE_INPUT_INVALID",
      "Binary bundle file path must be a safe relative path."
    );
  }
  return path;
}
function pathIsSafe$1(path) {
  return Boolean(
    path.length > 0 && path.length <= MAX_PATH_LENGTH$1 && !path.startsWith("/") && !path.startsWith("\\") && !path.includes("\\") && !path.split("/").some((part) => part.length === 0 || part === "." || part === "..")
  );
}
function normalizeKey$1(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw bundleError("ASSET_BINARY_BUNDLE_INPUT_INVALID", "Binary bundle key must be an object.");
  }
  const namespace = requireString$1(input.namespace, "binary bundle namespace", MAX_NAMESPACE_LENGTH$1);
  const name = requireString$1(input.name, "binary bundle name", MAX_NAME_LENGTH$1);
  const integrity = normalizeIntegrity$1(input.integrity, "binary bundle integrity");
  return {
    namespace,
    name,
    integrity,
    key: JSON.stringify([FORMAT_VERSION$1, namespace, name, integrity])
  };
}
function ownBytes$1(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  throw bundleError(
    "ASSET_BINARY_BUNDLE_INPUT_INVALID",
    "Binary bundle file bytes must be an ArrayBuffer or Uint8Array."
  );
}
function toHex$1(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function toBase64$1(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}
async function verifyIntegrity$1(bytes, integrity, subtleCrypto) {
  const digest = new Uint8Array(await subtleCrypto.digest("SHA-256", bytes));
  const payload = integrity.slice("sha256-".length);
  const actual = /^[0-9a-f]{64}$/u.test(payload) ? toHex$1(digest) : toBase64$1(digest);
  if (actual !== payload) {
    throw bundleError(
      "ASSET_BINARY_BUNDLE_INTEGRITY_MISMATCH",
      "Binary bundle file integrity does not match its bytes."
    );
  }
}
function metadataIsValid(value, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value;
  if (!(candidate.formatVersion === FORMAT_VERSION$1 && candidate.key === key && typeof candidate.namespace === "string" && candidate.namespace.length > 0 && candidate.namespace.length <= MAX_NAMESPACE_LENGTH$1 && typeof candidate.name === "string" && candidate.name.length > 0 && candidate.name.length <= MAX_NAME_LENGTH$1 && typeof candidate.integrity === "string" && integrityIsCanonical$1(candidate.integrity) && JSON.stringify([
    FORMAT_VERSION$1,
    candidate.namespace,
    candidate.name,
    candidate.integrity
  ]) === key && Array.isArray(candidate.files) && Number.isSafeInteger(candidate.totalBytes) && Number(candidate.totalBytes) >= 0 && Number.isFinite(candidate.createdAt) && Number(candidate.createdAt) >= 0 && Number.isFinite(candidate.lastAccessedAt) && Number(candidate.lastAccessedAt) >= Number(candidate.createdAt) && typeof candidate.writeToken === "string" && candidate.writeToken.length > 0)) {
    return false;
  }
  let totalBytes = 0;
  let previousPath = null;
  for (const file of candidate.files) {
    if (!file || typeof file !== "object" || typeof file.path !== "string" || !pathIsSafe$1(file.path) || previousPath !== null && file.path <= previousPath || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.integrity !== "string" || !integrityIsCanonical$1(file.integrity)) {
      return false;
    }
    totalBytes += file.size;
    if (!Number.isSafeInteger(totalBytes)) return false;
    previousPath = file.path;
  }
  return candidate.files.length > 0 && totalBytes === candidate.totalBytes;
}
function storedRecordIsValid(value, metadata, key) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value;
  if (candidate.formatVersion !== FORMAT_VERSION$1 || candidate.key !== key || candidate.namespace !== metadata.namespace || candidate.name !== metadata.name || candidate.integrity !== metadata.integrity || candidate.totalBytes !== metadata.totalBytes || candidate.writeToken !== metadata.writeToken || !Array.isArray(candidate.files) || candidate.files.length !== metadata.files.length) {
    return false;
  }
  return candidate.files.every((file, index) => {
    const expected = metadata.files[index];
    return Boolean(
      expected && file && typeof file === "object" && file.path === expected.path && file.size === expected.size && file.integrity === expected.integrity && file.data instanceof ArrayBuffer && file.data.byteLength === expected.size
    );
  });
}
function requestResult$2(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}
function transactionComplete$3(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}
function mappedStoreError(error, operation, signal) {
  if (signal?.aborted || error instanceof DOMException && error.name === "AbortError") {
    return abortError$2();
  }
  if (error instanceof Error && "code" in error && typeof error.code === "string" && error.code.startsWith("ASSET_BINARY_BUNDLE_")) {
    return error;
  }
  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return bundleError(
      "ASSET_BINARY_BUNDLE_QUOTA_EXCEEDED",
      `Binary bundle ${operation} exceeded IndexedDB quota.`,
      error
    );
  }
  return bundleError(
    "ASSET_BINARY_BUNDLE_TRANSACTION_FAILED",
    `Binary bundle ${operation} transaction failed.`,
    error
  );
}
function publicRegistration(key, files, totalBytes) {
  return Object.freeze({
    namespace: key.namespace,
    name: key.name,
    integrity: key.integrity,
    files: Object.freeze(files.map((file) => Object.freeze({ ...file }))),
    totalBytes
  });
}
function createBinaryBundleStore(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Binary bundle store options must be an object.");
  }
  const indexedDB2 = options.indexedDB ?? globalThis.indexedDB;
  const subtleCrypto = options.subtleCrypto ?? globalThis.crypto?.subtle;
  const databaseName = requireString$1(
    options.databaseName ?? DEFAULT_DATABASE_NAME$1,
    "binary bundle databaseName",
    MAX_DATABASE_NAME_LENGTH$3
  );
  const now = options.now ?? Date.now;
  if (typeof now !== "function") throw new TypeError("now must be a function.");
  const limits = {
    maxFilesPerBundle: requireLimit$1(
      options.maxFilesPerBundle,
      DEFAULT_MAX_FILES_PER_BUNDLE,
      "maxFilesPerBundle",
      ABSOLUTE_MAX_FILES_PER_BUNDLE
    ),
    maxBundleBytes: requireLimit$1(
      options.maxBundleBytes,
      DEFAULT_MAX_BUNDLE_BYTES,
      "maxBundleBytes"
    ),
    maxStoredBundles: requireLimit$1(
      options.maxStoredBundles,
      DEFAULT_MAX_STORED_BUNDLES,
      "maxStoredBundles",
      ABSOLUTE_MAX_STORED_BUNDLES
    ),
    maxStoreBytes: requireLimit$1(
      options.maxStoreBytes,
      DEFAULT_MAX_STORE_BYTES,
      "maxStoreBytes"
    ),
    ttlMs: requireLimit$1(options.ttlMs, DEFAULT_TTL_MS$1, "ttlMs")
  };
  let released = false;
  let releasePromise = null;
  let tokenCounter = 0;
  const releaseController = new AbortController();
  const generations = /* @__PURE__ */ new Map();
  const activeTransactions = /* @__PURE__ */ new Set();
  const activeByKey = /* @__PURE__ */ new Map();
  const activeOperations = /* @__PURE__ */ new Set();
  function ensureActive() {
    if (released) throw releasedError();
  }
  function currentGeneration(key) {
    return generations.get(key) ?? 0;
  }
  function advanceGeneration(key) {
    const next = currentGeneration(key) + 1;
    generations.set(key, next);
    for (const transaction of activeByKey.get(key) ?? []) {
      try {
        transaction.abort();
      } catch {
      }
    }
    return next;
  }
  function ensureGeneration(key, generation) {
    ensureActive();
    if (currentGeneration(key) !== generation) throw abortError$2();
  }
  function nextWriteToken(generation) {
    tokenCounter += 1;
    return `${now()}:${generation}:${tokenCounter}`;
  }
  function trackOperation(operation) {
    activeOperations.add(operation);
    void operation.then(
      () => activeOperations.delete(operation),
      () => activeOperations.delete(operation)
    );
    return operation;
  }
  async function verifyWithCancellation(bytes, integrity, signal) {
    assertNotAborted$2(signal);
    ensureActive();
    let rejectExternal = null;
    let rejectRelease = null;
    const cancellation = new Promise((_resolve, reject) => {
      rejectExternal = () => reject(abortError$2());
      rejectRelease = () => reject(releasedError());
      signal?.addEventListener("abort", rejectExternal, { once: true });
      releaseController.signal.addEventListener("abort", rejectRelease, { once: true });
    });
    try {
      await Promise.race([verifyIntegrity$1(bytes, integrity, subtleCrypto), cancellation]);
    } finally {
      if (rejectExternal) signal?.removeEventListener("abort", rejectExternal);
      if (rejectRelease) releaseController.signal.removeEventListener("abort", rejectRelease);
    }
  }
  async function openDatabase2() {
    ensureActive();
    if (!indexedDB2 || typeof indexedDB2.open !== "function") {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE",
        "IndexedDB is not available for the binary bundle store."
      );
    }
    let request;
    try {
      request = indexedDB2.open(databaseName, DATABASE_VERSION$2);
    } catch (error) {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE",
        "The binary bundle IndexedDB database could not be opened.",
        error
      );
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(BUNDLE_STORE$1)) {
          database.createObjectStore(BUNDLE_STORE$1, { keyPath: "key" });
        }
        let metadata;
        if (!database.objectStoreNames.contains(METADATA_STORE$1)) {
          metadata = database.createObjectStore(METADATA_STORE$1, { keyPath: "key" });
        } else {
          metadata = request.transaction.objectStore(METADATA_STORE$1);
        }
        if (!metadata.indexNames.contains(LAST_ACCESSED_INDEX)) {
          metadata.createIndex(LAST_ACCESSED_INDEX, "lastAccessedAt");
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled || released) {
          database.close();
          rejectOnce(releasedError());
          return;
        }
        settled = true;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => rejectOnce(
        bundleError(
          "ASSET_BINARY_BUNDLE_INDEXEDDB_UNAVAILABLE",
          "The binary bundle IndexedDB open request failed.",
          request.error
        )
      );
      request.onblocked = () => rejectOnce(
        bundleError(
          "ASSET_BINARY_BUNDLE_INDEXEDDB_BLOCKED",
          "The binary bundle IndexedDB open request was blocked."
        )
      );
    });
  }
  function trackTransaction(key, transaction) {
    activeTransactions.add(transaction);
    let transactions = activeByKey.get(key);
    if (!transactions) {
      transactions = /* @__PURE__ */ new Set();
      activeByKey.set(key, transactions);
    }
    transactions.add(transaction);
    return () => {
      activeTransactions.delete(transaction);
      transactions.delete(transaction);
      if (transactions.size === 0) activeByKey.delete(key);
    };
  }
  function abortWithSignal(transaction, signal) {
    const abort = () => {
      try {
        transaction.abort();
      } catch {
      }
    };
    signal?.addEventListener("abort", abort, { once: true });
    return () => signal?.removeEventListener("abort", abort);
  }
  async function normalizeFiles(input, signal) {
    const key = normalizeKey$1(input);
    if (!Array.isArray(input.files) || input.files.length === 0) {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_INPUT_INVALID",
        "Binary bundle files must be a non-empty array."
      );
    }
    if (input.files.length > limits.maxFilesPerBundle) {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_LIMIT_EXCEEDED",
        "Binary bundle exceeds maxFilesPerBundle."
      );
    }
    const paths = /* @__PURE__ */ new Set();
    const files = [];
    let totalBytes = 0;
    for (const inputFile of input.files) {
      assertNotAborted$2(signal);
      if (!inputFile || typeof inputFile !== "object" || Array.isArray(inputFile)) {
        throw bundleError(
          "ASSET_BINARY_BUNDLE_INPUT_INVALID",
          "Each binary bundle file must be an object."
        );
      }
      const path = safePath(inputFile.path);
      if (paths.has(path)) {
        throw bundleError(
          "ASSET_BINARY_BUNDLE_INPUT_INVALID",
          `Binary bundle contains a duplicate path: ${path}`
        );
      }
      paths.add(path);
      const bytes = ownBytes$1(inputFile.bytes);
      if (!Number.isSafeInteger(inputFile.size) || Number(inputFile.size) !== bytes.byteLength) {
        throw bundleError(
          "ASSET_BINARY_BUNDLE_INPUT_INVALID",
          `Binary bundle file size does not match: ${path}`
        );
      }
      const integrity = normalizeIntegrity$1(inputFile.integrity, `integrity for ${path}`);
      totalBytes += bytes.byteLength;
      if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxBundleBytes) {
        throw bundleError(
          "ASSET_BINARY_BUNDLE_LIMIT_EXCEEDED",
          "Binary bundle exceeds maxBundleBytes."
        );
      }
      files.push({ path, size: bytes.byteLength, integrity, bytes });
    }
    if (totalBytes > limits.maxStoreBytes) {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_LIMIT_EXCEEDED",
        "Binary bundle exceeds maxStoreBytes."
      );
    }
    if (!subtleCrypto || typeof subtleCrypto.digest !== "function") {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_CRYPTO_UNAVAILABLE",
        "SHA-256 is not available for binary bundle verification."
      );
    }
    for (const file of files) {
      assertNotAborted$2(signal);
      await verifyWithCancellation(file.bytes, file.integrity, signal);
    }
    files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
    return { key, files, totalBytes };
  }
  async function put(input, operationOptions = {}) {
    ensureActive();
    const signal = operationSignal$1(operationOptions);
    assertNotAborted$2(signal);
    const normalizedKey = normalizeKey$1(input);
    const generation = advanceGeneration(normalizedKey.key);
    const normalized = await normalizeFiles(input, signal);
    ensureGeneration(normalized.key.key, generation);
    const database = await openDatabase2();
    let transaction = null;
    let untrack = () => {
    };
    let removeAbort = () => {
    };
    try {
      ensureGeneration(normalized.key.key, generation);
      assertNotAborted$2(signal);
      transaction = database.transaction([BUNDLE_STORE$1, METADATA_STORE$1], "readwrite");
      untrack = trackTransaction(normalized.key.key, transaction);
      removeAbort = abortWithSignal(transaction, signal);
      const bundles = transaction.objectStore(BUNDLE_STORE$1);
      const metadataStore = transaction.objectStore(METADATA_STORE$1);
      const metadataRequest = metadataStore.openCursor();
      const bundleKeyRequest = bundles.openKeyCursor();
      const metadataRecords = [];
      const bundleKeys = /* @__PURE__ */ new Set();
      const scanCapacity = limits.maxStoredBundles * 2;
      let metadataDone = false;
      let bundleKeysDone = false;
      let finalized = false;
      let operationError;
      const writeToken = nextWriteToken(generation);
      const createdAt = now();
      const publicFiles = normalized.files.map(({ path, size, integrity }) => ({
        path,
        size,
        integrity
      }));
      const record = {
        ...normalized.key,
        formatVersion: FORMAT_VERSION$1,
        files: normalized.files.map(({ path, size, integrity, bytes }) => ({
          path,
          size,
          integrity,
          data: bytes.buffer
        })),
        totalBytes: normalized.totalBytes,
        writeToken
      };
      const metadata = {
        ...normalized.key,
        formatVersion: FORMAT_VERSION$1,
        files: publicFiles,
        totalBytes: normalized.totalBytes,
        createdAt,
        lastAccessedAt: createdAt,
        writeToken
      };
      const failTransaction = (error) => {
        operationError = error;
        try {
          transaction?.abort();
        } catch {
        }
      };
      const finalize = () => {
        if (finalized || !metadataDone || !bundleKeysDone) return;
        finalized = true;
        try {
          if (signal?.aborted || currentGeneration(normalized.key.key) !== generation || released) {
            failTransaction(abortError$2());
            return;
          }
          const currentTime2 = now();
          const metadataKeys = new Set(metadataRecords.map(({ key }) => key));
          for (const bundleKey of bundleKeys) {
            if (!metadataKeys.has(bundleKey)) bundles.delete(bundleKey);
          }
          const retained = metadataRecords.filter((candidate) => {
            if (candidate.key === normalized.key.key) return false;
            if (bundleKeys.has(candidate.key)) return true;
            metadataStore.delete(candidate.key);
            return false;
          }).sort(
            (left, right) => left.lastAccessedAt === right.lastAccessedAt ? left.key < right.key ? -1 : 1 : left.lastAccessedAt - right.lastAccessedAt
          );
          let retainedBytes = retained.reduce((sum, candidate) => sum + candidate.totalBytes, 0);
          let retainedCount = retained.length;
          for (const candidate of retained) {
            const expired = currentTime2 < candidate.lastAccessedAt || currentTime2 - candidate.lastAccessedAt > limits.ttlMs;
            const overBudget = retainedBytes + normalized.totalBytes > limits.maxStoreBytes;
            const overCount = retainedCount + 1 > limits.maxStoredBundles;
            if (!expired && !overBudget && !overCount) continue;
            bundles.delete(candidate.key);
            metadataStore.delete(candidate.key);
            retainedBytes -= candidate.totalBytes;
            retainedCount -= 1;
          }
          bundles.put(record);
          metadataStore.put(metadata);
        } catch (error) {
          failTransaction(error);
        }
      };
      metadataRequest.onsuccess = () => {
        try {
          const cursor = metadataRequest.result;
          if (cursor) {
            if (metadataRecords.length >= scanCapacity) {
              bundles.delete(cursor.primaryKey);
              cursor.delete();
            } else if (metadataIsValid(cursor.value, String(cursor.primaryKey))) {
              metadataRecords.push(cursor.value);
            } else {
              bundles.delete(cursor.primaryKey);
              cursor.delete();
            }
            cursor.continue();
            return;
          }
          metadataDone = true;
          finalize();
        } catch (error) {
          failTransaction(error);
        }
      };
      bundleKeyRequest.onsuccess = () => {
        try {
          const cursor = bundleKeyRequest.result;
          if (cursor) {
            const bundleKey = String(cursor.primaryKey);
            if (bundleKeys.size >= scanCapacity) {
              cursor.delete();
              metadataStore.delete(cursor.primaryKey);
            } else {
              bundleKeys.add(bundleKey);
            }
            cursor.continue();
            return;
          }
          bundleKeysDone = true;
          finalize();
        } catch (error) {
          failTransaction(error);
        }
      };
      try {
        await transactionComplete$3(transaction);
      } catch (error) {
        throw mappedStoreError(operationError ?? error, "put", signal);
      }
      ensureGeneration(normalized.key.key, generation);
      return publicRegistration(normalized.key, publicFiles, normalized.totalBytes);
    } finally {
      removeAbort();
      untrack();
      database.close();
    }
  }
  async function deleteIfToken(key, writeToken) {
    if (released) return;
    const database = await openDatabase2();
    let untrack = () => {
    };
    try {
      const transaction = database.transaction([BUNDLE_STORE$1, METADATA_STORE$1], "readwrite");
      untrack = trackTransaction(key, transaction);
      const metadataStore = transaction.objectStore(METADATA_STORE$1);
      const request = metadataStore.get(key);
      request.onsuccess = () => {
        if (!metadataIsValid(request.result, key) || request.result.writeToken !== writeToken) return;
        transaction.objectStore(BUNDLE_STORE$1).delete(key);
        metadataStore.delete(key);
      };
      try {
        await transactionComplete$3(transaction);
      } catch (error) {
        throw mappedStoreError(error, "conditional delete");
      }
    } finally {
      untrack();
      database.close();
    }
  }
  async function touch(key, writeToken) {
    if (released) return;
    const database = await openDatabase2();
    let untrack = () => {
    };
    try {
      const transaction = database.transaction(METADATA_STORE$1, "readwrite");
      untrack = trackTransaction(key, transaction);
      const store2 = transaction.objectStore(METADATA_STORE$1);
      const request = store2.get(key);
      request.onsuccess = () => {
        if (!metadataIsValid(request.result, key) || request.result.writeToken !== writeToken) return;
        store2.put({ ...request.result, lastAccessedAt: now() });
      };
      try {
        await transactionComplete$3(transaction);
      } catch (error) {
        throw mappedStoreError(error, "touch");
      }
    } finally {
      untrack();
      database.close();
    }
  }
  async function get(input, operationOptions = {}) {
    ensureActive();
    const signal = operationSignal$1(operationOptions);
    assertNotAborted$2(signal);
    const key = normalizeKey$1(input);
    const generation = currentGeneration(key.key);
    const database = await openDatabase2();
    let untrack = () => {
    };
    let removeAbort = () => {
    };
    let bundle;
    let metadata;
    try {
      assertNotAborted$2(signal);
      const transaction = database.transaction([BUNDLE_STORE$1, METADATA_STORE$1], "readonly");
      untrack = trackTransaction(key.key, transaction);
      removeAbort = abortWithSignal(transaction, signal);
      const bundleRequest = transaction.objectStore(BUNDLE_STORE$1).get(key.key);
      const metadataRequest = transaction.objectStore(METADATA_STORE$1).get(key.key);
      try {
        [bundle, metadata] = await Promise.all([
          requestResult$2(bundleRequest),
          requestResult$2(metadataRequest),
          transactionComplete$3(transaction)
        ]);
      } catch (error) {
        throw mappedStoreError(error, "get", signal);
      }
    } finally {
      removeAbort();
      untrack();
      database.close();
    }
    ensureGeneration(key.key, generation);
    if (bundle === void 0 && metadata === void 0) {
      throw bundleError("ASSET_BINARY_BUNDLE_NOT_FOUND", "Binary bundle was not found.");
    }
    if (!metadataIsValid(metadata, key.key) || !storedRecordIsValid(bundle, metadata, key.key)) {
      if (metadataIsValid(metadata, key.key)) await deleteIfToken(key.key, metadata.writeToken);
      throw bundleError("ASSET_BINARY_BUNDLE_CORRUPT", "Binary bundle record is incomplete or corrupt.");
    }
    const currentTime2 = now();
    if (currentTime2 < metadata.lastAccessedAt || currentTime2 - metadata.lastAccessedAt > limits.ttlMs) {
      await deleteIfToken(key.key, metadata.writeToken);
      throw bundleError("ASSET_BINARY_BUNDLE_NOT_FOUND", "Binary bundle has expired.");
    }
    if (!subtleCrypto || typeof subtleCrypto.digest !== "function") {
      throw bundleError(
        "ASSET_BINARY_BUNDLE_CRYPTO_UNAVAILABLE",
        "SHA-256 is not available for binary bundle verification."
      );
    }
    const files = [];
    try {
      for (const file of bundle.files) {
        assertNotAborted$2(signal);
        ensureGeneration(key.key, generation);
        const bytes = new Uint8Array(file.data);
        await verifyWithCancellation(bytes, file.integrity, signal);
        files.push(Object.freeze({ path: file.path, size: file.size, integrity: file.integrity, bytes }));
      }
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ASSET_BINARY_BUNDLE_INTEGRITY_MISMATCH") {
        await deleteIfToken(key.key, metadata.writeToken);
      }
      throw error;
    }
    ensureGeneration(key.key, generation);
    await touch(key.key, metadata.writeToken);
    ensureGeneration(key.key, generation);
    assertNotAborted$2(signal);
    return Object.freeze({
      namespace: key.namespace,
      name: key.name,
      integrity: key.integrity,
      files: Object.freeze(files),
      totalBytes: metadata.totalBytes
    });
  }
  async function deleteBundle(input, operationOptions = {}) {
    ensureActive();
    const signal = operationSignal$1(operationOptions);
    assertNotAborted$2(signal);
    const key = normalizeKey$1(input);
    const generation = advanceGeneration(key.key);
    const database = await openDatabase2();
    let untrack = () => {
    };
    let removeAbort = () => {
    };
    try {
      ensureGeneration(key.key, generation);
      assertNotAborted$2(signal);
      const transaction = database.transaction([BUNDLE_STORE$1, METADATA_STORE$1], "readwrite");
      untrack = trackTransaction(key.key, transaction);
      removeAbort = abortWithSignal(transaction, signal);
      transaction.objectStore(BUNDLE_STORE$1).delete(key.key);
      transaction.objectStore(METADATA_STORE$1).delete(key.key);
      try {
        await transactionComplete$3(transaction);
      } catch (error) {
        throw mappedStoreError(error, "delete", signal);
      }
      ensureGeneration(key.key, generation);
    } finally {
      removeAbort();
      untrack();
      database.close();
    }
  }
  const store = {
    put(input, operationOptions) {
      return trackOperation(put(input, operationOptions));
    },
    get(input, operationOptions) {
      return trackOperation(get(input, operationOptions));
    },
    delete(input, operationOptions) {
      return trackOperation(deleteBundle(input, operationOptions));
    },
    release() {
      if (releasePromise) return releasePromise;
      released = true;
      releaseController.abort();
      for (const transaction of activeTransactions) {
        try {
          transaction.abort();
        } catch {
        }
      }
      activeTransactions.clear();
      activeByKey.clear();
      generations.clear();
      const pending = [...activeOperations];
      releasePromise = Promise.allSettled(pending).then(() => {
      });
      return releasePromise;
    }
  };
  return Object.freeze(store);
}
const CATALOG_DATABASE_NAME = "tw-kamishibai-cache-catalog-v1";
const CATALOG_DATABASE_VERSION = 2;
const STORY_STORE = "stories";
const LEASE_STORE = "leases";
const CATALOG_FORMAT_VERSION = 1;
const STORY_DATABASE_PREFIX$1 = "tw-kamishibai-assets-v1--";
const MAX_DATABASE_NAME_LENGTH$2 = 160;
const DELETION_MARKER_TTL_MS = 30 * 60 * 1e3;
function catalogError(code, message, cause) {
  const error = new Error(message, cause === void 0 ? void 0 : { cause });
  Object.defineProperty(error, "code", { value: code });
  return error;
}
function transactionComplete$2(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}
function isNonNegativeSafeInteger(value) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}
function isCatalogRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return Boolean(
    record.formatVersion === CATALOG_FORMAT_VERSION && typeof record.key === "string" && record.key === record.databaseName && typeof record.databaseName === "string" && record.databaseName.length <= MAX_DATABASE_NAME_LENGTH$2 && record.databaseName.startsWith(STORY_DATABASE_PREFIX$1) && /^[\p{Letter}\p{Number}._-]+$/u.test(record.databaseName) && typeof record.id === "string" && /^[a-z0-9][a-z0-9_-]{7,63}$/u.test(record.id) && record.databaseName.endsWith(`--${record.id}`) && typeof record.label === "string" && record.label.length > 0 && record.label.length <= 256 && !/[\u0000-\u001f\u007f]/u.test(record.label) && isNonNegativeSafeInteger(record.entries) && isNonNegativeSafeInteger(record.bytes) && Number.isFinite(record.lastOpenedAt) && Number(record.lastOpenedAt) >= 0 && Number.isFinite(record.lastAccessedAt) && Number(record.lastAccessedAt) >= 0 && (record.lastCleanupAt === null || Number.isFinite(record.lastCleanupAt) && Number(record.lastCleanupAt) >= 0) && Number.isFinite(record.updatedAt) && Number(record.updatedAt) >= 0 && (record.statsRevision === void 0 || isNonNegativeSafeInteger(record.statsRevision)) && (record.deletingToken === void 0 || record.deletingToken === null || typeof record.deletingToken === "string" && record.deletingToken.length >= 16) && (record.deletingStartedAt === void 0 || record.deletingStartedAt === null || Number.isFinite(record.deletingStartedAt) && Number(record.deletingStartedAt) >= 0)
  );
}
function deletionIsStale(record, currentTime2) {
  return Boolean(
    record.deletingToken && (record.deletingStartedAt === void 0 || record.deletingStartedAt === null || currentTime2 - record.deletingStartedAt > DELETION_MARKER_TTL_MS)
  );
}
function isLeaseRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return Boolean(
    typeof record.key === "string" && typeof record.databaseName === "string" && record.databaseName.startsWith(STORY_DATABASE_PREFIX$1) && typeof record.token === "string" && record.token.length >= 16 && record.key === `${record.databaseName}:${record.token}` && Number.isFinite(record.expiresAt) && Number(record.expiresAt) >= 0
  );
}
function publicInfo(record, active) {
  return Object.freeze({
    databaseName: record.databaseName,
    id: record.id,
    label: record.label,
    entries: record.entries,
    bytes: record.bytes,
    lastOpenedAt: record.lastOpenedAt,
    lastAccessedAt: record.lastAccessedAt,
    lastCleanupAt: record.lastCleanupAt,
    active
  });
}
class StoryCacheCatalog {
  #indexedDB;
  #now;
  constructor(indexedDB2, now) {
    this.#indexedDB = indexedDB2;
    this.#now = now;
  }
  async #open() {
    if (!this.#indexedDB || typeof this.#indexedDB.open !== "function") {
      throw catalogError("ASSET_CACHE_CATALOG_UNAVAILABLE", "Story cache catalog is unavailable.");
    }
    let request;
    try {
      request = this.#indexedDB.open(CATALOG_DATABASE_NAME, CATALOG_DATABASE_VERSION);
    } catch (error) {
      throw catalogError(
        "ASSET_CACHE_CATALOG_UNAVAILABLE",
        "Story cache catalog could not be opened.",
        error
      );
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORY_STORE)) {
          const store = database.createObjectStore(STORY_STORE, { keyPath: "key" });
          store.createIndex("lastAccessedAt", "lastAccessedAt");
        }
        if (!database.objectStoreNames.contains(LEASE_STORE)) {
          const leases = database.createObjectStore(LEASE_STORE, { keyPath: "key" });
          leases.createIndex("databaseName", "databaseName");
          leases.createIndex("expiresAt", "expiresAt");
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        database.onversionchange = () => database.close();
        resolve(database);
      };
      request.onerror = () => {
        if (settled) return;
        settled = true;
        reject(
          catalogError(
            "ASSET_CACHE_CATALOG_UNAVAILABLE",
            "Story cache catalog open request failed.",
            request.error
          )
        );
      };
      request.onblocked = () => {
        if (settled) return;
        settled = true;
        reject(catalogError("ASSET_CACHE_CATALOG_BLOCKED", "Story cache catalog open was blocked."));
      };
    });
  }
  async #writeLease(identity, stats, accessedAt, token, expiresAt) {
    const database = await this.#open();
    let semanticError = null;
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], "readwrite");
      const store = transaction.objectStore(STORY_STORE);
      const request = store.get(identity.databaseName);
      request.onsuccess = () => {
        const previous = isCatalogRecord(request.result) ? request.result : null;
        if (previous?.deletingToken) {
          const stale = deletionIsStale(previous, this.#now());
          semanticError = catalogError(
            stale ? "ASSET_CACHE_DATABASE_DELETION_STALE" : "ASSET_CACHE_DATABASE_DELETING",
            stale ? "Story cache database has an abandoned deletion marker." : "Story cache database deletion is in progress."
          );
          transaction.abort();
          return;
        }
        const currentTime2 = this.#now();
        const previousRevision = previous?.statsRevision ?? 0;
        const acceptStats = stats !== null && (!previous || stats.revision >= previousRevision);
        const record = {
          key: identity.databaseName,
          formatVersion: CATALOG_FORMAT_VERSION,
          databaseName: identity.databaseName,
          id: identity.id,
          label: identity.label,
          entries: acceptStats ? stats.entries : previous?.entries ?? 0,
          bytes: acceptStats ? stats.bytes : previous?.bytes ?? 0,
          lastOpenedAt: Math.max(previous?.lastOpenedAt ?? 0, currentTime2),
          lastAccessedAt: Math.max(previous?.lastAccessedAt ?? 0, accessedAt),
          lastCleanupAt: acceptStats ? stats.lastCleanupAt : previous?.lastCleanupAt ?? null,
          updatedAt: currentTime2,
          statsRevision: acceptStats ? stats.revision : previousRevision,
          deletingToken: null,
          deletingStartedAt: null
        };
        store.put(record);
        const lease = {
          key: `${identity.databaseName}:${token}`,
          databaseName: identity.databaseName,
          token,
          expiresAt
        };
        transaction.objectStore(LEASE_STORE).put(lease);
      };
      try {
        await transactionComplete$2(transaction);
      } catch (error) {
        throw semanticError ?? error;
      }
    } finally {
      database.close();
    }
  }
  acquireLease(identity, accessedAt, token, expiresAt) {
    return this.#writeLease(identity, null, accessedAt, token, expiresAt);
  }
  upsertAndRenewLease(identity, stats, accessedAt, token, expiresAt) {
    return this.#writeLease(identity, stats, accessedAt, token, expiresAt);
  }
  touchAndRenewLease(identity, accessedAt, token, expiresAt) {
    return this.#writeLease(identity, null, accessedAt, token, expiresAt);
  }
  async list() {
    const database = await this.#open();
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], "readwrite");
      const store = transaction.objectStore(STORY_STORE);
      const leases = transaction.objectStore(LEASE_STORE);
      const records = [];
      const activeDatabases = /* @__PURE__ */ new Set();
      const request = store.openCursor();
      const cursorComplete = new Promise((resolve, reject) => {
        request.onerror = () => reject(request.error ?? new Error("Catalog cursor failed."));
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (isCatalogRecord(cursor.value)) records.push(cursor.value);
          else cursor.delete();
          cursor.continue();
        };
      });
      const leaseRequest = leases.openCursor();
      const leasesComplete = new Promise((resolve, reject) => {
        leaseRequest.onerror = () => reject(leaseRequest.error ?? new Error("Catalog lease cursor failed."));
        leaseRequest.onsuccess = () => {
          const cursor = leaseRequest.result;
          if (!cursor) {
            resolve();
            return;
          }
          if (!isLeaseRecord(cursor.value) || cursor.value.expiresAt <= this.#now()) {
            cursor.delete();
          } else {
            activeDatabases.add(cursor.value.databaseName);
          }
          cursor.continue();
        };
      });
      await Promise.all([cursorComplete, leasesComplete, transactionComplete$2(transaction)]);
      records.sort(
        (left, right) => left.lastAccessedAt - right.lastAccessedAt || left.databaseName.localeCompare(right.databaseName, "en-US")
      );
      return Object.freeze(
        records.map((record) => publicInfo(record, activeDatabases.has(record.databaseName)))
      );
    } finally {
      database.close();
    }
  }
  async #removeRecord(databaseName, deletionToken) {
    const database = await this.#open();
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], "readwrite");
      const stories = transaction.objectStore(STORY_STORE);
      const storyRequest = stories.get(databaseName);
      storyRequest.onsuccess = () => {
        if (isCatalogRecord(storyRequest.result) && storyRequest.result.deletingToken === deletionToken) {
          stories.delete(databaseName);
        }
      };
      const leases = transaction.objectStore(LEASE_STORE);
      const request = leases.openCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        if (isLeaseRecord(cursor.value) && cursor.value.databaseName === databaseName) {
          cursor.delete();
        }
        cursor.continue();
      };
      await transactionComplete$2(transaction);
    } finally {
      database.close();
    }
  }
  async #beginDelete(databaseName, deletionToken) {
    const database = await this.#open();
    let record = null;
    let storyComplete = false;
    let leasesComplete = false;
    let active = false;
    let semanticError = null;
    try {
      const transaction = database.transaction([STORY_STORE, LEASE_STORE], "readwrite");
      const stories = transaction.objectStore(STORY_STORE);
      const storyRequest = stories.get(databaseName);
      const decide = () => {
        if (!storyComplete || !leasesComplete || semanticError || !record) return;
        if (record.deletingToken && record.deletingToken !== deletionToken && !deletionIsStale(record, this.#now())) {
          semanticError = catalogError(
            "ASSET_CACHE_DATABASE_DELETING",
            "Story cache database deletion is already in progress."
          );
          transaction.abort();
          return;
        }
        if (active) {
          semanticError = catalogError(
            "ASSET_CACHE_DATABASE_ACTIVE",
            "Story cache database has an active runtime lease."
          );
          transaction.abort();
          return;
        }
        const currentTime2 = this.#now();
        stories.put({
          ...record,
          deletingToken: deletionToken,
          deletingStartedAt: currentTime2,
          updatedAt: currentTime2
        });
      };
      storyRequest.onsuccess = () => {
        if (isCatalogRecord(storyRequest.result)) record = storyRequest.result;
        else if (storyRequest.result !== void 0) stories.delete(databaseName);
        storyComplete = true;
        decide();
      };
      const leaseRequest = transaction.objectStore(LEASE_STORE).openCursor();
      leaseRequest.onsuccess = () => {
        const cursor = leaseRequest.result;
        if (!cursor) {
          leasesComplete = true;
          decide();
          return;
        }
        if (!isLeaseRecord(cursor.value) || cursor.value.expiresAt <= this.#now()) {
          cursor.delete();
        } else if (cursor.value.databaseName === databaseName) {
          active = true;
        }
        cursor.continue();
      };
      try {
        await transactionComplete$2(transaction);
      } catch (error) {
        throw semanticError ?? error;
      }
      return record;
    } finally {
      database.close();
    }
  }
  async #cancelDelete(databaseName, deletionToken) {
    const database = await this.#open();
    try {
      const transaction = database.transaction(STORY_STORE, "readwrite");
      const store = transaction.objectStore(STORY_STORE);
      const request = store.get(databaseName);
      request.onsuccess = () => {
        if (isCatalogRecord(request.result) && request.result.deletingToken === deletionToken) {
          store.put({
            ...request.result,
            deletingToken: null,
            deletingStartedAt: null,
            updatedAt: this.#now()
          });
        }
      };
      await transactionComplete$2(transaction);
    } finally {
      database.close();
    }
  }
  async delete(databaseName, deletionToken) {
    const record = await this.#beginDelete(databaseName, deletionToken);
    if (!record) {
      return Object.freeze({ databaseName, deleted: false, removedEntries: 0, removedBytes: 0 });
    }
    if (!this.#indexedDB || typeof this.#indexedDB.deleteDatabase !== "function") {
      await this.#cancelDelete(databaseName, deletionToken).catch(() => {
      });
      throw catalogError("ASSET_CACHE_CATALOG_UNAVAILABLE", "IndexedDB deletion is unavailable.");
    }
    let request;
    try {
      request = this.#indexedDB.deleteDatabase(databaseName);
    } catch (error) {
      await this.#cancelDelete(databaseName, deletionToken).catch(() => {
      });
      throw catalogError(
        "ASSET_CACHE_DATABASE_DELETE_FAILED",
        "Story cache database could not be deleted.",
        error
      );
    }
    try {
      await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(
          catalogError(
            "ASSET_CACHE_DATABASE_DELETE_FAILED",
            "Story cache database deletion failed.",
            request.error
          )
        );
        request.onblocked = () => {
        };
      });
      await this.#removeRecord(databaseName, deletionToken);
    } catch (error) {
      await this.#cancelDelete(databaseName, deletionToken).catch(() => {
      });
      throw error;
    }
    return Object.freeze({
      databaseName,
      deleted: true,
      removedEntries: record.entries,
      removedBytes: record.bytes
    });
  }
  async releaseLease(databaseName, token) {
    const database = await this.#open();
    try {
      const transaction = database.transaction(LEASE_STORE, "readwrite");
      transaction.objectStore(LEASE_STORE).delete(`${databaseName}:${token}`);
      await transactionComplete$2(transaction);
    } finally {
      database.close();
    }
  }
  async prune(options) {
    const warnings = [];
    let records = [...await this.list()];
    let removedDatabases = 0;
    let removedEntries = 0;
    let removedBytes = 0;
    const remove = async (record) => {
      try {
        const result = await this.delete(record.databaseName, options.createDeletionToken());
        if (!result.deleted) return false;
        removedDatabases += 1;
        removedEntries += result.removedEntries;
        removedBytes += result.removedBytes;
        return true;
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "ASSET_CACHE_DATABASE_DELETE_FAILED";
        if (!warnings.includes(code)) warnings.push(code);
        return false;
      }
    };
    const currentTime2 = this.#now();
    for (const record of records) {
      if (record.databaseName === options.pinnedDatabaseName) continue;
      if (record.active) continue;
      if (currentTime2 - record.lastAccessedAt <= options.ttlMs) continue;
      await remove(record);
    }
    records = [...await this.list()];
    let totalBytes = records.reduce((sum, record) => sum + record.bytes, 0);
    const incomingBytes = Math.max(0, options.incomingBytes ?? 0);
    const target = options.force ? Math.max(0, Math.min(options.lowWaterBytes, totalBytes - incomingBytes)) : Math.max(0, Math.min(options.lowWaterBytes, options.highWaterBytes - incomingBytes));
    if (options.force || totalBytes + incomingBytes > options.highWaterBytes) {
      for (const record of records) {
        if (record.databaseName === options.pinnedDatabaseName) continue;
        if (record.active) continue;
        if (!await remove(record)) continue;
        totalBytes -= record.bytes;
        if (totalBytes <= target) break;
      }
    }
    const remaining = await this.list();
    return Object.freeze({
      removedDatabases,
      removedEntries,
      removedBytes,
      remainingDatabases: remaining.length,
      remainingBytes: remaining.reduce((sum, record) => sum + record.bytes, 0),
      highWaterBytes: options.highWaterBytes,
      lowWaterBytes: options.lowWaterBytes,
      warnings: Object.freeze(warnings)
    });
  }
}
const DATABASE_NAME = "tw-asset-manager-verified-binary-v1";
const DATABASE_VERSION$1 = 2;
const ENTRY_STORE = "entries";
const METADATA_STORE = "metadata";
const INFO_STORE = "info";
const CACHE_FORMAT_VERSION = 1;
const STORY_DATABASE_PREFIX = "tw-kamishibai-assets-v1--";
const MAX_DATABASE_NAME_LENGTH$1 = 160;
const DEFAULT_MAX_CACHE_BYTES = 256 * 1024 * 1024;
const DEFAULT_QUOTA_FRACTION = 0.2;
const DEFAULT_LOW_WATER_RATIO = 0.8;
const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
const DEFAULT_TOUCH_INTERVAL_MS = 60 * 60 * 1e3;
const DEFAULT_CLEANUP_BATCH_SIZE = 64;
const DEFAULT_LEASE_TTL_MS$1 = 5 * 60 * 1e3;
function cacheError(code, message, cause) {
  const error = new Error(message, cause === void 0 ? void 0 : { cause });
  Object.defineProperty(error, "code", { value: code });
  return error;
}
function abortError$1() {
  const error = new Error("Verified remote binary resolution was cancelled.");
  error.name = "AbortError";
  return error;
}
function assertNotAborted$1(signal) {
  if (signal?.aborted) throw abortError$1();
}
function isAbortError(error) {
  return Boolean(error && typeof error === "object" && "name" in error && error.name === "AbortError");
}
function isQuotaExceeded(error) {
  return error instanceof DOMException ? error.name === "QuotaExceededError" : Boolean(
    error && typeof error === "object" && "name" in error && error.name === "QuotaExceededError"
  );
}
function diagnosticCode(error, fallback) {
  if (error && typeof error === "object") {
    if ("code" in error && typeof error.code === "string" && error.code) return error.code;
    if ("name" in error && error.name === "QuotaExceededError") {
      return "ASSET_CACHE_QUOTA_EXCEEDED";
    }
    if ("name" in error && error.name === "AbortError") return "ASSET_CACHE_ABORTED";
  }
  return fallback;
}
function positiveSafeInteger(value, name) {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw cacheError("ASSET_CACHE_INPUT_INVALID", `${name} must be a positive safe integer.`);
  }
  return Number(value);
}
function finiteRatio(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1) {
    throw new TypeError(`${name} must be greater than 0 and at most 1.`);
  }
  return value;
}
function normalizeContentType(value) {
  if (typeof value !== "string") return "";
  return value.split(";", 1)[0].trim().toLowerCase();
}
function normalizeInput$1(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw cacheError("ASSET_CACHE_INPUT_INVALID", "Remote binary input must be an object.");
  }
  if (typeof input.url !== "string") {
    throw cacheError("ASSET_CACHE_INPUT_INVALID", "Remote binary URL must be a string.");
  }
  let url;
  try {
    url = new URL(input.url);
  } catch (error) {
    throw cacheError("ASSET_CACHE_INPUT_INVALID", "Remote binary URL is invalid.", error);
  }
  if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.hash) {
    throw cacheError(
      "ASSET_CACHE_INPUT_INVALID",
      "Remote binary URL must be an absolute HTTPS URL without credentials or a fragment."
    );
  }
  if (typeof input.integrity !== "string" || !/^sha256-[0-9a-f]{64}$/u.test(input.integrity)) {
    throw cacheError(
      "ASSET_CACHE_INPUT_INVALID",
      "Remote binary integrity must be sha256- followed by 64 lowercase hexadecimal digits."
    );
  }
  const contentType = normalizeContentType(input.contentType);
  if (!contentType || !/^[a-z0-9!#$%&'*+.^_`|~-]+\/[a-z0-9!#$%&'*+.^_`|~-]+$/u.test(contentType)) {
    throw cacheError("ASSET_CACHE_INPUT_INVALID", "Remote binary Content-Type is invalid.");
  }
  return Object.freeze({
    url: url.href,
    integrity: input.integrity,
    size: positiveSafeInteger(input.size, "Remote binary size"),
    contentType
  });
}
function normalizeCacheIdentityId(value) {
  if (typeof value !== "string") {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Cache identity id must be a string.");
  }
  const id = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{7,63}$/u.test(id)) {
    throw cacheError(
      "ASSET_CACHE_IDENTITY_INVALID",
      "Cache identity id must contain 8 to 64 lowercase ASCII letters, digits, underscores, or hyphens."
    );
  }
  return id;
}
function normalizeCacheIdentityLabel(value) {
  if (typeof value !== "string") {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Cache identity label must be a string.");
  }
  const basename = value.normalize("NFKC").replaceAll("\\", "/").split("/").at(-1).trim();
  if (!basename || basename.length > 256 || /[\u0000-\u001f\u007f]/u.test(basename)) {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Cache identity label is invalid.");
  }
  return basename;
}
function truncateUtf16(value, maxCodeUnits, maxCodePoints) {
  let result = "";
  let codePoints = 0;
  for (const character of value) {
    if (codePoints >= maxCodePoints || result.length + character.length > maxCodeUnits) break;
    result += character;
    codePoints += 1;
  }
  return result;
}
function cacheLabelSlug(label, maxCodeUnits) {
  const withoutExtension = label.replace(/(?:\.kamishibai)?\.ya?ml$/iu, "");
  const slug = withoutExtension.toLocaleLowerCase("en-US").replace(/[^\p{Letter}\p{Number}._-]+/gu, "-").replace(/^[._-]+|[._-]+$/gu, "");
  return truncateUtf16(slug || "story", maxCodeUnits, 48);
}
function createVerifiedRemoteCacheDatabaseName(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Cache identity must be an object.");
  }
  const id = normalizeCacheIdentityId(input.id);
  const label = normalizeCacheIdentityLabel(input.label);
  const slugBudget = MAX_DATABASE_NAME_LENGTH$1 - STORY_DATABASE_PREFIX.length - 2 - id.length;
  return `${STORY_DATABASE_PREFIX}${cacheLabelSlug(label, slugBudget)}--${id}`;
}
function normalizeCacheIdentity(input) {
  if (input === void 0) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Cache identity must be an object.");
  }
  const id = normalizeCacheIdentityId(input.id);
  const label = normalizeCacheIdentityLabel(input.label);
  const generated = createVerifiedRemoteCacheDatabaseName({ id, label });
  if (input.databaseName === void 0) {
    return Object.freeze({ id, label, databaseName: generated });
  }
  if (typeof input.databaseName !== "string") {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Cache database name must be a string.");
  }
  const databaseName = input.databaseName.normalize("NFKC");
  if (databaseName.length > MAX_DATABASE_NAME_LENGTH$1 || !databaseName.startsWith(STORY_DATABASE_PREFIX) || !databaseName.endsWith(`--${id}`) || !/^[\p{Letter}\p{Number}._-]+$/u.test(databaseName)) {
    throw cacheError(
      "ASSET_CACHE_IDENTITY_INVALID",
      "Cache database name must be a generated Kamishibai story database name for the same id."
    );
  }
  return Object.freeze({ id, label, databaseName });
}
function normalizeStoryDatabaseName(value) {
  if (typeof value !== "string") {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Story cache database name must be a string.");
  }
  const databaseName = value.normalize("NFKC");
  if (databaseName.length > MAX_DATABASE_NAME_LENGTH$1 || !databaseName.startsWith(STORY_DATABASE_PREFIX) || !/^[\p{Letter}\p{Number}._-]+$/u.test(databaseName)) {
    throw cacheError("ASSET_CACHE_IDENTITY_INVALID", "Story cache database name is invalid.");
  }
  return databaseName;
}
function takeBytes(value, transferOwnership) {
  if (value instanceof ArrayBuffer) {
    return transferOwnership ? new Uint8Array(value) : Uint8Array.from(new Uint8Array(value));
  }
  if (value instanceof Uint8Array) {
    if (transferOwnership && value.buffer instanceof ArrayBuffer && value.byteOffset === 0 && value.byteLength === value.buffer.byteLength) {
      return value;
    }
    return Uint8Array.from(value);
  }
  throw cacheError(
    "ASSET_CACHE_LOAD_INVALID",
    "Remote binary loader must return an ArrayBuffer or Uint8Array."
  );
}
function requestResult$1(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}
function transactionComplete$1(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}
function metadataIsStructurallyValid(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const candidate = metadata;
  return candidate.formatVersion === CACHE_FORMAT_VERSION && typeof candidate.key === "string" && typeof candidate.integrity === "string" && candidate.key === `${CACHE_FORMAT_VERSION}:${candidate.integrity}` && /^sha256-[0-9a-f]{64}$/u.test(candidate.integrity) && Number.isSafeInteger(candidate.size) && Number(candidate.size) > 0 && typeof candidate.contentType === "string" && normalizeContentType(candidate.contentType) === candidate.contentType && Number.isFinite(candidate.createdAt) && Number(candidate.createdAt) >= 0 && Number.isFinite(candidate.lastAccessedAt) && Number(candidate.lastAccessedAt) >= Number(candidate.createdAt) && Number.isFinite(candidate.lastValidatedAt) && Number(candidate.lastValidatedAt) >= Number(candidate.createdAt) && typeof candidate.writeToken === "string" && candidate.writeToken.length >= 16;
}
function revisionValue(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const candidate = value;
  return candidate.key === "revision" && Number.isSafeInteger(candidate.value) && Number(candidate.value) >= 0 ? Number(candidate.value) : 0;
}
function nextRevision(value) {
  if (value >= Number.MAX_SAFE_INTEGER) {
    throw cacheError("ASSET_CACHE_REVISION_EXHAUSTED", "Cache statistics revision is exhausted.");
  }
  return value + 1;
}
function entryBytes(entry, key) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const candidate = entry;
  if (candidate.key !== key || !(candidate.data instanceof ArrayBuffer)) return null;
  return new Uint8Array(candidate.data);
}
function recordIsUsable(record, currentTime2, ttlMs) {
  if (!metadataIsStructurallyValid(record.metadata)) return false;
  const bytes = entryBytes(record.entry, record.key);
  return Boolean(
    bytes && bytes.byteLength === record.metadata.size && currentTime2 >= record.metadata.createdAt && currentTime2 >= record.metadata.lastAccessedAt && currentTime2 - record.metadata.lastAccessedAt <= ttlMs
  );
}
function scanRecordIsUsable(record, currentTime2, ttlMs) {
  if (!record.entryPresent || !metadataIsStructurallyValid(record.metadata)) return false;
  return Boolean(
    currentTime2 >= record.metadata.createdAt && currentTime2 >= record.metadata.lastAccessedAt && currentTime2 - record.metadata.lastAccessedAt <= ttlMs
  );
}
function candidateFor(record) {
  if (metadataIsStructurallyValid(record.metadata)) {
    return {
      key: record.key,
      expectedWriteToken: record.metadata.writeToken,
      expectedSize: record.metadata.size,
      deleteIfMetadataInvalid: false,
      deleteIfMetadataMissing: false
    };
  }
  return {
    key: record.key,
    expectedWriteToken: null,
    expectedSize: 0,
    deleteIfMetadataInvalid: record.metadata !== void 0,
    deleteIfMetadataMissing: record.metadata === void 0
  };
}
function createInstanceToken(now) {
  const random = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(random);
    return [...random].map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  throw cacheError(
    "ASSET_CACHE_CRYPTO_UNAVAILABLE",
    `Secure random values are not available at ${now()}.`
  );
}
async function sha256Hex(bytes, subtleCrypto) {
  const digest = new Uint8Array(await subtleCrypto.digest("SHA-256", bytes));
  return [...digest].map((value) => value.toString(16).padStart(2, "0")).join("");
}
class IndexedDBVerifiedRemoteStore {
  #indexedDB;
  #databaseName;
  #cacheIdentity;
  #now;
  #identityStored = false;
  constructor(indexedDB2, databaseName, cacheIdentity, now) {
    this.#indexedDB = indexedDB2;
    this.#databaseName = databaseName;
    this.#cacheIdentity = cacheIdentity;
    this.#now = now;
  }
  resetIdentityState() {
    this.#identityStored = false;
  }
  async #open() {
    if (!this.#indexedDB || typeof this.#indexedDB.open !== "function") {
      throw cacheError("ASSET_CACHE_INDEXEDDB_UNAVAILABLE", "IndexedDB is not available.");
    }
    let request;
    try {
      request = this.#indexedDB.open(this.#databaseName, DATABASE_VERSION$1);
    } catch (error) {
      throw cacheError("ASSET_CACHE_INDEXEDDB_UNAVAILABLE", "IndexedDB could not be opened.", error);
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const rejectOnce = (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      };
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(ENTRY_STORE)) {
          database.createObjectStore(ENTRY_STORE, { keyPath: "key" });
        }
        let metadata;
        if (!database.objectStoreNames.contains(METADATA_STORE)) {
          metadata = database.createObjectStore(METADATA_STORE, { keyPath: "key" });
        } else {
          metadata = request.transaction.objectStore(METADATA_STORE);
        }
        if (!metadata.indexNames.contains("lastAccessedAt")) {
          metadata.createIndex("lastAccessedAt", "lastAccessedAt");
        }
        if (!database.objectStoreNames.contains(INFO_STORE)) {
          database.createObjectStore(INFO_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        settled = true;
        database.onversionchange = () => database.close();
        if (!this.#cacheIdentity || this.#identityStored) {
          resolve(database);
          return;
        }
        let transaction;
        try {
          transaction = database.transaction(INFO_STORE, "readwrite");
          const record = {
            key: "identity",
            formatVersion: CACHE_FORMAT_VERSION,
            id: this.#cacheIdentity.id,
            label: this.#cacheIdentity.label,
            databaseName: this.#cacheIdentity.databaseName,
            lastOpenedAt: this.#now()
          };
          transaction.objectStore(INFO_STORE).put(record);
        } catch (error) {
          database.close();
          reject(
            cacheError(
              "ASSET_CACHE_IDENTITY_WRITE_FAILED",
              "Cache identity metadata could not be written.",
              error
            )
          );
          return;
        }
        transactionComplete$1(transaction).then(
          () => {
            this.#identityStored = true;
            resolve(database);
          },
          (error) => {
            database.close();
            reject(error);
          }
        );
      };
      request.onerror = () => rejectOnce(
        cacheError(
          "ASSET_CACHE_INDEXEDDB_UNAVAILABLE",
          "IndexedDB open request failed.",
          request.error
        )
      );
      request.onblocked = () => rejectOnce(cacheError("ASSET_CACHE_INDEXEDDB_BLOCKED", "IndexedDB upgrade was blocked."));
    });
  }
  async get(key) {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], "readonly");
      const entryRequest = transaction.objectStore(ENTRY_STORE).get(key);
      const metadataRequest = transaction.objectStore(METADATA_STORE).get(key);
      const [entry, metadata] = await Promise.all([
        requestResult$1(entryRequest),
        requestResult$1(metadataRequest),
        transactionComplete$1(transaction)
      ]);
      return entry === void 0 && metadata === void 0 ? null : { key, entry, metadata };
    } finally {
      database.close();
    }
  }
  async getScanRecord(key) {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], "readonly");
      const entryKeyRequest = transaction.objectStore(ENTRY_STORE).getKey(key);
      const metadataRequest = transaction.objectStore(METADATA_STORE).get(key);
      const [entryKey, metadata] = await Promise.all([
        requestResult$1(entryKeyRequest),
        requestResult$1(metadataRequest),
        transactionComplete$1(transaction)
      ]);
      if (entryKey === void 0 && metadata === void 0) return null;
      return { key, entryPresent: entryKey !== void 0, metadata };
    } finally {
      database.close();
    }
  }
  async putIfAbsentValid(record, signal) {
    assertNotAborted$1(signal);
    const database = await this.#open();
    let transaction = null;
    let completed = false;
    let written = false;
    let synchronousError;
    const abortTransaction = () => {
      if (completed || !transaction) return;
      try {
        transaction.abort();
      } catch {
      }
    };
    try {
      assertNotAborted$1(signal);
      transaction = database.transaction([ENTRY_STORE, METADATA_STORE, INFO_STORE], "readwrite");
      signal?.addEventListener("abort", abortTransaction, { once: true });
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const info = transaction.objectStore(INFO_STORE);
      const entryRequest = entries.get(record.entry.key);
      const metadataRequest = metadata.get(record.metadata.key);
      const revisionRequest = info.get("revision");
      let entryDone = false;
      let metadataDone = false;
      let revisionDone = false;
      const decide = () => {
        if (!entryDone || !metadataDone || !revisionDone || synchronousError) return;
        if (signal?.aborted) {
          abortTransaction();
          return;
        }
        const existingBytes = entryBytes(entryRequest.result, record.entry.key);
        const existingMetadata = metadataRequest.result;
        const existingIsValidSameContent = metadataIsStructurallyValid(existingMetadata) && existingMetadata.integrity === record.metadata.integrity && existingMetadata.size === record.metadata.size && existingMetadata.contentType === record.metadata.contentType && existingBytes?.byteLength === record.metadata.size;
        if (existingIsValidSameContent) return;
        try {
          entries.put(record.entry);
          metadata.put(record.metadata);
          info.put({ key: "revision", value: nextRevision(revisionValue(revisionRequest.result)) });
          written = true;
        } catch (error) {
          synchronousError = error;
          abortTransaction();
        }
      };
      entryRequest.onsuccess = () => {
        entryDone = true;
        decide();
      };
      metadataRequest.onsuccess = () => {
        metadataDone = true;
        decide();
      };
      revisionRequest.onsuccess = () => {
        revisionDone = true;
        decide();
      };
      try {
        await transactionComplete$1(transaction);
        completed = true;
      } catch (error) {
        if (signal?.aborted) throw abortError$1();
        throw synchronousError ?? error;
      }
      if (synchronousError) throw synchronousError;
      return written;
    } finally {
      signal?.removeEventListener("abort", abortTransaction);
      database.close();
    }
  }
  async touch(key, accessedAt, validatedAt) {
    const database = await this.#open();
    try {
      const transaction = database.transaction(METADATA_STORE, "readwrite");
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);
      request.onsuccess = () => {
        if (!metadataIsStructurallyValid(request.result)) return;
        store.put({ ...request.result, lastAccessedAt: accessedAt, lastValidatedAt: validatedAt });
      };
      await transactionComplete$1(transaction);
    } finally {
      database.close();
    }
  }
  async #scanBatch(primaryStore, afterKey, limit) {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], "readonly");
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const primary = primaryStore === ENTRY_STORE ? entries : metadata;
      const records = [];
      let nextKey = null;
      let done = true;
      const cursorRequest = primaryStore === ENTRY_STORE ? primary.openKeyCursor() : primary.openCursor();
      const cursorFinished = new Promise((resolve, reject) => {
        cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("IndexedDB cursor failed."));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor) {
            done = true;
            resolve();
            return;
          }
          if (afterKey !== null) {
            const comparison = this.#indexedDB.cmp(cursor.primaryKey, afterKey);
            if (comparison < 0) {
              cursor.continue(afterKey);
              return;
            }
            if (comparison === 0) {
              cursor.continue();
              return;
            }
          }
          const record = {
            key: cursor.primaryKey,
            entryPresent: primaryStore === ENTRY_STORE,
            metadata: primaryStore === METADATA_STORE ? cursor.value : void 0
          };
          records.push(record);
          const counterpartRequest = primaryStore === ENTRY_STORE ? metadata.get(cursor.primaryKey) : entries.getKey(cursor.primaryKey);
          counterpartRequest.onsuccess = () => {
            if (primaryStore === ENTRY_STORE) record.metadata = counterpartRequest.result;
            else record.entryPresent = counterpartRequest.result !== void 0;
          };
          nextKey = cursor.primaryKey;
          if (records.length >= limit) {
            done = false;
            resolve();
            return;
          }
          cursor.continue();
        };
      });
      await Promise.all([cursorFinished, transactionComplete$1(transaction)]);
      return { records, nextKey, done };
    } finally {
      database.close();
    }
  }
  scanMetadataBatch(afterKey, limit) {
    return this.#scanBatch(METADATA_STORE, afterKey, limit);
  }
  scanEntryBatch(afterKey, limit) {
    return this.#scanBatch(ENTRY_STORE, afterKey, limit);
  }
  async oldestBatch(limit) {
    const database = await this.#open();
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE], "readonly");
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const records = [];
      const cursorRequest = metadata.index("lastAccessedAt").openCursor();
      const cursorFinished = new Promise((resolve, reject) => {
        cursorRequest.onerror = () => reject(cursorRequest.error ?? new Error("IndexedDB LRU cursor failed."));
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result;
          if (!cursor || records.length >= limit) {
            resolve();
            return;
          }
          const record = {
            key: cursor.primaryKey,
            entryPresent: false,
            metadata: cursor.value
          };
          records.push(record);
          const entryRequest = entries.getKey(cursor.primaryKey);
          entryRequest.onsuccess = () => {
            record.entryPresent = entryRequest.result !== void 0;
          };
          cursor.continue();
        };
      });
      await Promise.all([cursorFinished, transactionComplete$1(transaction)]);
      return records;
    } finally {
      database.close();
    }
  }
  async deleteBatch(candidates) {
    if (candidates.length === 0) return { entries: 0, bytes: 0 };
    const database = await this.#open();
    let removedEntries = 0;
    let removedBytes = 0;
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE, INFO_STORE], "readwrite");
      const entries = transaction.objectStore(ENTRY_STORE);
      const metadata = transaction.objectStore(METADATA_STORE);
      const info = transaction.objectStore(INFO_STORE);
      const revisionRequest = info.get("revision");
      let revisionDone = false;
      let revisionWritten = false;
      let remainingCandidates = candidates.length;
      const writeRevisionWhenReady = () => {
        if (!revisionDone || revisionWritten || remainingCandidates !== 0 || removedEntries === 0) {
          return;
        }
        revisionWritten = true;
        info.put({ key: "revision", value: nextRevision(revisionValue(revisionRequest.result)) });
      };
      revisionRequest.onsuccess = () => {
        revisionDone = true;
        writeRevisionWhenReady();
      };
      for (const candidate of candidates) {
        const metadataRequest = metadata.get(candidate.key);
        const entryRequest = entries.getKey(candidate.key);
        let metadataDone = false;
        let entryDone = false;
        let handled = false;
        const deleteIfStillCandidate = () => {
          if (!metadataDone || !entryDone || handled) return;
          handled = true;
          const currentMetadata = metadataRequest.result;
          const currentEntryPresent = entryRequest.result !== void 0;
          const currentWriteToken = currentMetadata && typeof currentMetadata === "object" && !Array.isArray(currentMetadata) ? currentMetadata.writeToken : void 0;
          const candidateStillMatches = candidate.expectedWriteToken !== null && currentWriteToken === candidate.expectedWriteToken || candidate.deleteIfMetadataInvalid && currentMetadata !== void 0 && !metadataIsStructurallyValid(currentMetadata) || candidate.deleteIfMetadataMissing && currentMetadata === void 0;
          if (candidateStillMatches) {
            entries.delete(candidate.key);
            metadata.delete(candidate.key);
            if (currentEntryPresent || currentMetadata !== void 0) removedEntries += 1;
            removedBytes += candidate.expectedSize;
          }
          remainingCandidates -= 1;
          writeRevisionWhenReady();
        };
        metadataRequest.onsuccess = () => {
          metadataDone = true;
          deleteIfStillCandidate();
        };
        entryRequest.onsuccess = () => {
          entryDone = true;
          deleteIfStillCandidate();
        };
      }
      await transactionComplete$1(transaction);
      return { entries: removedEntries, bytes: removedBytes };
    } finally {
      database.close();
    }
  }
  async clear() {
    const database = await this.#open();
    let revision = 0;
    try {
      const transaction = database.transaction([ENTRY_STORE, METADATA_STORE, INFO_STORE], "readwrite");
      const info = transaction.objectStore(INFO_STORE);
      const revisionRequest = info.get("revision");
      revisionRequest.onsuccess = () => {
        revision = nextRevision(revisionValue(revisionRequest.result));
        info.put({ key: "revision", value: revision });
      };
      transaction.objectStore(ENTRY_STORE).clear();
      transaction.objectStore(METADATA_STORE).clear();
      await transactionComplete$1(transaction);
      return revision;
    } finally {
      database.close();
    }
  }
  async revision() {
    const database = await this.#open();
    try {
      const transaction = database.transaction(INFO_STORE, "readonly");
      const request = transaction.objectStore(INFO_STORE).get("revision");
      const [result] = await Promise.all([
        requestResult$1(request),
        transactionComplete$1(transaction)
      ]);
      return revisionValue(result);
    } finally {
      database.close();
    }
  }
  async cleanupInfo() {
    const database = await this.#open();
    try {
      const transaction = database.transaction(INFO_STORE, "readonly");
      const request = transaction.objectStore(INFO_STORE).get("cleanup");
      const [result] = await Promise.all([
        requestResult$1(request),
        transactionComplete$1(transaction)
      ]);
      if (!result || typeof result !== "object" || Array.isArray(result)) return null;
      const candidate = result;
      if (candidate.key !== "cleanup" || !Number.isFinite(candidate.lastCleanupAt) || !Number.isSafeInteger(candidate.removedEntries) || Number(candidate.removedEntries) < 0 || !Number.isSafeInteger(candidate.removedBytes) || Number(candidate.removedBytes) < 0) {
        return null;
      }
      return candidate;
    } finally {
      database.close();
    }
  }
  async recordCleanup(record) {
    const database = await this.#open();
    try {
      const transaction = database.transaction(INFO_STORE, "readwrite");
      transaction.objectStore(INFO_STORE).put(record);
      await transactionComplete$1(transaction);
    } finally {
      database.close();
    }
  }
}
function createVerifiedRemoteBinaryCache(options = {}) {
  const indexedDB2 = options.indexedDB ?? globalThis.indexedDB;
  const subtleCrypto = options.subtleCrypto ?? globalThis.crypto?.subtle;
  if (!subtleCrypto || typeof subtleCrypto.digest !== "function") {
    throw cacheError("ASSET_CACHE_CRYPTO_UNAVAILABLE", "Web Crypto SHA-256 is not available.");
  }
  const now = options.now ?? Date.now;
  if (typeof now !== "function") throw new TypeError("now must be a function.");
  const maxCacheBytes = positiveSafeInteger(
    options.maxCacheBytes ?? DEFAULT_MAX_CACHE_BYTES,
    "maxCacheBytes"
  );
  const quotaFraction = finiteRatio(
    options.quotaFraction ?? DEFAULT_QUOTA_FRACTION,
    "quotaFraction"
  );
  const lowWaterRatio = finiteRatio(
    options.lowWaterRatio ?? DEFAULT_LOW_WATER_RATIO,
    "lowWaterRatio"
  );
  const ttlMs = positiveSafeInteger(options.ttlMs ?? DEFAULT_TTL_MS, "ttlMs");
  const touchIntervalMs = positiveSafeInteger(
    options.touchIntervalMs ?? DEFAULT_TOUCH_INTERVAL_MS,
    "touchIntervalMs"
  );
  const cleanupBatchSize = positiveSafeInteger(
    options.cleanupBatchSize ?? DEFAULT_CLEANUP_BATCH_SIZE,
    "cleanupBatchSize"
  );
  const leaseTtlMs = positiveSafeInteger(
    options.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS$1,
    "leaseTtlMs"
  );
  const catalogHeartbeatIntervalMs = Math.max(1, Math.floor(leaseTtlMs / 2));
  const estimateStorage = options.estimateStorage ?? (typeof globalThis.navigator?.storage?.estimate === "function" ? () => globalThis.navigator.storage.estimate() : async () => ({}));
  if (typeof estimateStorage !== "function") {
    throw new TypeError("estimateStorage must be a function.");
  }
  const cacheIdentity = normalizeCacheIdentity(options.cacheIdentity);
  const databaseName = cacheIdentity?.databaseName ?? DATABASE_NAME;
  const store = new IndexedDBVerifiedRemoteStore(indexedDB2, databaseName, cacheIdentity, now);
  const catalog = new StoryCacheCatalog(indexedDB2, now);
  const instanceToken = createInstanceToken(now);
  let writeSequence = 0;
  let initialSweep = null;
  let catalogInitialized = null;
  let lastCatalogTouchAt = Number.NEGATIVE_INFINITY;
  let leaseHeld = false;
  async function waterMarks() {
    let quotaBudget = maxCacheBytes;
    try {
      const estimate = await estimateStorage();
      if (Number.isFinite(estimate.quota) && Number(estimate.quota) > 0) {
        quotaBudget = Math.max(1, Math.floor(Number(estimate.quota) * quotaFraction));
      }
    } catch {
    }
    const high = Math.min(maxCacheBytes, quotaBudget);
    return { high, low: Math.max(0, Math.floor(high * lowWaterRatio)) };
  }
  async function forEachMetadataBatch(visitor, onlyFirst = false) {
    let afterKey = null;
    while (true) {
      const batch = await store.scanMetadataBatch(afterKey, cleanupBatchSize);
      await visitor(batch.records);
      if (onlyFirst || batch.done || batch.nextKey === null) return;
      afterKey = batch.nextKey;
    }
  }
  async function forEachEntryBatch(visitor, onlyFirst = false) {
    let afterKey = null;
    while (true) {
      const batch = await store.scanEntryBatch(afterKey, cleanupBatchSize);
      await visitor(batch.records);
      if (onlyFirst || batch.done || batch.nextKey === null) return;
      afterKey = batch.nextKey;
    }
  }
  async function cleanupInvalid(onlyFirst = false) {
    const currentTime2 = now();
    let removedEntries = 0;
    let removedBytes = 0;
    await forEachMetadataBatch(async (records) => {
      const candidates = records.filter((record) => !scanRecordIsUsable(record, currentTime2, ttlMs)).map(candidateFor);
      const removed = await store.deleteBatch(candidates);
      removedEntries += removed.entries;
      removedBytes += removed.bytes;
    }, onlyFirst);
    await forEachEntryBatch(async (records) => {
      const candidates = records.filter((record) => record.metadata === void 0).map(candidateFor);
      const removed = await store.deleteBatch(candidates);
      removedEntries += removed.entries;
      removedBytes += removed.bytes;
    }, onlyFirst);
    return { entries: removedEntries, bytes: removedBytes };
  }
  function ensureInitialSweep() {
    initialSweep ??= cleanupInvalid(true).catch((error) => {
      initialSweep = null;
      throw error;
    });
    return initialSweep;
  }
  async function computeStats(warnings = []) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const revisionBefore = await store.revision();
      const currentTime2 = now();
      let entries = 0;
      let bytes = 0;
      let oldestAccessedAt = null;
      let newestAccessedAt = null;
      await forEachMetadataBatch((records) => {
        for (const record of records) {
          if (!scanRecordIsUsable(record, currentTime2, ttlMs)) continue;
          entries += 1;
          bytes += record.metadata.size;
          oldestAccessedAt = oldestAccessedAt === null ? record.metadata.lastAccessedAt : Math.min(oldestAccessedAt, record.metadata.lastAccessedAt);
          newestAccessedAt = newestAccessedAt === null ? record.metadata.lastAccessedAt : Math.max(newestAccessedAt, record.metadata.lastAccessedAt);
        }
      });
      const revisionAfter = await store.revision();
      if (revisionBefore !== revisionAfter) continue;
      const [{ high, low }, cleanup] = await Promise.all([waterMarks(), store.cleanupInfo()]);
      return Object.freeze({
        databaseName,
        cacheIdentity,
        entries,
        bytes,
        oldestAccessedAt,
        newestAccessedAt,
        highWaterBytes: high,
        lowWaterBytes: low,
        lastCleanupAt: cleanup?.lastCleanupAt ?? null,
        lastCleanupRemovedEntries: cleanup?.removedEntries ?? 0,
        lastCleanupRemovedBytes: cleanup?.removedBytes ?? 0,
        warnings: Object.freeze([...warnings]),
        statsRevision: revisionAfter
      });
    }
    throw cacheError(
      "ASSET_CACHE_STATS_UNSTABLE",
      "Cache statistics changed repeatedly while they were being measured."
    );
  }
  async function updateCatalog(stats, accessedAt = now()) {
    if (!cacheIdentity) return;
    await catalog.upsertAndRenewLease(
      cacheIdentity,
      {
        entries: stats.entries,
        bytes: stats.bytes,
        lastCleanupAt: stats.lastCleanupAt,
        revision: stats.statsRevision
      },
      accessedAt,
      instanceToken,
      accessedAt + leaseTtlMs
    );
    leaseHeld = true;
    lastCatalogTouchAt = Math.max(lastCatalogTouchAt, accessedAt);
  }
  async function touchCatalog(accessedAt) {
    if (!cacheIdentity) return;
    if (leaseHeld && accessedAt - lastCatalogTouchAt < catalogHeartbeatIntervalMs) return;
    await catalog.touchAndRenewLease(
      cacheIdentity,
      accessedAt,
      instanceToken,
      accessedAt + leaseTtlMs
    );
    leaseHeld = true;
    lastCatalogTouchAt = accessedAt;
  }
  async function ensureCatalog() {
    if (!cacheIdentity) return;
    catalogInitialized ??= Promise.resolve().then(async () => {
      const accessedAt = now();
      try {
        await catalog.acquireLease(
          cacheIdentity,
          accessedAt,
          instanceToken,
          accessedAt + leaseTtlMs
        );
      } catch (error) {
        if (diagnosticCode(error, "") !== "ASSET_CACHE_DATABASE_DELETION_STALE") throw error;
        await catalog.delete(
          databaseName,
          `${instanceToken}:recover-delete:${++writeSequence}`
        );
        store.resetIdentityState();
        initialSweep = null;
        await catalog.acquireLease(
          cacheIdentity,
          accessedAt,
          instanceToken,
          accessedAt + leaseTtlMs
        );
      }
      leaseHeld = true;
      lastCatalogTouchAt = accessedAt;
      const stats = await computeStats();
      await updateCatalog(stats, accessedAt);
    }).catch((error) => {
      catalogInitialized = null;
      throw error;
    });
    await catalogInitialized;
    await touchCatalog(now());
  }
  async function pruneCatalog(incomingBytes = 0, force = false) {
    const { high, low } = await waterMarks();
    return catalog.prune({
      highWaterBytes: high,
      lowWaterBytes: low,
      ttlMs,
      incomingBytes,
      pinnedDatabaseName: cacheIdentity?.databaseName ?? null,
      force,
      createDeletionToken: () => `${instanceToken}:prune:${++writeSequence}`
    });
  }
  async function physicalEntryStats() {
    let entries = 0;
    let bytes = 0;
    await forEachEntryBatch((records) => {
      for (const record of records) {
        entries += 1;
        if (record.entryPresent && metadataIsStructurallyValid(record.metadata)) {
          bytes += record.metadata.size;
        }
      }
    });
    return { entries, bytes };
  }
  async function pruneFor(incomingBytes = 0, pinnedKey = null, force = false, budget) {
    const warnings = [];
    const invalidRemoved = await cleanupInvalid();
    let stats = await computeStats();
    let removedEntries = invalidRemoved.entries;
    let removedBytes = invalidRemoved.bytes;
    let replacedBytes = 0;
    if (pinnedKey) {
      const existing = await store.getScanRecord(pinnedKey);
      if (existing && scanRecordIsUsable(existing, now(), ttlMs)) {
        replacedBytes = existing.metadata.size;
      }
    }
    const effectiveIncomingBytes = Math.max(0, incomingBytes - replacedBytes);
    const effectiveHighWaterBytes = budget?.high ?? stats.highWaterBytes;
    const effectiveLowWaterBytes = Math.min(
      effectiveHighWaterBytes,
      budget?.low ?? stats.lowWaterBytes
    );
    const target = Math.max(
      0,
      Math.min(effectiveLowWaterBytes, effectiveHighWaterBytes - effectiveIncomingBytes)
    );
    if (force || stats.bytes + effectiveIncomingBytes > effectiveHighWaterBytes) {
      while (stats.bytes > target) {
        const oldest = await store.oldestBatch(cleanupBatchSize + 1);
        const candidates = [];
        let selectedBytes = 0;
        for (const record of oldest) {
          if (record.key === pinnedKey || !scanRecordIsUsable(record, now(), ttlMs)) continue;
          candidates.push(candidateFor(record));
          selectedBytes += record.metadata.size;
          if (stats.bytes - selectedBytes <= target || candidates.length >= cleanupBatchSize) break;
        }
        if (candidates.length === 0) break;
        const removed = await store.deleteBatch(candidates);
        removedEntries += removed.entries;
        removedBytes += removed.bytes;
        if (removed.entries === 0) break;
        stats = await computeStats();
      }
    }
    const after = await computeStats();
    const cleanupAt = now();
    await store.recordCleanup({
      key: "cleanup",
      lastCleanupAt: cleanupAt,
      removedEntries,
      removedBytes
    });
    await updateCatalog({ ...after, lastCleanupAt: cleanupAt }).catch((error) => {
      addWarning(warnings, "cleanup", diagnosticCode(error, "ASSET_CACHE_CATALOG_FAILED"));
    });
    return Object.freeze({
      databaseName,
      cacheIdentity,
      removedEntries,
      removedBytes,
      remainingEntries: after.entries,
      remainingBytes: after.bytes,
      highWaterBytes: after.highWaterBytes,
      lowWaterBytes: after.lowWaterBytes,
      warnings: Object.freeze(warnings)
    });
  }
  async function currentOriginBudget(incomingBytes, force = false) {
    const current = await computeStats();
    await updateCatalog(current);
    const pruned = await pruneCatalog(incomingBytes, force);
    const otherStoryBytes = Math.max(0, pruned.remainingBytes - current.bytes);
    const { high, low } = await waterMarks();
    return {
      high: Math.max(0, high - otherStoryBytes),
      low: Math.max(0, low - otherStoryBytes),
      warnings: pruned.warnings.map((code) => ({ operation: "cleanup", code }))
    };
  }
  async function verifyBytes(bytes, input, actualContentType) {
    if (bytes.byteLength !== input.size) {
      throw cacheError(
        "ASSET_CACHE_SIZE_MISMATCH",
        `Remote binary size mismatch: expected ${input.size}, received ${bytes.byteLength}.`
      );
    }
    if (normalizeContentType(actualContentType) !== input.contentType) {
      throw cacheError(
        "ASSET_CACHE_CONTENT_TYPE_MISMATCH",
        `Remote binary Content-Type mismatch: expected ${input.contentType}.`
      );
    }
    const actualIntegrity = `sha256-${await sha256Hex(bytes, subtleCrypto)}`;
    if (actualIntegrity !== input.integrity) {
      throw cacheError("ASSET_CACHE_INTEGRITY_MISMATCH", "Remote binary integrity mismatch.");
    }
  }
  async function readCached(input) {
    const key = `${CACHE_FORMAT_VERSION}:${input.integrity}`;
    const record = await store.get(key);
    if (!record) return { status: "miss" };
    const currentTime2 = now();
    const bytes = entryBytes(record.entry, key);
    const metadataMatches = recordIsUsable(record, currentTime2, ttlMs) && record.metadata.integrity === input.integrity && record.metadata.size === input.size && record.metadata.contentType === input.contentType && bytes?.byteLength === input.size;
    if (!metadataMatches || !bytes) {
      await store.deleteBatch([candidateFor(record)]);
      return { status: "invalid" };
    }
    try {
      await verifyBytes(bytes, input, record.metadata.contentType);
    } catch {
      await store.deleteBatch([candidateFor(record)]);
      return { status: "invalid" };
    }
    if (currentTime2 - record.metadata.lastAccessedAt >= touchIntervalMs) {
      await store.touch(key, currentTime2, currentTime2).catch(() => {
      });
    }
    return { status: "hit", bytes };
  }
  async function writeCached(input, bytes, signal) {
    const key = `${CACHE_FORMAT_VERSION}:${input.integrity}`;
    const { high } = await waterMarks();
    if (bytes.byteLength > high) {
      return {
        status: "skipped",
        writeToken: null,
        warnings: [{ operation: "write", code: "ASSET_CACHE_ENTRY_OVER_BUDGET" }]
      };
    }
    const writeToken = `${instanceToken}:${++writeSequence}`;
    const write = async () => {
      assertNotAborted$1(signal);
      const timestamp = now();
      const written = await store.putIfAbsentValid(
        {
          entry: { key, data: bytes.buffer },
          metadata: {
            formatVersion: CACHE_FORMAT_VERSION,
            key,
            integrity: input.integrity,
            size: input.size,
            contentType: input.contentType,
            createdAt: timestamp,
            lastAccessedAt: timestamp,
            lastValidatedAt: timestamp,
            writeToken
          }
        },
        signal
      );
      return written;
    };
    const catalogWarnings = [];
    const appendWarnings = (target, additions) => {
      for (const warning of additions) addWarning(target, warning.operation, warning.code);
    };
    const budgetFor = async (incomingBytes, force = false) => {
      const fallback = await waterMarks();
      if (!cacheIdentity) return fallback;
      try {
        const origin = await currentOriginBudget(incomingBytes, force);
        appendWarnings(catalogWarnings, origin.warnings);
        return { high: origin.high, low: origin.low };
      } catch (error) {
        const code = diagnosticCode(error, "ASSET_CACHE_CATALOG_FAILED");
        addWarning(catalogWarnings, "cleanup", code);
        return code === "ASSET_CACHE_DATABASE_DELETING" ? { high: 0, low: 0 } : fallback;
      }
    };
    const enforcePostWriteBudget = async (warnings) => {
      const budget = await budgetFor(0);
      appendWarnings(warnings, catalogWarnings);
      const pinned = await pruneFor(0, key, false, budget);
      appendWarnings(warnings, pinned.warnings);
      if (pinned.remainingBytes <= budget.high) return true;
      addWarning(warnings, "write", "ASSET_CACHE_ORIGIN_BUDGET_PINNED");
      const unpinned = await pruneFor(0, null, false, budget);
      appendWarnings(warnings, unpinned.warnings);
      return await store.getScanRecord(key) !== null;
    };
    let writeBudget = await budgetFor(bytes.byteLength);
    if (bytes.byteLength > writeBudget.high) {
      addWarning(catalogWarnings, "write", "ASSET_CACHE_ORIGIN_BUDGET_PINNED");
      return { status: "skipped", writeToken: null, warnings: catalogWarnings };
    }
    try {
      const beforeWrite = await pruneFor(bytes.byteLength, key, false, writeBudget);
      appendWarnings(catalogWarnings, beforeWrite.warnings);
      const written = await write();
      if (signal?.aborted) {
        if (written) {
          await store.deleteBatch([
            {
              key,
              expectedWriteToken: writeToken,
              expectedSize: input.size,
              deleteIfMetadataInvalid: false,
              deleteIfMetadataMissing: false
            }
          ]).catch(() => {
          });
        }
        throw abortError$1();
      }
      const warnings = [...catalogWarnings];
      const retained = await enforcePostWriteBudget(warnings).catch((error) => {
        addWarning(warnings, "cleanup", diagnosticCode(error, "ASSET_CACHE_CLEANUP_FAILED"));
        return true;
      });
      return {
        status: retained ? "stored" : "skipped",
        writeToken: retained && written ? writeToken : null,
        warnings
      };
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (!isQuotaExceeded(error)) {
        return {
          status: "failed",
          writeToken: null,
          warnings: [
            ...catalogWarnings,
            { operation: "write", code: diagnosticCode(error, "ASSET_CACHE_WRITE_FAILED") }
          ]
        };
      }
      try {
        writeBudget = await budgetFor(bytes.byteLength, true);
        if (bytes.byteLength > writeBudget.high) {
          addWarning(catalogWarnings, "write", "ASSET_CACHE_ORIGIN_BUDGET_PINNED");
          return { status: "skipped", writeToken: null, warnings: catalogWarnings };
        }
        const beforeRetry = await pruneFor(bytes.byteLength, key, true, writeBudget);
        appendWarnings(catalogWarnings, beforeRetry.warnings);
        const written = await write();
        const warnings = [...catalogWarnings];
        const retained = await enforcePostWriteBudget(warnings).catch((error2) => {
          addWarning(warnings, "cleanup", diagnosticCode(error2, "ASSET_CACHE_CLEANUP_FAILED"));
          return true;
        });
        return {
          status: retained ? "stored" : "skipped",
          writeToken: retained && written ? writeToken : null,
          warnings
        };
      } catch (retryError) {
        if (isAbortError(retryError)) throw retryError;
        return {
          status: "failed",
          writeToken: null,
          warnings: [
            ...catalogWarnings,
            { operation: "write", code: diagnosticCode(retryError, "ASSET_CACHE_QUOTA_EXCEEDED") }
          ]
        };
      }
    }
  }
  function addWarning(warnings, operation, code) {
    if (warnings.some((warning) => warning.operation === operation && warning.code === code)) return;
    warnings.push(Object.freeze({ operation, code }));
  }
  const cache = {
    async resolve(input, resolveOptions) {
      if (!resolveOptions || typeof resolveOptions !== "object" || Array.isArray(resolveOptions)) {
        throw new TypeError("Verified remote binary resolve options must be an object.");
      }
      if (typeof resolveOptions.load !== "function") {
        throw new TypeError("Verified remote binary resolve options must provide load.");
      }
      const normalized = normalizeInput$1(input);
      const warnings = [];
      let persistentCacheAvailable = true;
      assertNotAborted$1(resolveOptions.signal);
      if (cacheIdentity) {
        try {
          await ensureCatalog();
        } catch (error) {
          const code = diagnosticCode(error, "ASSET_CACHE_CATALOG_FAILED");
          addWarning(warnings, "cleanup", code);
          if (code === "ASSET_CACHE_DATABASE_DELETING") persistentCacheAvailable = false;
        }
      }
      if (persistentCacheAvailable) {
        try {
          await ensureInitialSweep();
        } catch (error) {
          if (isAbortError(error)) throw error;
          addWarning(warnings, "cleanup", diagnosticCode(error, "ASSET_CACHE_CLEANUP_FAILED"));
        }
      }
      let cacheRead = persistentCacheAvailable ? "miss" : "failed";
      if (persistentCacheAvailable) {
        try {
          const cached = await readCached(normalized);
          cacheRead = cached.status;
          if (cached.status === "hit" && cached.bytes) {
            if (cacheIdentity) {
              await touchCatalog(now()).catch((error) => {
                addWarning(
                  warnings,
                  "cleanup",
                  diagnosticCode(error, "ASSET_CACHE_CATALOG_FAILED")
                );
              });
            }
            assertNotAborted$1(resolveOptions.signal);
            return Object.freeze({
              bytes: cached.bytes,
              contentType: normalized.contentType,
              integrity: normalized.integrity,
              source: "indexeddb",
              cacheRead,
              cacheWrite: "not-needed",
              cacheWarnings: Object.freeze([...warnings])
            });
          }
        } catch (error) {
          if (isAbortError(error)) throw error;
          cacheRead = "failed";
          addWarning(warnings, "read", diagnosticCode(error, "ASSET_CACHE_READ_FAILED"));
        }
      }
      assertNotAborted$1(resolveOptions.signal);
      const loaded = await resolveOptions.load(
        normalized,
        Object.freeze(
          resolveOptions.signal === void 0 ? {} : { signal: resolveOptions.signal }
        )
      );
      assertNotAborted$1(resolveOptions.signal);
      if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) {
        throw cacheError("ASSET_CACHE_LOAD_INVALID", "Remote binary loader returned no result.");
      }
      const bytes = takeBytes(loaded.bytes, loaded.transferOwnership === true);
      await verifyBytes(bytes, normalized, loaded.contentType);
      assertNotAborted$1(resolveOptions.signal);
      const writeResult = persistentCacheAvailable ? await writeCached(normalized, bytes, resolveOptions.signal) : { status: "skipped", writeToken: null, warnings: [] };
      for (const warning of writeResult.warnings) {
        addWarning(warnings, warning.operation, warning.code);
      }
      if (resolveOptions.signal?.aborted) {
        if (writeResult.writeToken) {
          await store.deleteBatch([
            {
              key: `${CACHE_FORMAT_VERSION}:${normalized.integrity}`,
              expectedWriteToken: writeResult.writeToken,
              expectedSize: normalized.size,
              deleteIfMetadataInvalid: false,
              deleteIfMetadataMissing: false
            }
          ]).catch(() => {
          });
        }
        throw abortError$1();
      }
      return Object.freeze({
        bytes,
        contentType: normalized.contentType,
        integrity: normalized.integrity,
        source: "network",
        cacheRead,
        cacheWrite: writeResult.status,
        cacheWarnings: Object.freeze([...warnings])
      });
    },
    async getStats() {
      if (cacheIdentity) await ensureCatalog();
      const pruned = await pruneFor();
      return computeStats(pruned.warnings);
    },
    async prune() {
      if (cacheIdentity) await ensureCatalog();
      return pruneFor();
    },
    async clear() {
      if (cacheIdentity) await ensureCatalog();
      const warnings = [];
      const before = await physicalEntryStats();
      const statsRevision = await store.clear();
      const cleanupAt = now();
      await store.recordCleanup({
        key: "cleanup",
        lastCleanupAt: cleanupAt,
        removedEntries: before.entries,
        removedBytes: before.bytes
      });
      await updateCatalog({ entries: 0, bytes: 0, lastCleanupAt: cleanupAt, statsRevision }).catch(
        (error) => {
          addWarning(warnings, "cleanup", diagnosticCode(error, "ASSET_CACHE_CATALOG_FAILED"));
        }
      );
      const { high, low } = await waterMarks();
      return Object.freeze({
        databaseName,
        cacheIdentity,
        removedEntries: before.entries,
        removedBytes: before.bytes,
        remainingEntries: 0,
        remainingBytes: 0,
        highWaterBytes: high,
        lowWaterBytes: low,
        warnings: Object.freeze(warnings)
      });
    },
    listStoryCaches() {
      return catalog.list();
    },
    pruneStoryCaches() {
      return pruneCatalog();
    },
    async deleteStoryCache(value) {
      const target = normalizeStoryDatabaseName(value);
      const result = await catalog.delete(target, `${instanceToken}:delete:${++writeSequence}`);
      if (result.deleted && target === databaseName) {
        store.resetIdentityState();
        initialSweep = null;
        catalogInitialized = null;
        lastCatalogTouchAt = Number.NEGATIVE_INFINITY;
        leaseHeld = false;
      }
      return result;
    },
    renewStoryCacheLease() {
      return leaseHeld ? touchCatalog(now()) : ensureCatalog();
    },
    async releaseStoryCacheLease() {
      if (!cacheIdentity || !leaseHeld) return;
      await catalog.releaseLease(databaseName, instanceToken);
      leaseHeld = false;
      catalogInitialized = null;
      lastCatalogTouchAt = Number.NEGATIVE_INFINITY;
    }
  };
  return Object.freeze(cache);
}
const DEFAULT_DATABASE_NAME = "tw-asset-manager-session-binary-v1";
const DATABASE_VERSION = 1;
const SESSION_STORE = "sessions";
const BUNDLE_STORE = "sessionBinaryBundles";
const SESSION_ID_INDEX = "sessionId";
const EXPIRES_AT_INDEX = "expiresAt";
const FORMAT_VERSION = 1;
const DEFAULT_MAX_FILES_PER_ASSET = 256;
const DEFAULT_MAX_ASSET_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_SESSION_ASSETS = 4096;
const DEFAULT_MAX_SESSION_BYTES = 512 * 1024 * 1024;
const DEFAULT_LEASE_TTL_MS = 5 * 6e4;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 6e4;
const DEFAULT_ORPHAN_CLEANUP_BATCH_SIZE = 8;
const MAX_SESSION_ID_LENGTH = 256;
const MAX_NAMESPACE_LENGTH = 512;
const MAX_NAME_LENGTH = 256;
const MAX_PATH_LENGTH = 1024;
const MAX_DATABASE_NAME_LENGTH = 256;
function sessionError(code, message, cause) {
  const error = new Error(message, cause === void 0 ? void 0 : { cause });
  Object.defineProperty(error, "code", { value: code, enumerable: true });
  return error;
}
function errorCode(error) {
  return error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "";
}
function abortError(cause) {
  const error = sessionError(
    "ASSET_SESSION_BINARY_ABORTED",
    "Session binary backing operation was aborted.",
    cause
  );
  error.name = "AbortError";
  return error;
}
function assertNotAborted(signal) {
  if (signal?.aborted) throw abortError(signal.reason);
}
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw sessionError("ASSET_SESSION_BINARY_INPUT_INVALID", `${label} must be an object.`);
  }
  return value;
}
function requireSourceRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw sessionError("ASSET_SESSION_BINARY_SOURCE_INVALID", `${label} must be an object.`);
  }
  return value;
}
function requireString(value, label, maxLength) {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || value.includes("\0")) {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      `${label} must be a non-empty string of at most ${maxLength} code units.`
    );
  }
  return value;
}
function requireLimit(value, fallback, label) {
  const normalized = value ?? fallback;
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new TypeError(`${label} must be a positive safe integer.`);
  }
  return normalized;
}
function currentTime(now) {
  const value = now();
  if (!Number.isSafeInteger(value) || value < 0) {
    throw sessionError(
      "ASSET_SESSION_BINARY_CLOCK_INVALID",
      "Session binary backing clock must return a non-negative safe integer."
    );
  }
  return value;
}
function isLowerHexSha256(value) {
  if (value.length !== 64) return false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (!(code >= 48 && code <= 57 || code >= 97 && code <= 102)) return false;
  }
  return true;
}
function toBase64(bytes) {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary);
}
function integrityIsCanonical(value) {
  if (!value.startsWith("sha256-")) return false;
  const payload = value.slice("sha256-".length);
  if (isLowerHexSha256(payload)) return true;
  try {
    const decoded = Uint8Array.from(atob(payload), (character) => character.charCodeAt(0));
    return decoded.byteLength === 32 && toBase64(decoded) === payload;
  } catch {
    return false;
  }
}
function normalizeIntegrity(value, label) {
  const integrity = requireString(value, label, 96);
  if (!integrityIsCanonical(integrity)) {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      `${label} must contain canonical SHA-256 hex or base64.`
    );
  }
  return integrity;
}
function pathIsSafe(path) {
  return Boolean(
    path.length > 0 && path.length <= MAX_PATH_LENGTH && !path.startsWith("/") && !path.startsWith("\\") && !path.includes("\\") && !path.split("/").some((part) => part.length === 0 || part === "." || part === "..")
  );
}
function normalizePath(value) {
  const path = requireString(value, "session binary file path", MAX_PATH_LENGTH);
  if (!pathIsSafe(path)) {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      "Session binary file path must be a safe relative path."
    );
  }
  return path;
}
function lookupKey(namespace, name, integrity) {
  return JSON.stringify([namespace, name, integrity]);
}
function normalizeKey(input) {
  requireRecord(input, "session binary asset key");
  const namespace = requireString(
    input.namespace,
    "session binary asset namespace",
    MAX_NAMESPACE_LENGTH
  );
  const name = requireString(input.name, "session binary asset name", MAX_NAME_LENGTH);
  const integrity = normalizeIntegrity(input.integrity, "session binary asset integrity");
  return { namespace, name, integrity, lookupKey: lookupKey(namespace, name, integrity) };
}
function normalizeFileRegistration(value) {
  const file = requireRecord(value, "session binary file descriptor");
  const path = normalizePath(file.path);
  if (!Number.isSafeInteger(file.size) || Number(file.size) < 0) {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      `Session binary file size is invalid: ${path}`
    );
  }
  return {
    path,
    size: Number(file.size),
    integrity: normalizeIntegrity(file.integrity, `session binary file integrity for ${path}`)
  };
}
function ownBytes(value) {
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (value instanceof Uint8Array) return Uint8Array.from(value);
  throw sessionError(
    "ASSET_SESSION_BINARY_SOURCE_INVALID",
    "Session binary source bytes must be an ArrayBuffer or Uint8Array."
  );
}
function normalizeOptions(options) {
  requireRecord(options, "session binary backing options");
  const databaseName = requireString(
    options.databaseName ?? DEFAULT_DATABASE_NAME,
    "session binary database name",
    MAX_DATABASE_NAME_LENGTH
  );
  const leaseTtlMs = requireLimit(options.leaseTtlMs, DEFAULT_LEASE_TTL_MS, "leaseTtlMs");
  const heartbeatIntervalMs = requireLimit(
    options.heartbeatIntervalMs,
    DEFAULT_HEARTBEAT_INTERVAL_MS,
    "heartbeatIntervalMs"
  );
  if (heartbeatIntervalMs >= leaseTtlMs) {
    throw new TypeError("heartbeatIntervalMs must be less than leaseTtlMs.");
  }
  return {
    indexedDB: options.indexedDB ?? globalThis.indexedDB,
    subtleCrypto: options.subtleCrypto ?? globalThis.crypto?.subtle,
    databaseName,
    now: options.now ?? Date.now,
    maxFilesPerAsset: requireLimit(
      options.maxFilesPerAsset,
      DEFAULT_MAX_FILES_PER_ASSET,
      "maxFilesPerAsset"
    ),
    maxAssetBytes: requireLimit(
      options.maxAssetBytes,
      DEFAULT_MAX_ASSET_BYTES,
      "maxAssetBytes"
    ),
    maxSessionAssets: requireLimit(
      options.maxSessionAssets,
      DEFAULT_MAX_SESSION_ASSETS,
      "maxSessionAssets"
    ),
    maxSessionBytes: requireLimit(
      options.maxSessionBytes,
      DEFAULT_MAX_SESSION_BYTES,
      "maxSessionBytes"
    ),
    leaseTtlMs,
    heartbeatIntervalMs,
    orphanCleanupBatchSize: requireLimit(
      options.orphanCleanupBatchSize,
      DEFAULT_ORPHAN_CLEANUP_BATCH_SIZE,
      "orphanCleanupBatchSize"
    )
  };
}
function normalizeInput(input, limits) {
  requireRecord(input, "session binary backing input");
  if (input.policy !== "prefer" && input.policy !== "required" && input.policy !== "disabled") {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      "Session binary backing policy must be prefer, required, or disabled."
    );
  }
  const sessionId = requireString(
    input.sessionId,
    "session binary session ID",
    MAX_SESSION_ID_LENGTH
  );
  if (!Array.isArray(input.assets) || input.assets.length === 0) {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      "Session binary backing assets must be a non-empty array."
    );
  }
  if (input.assets.length > limits.maxSessionAssets) {
    throw sessionError(
      "ASSET_SESSION_BINARY_LIMIT_EXCEEDED",
      "Session binary backing exceeds maxSessionAssets."
    );
  }
  if (!input.source || typeof input.source !== "object" || typeof input.source.read !== "function" || typeof input.source.release !== "function") {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      "Session binary backing source must provide read and release."
    );
  }
  if (input.onFatalError !== void 0 && typeof input.onFatalError !== "function") {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      "Session binary onFatalError must be a function."
    );
  }
  const assets = [];
  const assetsByKey = /* @__PURE__ */ new Map();
  let sessionBytes = 0;
  for (const inputAsset of input.assets) {
    const key = normalizeKey(inputAsset);
    if (!Array.isArray(inputAsset.files) || inputAsset.files.length === 0) {
      throw sessionError(
        "ASSET_SESSION_BINARY_INPUT_INVALID",
        `Session binary asset must contain files: ${key.name}`
      );
    }
    if (inputAsset.files.length > limits.maxFilesPerAsset) {
      throw sessionError(
        "ASSET_SESSION_BINARY_LIMIT_EXCEEDED",
        `Session binary asset exceeds maxFilesPerAsset: ${key.name}`
      );
    }
    const paths = /* @__PURE__ */ new Set();
    const files = inputAsset.files.map((file) => {
      const normalized = normalizeFileRegistration(file);
      if (paths.has(normalized.path)) {
        throw sessionError(
          "ASSET_SESSION_BINARY_INPUT_INVALID",
          `Session binary asset contains a duplicate path: ${normalized.path}`
        );
      }
      paths.add(normalized.path);
      return normalized;
    });
    files.sort(
      (left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0
    );
    const totalBytes = files.reduce(
      (sum, file) => sum + file.size,
      0
    );
    if (!Number.isSafeInteger(totalBytes) || totalBytes > limits.maxAssetBytes) {
      throw sessionError(
        "ASSET_SESSION_BINARY_LIMIT_EXCEEDED",
        `Session binary asset exceeds maxAssetBytes: ${key.name}`
      );
    }
    sessionBytes += totalBytes;
    if (!Number.isSafeInteger(sessionBytes) || sessionBytes > limits.maxSessionBytes) {
      throw sessionError(
        "ASSET_SESSION_BINARY_LIMIT_EXCEEDED",
        "Session binary backing exceeds maxSessionBytes."
      );
    }
    if (assetsByKey.has(key.lookupKey)) {
      throw sessionError(
        "ASSET_SESSION_BINARY_INPUT_INVALID",
        `Session binary backing contains a duplicate asset: ${key.name}`
      );
    }
    const asset = { ...key, files, totalBytes };
    assets.push(asset);
    assetsByKey.set(key.lookupKey, asset);
  }
  assets.sort(
    (left, right) => left.lookupKey < right.lookupKey ? -1 : left.lookupKey > right.lookupKey ? 1 : 0
  );
  return {
    policy: input.policy,
    sessionId,
    assets,
    assetsByKey,
    source: input.source,
    ...input.onFatalError === void 0 ? {} : { onFatalError: input.onFatalError }
  };
}
function operationSignal(options) {
  requireRecord(options, "session binary operation options");
  if (options.signal === void 0) return void 0;
  const signal = options.signal;
  if (!signal || typeof signal !== "object" || typeof signal.aborted !== "boolean" || typeof signal.addEventListener !== "function" || typeof signal.removeEventListener !== "function") {
    throw sessionError(
      "ASSET_SESSION_BINARY_INPUT_INVALID",
      "Session binary operation signal must be an AbortSignal."
    );
  }
  return signal;
}
function linkSignals(external, internal) {
  if (!external) return { signal: internal, release() {
  } };
  const controller = new AbortController();
  const abort = () => controller.abort();
  external.addEventListener("abort", abort, { once: true });
  internal.addEventListener("abort", abort, { once: true });
  if (external.aborted || internal.aborted) abort();
  return {
    signal: controller.signal,
    release() {
      external.removeEventListener("abort", abort);
      internal.removeEventListener("abort", abort);
    }
  };
}
function toHex(bytes) {
  return [...bytes].map((value) => value.toString(16).padStart(2, "0")).join("");
}
async function verifyIntegrity(bytes, integrity, subtleCrypto, code) {
  if (!subtleCrypto || typeof subtleCrypto.digest !== "function") {
    throw sessionError(
      "ASSET_SESSION_BINARY_CRYPTO_UNAVAILABLE",
      "SHA-256 is not available for session binary verification."
    );
  }
  let digest;
  try {
    digest = new Uint8Array(await subtleCrypto.digest("SHA-256", bytes));
  } catch (error) {
    throw sessionError(
      "ASSET_SESSION_BINARY_CRYPTO_FAILED",
      "SHA-256 verification failed for session binary bytes.",
      error
    );
  }
  const expected = integrity.slice("sha256-".length);
  const actual = isLowerHexSha256(expected) ? toHex(digest) : toBase64(digest);
  if (actual !== expected) {
    throw sessionError(code, "Session binary file integrity does not match its bytes.");
  }
}
async function readSourceAsset(source, asset, subtleCrypto, signal) {
  assertNotAborted(signal);
  const publicAsset = Object.freeze({
    namespace: asset.namespace,
    name: asset.name,
    integrity: asset.integrity,
    files: Object.freeze(asset.files.map((file) => Object.freeze({ ...file })))
  });
  let loaded;
  try {
    loaded = await source.read(publicAsset, { signal });
  } catch (error) {
    if (signal.aborted) throw abortError(error);
    if (errorCode(error).startsWith("ASSET_SESSION_BINARY_SOURCE_")) throw error;
    throw sessionError(
      "ASSET_SESSION_BINARY_SOURCE_READ_FAILED",
      `Session binary source could not read asset: ${asset.name}`,
      error
    );
  }
  const loadedRecord = requireSourceRecord(loaded, "session binary source asset");
  if (loadedRecord.namespace !== asset.namespace || loadedRecord.name !== asset.name || loadedRecord.integrity !== asset.integrity || !Array.isArray(loadedRecord.files) || loadedRecord.files.length !== asset.files.length) {
    throw sessionError(
      "ASSET_SESSION_BINARY_SOURCE_INVALID",
      `Session binary source metadata does not match: ${asset.name}`
    );
  }
  const expectedByPath = new Map(asset.files.map((file) => [file.path, file]));
  const seen = /* @__PURE__ */ new Set();
  const files = [];
  for (const loadedFile of loadedRecord.files) {
    const record = requireSourceRecord(loadedFile, "session binary source file");
    const path = typeof record.path === "string" ? record.path : "";
    const expected = expectedByPath.get(path);
    if (!expected || seen.has(path) || record.size !== expected.size || record.integrity !== expected.integrity) {
      throw sessionError(
        "ASSET_SESSION_BINARY_SOURCE_INVALID",
        `Session binary source file metadata does not match: ${asset.name}`
      );
    }
    seen.add(path);
    const bytes = ownBytes(record.bytes);
    if (bytes.byteLength !== expected.size) {
      throw sessionError(
        "ASSET_SESSION_BINARY_SOURCE_INVALID",
        `Session binary source file size does not match: ${asset.name}/${path}`
      );
    }
    await verifyIntegrity(
      bytes,
      expected.integrity,
      subtleCrypto,
      "ASSET_SESSION_BINARY_SOURCE_INTEGRITY_MISMATCH"
    );
    files.push({ ...expected, bytes });
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  assertNotAborted(signal);
  return files;
}
function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}
function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
  });
}
function isDomException(error, name) {
  return error instanceof DOMException && error.name === name;
}
function mapStorageError(error, operation, signal) {
  if (signal?.aborted || isDomException(error, "AbortError")) return abortError(error);
  if (errorCode(error).startsWith("ASSET_SESSION_BINARY_")) return error;
  if (isDomException(error, "QuotaExceededError")) {
    return sessionError(
      "ASSET_SESSION_BINARY_QUOTA_EXCEEDED",
      `Session binary ${operation} exceeded IndexedDB quota.`,
      error
    );
  }
  if (isDomException(error, "InvalidStateError")) {
    return sessionError(
      "ASSET_SESSION_BINARY_CONNECTION_CLOSED",
      `Session binary ${operation} used a closed IndexedDB connection.`,
      error
    );
  }
  return sessionError(
    "ASSET_SESSION_BINARY_TRANSACTION_FAILED",
    `Session binary ${operation} transaction failed.`,
    error
  );
}
async function openDatabase(options, signal) {
  assertNotAborted(signal);
  const indexedDB2 = options.indexedDB;
  if (!indexedDB2 || typeof indexedDB2.open !== "function") {
    throw sessionError(
      "ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE",
      "IndexedDB is not available for session binary backing."
    );
  }
  let request;
  try {
    request = indexedDB2.open(options.databaseName, DATABASE_VERSION);
  } catch (error) {
    throw sessionError(
      "ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE",
      "The session binary IndexedDB database could not be opened.",
      error
    );
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const abort = () => rejectOnce(abortError(signal?.reason));
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      reject(error);
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    request.onupgradeneeded = () => {
      const database = request.result;
      let sessions;
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        sessions = database.createObjectStore(SESSION_STORE, { keyPath: "sessionId" });
      } else {
        sessions = request.transaction.objectStore(SESSION_STORE);
      }
      if (!sessions.indexNames.contains(EXPIRES_AT_INDEX)) {
        sessions.createIndex(EXPIRES_AT_INDEX, "expiresAt");
      }
      let bundles;
      if (!database.objectStoreNames.contains(BUNDLE_STORE)) {
        bundles = database.createObjectStore(BUNDLE_STORE, {
          keyPath: ["sessionId", "namespace", "name"]
        });
      } else {
        bundles = request.transaction.objectStore(BUNDLE_STORE);
      }
      if (!bundles.indexNames.contains(SESSION_ID_INDEX)) {
        bundles.createIndex(SESSION_ID_INDEX, "sessionId");
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      signal?.removeEventListener("abort", abort);
      resolve(request.result);
    };
    request.onerror = () => rejectOnce(
      sessionError(
        "ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE",
        "The session binary IndexedDB open request failed.",
        request.error
      )
    );
    request.onblocked = () => rejectOnce(
      sessionError(
        "ASSET_SESSION_BINARY_INDEXEDDB_BLOCKED",
        "The session binary IndexedDB open request was blocked."
      )
    );
  });
}
function sessionRecordIsValid(value, sessionId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  return Boolean(
    record.formatVersion === FORMAT_VERSION && typeof record.sessionId === "string" && (sessionId === void 0 || record.sessionId === sessionId) && (record.state === "establishing" || record.state === "active") && Number.isSafeInteger(record.expectedAssets) && Number(record.expectedAssets) > 0 && Number.isSafeInteger(record.committedAssets) && Number(record.committedAssets) >= 0 && Number(record.committedAssets) <= Number(record.expectedAssets) && Number.isSafeInteger(record.committedBytes) && Number(record.committedBytes) >= 0 && Number.isSafeInteger(record.createdAt) && Number(record.createdAt) >= 0 && Number.isSafeInteger(record.heartbeatAt) && Number(record.heartbeatAt) >= Number(record.createdAt) && Number.isSafeInteger(record.expiresAt) && Number(record.expiresAt) > Number(record.heartbeatAt)
  );
}
function storedBundleIsValid(value, sessionId, asset) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value;
  if (record.formatVersion !== FORMAT_VERSION || record.sessionId !== sessionId || record.namespace !== asset.namespace || record.name !== asset.name || record.integrity !== asset.integrity || record.totalBytes !== asset.totalBytes || !Array.isArray(record.files) || record.files.length !== asset.files.length) {
    return false;
  }
  return record.files.every((file, index) => {
    const expected = asset.files[index];
    return Boolean(
      expected && file && typeof file === "object" && file.path === expected.path && file.size === expected.size && file.integrity === expected.integrity && file.data instanceof ArrayBuffer && file.data.byteLength === expected.size
    );
  });
}
function createSessionRecord(sessionId, expectedAssets, timestamp, leaseTtlMs) {
  return {
    formatVersion: FORMAT_VERSION,
    sessionId,
    state: "establishing",
    expectedAssets,
    committedAssets: 0,
    committedBytes: 0,
    createdAt: timestamp,
    heartbeatAt: timestamp,
    expiresAt: timestamp + leaseTtlMs
  };
}
async function addSession(database, record, signal) {
  assertNotAborted(signal);
  try {
    const transaction = database.transaction(SESSION_STORE, "readwrite");
    const abort = () => transaction.abort();
    signal.addEventListener("abort", abort, { once: true });
    transaction.objectStore(SESSION_STORE).add(record);
    try {
      await transactionComplete(transaction);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  } catch (error) {
    if (isDomException(error, "ConstraintError")) {
      throw sessionError(
        "ASSET_SESSION_BINARY_SESSION_CONFLICT",
        `Session binary session already exists: ${record.sessionId}`,
        error
      );
    }
    throw mapStorageError(error, "session creation", signal);
  }
}
async function putBundle(database, sessionId, asset, files, signal) {
  assertNotAborted(signal);
  let semanticError;
  let transaction;
  try {
    transaction = database.transaction([SESSION_STORE, BUNDLE_STORE], "readwrite");
  } catch (error) {
    throw mapStorageError(error, "asset write", signal);
  }
  const abort = () => transaction.abort();
  signal.addEventListener("abort", abort, { once: true });
  const sessions = transaction.objectStore(SESSION_STORE);
  const request = sessions.get(sessionId);
  request.onsuccess = () => {
    try {
      if (!sessionRecordIsValid(request.result, sessionId) || request.result.state !== "establishing") {
        throw sessionError(
          "ASSET_SESSION_BINARY_CORRUPT",
          "Session binary metadata is missing or corrupt during establishment."
        );
      }
      const record = {
        formatVersion: FORMAT_VERSION,
        sessionId,
        namespace: asset.namespace,
        name: asset.name,
        integrity: asset.integrity,
        files: files.map(({ path, size, integrity, bytes }) => ({
          path,
          size,
          integrity,
          data: bytes.buffer
        })),
        totalBytes: asset.totalBytes
      };
      transaction.objectStore(BUNDLE_STORE).put(record);
      sessions.put({
        ...request.result,
        committedAssets: request.result.committedAssets + 1,
        committedBytes: request.result.committedBytes + asset.totalBytes
      });
    } catch (error) {
      semanticError = error;
      try {
        transaction.abort();
      } catch {
      }
    }
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(semanticError ?? error, "asset write", signal);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
async function readBundle(database, sessionId, asset, subtleCrypto, signal) {
  assertNotAborted(signal);
  let record;
  let transaction;
  try {
    transaction = database.transaction(BUNDLE_STORE, "readonly");
    const abort = () => transaction.abort();
    signal.addEventListener("abort", abort, { once: true });
    try {
      record = await requestResult(
        transaction.objectStore(BUNDLE_STORE).get([sessionId, asset.namespace, asset.name])
      );
      await transactionComplete(transaction);
    } finally {
      signal.removeEventListener("abort", abort);
    }
  } catch (error) {
    throw mapStorageError(error, "asset read", signal);
  }
  if (record === void 0) {
    throw sessionError(
      "ASSET_SESSION_BINARY_NOT_FOUND",
      `Session binary asset was not found: ${asset.name}`
    );
  }
  if (!storedBundleIsValid(record, sessionId, asset)) {
    throw sessionError(
      "ASSET_SESSION_BINARY_CORRUPT",
      `Session binary asset is incomplete or corrupt: ${asset.name}`
    );
  }
  const files = [];
  for (const file of record.files) {
    assertNotAborted(signal);
    const bytes = new Uint8Array(file.data);
    await verifyIntegrity(
      bytes,
      file.integrity,
      subtleCrypto,
      "ASSET_SESSION_BINARY_INTEGRITY_MISMATCH"
    );
    files.push(Object.freeze({
      path: file.path,
      size: file.size,
      integrity: file.integrity,
      bytes
    }));
  }
  return Object.freeze({
    namespace: asset.namespace,
    name: asset.name,
    integrity: asset.integrity,
    files: Object.freeze(files),
    totalBytes: asset.totalBytes
  });
}
async function activateSession(database, sessionId, expectedAssets, expectedBytes, timestamp, leaseTtlMs, signal) {
  assertNotAborted(signal);
  let semanticError;
  let transaction;
  try {
    transaction = database.transaction(SESSION_STORE, "readwrite");
  } catch (error) {
    throw mapStorageError(error, "session activation", signal);
  }
  const abort = () => transaction.abort();
  signal.addEventListener("abort", abort, { once: true });
  const store = transaction.objectStore(SESSION_STORE);
  const request = store.get(sessionId);
  request.onsuccess = () => {
    try {
      if (!sessionRecordIsValid(request.result, sessionId) || request.result.state !== "establishing" || request.result.committedAssets !== expectedAssets || request.result.committedBytes !== expectedBytes) {
        throw sessionError(
          "ASSET_SESSION_BINARY_CORRUPT",
          "Session binary establishment metadata did not pass read-back verification."
        );
      }
      store.put({
        ...request.result,
        state: "active",
        heartbeatAt: timestamp,
        expiresAt: timestamp + leaseTtlMs
      });
    } catch (error) {
      semanticError = error;
      try {
        transaction.abort();
      } catch {
      }
    }
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(semanticError ?? error, "session activation", signal);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}
async function renewSession(database, sessionId, timestamp, leaseTtlMs, signal) {
  assertNotAborted(signal);
  let semanticError;
  let transaction;
  try {
    transaction = database.transaction(SESSION_STORE, "readwrite");
  } catch (error) {
    throw mapStorageError(error, "lease renewal", signal);
  }
  const store = transaction.objectStore(SESSION_STORE);
  const request = store.get(sessionId);
  request.onsuccess = () => {
    try {
      if (!sessionRecordIsValid(request.result, sessionId) || request.result.state !== "active") {
        throw sessionError(
          "ASSET_SESSION_BINARY_NOT_FOUND",
          "Active session binary lease metadata is missing or corrupt."
        );
      }
      store.put({
        ...request.result,
        heartbeatAt: timestamp,
        expiresAt: timestamp + leaseTtlMs
      });
    } catch (error) {
      semanticError = error;
      try {
        transaction.abort();
      } catch {
      }
    }
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(semanticError ?? error, "lease renewal", signal);
  }
}
async function deleteSessionRecords(database, sessionId, expiredAtOrBefore) {
  let transaction;
  try {
    transaction = database.transaction([SESSION_STORE, BUNDLE_STORE], "readwrite");
  } catch (error) {
    throw mapStorageError(error, "session cleanup");
  }
  const sessions = transaction.objectStore(SESSION_STORE);
  const bundles = transaction.objectStore(BUNDLE_STORE);
  const removeBundles = () => {
    const cursorRequest = bundles.index(SESSION_ID_INDEX).openCursor(sessionId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      cursor.delete();
      cursor.continue();
    };
    sessions.delete(sessionId);
  };
  if (expiredAtOrBefore === void 0) {
    removeBundles();
  } else {
    const request = sessions.get(sessionId);
    request.onsuccess = () => {
      if (sessionRecordIsValid(request.result, sessionId) && request.result.expiresAt <= expiredAtOrBefore) {
        removeBundles();
      }
    };
  }
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(error, "session cleanup");
  }
}
async function expiredSessionIds(database, timestamp, limit) {
  const ids = [];
  let transaction;
  try {
    transaction = database.transaction(SESSION_STORE, "readonly");
  } catch (error) {
    throw mapStorageError(error, "orphan scan");
  }
  const request = transaction.objectStore(SESSION_STORE).index(EXPIRES_AT_INDEX).openCursor();
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor || ids.length >= limit || Number(cursor.key) > timestamp) return;
    if (sessionRecordIsValid(cursor.value) && cursor.value.expiresAt <= timestamp) {
      ids.push(cursor.value.sessionId);
    }
    cursor.continue();
  };
  try {
    await transactionComplete(transaction);
  } catch (error) {
    throw mapStorageError(error, "orphan scan");
  }
  return ids;
}
async function cleanupOrphans(database, timestamp, limit) {
  const ids = await expiredSessionIds(database, timestamp, limit);
  for (const sessionId of ids) {
    await deleteSessionRecords(database, sessionId, timestamp);
  }
}
function fallbackEligible(error) {
  return (/* @__PURE__ */ new Set([
    "ASSET_SESSION_BINARY_INDEXEDDB_UNAVAILABLE",
    "ASSET_SESSION_BINARY_INDEXEDDB_BLOCKED",
    "ASSET_SESSION_BINARY_QUOTA_EXCEEDED",
    "ASSET_SESSION_BINARY_ABORTED"
  ])).has(errorCode(error));
}
async function releaseSource(source) {
  try {
    await source.release();
  } catch (error) {
    throw sessionError(
      "ASSET_SESSION_BINARY_SOURCE_RELEASE_FAILED",
      "Session binary source could not be released.",
      error
    );
  }
}
function closeDatabase(database) {
  database?.close();
}
function publicDirectResult(asset, files) {
  return Object.freeze({
    namespace: asset.namespace,
    name: asset.name,
    integrity: asset.integrity,
    files: Object.freeze(
      files.map(
        ({ path, size, integrity, bytes }) => Object.freeze({ path, size, integrity, bytes })
      )
    ),
    totalBytes: asset.totalBytes
  });
}
function createEstablishedBacking({
  input,
  options,
  mode,
  database,
  source,
  warning
}) {
  const controller = new AbortController();
  const activeOperations = /* @__PURE__ */ new Set();
  let disposed = false;
  let disposePromise = null;
  let fatalError = null;
  let heartbeat = null;
  let closingDatabase = false;
  const notifyFatal = (error) => {
    if (!fatalError) {
      fatalError = error;
      controller.abort();
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      try {
        input.onFatalError?.(error);
      } catch {
      }
    }
    return fatalError;
  };
  const ensureUsable = () => {
    if (disposed) {
      throw sessionError(
        "ASSET_SESSION_BINARY_RELEASED",
        "Session binary backing has been disposed."
      );
    }
    if (fatalError) throw fatalError;
  };
  if (database) {
    const closeFailure = () => {
      if (closingDatabase || disposed) return;
      notifyFatal(
        sessionError(
          "ASSET_SESSION_BINARY_CONNECTION_CLOSED",
          "The session binary IndexedDB connection closed unexpectedly."
        )
      );
    };
    database.addEventListener("versionchange", () => {
      closeFailure();
      closingDatabase = true;
      database.close();
    });
    database.addEventListener("close", closeFailure);
  }
  const track = (operation) => {
    activeOperations.add(operation);
    void operation.then(
      () => activeOperations.delete(operation),
      () => activeOperations.delete(operation)
    );
    return operation;
  };
  const assetFor = (value) => {
    const key = normalizeKey(value);
    const asset = input.assetsByKey.get(key.lookupKey);
    if (!asset) {
      throw sessionError(
        "ASSET_SESSION_BINARY_NOT_FOUND",
        `Unknown session binary asset: ${key.name}`
      );
    }
    return asset;
  };
  const renew = async () => {
    ensureUsable();
    if (mode === "direct") return;
    try {
      await renewSession(
        database,
        input.sessionId,
        currentTime(options.now),
        options.leaseTtlMs,
        controller.signal
      );
    } catch (error) {
      throw notifyFatal(error instanceof Error ? error : mapStorageError(error, "lease renewal"));
    }
  };
  if (mode === "session") {
    heartbeat = setInterval(() => {
      void track(renew()).catch(() => {
      });
    }, options.heartbeatIntervalMs);
  }
  const backing = {
    sessionId: input.sessionId,
    mode,
    ...warning === void 0 ? {} : { warning },
    get(value, operationOptions = {}) {
      const operation = (async () => {
        ensureUsable();
        const asset = assetFor(value);
        const externalSignal = operationSignal(operationOptions);
        const linked = linkSignals(externalSignal, controller.signal);
        try {
          if (mode === "direct") {
            const files = await readSourceAsset(source, asset, options.subtleCrypto, linked.signal);
            return publicDirectResult(asset, files);
          }
          return await readBundle(
            database,
            input.sessionId,
            asset,
            options.subtleCrypto,
            linked.signal
          );
        } catch (error) {
          const normalized = error instanceof Error ? error : sessionError("ASSET_SESSION_BINARY_READ_FAILED", "Session binary read failed.", error);
          if (disposed) throw normalized;
          throw notifyFatal(normalized);
        } finally {
          linked.release();
        }
      })();
      return track(operation);
    },
    renewLease() {
      return track(renew());
    },
    dispose() {
      if (disposePromise) return disposePromise;
      disposed = true;
      controller.abort();
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      disposePromise = (async () => {
        await Promise.allSettled([...activeOperations]);
        const errors = [];
        if (mode === "session" && database) {
          try {
            await deleteSessionRecords(database, input.sessionId);
          } catch (error) {
            errors.push(error);
          }
          closingDatabase = true;
          database.close();
        }
        if (source) {
          try {
            await releaseSource(source);
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length > 0) {
          throw sessionError(
            "ASSET_SESSION_BINARY_CLEANUP_FAILED",
            "Session binary backing disposal failed.",
            new AggregateError(errors)
          );
        }
      })();
      return disposePromise;
    }
  };
  return Object.freeze(backing);
}
async function createSessionBinaryBacking(inputValue, optionValue = {}, operationOptions = {}) {
  const options = normalizeOptions(optionValue);
  const input = normalizeInput(inputValue, options);
  const externalSignal = operationSignal(operationOptions);
  const establishmentController = new AbortController();
  const linked = linkSignals(externalSignal, establishmentController.signal);
  const signal = linked.signal;
  let database = null;
  let sourceReleased = false;
  let createdSession = false;
  try {
    assertNotAborted(signal);
    if (input.policy === "disabled") {
      return createEstablishedBacking({
        input,
        options,
        mode: "direct",
        database: null,
        source: input.source
      });
    }
    try {
      database = await openDatabase(options, signal);
      const timestamp = currentTime(options.now);
      await cleanupOrphans(database, timestamp, options.orphanCleanupBatchSize);
      await addSession(
        database,
        createSessionRecord(input.sessionId, input.assets.length, timestamp, options.leaseTtlMs),
        signal
      );
      createdSession = true;
      let expectedBytes = 0;
      for (const asset of input.assets) {
        const files = await readSourceAsset(input.source, asset, options.subtleCrypto, signal);
        await putBundle(database, input.sessionId, asset, files, signal);
        await readBundle(database, input.sessionId, asset, options.subtleCrypto, signal);
        expectedBytes += asset.totalBytes;
      }
      await activateSession(
        database,
        input.sessionId,
        input.assets.length,
        expectedBytes,
        currentTime(options.now),
        options.leaseTtlMs,
        signal
      );
      await releaseSource(input.source);
      sourceReleased = true;
      return createEstablishedBacking({
        input,
        options,
        mode: "session",
        database,
        source: null
      });
    } catch (error) {
      let cleanupError;
      if (database && createdSession) {
        try {
          await deleteSessionRecords(database, input.sessionId);
        } catch (candidate) {
          cleanupError = candidate;
        }
      }
      if (input.policy === "prefer" && fallbackEligible(error) && cleanupError === void 0) {
        if (database) database.close();
        database = null;
        return createEstablishedBacking({
          input,
          options,
          mode: "direct",
          database: null,
          source: input.source,
          warning: Object.freeze({
            code: "ASSET_SESSION_BINARY_DIRECT_FALLBACK",
            causeCode: errorCode(error)
          })
        });
      }
      if (cleanupError !== void 0) {
        throw sessionError(
          "ASSET_SESSION_BINARY_CLEANUP_FAILED",
          "Partial session binary records could not be removed.",
          new AggregateError([error, cleanupError])
        );
      }
      throw error;
    }
  } catch (error) {
    if (!sourceReleased) {
      try {
        await releaseSource(input.source);
        sourceReleased = true;
      } catch (releaseError) {
        throw sessionError(
          "ASSET_SESSION_BINARY_SOURCE_RELEASE_FAILED",
          "Session binary startup failed and its source could not be released.",
          new AggregateError([error, releaseError])
        );
      }
    }
    closeDatabase(database);
    throw error;
  } finally {
    linked.release();
  }
}
function createAssetManagerComposition(featureFlags, options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new TypeError("Asset Manager composition options must be an object.");
  }
  const extension = featureFlags ? new AssetManagerExtension(featureFlags) : new AssetManagerExtension();
  const ownedNames = /* @__PURE__ */ new Map();
  let literalNameSequence = 0;
  let verifiedRemoteCache = null;
  let binaryBundleStore = null;
  const domImageResourceVersions = /* @__PURE__ */ new Map();
  const domImageResourceBackings = /* @__PURE__ */ new Map();
  const activeDOMImageResources = /* @__PURE__ */ new Set();
  const activeDOMImageResourcesByName = /* @__PURE__ */ new Map();
  const domImageResourceControllers = /* @__PURE__ */ new WeakMap();
  const boundDOMImageResources = /* @__PURE__ */ new WeakMap();
  const ownerDOMImageResources = /* @__PURE__ */ new Map();
  function remoteCache() {
    verifiedRemoteCache ??= createVerifiedRemoteBinaryCache(options.verifiedRemoteCache);
    return verifiedRemoteCache;
  }
  function bundleStore() {
    binaryBundleStore ??= createBinaryBundleStore(options.binaryBundleStore);
    return binaryBundleStore;
  }
  function cancelledRegistration(name) {
    const error = new Error(`Asset registration was cancelled: ${JSON.stringify(name)}`);
    error.name = "AbortError";
    return error;
  }
  function cancelledDOMImageResolution(name) {
    const error = new Error(`DOM image resource resolution was cancelled: ${JSON.stringify(name)}`);
    error.name = "AbortError";
    return error;
  }
  function externalName(value, mode) {
    if (mode === "trimmed") return normalizeName(value);
    if (mode !== "literal") throw new TypeError("Asset nameMode must be trimmed or literal.");
    if (typeof value !== "string" || value.length === 0) {
      throw new TypeError("A literal asset name must be a non-empty string.");
    }
    return value;
  }
  function claimName(value, mode) {
    const external = externalName(value, mode);
    const existing = ownedNames.get(external);
    if (existing !== void 0) {
      return { external, internal: existing, previouslyOwned: true };
    }
    const internal = mode === "literal" ? `\0asset-manager-composition:${++literalNameSequence}` : external;
    ownedNames.set(external, internal);
    return { external, internal, previouslyOwned: false };
  }
  function ownedName(value) {
    if (typeof value === "string") {
      const exact = ownedNames.get(value);
      if (exact !== void 0) return { external: value, internal: exact };
    }
    const normalized = normalizeName(value);
    const legacy = ownedNames.get(normalized);
    return legacy === void 0 ? null : { external: normalized, internal: legacy };
  }
  async function trackRegistration(claimed, operation) {
    try {
      await operation;
      if (ownedNames.get(claimed.external) !== claimed.internal || !extension.isLoaded({ NAME: claimed.internal })) {
        throw cancelledRegistration(claimed.external);
      }
      const registered = registration(claimed.external, claimed.internal);
      invalidateDOMImageResources(claimed.external);
      return registered;
    } catch (error) {
      if (!claimed.previouslyOwned && !extension.isLoaded({ NAME: claimed.internal })) {
        ownedNames.delete(claimed.external);
      }
      throw error;
    }
  }
  function registration(external, internal) {
    return Object.freeze({
      name: external,
      mimeType: extension.getAssetMimeType({ NAME: internal })
    });
  }
  function releaseAsset(name) {
    const owned = ownedName(name);
    if (!owned) return;
    invalidateDOMImageResources(owned.external);
    ownedNames.delete(owned.external);
    let stopError;
    if (extension.getAssetMimeType({ NAME: owned.internal }).startsWith("audio/")) {
      try {
        extension.stopSound({ NAME: owned.internal });
      } catch (error) {
        stopError = error;
      }
    }
    extension.deleteMemoryAsset({ NAME: owned.internal });
    if (stopError) throw stopError;
  }
  function invalidateDOMImageResources(name) {
    domImageResourceVersions.set(name, (domImageResourceVersions.get(name) ?? 0) + 1);
    for (const controller of [...activeDOMImageResourcesByName.get(name) ?? []]) {
      controller.resource.release();
    }
  }
  function releaseActiveDOMImageResource(controller) {
    activeDOMImageResources.delete(controller);
    const named = activeDOMImageResourcesByName.get(controller.name);
    named?.delete(controller);
    if (named?.size === 0) activeDOMImageResourcesByName.delete(controller.name);
    const binding = controller.binding;
    if (!binding) {
      stopListeningForDOMImageLifecycleIfIdle();
      return;
    }
    const ownsTargetBinding = boundDOMImageResources.get(binding.target) === controller;
    if (ownsTargetBinding) {
      boundDOMImageResources.delete(binding.target);
      try {
        if (binding.target.getAttribute(binding.attribute) === controller.resource.url) {
          binding.target.removeAttribute(binding.attribute);
        }
      } catch {
      }
    }
    if (binding.ownerId !== void 0) {
      const owned = ownerDOMImageResources.get(binding.ownerId);
      owned?.delete(controller);
      if (owned?.size === 0) ownerDOMImageResources.delete(binding.ownerId);
    }
    delete controller.binding;
    stopListeningForDOMImageLifecycleIfIdle();
  }
  function releaseAllDOMImageResources() {
    for (const name of ownedNames.keys()) {
      domImageResourceVersions.set(name, (domImageResourceVersions.get(name) ?? 0) + 1);
    }
    for (const controller of [...activeDOMImageResources]) controller.resource.release();
  }
  function releaseDOMImageResourcesForOwner(ownerId) {
    for (const controller of [...ownerDOMImageResources.get(ownerId) ?? []]) {
      controller.resource.release();
    }
  }
  async function resolveDOMImageResourceBacking(external, internal, version) {
    const cached = domImageResourceBackings.get(external);
    if (cached?.version === version) return cached.promise;
    let entry;
    const promise = (async () => {
      const resolved = await extension.resolveImageAssetBytes({ NAME: internal });
      const backing = await createDOMImageResourceBacking(
        { name: external, bytes: resolved.bytes, mimeType: resolved.mimeType },
        (idleBacking) => {
          if (domImageResourceBackings.get(external) === entry && entry.backing === idleBacking) {
            domImageResourceBackings.delete(external);
          }
        }
      );
      entry.backing = backing;
      return backing;
    })();
    entry = { version, promise };
    domImageResourceBackings.set(external, entry);
    try {
      return await promise;
    } catch (error) {
      if (domImageResourceBackings.get(external) === entry) {
        domImageResourceBackings.delete(external);
      }
      throw error;
    }
  }
  async function acquireDOMImageResource(external, internal, version, onRelease) {
    const backing = await resolveDOMImageResourceBacking(external, internal, version);
    return backing.acquire(onRelease);
  }
  async function resolveDOMImageResource(name) {
    const owned = ownedName(name);
    const internal = owned?.internal ?? name;
    const external = owned?.external ?? normalizeName(name);
    const version = domImageResourceVersions.get(external) ?? 0;
    let controller;
    const resource = await acquireDOMImageResource(external, internal, version, () => {
      if (controller) releaseActiveDOMImageResource(controller);
    });
    if (!owned || ownedNames.get(external) !== owned.internal || (domImageResourceVersions.get(external) ?? 0) !== version) {
      resource.release();
      throw cancelledDOMImageResolution(external);
    }
    controller = { name: external, resource };
    activeDOMImageResources.add(controller);
    const named = activeDOMImageResourcesByName.get(external) ?? /* @__PURE__ */ new Set();
    named.add(controller);
    activeDOMImageResourcesByName.set(external, named);
    domImageResourceControllers.set(resource, controller);
    startListeningForDOMImageLifecycle();
    return resource;
  }
  async function applyDOMImageResource(name, target, bindingOptions = {}) {
    if (!target || typeof target !== "object" || typeof target.getAttribute !== "function" || typeof target.setAttribute !== "function" || typeof target.removeAttribute !== "function") {
      throw new TypeError("DOM image resource target must support DOM attributes.");
    }
    if (!bindingOptions || typeof bindingOptions !== "object" || Array.isArray(bindingOptions)) {
      throw new TypeError("DOM image resource binding options must be an object.");
    }
    const attribute = bindingOptions.attribute ?? (target.namespaceURI === "http://www.w3.org/2000/svg" || target.localName?.toLowerCase() === "image" ? "href" : "src");
    if (attribute !== "href" && attribute !== "src") {
      throw new TypeError("DOM image resource attribute must be href or src.");
    }
    const resource = await resolveDOMImageResource(name);
    const controller = domImageResourceControllers.get(resource);
    const previous = boundDOMImageResources.get(target);
    try {
      target.setAttribute(attribute, resource.url);
    } catch (error) {
      resource.release();
      throw error;
    }
    const ownerId = bindingOptions.owner?.id;
    controller.binding = {
      target,
      attribute,
      ...ownerId === void 0 ? {} : { ownerId }
    };
    boundDOMImageResources.set(target, controller);
    if (ownerId !== void 0) {
      const ownerResources = ownerDOMImageResources.get(ownerId) ?? /* @__PURE__ */ new Set();
      ownerResources.add(controller);
      ownerDOMImageResources.set(ownerId, ownerResources);
    }
    previous?.resource.release();
    return resource;
  }
  const runtime = Scratch.vm.runtime;
  let listeningForDOMImageLifecycle = false;
  const releaseStoppedTargetDOMImageResources = (target) => {
    if (target && !runtime.targets.includes(target)) releaseDOMImageResourcesForOwner(target.id);
  };
  function startListeningForDOMImageLifecycle() {
    if (listeningForDOMImageLifecycle || !runtime.on) return;
    listeningForDOMImageLifecycle = true;
    runtime.on("PROJECT_STOP_ALL", releaseAllDOMImageResources);
    runtime.on("PROJECT_LOADED", releaseAllDOMImageResources);
    runtime.on("RUNTIME_DISPOSED", releaseAllDOMImageResources);
    runtime.on("STOP_FOR_TARGET", releaseStoppedTargetDOMImageResources);
  }
  function stopListeningForDOMImageLifecycleIfIdle() {
    if (!listeningForDOMImageLifecycle || activeDOMImageResources.size > 0 || !runtime.off) return;
    listeningForDOMImageLifecycle = false;
    runtime.off("PROJECT_STOP_ALL", releaseAllDOMImageResources);
    runtime.off("PROJECT_LOADED", releaseAllDOMImageResources);
    runtime.off("RUNTIME_DISPOSED", releaseAllDOMImageResources);
    runtime.off("STOP_FOR_TARGET", releaseStoppedTargetDOMImageResources);
  }
  const composition = {
    async registerProjectAsset(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("Project asset registration input must be an object.");
      }
      const hasLocator = Object.hasOwn(input, "locator");
      if (hasLocator === Object.hasOwn(input, "resourceId")) {
        throw new TypeError("Provide exactly one project asset locator or resourceId.");
      }
      const claimed = claimName(input.name, input.nameMode ?? (hasLocator ? "literal" : "trimmed"));
      const operation = hasLocator ? extension.registerProjectAssetLiteral(claimed.internal, input.locator) : extension.registerAsset({ NAME: claimed.internal, RESOURCE_ID: input.resourceId });
      return trackRegistration(claimed, operation);
    },
    async registerEmbeddedAsset(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new TypeError("Embedded asset registration input must be an object.");
      }
      const claimed = claimName(input.name, input.nameMode ?? "trimmed");
      return trackRegistration(
        claimed,
        extension.registerEmbeddedAsset({
          name: claimed.internal,
          bytes: input.bytes,
          mimeType: input.mimeType,
          ...input.sourceName === void 0 ? {} : { sourceName: input.sourceName },
          ...input.bitmapResolution === void 0 ? {} : { bitmapResolution: input.bitmapResolution }
        })
      );
    },
    releaseAsset,
    releaseAll() {
      releaseAllDOMImageResources();
      const errors = [];
      for (const name of [...ownedNames.keys()].reverse()) {
        try {
          releaseAsset(name);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) throw new AggregateError(errors, "Failed to release assets");
    },
    isRegistered(name) {
      const owned = ownedName(name);
      return owned !== null && extension.isLoaded({ NAME: owned.internal });
    },
    getMimeType(name) {
      const owned = ownedName(name);
      return owned ? extension.getAssetMimeType({ NAME: owned.internal }) : "";
    },
    resolveDOMImageResource,
    applyDOMImageResource,
    releaseDOMImageResource(target) {
      boundDOMImageResources.get(target)?.resource.release();
    },
    releaseAllDOMImageResources,
    applyToStage(name) {
      return extension.setStageSkin({ NAME: ownedName(name)?.internal ?? name });
    },
    applyToTarget(name, target) {
      return extension.setThisSpriteSkin(
        { NAME: ownedName(name)?.internal ?? name },
        { target, runtime: Scratch.vm.runtime }
      );
    },
    playSound(name, options2 = {}) {
      return options2.untilDone ? extension.playSoundUntilDone({ NAME: ownedName(name)?.internal ?? name }) : extension.playSound({ NAME: ownedName(name)?.internal ?? name });
    },
    stopSound(name) {
      extension.stopSound({ NAME: ownedName(name)?.internal ?? name });
    },
    stopAllSounds() {
      extension.stopAllSounds();
    },
    resolveVerifiedRemoteBinary(input, resolveOptions) {
      return remoteCache().resolve(input, resolveOptions);
    },
    getVerifiedRemoteCacheStats() {
      return remoteCache().getStats();
    },
    pruneVerifiedRemoteCache() {
      return remoteCache().prune();
    },
    clearVerifiedRemoteCache() {
      return remoteCache().clear();
    },
    listVerifiedRemoteStoryCaches() {
      return remoteCache().listStoryCaches();
    },
    pruneVerifiedRemoteStoryCaches() {
      return remoteCache().pruneStoryCaches();
    },
    deleteVerifiedRemoteStoryCache(databaseName) {
      return remoteCache().deleteStoryCache(databaseName);
    },
    renewVerifiedRemoteStoryCacheLease() {
      return remoteCache().renewStoryCacheLease();
    },
    releaseVerifiedRemoteStoryCacheLease() {
      return remoteCache().releaseStoryCacheLease();
    },
    putBinaryBundle(input, operationOptions) {
      return bundleStore().put(input, operationOptions);
    },
    getBinaryBundle(input, operationOptions) {
      return bundleStore().get(input, operationOptions);
    },
    deleteBinaryBundle(input, operationOptions) {
      return bundleStore().delete(input, operationOptions);
    },
    releaseBinaryStore() {
      return bundleStore().release();
    },
    createSessionBinaryBacking(input, operationOptions) {
      return createSessionBinaryBacking(
        input,
        options.sessionBinaryBacking,
        operationOptions
      );
    }
  };
  return Object.freeze(composition);
}
export {
  createAssetManagerComposition,
  createBinaryBundleStore,
  createSessionBinaryBacking,
  createVerifiedRemoteBinaryCache,
  createVerifiedRemoteCacheDatabaseName
};
