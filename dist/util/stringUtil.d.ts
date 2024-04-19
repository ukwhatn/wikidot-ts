/**
 * @class StringUtil
 * @description 文字列操作に関するユーティリティクラス
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
declare class StringUtil {
    /**
     * @method toUnix
     * @description 文字列をUnix形式に変換する
     * @param targetStr 対象の文字列
     * @returns Unix形式に変換された文字列
     * @version 1.0.0
     * @since 1.0.0
     */
    static toUnix: (targetStr: string) => string;
    static split: (targetStr: string, separator: string, maxSplit: number) => string[];
}
export { StringUtil };
