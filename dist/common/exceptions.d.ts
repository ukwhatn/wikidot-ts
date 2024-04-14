/**
 * 独自例外の基底クラス
 *
 * @param message - エラーメッセージ
 */
declare class WikidotException extends Error {
    constructor(message: string);
}
/**
 * 予期せぬ例外が発生したときの例外
 *
 * @param message - エラーメッセージ
 */
declare class UnexpectedException extends WikidotException {
    constructor(message: string);
}
/**
 * セッションの作成に失敗したときの例外
 *
 * @param message - エラーメッセージ
 */
declare class SessionCreateException extends WikidotException {
    constructor(message: string);
}
/**
 * ログインが必要なメソッドをときの例外
 *
 * @param message - エラーメッセージ
 */
declare class LoginRequiredException extends WikidotException {
    constructor(message: string);
}
/**
 * ajax-module-connector.phpへのリクエストに失敗したときの例外
 *
 * @param message - エラーメッセージ
 */
declare class AjaxModuleConnectorException extends WikidotException {
    constructor(message: string);
}
/**
 * AMCから返却されたHTTPステータスが200以外だったときの例外
 *
 * @param message - エラーメッセージ
 * @param statusCode - HTTPステータスコード
 */
declare class AMCHttpStatusCodeException extends AjaxModuleConnectorException {
    readonly statusCode: number;
    constructor(message: string, statusCode: number);
}
/**
 * AMCから返却されたデータ内のステータスがokではなかったときの例外
 *
 * HTTPステータスが200以外の場合はAMCHttpStatusCodeExceptionを投げる
 *
 * @param message - エラーメッセージ
 * @param statusCode - WikidotステータスコードAMCから返却されたデータ内のステータスがokではなかったときの例外
 */
declare class WikidotStatusCodeException extends AjaxModuleConnectorException {
    readonly statusCode: string;
    constructor(message: string, statusCode: string);
}
/**
 * AMCから返却されたデータが不正だったときの例外
 *
 * @param message - エラーメッセージ
 */
declare class ResponseDataException extends AjaxModuleConnectorException {
    constructor(message: string);
}
/**
 * サイトやページ・ユーザが見つからなかったときの例外
 *
 * @param message - エラーメッセージ
 */
declare class NotFoundException extends WikidotException {
    constructor(message: string);
}
/**
 * メソッドの対象としたオブジェクトに操作が適用できないときの例外
 *
 * @param message - エラーメッセージ
 */
declare class TargetErrorException extends WikidotException {
    constructor(message: string);
}
/**
 * 権限がないときの例外
 *
 * @param message - エラーメッセージ
 */
declare class ForbiddenException extends WikidotException {
    constructor(message: string);
}
export { WikidotException, UnexpectedException, SessionCreateException, LoginRequiredException, AjaxModuleConnectorException, AMCHttpStatusCodeException, WikidotStatusCodeException, ResponseDataException, NotFoundException, TargetErrorException, ForbiddenException };
