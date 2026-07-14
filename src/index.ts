import {AnimatedAssetManagerExtension} from './animation.js';

if (!Scratch.extensions.unsandboxed) {
  throw new Error('Asset Manager must run unsandboxed.');
}

Scratch.extensions.register(new AnimatedAssetManagerExtension());
