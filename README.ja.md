# TurboWarp-Asset-Manager

<img src="assets/block-icon.svg" alt="" width="48" height="48">

[English](README.md)

> [!WARNING]
> このpackageは非推奨です。画像・音声・実行時テキスト・描画・再生・検証済みremote cache APIには
> [`@kubohiroya/turbowarp-asset-cache`](https://github.com/kubohiroya/turbowarp-asset-cache)を、
> 移植可能なnamespace/keyの永続化とbinary object・bundle・session backingのAPIには
> [`@kubohiroya/turbowarp-kvs`](https://github.com/kubohiroya/turbowarp-kvs)を使ってください。
> 再現可能なビルドのために既存のreleaseは引き続き利用できますが、新しい統合でこのpackageに依存しないで
> ください。

TurboWarpのプロジェクト向けに、画像・音声・実行時テキストをIndexedDBで管理するasset managerです。
composition hostには、OPFSを明示的に選べるhybridなbinary backingを提供します。外部ファイル、
プロジェクト内のコスチューム／背景／音、Temporary Variablesのテキスト参照を登録し、TurboWarpのblockや
composition hostから利用できるようにします。

## ユーザーガイド

導入手順、安全上の注意、レシピ、図入りのblock解説は
[English user guide](https://kubohiroya.github.io/turbowarp-asset-manager/)または
[日本語ユーザーガイド](https://kubohiroya.github.io/turbowarp-asset-manager/ja/)を参照してください。

## 移行

- asset登録・描画・再生・DOM image resource・検証済みremote cacheのlifecycle APIについては、
  `@kubohiroya/turbowarp-asset-manager/composition`を
  `@kubohiroya/turbowarp-asset-cache/composition`へ置き換えてください。
- binaryの保存は`@kubohiroya/turbowarp-kvs/binary-object-store`、
  `@kubohiroya/turbowarp-kvs/binary-bundle-store`、
  `@kubohiroya/turbowarp-kvs/session-binary-backing`から直接importしてください。
- standaloneのプロジェクトは、拡張機能IDを`kubohiroyaassetmanager`から`kubohiroyaassetcache`へ
  置き換える必要があります。公開済みのSB3成果物は、元の拡張機能に固定したままにしてください。
- Asset Managerのデータベースは削除も暗黙の移行もしません。置き換え先のpackageは製品ごとに異なる
  ストレージ名を使うため、初回の実行はcacheが空の状態から始まります。

## できること

- 画像、音声、プロジェクトasset、実行時テキストを論理的なasset名で登録します。
- 登録済みの画像やテキストを、スプライト、クローン、ステージへ適用します。
- 登録済みの音声を再生し、actorのアニメーション列にも対応します。
- host拡張機能向けに、blockを使わないComposition APIを提供します。
- SVGとremote binaryの入力を、利用前およびcacheへの書き込み前に検証します。
- アプリケーションshell向けに、story単位のIndexedDB cache制御を利用できる状態に保ちます。
- 既定はIndexedDBのまま、composition hostが検証済みbinary objectのbyte列にOPFSを選べるようにします。

## 統合方法を選ぶ

TurboWarpのプロジェクトが`dist/asset-manager.js`を直接読み込み、パレットにAsset Managerのblockを
並べる場合はStandalone拡張機能を使います。

別のunsandboxed拡張機能やアプリケーションshellが`@kubohiroya/turbowarp-asset-manager/composition`を
importし、registryを内部に閉じたまま、パレットへAsset Managerのblockを追加したくない場合は
Composition APIを使います。

## 動作条件と安全性

standaloneでの利用には、TurboWarp Desktop、またはunsandboxedなカスタム拡張機能を読み込める他の
TurboWarp環境が必要です。実行時テキストの描画には、さらにTemporary Variables（`lmsTempVars2`）と
Animated Text（`text`）が必要です。

SVG入力は既定で拒否します。remote binaryのcache entryは、保存前にサイズ・content-type・SHA-256を
検証します。IndexedDBは機密の境界ではなく補助的なcacheとして扱います。

メンテナはNode.js 22以降と、Corepack経由のpnpmを使います。インストール例とCDN URLのsource of truthは
`package.json`のversionです。

## インストール

[`dist/asset-manager.js`](dist/asset-manager.js)をダウンロードし、TurboWarp Desktopでローカルの
カスタム拡張機能として読み込みます。確認されたら**サンドボックス化せずに実行**を有効にします。

ビルド済みのJavaScriptファイルをこのリポジトリにcommitしてあるため、Node.jsのインストールやビルドの実行は
必要ありません。

versionを付けたnpm packageにも、同じレビュー済みビルドが入っています。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-asset-manager@0.16.1
```

`node_modules/@kubohiroya/turbowarp-asset-manager/dist/asset-manager.js`を読み込むか、version固定の
CDN URLを使います。

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-asset-manager@0.16.1/dist/asset-manager.js
```

## クイックスタート

1. `dist/asset-manager.js`をunsandboxedなTurboWarp拡張機能として読み込みます。
2. `register resource [RESOURCE_ID] as asset [NAME]`でリソースを登録します。
3. `show asset [NAME] on this sprite`、`set stage backdrop to asset [NAME]`、または音声blockでassetを使います。
4. プロジェクトのlifecycleや保存方針として明示的な後片付けが必要な場合は、cacheと削除のblockを使います。

## Compositionの例

```js
import {createAssetManagerComposition} from '@kubohiroya/turbowarp-asset-manager/composition';

const assets = createAssetManagerComposition();
await assets.registerEmbeddedAsset({
  name: 'Opening',
  sourceName: 'opening.svg',
  mimeType: 'image/svg+xml',
  bytes: new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')
});
await assets.applyToStage('Opening');
assets.releaseAll();
```

## 統合の全体像

- standaloneのプロジェクトは、リソース識別子、実行時テキスト、診断、actorアニメーション、読み込み互換性、
  拡張機能IDの移行について[Runtime and Standalone Contracts](docs/runtime-contracts.md)を参照してください。
- composition hostは、埋め込みasset、構造化locator、音声voice、DOM image resource、SVG検証、
  story単位のcache、検証済みremote binary、binary bundle、session限定のbinary backingについて
  [Composition API](docs/composition-api.md)を参照してください。
- blockの利用者とドキュメントのメンテナは、生成されたblock表について
  [Block Reference](docs/block-reference.md)を参照してください。

## 開発

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

block APIの正式なsourceは`src/block-definitions.json`です。変更したらblockのドキュメントを再生成します。

```bash
pnpm run docs
```

ビルドは`dist/asset-manager.js`、`dist/extension-manifest.json`、`dist/composition.js`、
`dist/types/composition.d.ts`を生成します。決定的なmanifestは、拡張機能ID、すべてのopcodeとblock種別、
各引数のID・型・menu参照を記録します。`sb3-toolchain`などのツールが互換性を検査するためです。
拡張機能、block metadata、Compositionのsourceを変更したら、再ビルドした成果物をcommitしてください。

## リリース

公開前にローカルでリリース検査を実行します。

```bash
pnpm run pack:check
pnpm run release:check
```

npm packageのアーカイブには、README、LICENSE、Standalone bundle、拡張機能API manifest、
Composition bundle、Compositionの型宣言を含める必要があります。

## ライセンス

SPDX-License-Identifier: MPL-2.0

## 固定入力の編集

既定OFFの固定入力フォームと既存データの保持規則は[固定入力エディターの契約](docs/fixed-input-editors.ja.md)を参照してください。
