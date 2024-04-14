"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StringUtil = void 0;
const table_1 = require("./table");
/**
 * @class StringUtil
 * @description 文字列操作に関するユーティリティクラス
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
class StringUtil {
}
exports.StringUtil = StringUtil;
/**
 * @method toUnix
 * @description 文字列をUnix形式に変換する
 * @param targetStr 対象の文字列
 * @returns Unix形式に変換された文字列
 * @version 1.0.0
 * @since 1.0.0
 */
StringUtil.toUnix = (targetStr) => {
    // MEMO: legacy wikidotの実装に合わせている
    // 変換実施
    targetStr = targetStr.replace(/[^]/g, (char) => table_1.specialCharMap[char] || char);
    // lowercaseへの変換
    targetStr = targetStr.toLowerCase();
    // ascii以外の文字を削除
    targetStr = targetStr.replace(/[^a-z0-9\-:_]/g, '-');
    targetStr = targetStr.replace(/^_/, ':_');
    targetStr = targetStr.replace(/(?<!:)_/g, '-');
    targetStr = targetStr.replace(/^-*/, '');
    targetStr = targetStr.replace(/-*$/, '');
    targetStr = targetStr.replace(/-{2,}/g, '-');
    targetStr = targetStr.replace(/:{2,}/g, ':');
    targetStr = targetStr.replace(':-', ':');
    targetStr = targetStr.replace('-:', ':');
    targetStr = targetStr.replace('_-', '_');
    targetStr = targetStr.replace('-_', '_');
    // 先頭と末尾の:を削除
    targetStr = targetStr.replace(/^:/, '');
    targetStr = targetStr.replace(/:$/, '');
    return targetStr;
};
//# sourceMappingURL=stringUtil.js.map