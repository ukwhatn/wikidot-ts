# CLAUDE.md - wikidot-ts プロジェクトガイド

このドキュメントはAIエージェント向けのプロジェクトガイドです。

## プロジェクト概要

**wikidot-ts** は、TypeScriptでWikidotサイトと対話するためのユーティリティライブラリです。wikidot.pyのTypeScript移植版。

- **バージョン**: 4.0.x
- **Node.js対応**: 18以上
- **ライセンス**: MIT
- **パッケージ名**: `@ukwhatn/wikidot`

### 主な機能

- サイト情報の取得・管理
- ページの作成、編集、削除、検索（ListPagesModule対応）
- ユーザー情報の取得・検索
- フォーラム（カテゴリ、スレッド、投稿）操作
- プライベートメッセージの送受信
- 認証機能（ログインなしでも公開情報はアクセス可能）

## ディレクトリ構造

```
wikidot-ts/
├── src/
│   ├── index.ts              # パッケージエントリポイント
│   ├── common/               # 共通ユーティリティ
│   │   ├── decorators.ts     # @loginRequired デコレータ
│   │   ├── errors/           # カスタムエラー
│   │   ├── logger.ts         # ロギング設定
│   │   └── types/            # 共通型定義
│   ├── connector/            # HTTP通信
│   │   ├── amc-client.ts     # AjaxModuleConnectorClient
│   │   └── auth.ts           # 認証処理
│   ├── module/               # コアモジュール
│   │   ├── client/           # Client（メインエントリポイント）
│   │   ├── site/             # Site（サイト管理）
│   │   ├── page/             # Page（ページ操作）
│   │   ├── user/             # User階層
│   │   ├── forum/            # フォーラム関連
│   │   ├── private-message/  # プライベートメッセージ
│   │   └── types.ts          # モジュール共通型
│   └── util/                 # ユーティリティ
│       ├── quick-module.ts   # QuickModule検索
│       ├── string.ts         # 文字列変換
│       └── parser/           # HTMLパーサー
├── tests/
│   ├── unit/                 # ユニットテスト
│   ├── integration/          # 統合テスト
│   ├── fixtures/             # テストフィクスチャ
│   └── mocks/                # モック
├── package.json              # プロジェクト設定
├── tsconfig.json             # TypeScript設定
└── biome.json                # Biome設定
```

## 開発コマンド

```bash
# 依存関係インストール
bun install

# フォーマット
bun run format

# リント
bun run lint

# リント修正
bun run lint:fix

# 型チェック
bun run typecheck

# テスト実行
bun test              # 全テスト
bun test:cov          # カバレッジ付き

# ビルド
bun run build
```

## アーキテクチャ

### 設計パターン

1. **Facadeパターン**: `Client`が複数システムの統一インターフェース
2. **Accessorパターン**: 機能をグループ化（`client.user`, `client.site`, `site.page`等）
3. **Collectionパターン**: 複数リソースの一括操作（`PageCollection`, `UserCollection`等）
4. **Factoryパターン**: `Page.fromName()`, `Site.fromUnixName()`等の静的メソッド

### コアクラス

すべての非同期メソッドは`WikidotResultAsync<T>`を返す。`isOk()`でチェック後、`.value`で値を取得する。

```typescript
import { Client } from '@ukwhatn/wikidot';

// Client - メインエントリポイント
const clientResult = await Client.create({ username, password });
if (!clientResult.isOk()) throw new Error('Failed');
const client = clientResult.value;

// Site - サイト操作
const siteResult = await client.site.get("scp-jp");
if (!siteResult.isOk()) throw new Error('Failed');
const site = siteResult.value;

// ページ検索
const pagesResult = await site.pages.search({ category: "*", tags: ["tag1"] });
if (!pagesResult.isOk()) throw new Error('Failed');
const pages = pagesResult.value;

// Page - ページ操作
const pageResult = await site.page.get("page-name");
if (!pageResult.isOk()) throw new Error('Failed');
const page = pageResult.value;
await page.getSource();
await page.getVotes();
```

### User階層

```
AbstractUser (基底)
├── User            # 通常ユーザー
├── DeletedUser     # 削除済みユーザー
├── AnonymousUser   # 匿名ユーザー
├── GuestUser       # ゲストユーザー
└── WikidotUser     # Wikidot公式ユーザー
```

### エラーハンドリング

neverthrowライブラリを使用したResult型でエラーを扱う:

```typescript
type WikidotResult<T, E = WikidotError> = Result<T, E>;
type WikidotResultAsync<T, E = WikidotError> = ResultAsync<T, E>;
```

### 例外階層

```
WikidotError (基底)
├── UnexpectedError
├── SessionCreateError
├── LoginRequiredError
├── AMCError
│   ├── AMCHttpStatusError
│   ├── WikidotStatusError
│   └── ResponseDataError
├── NotFoundError
├── TargetExistsError
├── TargetError
├── ForbiddenError
└── NoElementError
```

## コード品質設定

### Biome（リンター/フォーマッター）

- 行長: 120文字
- インデント: タブ（幅2）
- セミコロン: 必須
- クォート: ダブル

### TypeScript

- strict: true
- target: ESNext
- module: ESNext

### Bun Test

- カバレッジ要件: 80%以上目標

## 重要な実装詳細

### 認証フロー

1. `Client.create({ username, password })` でクライアント作成
2. 内部で`login()` → Wikidot ログインエンドポイントへPOST
3. `WIKIDOT_SESSION_ID` クッキーを抽出
4. `@loginRequired` デコレータで検証

### HTMLパース

- cheerioライブラリ使用
- `odateParse()`: Wikidot日時要素をDateに変換
- `userParse()`: HTML要素からUser型を自動判定

### SearchPagesQuery

ListPagesModuleの複雑なクエリをTypeScriptで表現:

```typescript
interface SearchPagesQuery {
  pagetype?: string;
  category?: string;
  tags?: string | string[];
  parent?: string;
  createdBy?: User | string;
  rating?: string;
  order?: string;
  offset?: number;
  limit?: number;
}
```

## 環境変数

```bash
WIKIDOT_USERNAME=your_username
WIKIDOT_PASSWORD=your_password
```

## 依存関係

### 必須

- `cheerio` - HTMLパース
- `ky` - HTTPクライアント
- `neverthrow` - Result型
- `p-limit` - 並行数制限
- `zod` - スキーマバリデーション

### 開発

- `@biomejs/biome` - リンター/フォーマッター
- `typescript` - 型チェック
- `bunup` - バンドラー

## CI/CD

### GitHub Actions

- **check_code_quality.yml**: PR時にformat→lint→typecheck→test
- **publish.yml**: リリース時にnpmへ公開

## サブエージェント呼び出し時の追加情報

### quality-checker / lint-runner / format-runner / typecheck-runner / test-runner

```
lint: bun run lint
format: bun run format
typecheck: bun run typecheck
test: bun test
```

### self-reviewer / pr-reviewer

```
ベースブランチ: main
アーキテクチャルール:
  - Facadeパターン（Client）
  - Accessorパターン
  - Result型によるエラーハンドリング
追加チェック:
  - neverthrow Result型の適切な使用
  - 循環依存の回避（types.tsのRef型活用）
```

## 注意事項

- TypeScript strictモードを維持
- 循環依存を避けるため、`module/types.ts`のRef型インターフェースを活用
- エラーは`neverthrow`のResult型で返却（例外throwは避ける）
- 公開APIはAccessorパターンで構成
- Python版（wikidot.py）との互換性を意識
