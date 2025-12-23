# wikidot-ts

TypeScriptでWikidotサイトと対話するための非同期ユーティリティライブラリ。

## 概要

wikidot-tsは、Wikidot APIを操作するためのTypeScriptライブラリです。ページの取得・編集、フォーラム操作、プライベートメッセージ、ユーザー情報の取得など、Wikidotの主要機能をサポートしています。

## 特徴

- 型安全なAPI（TypeScript完全対応）
- Result型によるエラーハンドリング（neverthrow使用）
- 非同期処理の完全サポート
- ページ、フォーラム、プライベートメッセージなど主要機能をカバー
- wikidot.pyとの高い互換性

## インストール

```bash
bun add wikidot-ts
```

または

```bash
npm install wikidot-ts
```

## 基本的な使い方

### クライアントの作成

```typescript
import { Client } from 'wikidot-ts';

// ログインなしでアクセス（公開情報のみ）
const client = await Client.create();

// ログインしてアクセス
const authenticatedClient = await Client.create({
  username: 'your_username',
  password: 'your_password',
});
```

### サイトの取得

```typescript
// サイトを取得
const siteResult = await client.site.get('scp-jp');
if (siteResult.isOk()) {
  const site = siteResult.value;
  console.log(`サイト: ${site.title}`);
}
```

### ページの操作

```typescript
// ページを検索
const pagesResult = await site.pages.search({ category: 'scp', tags: ['safe'] });
if (pagesResult.isOk()) {
  for (const page of pagesResult.value) {
    console.log(`${page.fullname}: ${page.title}`);
  }
}

// 単一ページを取得
const pageResult = await site.page.get('scp-001');
if (pageResult.isOk()) {
  const page = pageResult.value;
  console.log(`タイトル: ${page.title}`);
  console.log(`レーティング: ${page.rating}`);
}
```

### フォーラムの操作

```typescript
// フォーラムカテゴリを取得
const categoriesResult = await site.forum.getCategories();
if (categoriesResult.isOk()) {
  for (const category of categoriesResult.value) {
    console.log(`カテゴリ: ${category.title}`);
  }
}

// スレッドに返信（要ログイン）
const threadResult = await site.forum.getThread(12345);
if (threadResult.isOk()) {
  const thread = threadResult.value;
  await thread.reply('返信内容', 'Re: タイトル');
}
```

### プライベートメッセージ（要ログイン）

```typescript
// 受信箱を取得
const inboxResult = await client.pm.inbox();
if (inboxResult.isOk()) {
  for (const message of inboxResult.value) {
    console.log(`From: ${message.sender.name}, Subject: ${message.subject}`);
  }
}

// メッセージを送信
await client.pm.send(recipientUser, '件名', '本文');

// メッセージを検索
const searchResult = await client.pm.search('検索クエリ', 'all');
```

## エラーハンドリング

wikidot-tsは`neverthrow`ライブラリを使用したResult型でエラーを処理します。

```typescript
const result = await site.page.get('non-existent-page');

if (result.isOk()) {
  const page = result.value;
  // 成功時の処理
} else {
  const error = result.error;
  if (error instanceof NotFoundException) {
    console.log('ページが見つかりません');
  } else if (error instanceof ForbiddenError) {
    console.log('アクセス権限がありません');
  }
}
```

## 主要なエラー型

| エラー | 説明 |
|--------|------|
| `LoginRequiredError` | ログインが必要な操作 |
| `NotFoundException` | リソースが見つからない |
| `ForbiddenError` | アクセス権限がない |
| `TargetExistsError` | リソースが既に存在する |
| `WikidotStatusError` | Wikidot APIエラー |

## wikidot.pyとの差異

wikidot-tsはwikidot.pyからの移植ですが、TypeScriptの慣習に合わせていくつかの違いがあります。

### プロパティ → メソッド変換

Pythonの`@property`デコレータを使用したプロパティは、TypeScriptではgetterメソッドとして実装されています。

| Python (wikidot.py) | TypeScript (wikidot-ts) |
|---------------------|------------------------|
| `site.base_url` | `site.getBaseUrl()` |
| `page.url` | `page.getUrl()` |
| `user.avatar_url` | `user.avatarUrl` (読み取り専用プロパティ) |

### 命名規則

- スネークケース → キャメルケース
  - `page.fullname` (変更なし)
  - `page.children_count` → `page.childrenCount`
  - `page.created_by` → `page.createdBy`

### エラーハンドリング

- Python: 例外をスロー
- TypeScript: `Result`型を返却（`neverthrow`使用）

```python
# Python
try:
    page = await site.get_page("scp-001")
except NotFoundException:
    print("Page not found")
```

```typescript
// TypeScript
const result = await site.page.get("scp-001");
if (result.isErr()) {
  if (result.error instanceof NotFoundException) {
    console.log("Page not found");
  }
}
```

### オプション引数

一部のメソッドでは、Python版と同様のオプション引数をサポートしています。

```typescript
// raiseWhenNotFound オプション
const user = await client.user.get("username", { raiseWhenNotFound: true });

// returnExceptions オプション（AMCClient）
const results = await client.amcClient.requestWithOptions(bodies, { returnExceptions: true });
```

## 開発

### セットアップ

```bash
bun install
```

### コマンド

```bash
# 型チェック
bun run typecheck

# Lint
bun run lint

# フォーマット
bun run format

# テスト
bun test

# ビルド
bun run build
```

## ライセンス

MIT

## 関連プロジェクト

- [wikidot.py](https://github.com/ukwhatn/wikidot.py) - Python版のWikidotライブラリ
