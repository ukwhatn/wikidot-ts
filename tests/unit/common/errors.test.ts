/**
 * エラークラスのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import {
  AMCError,
  AMCHttpError,
  ForbiddenError,
  LoginRequiredError,
  NoElementError,
  NotFoundException,
  ResponseDataError,
  TargetError,
  TargetExistsError,
  UnexpectedError,
  WikidotError,
  WikidotStatusError,
} from '../../../src/common/errors';

describe('WikidotError', () => {
  test('基本エラーを作成できる', () => {
    const error = new WikidotError('test error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WikidotError);
    expect(error.message).toBe('test error');
    expect(error.name).toBe('WikidotError');
  });
});

describe('UnexpectedError', () => {
  test('予期しないエラーを作成できる', () => {
    const error = new UnexpectedError('unexpected error');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(UnexpectedError);
    expect(error.message).toBe('unexpected error');
    expect(error.name).toBe('UnexpectedError');
  });
});

describe('LoginRequiredError', () => {
  test('ログイン必須エラーを作成できる', () => {
    const error = new LoginRequiredError('login required');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(LoginRequiredError);
    expect(error.message).toBe('login required');
    expect(error.name).toBe('LoginRequiredError');
  });
});

describe('AMCError', () => {
  test('AMCエラーを作成できる', () => {
    const error = new AMCError('amc error');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(AMCError);
    expect(error.message).toBe('amc error');
  });
});

describe('AMCHttpError', () => {
  test('HTTPステータスエラーを作成できる', () => {
    const error = new AMCHttpError('http error', 404);

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(AMCHttpError);
    expect(error.message).toBe('http error');
    expect(error.statusCode).toBe(404);
  });

  test('ステータスコードを含むメッセージ', () => {
    const error = new AMCHttpError('Not Found', 404);

    expect(error.statusCode).toBe(404);
  });
});

describe('WikidotStatusError', () => {
  test('Wikidotステータスエラーを作成できる', () => {
    const error = new WikidotStatusError('wikidot error', 'no_permission');

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(WikidotStatusError);
    expect(error.message).toBe('wikidot error');
    expect(error.statusCode).toBe('no_permission');
  });

  test('様々なステータスコード', () => {
    const tryAgain = new WikidotStatusError('retry', 'try_again');
    const notOk = new WikidotStatusError('failed', 'not_ok');

    expect(tryAgain.statusCode).toBe('try_again');
    expect(notOk.statusCode).toBe('not_ok');
  });
});

describe('ResponseDataError', () => {
  test('レスポンスデータエラーを作成できる', () => {
    const error = new ResponseDataError('invalid response');

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(ResponseDataError);
    expect(error.message).toBe('invalid response');
  });
});

describe('NotFoundException', () => {
  test('リソース未検出エラーを作成できる', () => {
    const error = new NotFoundException('page not found');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe('page not found');
  });
});

describe('TargetExistsError', () => {
  test('リソース重複エラーを作成できる', () => {
    const error = new TargetExistsError('page already exists');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(TargetExistsError);
    expect(error.message).toBe('page already exists');
  });
});

describe('TargetError', () => {
  test('ターゲットエラーを作成できる', () => {
    const error = new TargetError('target error');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(TargetError);
    expect(error.message).toBe('target error');
  });
});

describe('ForbiddenError', () => {
  test('アクセス禁止エラーを作成できる', () => {
    const error = new ForbiddenError('access denied');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe('access denied');
  });
});

describe('NoElementError', () => {
  test('要素未検出エラーを作成できる', () => {
    const error = new NoElementError('element not found');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(NoElementError);
    expect(error.message).toBe('element not found');
  });
});

describe('エラー階層', () => {
  test('すべてのエラーはWikidotErrorを継承している', () => {
    const errors = [
      new UnexpectedError(''),
      new LoginRequiredError(''),
      new AMCError(''),
      new AMCHttpError('', 500),
      new WikidotStatusError('', 'error'),
      new ResponseDataError(''),
      new NotFoundException(''),
      new TargetExistsError(''),
      new TargetError(''),
      new ForbiddenError(''),
      new NoElementError(''),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(WikidotError);
    }
  });

  test('AMC関連エラーはAMCErrorを継承している', () => {
    const amcErrors = [
      new AMCHttpError('', 500),
      new WikidotStatusError('', 'error'),
      new ResponseDataError(''),
    ];

    for (const error of amcErrors) {
      expect(error).toBeInstanceOf(AMCError);
    }
  });
});
