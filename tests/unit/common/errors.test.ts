/**
 * Error classes unit tests
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
  test('Can create basic error', () => {
    const error = new WikidotError('test error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WikidotError);
    expect(error.message).toBe('test error');
    expect(error.name).toBe('WikidotError');
  });
});

describe('UnexpectedError', () => {
  test('Can create unexpected error', () => {
    const error = new UnexpectedError('unexpected error');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(UnexpectedError);
    expect(error.message).toBe('unexpected error');
    expect(error.name).toBe('UnexpectedError');
  });
});

describe('LoginRequiredError', () => {
  test('Can create login required error', () => {
    const error = new LoginRequiredError('login required');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(LoginRequiredError);
    expect(error.message).toBe('login required');
    expect(error.name).toBe('LoginRequiredError');
  });
});

describe('AMCError', () => {
  test('Can create AMC error', () => {
    const error = new AMCError('amc error');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(AMCError);
    expect(error.message).toBe('amc error');
  });
});

describe('AMCHttpError', () => {
  test('Can create HTTP status error', () => {
    const error = new AMCHttpError('http error', 404);

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(AMCHttpError);
    expect(error.message).toBe('http error');
    expect(error.statusCode).toBe(404);
  });

  test('Message includes status code', () => {
    const error = new AMCHttpError('Not Found', 404);

    expect(error.statusCode).toBe(404);
  });
});

describe('WikidotStatusError', () => {
  test('Can create Wikidot status error', () => {
    const error = new WikidotStatusError('wikidot error', 'no_permission');

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(WikidotStatusError);
    expect(error.message).toBe('wikidot error');
    expect(error.statusCode).toBe('no_permission');
  });

  test('Various status codes', () => {
    const tryAgain = new WikidotStatusError('retry', 'try_again');
    const notOk = new WikidotStatusError('failed', 'not_ok');

    expect(tryAgain.statusCode).toBe('try_again');
    expect(notOk.statusCode).toBe('not_ok');
  });
});

describe('ResponseDataError', () => {
  test('Can create response data error', () => {
    const error = new ResponseDataError('invalid response');

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(ResponseDataError);
    expect(error.message).toBe('invalid response');
  });
});

describe('NotFoundException', () => {
  test('Can create resource not found error', () => {
    const error = new NotFoundException('page not found');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe('page not found');
  });
});

describe('TargetExistsError', () => {
  test('Can create resource already exists error', () => {
    const error = new TargetExistsError('page already exists');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(TargetExistsError);
    expect(error.message).toBe('page already exists');
  });
});

describe('TargetError', () => {
  test('Can create target error', () => {
    const error = new TargetError('target error');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(TargetError);
    expect(error.message).toBe('target error');
  });
});

describe('ForbiddenError', () => {
  test('Can create access forbidden error', () => {
    const error = new ForbiddenError('access denied');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.message).toBe('access denied');
  });
});

describe('NoElementError', () => {
  test('Can create element not found error', () => {
    const error = new NoElementError('element not found');

    expect(error).toBeInstanceOf(WikidotError);
    expect(error).toBeInstanceOf(NoElementError);
    expect(error.message).toBe('element not found');
  });
});

describe('Error hierarchy', () => {
  test('All errors inherit from WikidotError', () => {
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

  test('AMC related errors inherit from AMCError', () => {
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
