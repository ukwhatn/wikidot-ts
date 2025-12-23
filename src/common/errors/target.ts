import { WikidotError } from './base';

/**
 * リソース未発見エラー
 * 要求されたリソースが存在しない場合
 */
export class NotFoundException extends WikidotError {}

/**
 * リソース既存エラー
 * 作成しようとしたリソースが既に存在する場合
 */
export class TargetExistsError extends WikidotError {}

/**
 * ターゲット状態エラー
 * リソースが操作不可能な状態の場合（ロック中など）
 */
export class TargetError extends WikidotError {}

/**
 * アクセス拒否エラー
 * 権限不足で操作が拒否された場合
 */
export class ForbiddenError extends WikidotError {}

/**
 * HTML要素未発見エラー
 * パース中に必要な要素が見つからない場合
 */
export class NoElementError extends WikidotError {}
