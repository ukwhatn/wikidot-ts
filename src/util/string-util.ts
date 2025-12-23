/**
 * 文字列ユーティリティ
 */

import { specialCharMap } from './table/char-table';

/**
 * 文字列をUnix形式に変換する
 *
 * legacy wikidotの実装に合わせた変換を行う。
 * - 特殊文字をASCII文字に変換
 * - 小文字に変換
 * - ASCII以外の文字をハイフンに変換
 * - 連続するハイフン/コロンを単一に
 * - 先頭/末尾のハイフン/コロンを削除
 *
 * @param targetStr - 変換対象の文字列
 * @returns 変換された文字列
 */
export function toUnix(targetStr: string): string {
  // 特殊文字の変換
  let result = '';
  for (const char of targetStr) {
    const mapped = specialCharMap[char];
    result += mapped !== undefined ? mapped : char;
  }

  // lowercaseへの変換
  result = result.toLowerCase();

  // ascii以外の文字を削除
  result = result.replace(/[^a-z0-9\-:_]/g, '-');
  result = result.replace(/^_/, ':_');
  result = result.replace(/(?<!:)_/g, '-');
  result = result.replace(/^-*/, '');
  result = result.replace(/-*$/, '');
  result = result.replace(/-{2,}/g, '-');
  result = result.replace(/:{2,}/g, ':');
  result = result.replace(/:-/g, ':');
  result = result.replace(/-:/g, ':');
  result = result.replace(/_-/g, '_');
  result = result.replace(/-_/g, '_');

  // 先頭と末尾の:を削除
  result = result.replace(/^:/, '');
  result = result.replace(/:$/, '');

  return result;
}

/**
 * StringUtilクラス（Python互換）
 */
export const StringUtil = {
  toUnix,
};
