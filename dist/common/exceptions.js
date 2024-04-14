"use strict";
// ---
// 基底クラス
// ---
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForbiddenException = exports.TargetErrorException = exports.NotFoundException = exports.ResponseDataException = exports.WikidotStatusCodeException = exports.AMCHttpStatusCodeException = exports.AjaxModuleConnectorException = exports.LoginRequiredException = exports.SessionCreateException = exports.UnexpectedException = exports.WikidotException = void 0;
/**
 * 独自例外の基底クラス
 *
 * @param message - エラーメッセージ
 */
class WikidotException extends Error {
    constructor(message) {
        super(message);
    }
}
exports.WikidotException = WikidotException;
// ---
// ワイルドカード
// ---
/**
 * 予期せぬ例外が発生したときの例外
 *
 * @param message - エラーメッセージ
 */
class UnexpectedException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.UnexpectedException = UnexpectedException;
// ---
// セッション関連
// ---
/**
 * セッションの作成に失敗したときの例外
 *
 * @param message - エラーメッセージ
 */
class SessionCreateException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.SessionCreateException = SessionCreateException;
/**
 * ログインが必要なメソッドをときの例外
 *
 * @param message - エラーメッセージ
 */
class LoginRequiredException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.LoginRequiredException = LoginRequiredException;
// ---
// AMC関連
// ---
/**
 * ajax-module-connector.phpへのリクエストに失敗したときの例外
 *
 * @param message - エラーメッセージ
 */
class AjaxModuleConnectorException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.AjaxModuleConnectorException = AjaxModuleConnectorException;
/**
 * AMCから返却されたHTTPステータスが200以外だったときの例外
 *
 * @param message - エラーメッセージ
 * @param statusCode - HTTPステータスコード
 */
class AMCHttpStatusCodeException extends AjaxModuleConnectorException {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.AMCHttpStatusCodeException = AMCHttpStatusCodeException;
/**
 * AMCから返却されたデータ内のステータスがokではなかったときの例外
 *
 * HTTPステータスが200以外の場合はAMCHttpStatusCodeExceptionを投げる
 *
 * @param message - エラーメッセージ
 * @param statusCode - WikidotステータスコードAMCから返却されたデータ内のステータスがokではなかったときの例外
 */
class WikidotStatusCodeException extends AjaxModuleConnectorException {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.WikidotStatusCodeException = WikidotStatusCodeException;
/**
 * AMCから返却されたデータが不正だったときの例外
 *
 * @param message - エラーメッセージ
 */
class ResponseDataException extends AjaxModuleConnectorException {
    constructor(message) {
        super(message);
    }
}
exports.ResponseDataException = ResponseDataException;
// ---
// ターゲットエラー関連
// ---
/**
 * サイトやページ・ユーザが見つからなかったときの例外
 *
 * @param message - エラーメッセージ
 */
class NotFoundException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.NotFoundException = NotFoundException;
/**
 * メソッドの対象としたオブジェクトに操作が適用できないときの例外
 *
 * @param message - エラーメッセージ
 */
class TargetErrorException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.TargetErrorException = TargetErrorException;
/**
 * 権限がないときの例外
 *
 * @param message - エラーメッセージ
 */
class ForbiddenException extends WikidotException {
    constructor(message) {
        super(message);
    }
}
exports.ForbiddenException = ForbiddenException;
//# sourceMappingURL=exceptions.js.map