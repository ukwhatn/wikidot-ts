// ---
// 基底クラス
// ---

/**
 * 独自例外の基底クラス
 *
 * @param message - エラーメッセージ
 */
class WikidotException extends Error {
    constructor(message: string) {
        super(message)
    }
}

// ---
// ワイルドカード
// ---

/**
 * 予期せぬ例外が発生したときの例外
 *
 * @param message - エラーメッセージ
 */
class UnexpectedException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

// ---
// セッション関連
// ---

/**
 * セッションの作成に失敗したときの例外
 *
 * @param message - エラーメッセージ
 */
class SessionCreateException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

/**
 * ログインが必要なメソッドをときの例外
 *
 * @param message - エラーメッセージ
 */
class LoginRequiredException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

// ---
// AMC関連
// ---

/**
 * ajax-module-connector.phpへのリクエストに失敗したときの例外
 *
 * @param message - エラーメッセージ
 */
class AjaxModuleConnectorException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

/**
 * AMCから返却されたHTTPステータスが200以外だったときの例外
 *
 * @param message - エラーメッセージ
 * @param statusCode - HTTPステータスコード
 */
class AMCHttpStatusCodeException extends AjaxModuleConnectorException {
    constructor(
        message: string,
        public readonly statusCode: number,
    ) {
        super(message)
    }
}

/**
 * AMCから返却されたデータ内のステータスがokではなかったときの例外
 *
 * HTTPステータスが200以外の場合はAMCHttpStatusCodeExceptionを投げる
 *
 * @param message - エラーメッセージ
 * @param statusCode - WikidotステータスコードAMCから返却されたデータ内のステータスがokではなかったときの例外
 */
class WikidotStatusCodeException extends AjaxModuleConnectorException {
    constructor(
        message: string,
        public readonly statusCode: string,
    ) {
        super(message)
    }
}

/**
 * AMCから返却されたデータが不正だったときの例外
 *
 * @param message - エラーメッセージ
 */
class ResponseDataException extends AjaxModuleConnectorException {
    constructor(message: string) {
        super(message)
    }
}

// ---
// ターゲットエラー関連
// ---

/**
 * サイトやページ・ユーザが見つからなかったときの例外
 *
 * @param message - エラーメッセージ
 */
class NotFoundException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

/**
 * メソッドの対象としたオブジェクトに操作が適用できないときの例外
 *
 * @param message - エラーメッセージ
 */
class TargetErrorException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

/**
 * 権限がないときの例外
 *
 * @param message - エラーメッセージ
 */
class ForbiddenException extends WikidotException {
    constructor(message: string) {
        super(message)
    }
}

export {
    WikidotException,
    UnexpectedException,
    SessionCreateException,
    LoginRequiredException,
    AjaxModuleConnectorException,
    AMCHttpStatusCodeException,
    WikidotStatusCodeException,
    ResponseDataException,
    NotFoundException,
    TargetErrorException,
    ForbiddenException,
}
