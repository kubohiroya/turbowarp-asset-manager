import {AssetManagerExtension} from './extension.js';

if (!Scratch.extensions.unsandboxed) {
  throw new Error('Asset Manager must run unsandboxed.');
}

Scratch.extensions.register(new AssetManagerExtension());
