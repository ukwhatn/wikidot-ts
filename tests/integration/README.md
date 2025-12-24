# 統合テスト

## 概要

このディレクトリには、実際のWikidotサーバー（ukwhatn-ci.wikidot.com）に対する統合テストが含まれています。

## 環境設定

### 必要な環境変数

```bash
export WIKIDOT_USERNAME=your_username
export WIKIDOT_PASSWORD=your_password
```

### テストサイト

- サイト名: `ukwhatn-ci.wikidot.com`
- 要件: テストアカウントがサイトのメンバーであること

## テスト実行

```bash
# 統合テストのみ実行
cd /Users/yuki.c.watanabe/dev/scp/libs/wikidot-ts
bun test tests/integration/

# 特定のテストファイルを実行
bun test tests/integration/page-lifecycle.test.ts

# 全テスト（ユニット + 統合）
bun test
```

## テストカバー範囲

| テストファイル | カバー機能 |
|--------------|----------|
| site.test.ts | サイト取得、ページ取得 |
| page-lifecycle.test.ts | ページ作成、取得、編集、削除 |
| page-tags.test.ts | タグ追加、変更、削除 |
| page-meta.test.ts | メタ設定、取得、更新、削除 |
| page-revision.test.ts | リビジョン履歴取得、最新リビジョン取得 |
| page-votes.test.ts | 投票情報取得 |
| page-discussion.test.ts | ディスカッション取得、投稿作成 |
| forum-category.test.ts | フォーラムカテゴリ一覧、スレッド取得 |
| user.test.ts | ユーザー検索、一括取得 |
| pm.test.ts | 受信箱/送信箱取得、メッセージ確認 |

## スキップ対象機能

以下の機能は統合テストからスキップされています:

### 1. サイト参加申請
- 理由: テストサイトへの参加申請は手動承認が必要
- 該当API: `site.application.*`

### 2. プライベートメッセージ送信
- 理由: 実ユーザーへのメッセージ送信を避けるため
- 該当API: `client.privateMessage.send()`
- 備考: 取得のみテスト。事前にInbox/Outboxにメッセージを入れておくこと

### 3. フォーラムカテゴリ/スレッド作成
- 理由: フォーラム構造への永続的な変更を避けるため
- 該当API: `site.forum.createThread()`
- 備考: ページディスカッションへの投稿のみテスト

### 4. メンバー招待
- 理由: 実ユーザーへの招待を避けるため
- 該当API: `site.member.invite()`

## クリーンアップ戦略

1. 各テストの`beforeAll`でテスト用ページを作成
2. `afterAll`で作成したページを削除
3. 削除失敗時はログ出力して続行
4. ページ命名: `{prefix}-{timestamp}-{random6chars}` 形式で衝突を回避

## 注意事項

- 環境変数が未設定の場合、統合テストは自動的にスキップされます
- テストは各ファイル内で順次実行されます（テスト間に依存関係がある場合があるため）
- APIレート制限に注意してください
- テスト実行後、クリーンアップに失敗したページが残る場合があります
  - ページ名プレフィックス（`test-`）で識別可能
  - 必要に応じて手動削除してください
