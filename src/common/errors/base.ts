/**
 * Wikidotライブラリの基底エラークラス
 * 全てのカスタムエラーはこのクラスを継承する
 */
export abstract class WikidotError extends Error {
  /** エラー名 */
  public override readonly name: string;

  /**
   * @param message - エラーメッセージ
   */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * 予期せぬエラー
 * 内部的な不整合やバグを表す
 */
export class UnexpectedError extends WikidotError {}
