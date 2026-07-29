/**
 * Error classes unit tests
 */
import { describe, expect, test } from 'bun:test';
import {
  AMCError,
  AMCHttpError,
  ForbiddenError,
  FormErrorsError,
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
import type { AMCResponse } from '../../../src/connector/amc-types';

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

  test('response is undefined when not provided (backward compatible)', () => {
    const error = new WikidotStatusError('failed', 'not_ok');

    expect(error.response).toBeUndefined();
  });

  test('response carries the raw AMC payload when provided', () => {
    const response: AMCResponse = { status: 'not_ok', message: 'nope' };
    const error = new WikidotStatusError('failed', 'not_ok', response);

    expect(error.response).toBe(response);
  });
});

describe('FormErrorsError', () => {
  test('Is a WikidotStatusError', () => {
    const error = new FormErrorsError('form errors', 'form_errors');

    expect(error).toBeInstanceOf(AMCError);
    expect(error).toBeInstanceOf(WikidotStatusError);
    expect(error).toBeInstanceOf(FormErrorsError);
  });

  test('errors reads from the "formErrors" key (Forum/Clone/saveGeneral, etc.)', () => {
    const response: AMCResponse = {
      status: 'form_errors',
      formErrors: { name: 'Please provide the site title', defaultPage: 'Invalid page name' },
    };
    const error = new FormErrorsError('form errors', 'form_errors', response);

    expect(error.errors).toEqual({
      name: 'Please provide the site title',
      defaultPage: 'Invalid page name',
    });
  });

  test('errors reads from the "errors" key (WikiPageAction/savePage)', () => {
    const response: AMCResponse = {
      status: 'form_errors',
      errors: { title: 'Title is required' },
    };
    const error = new FormErrorsError('form errors', 'form_errors', response);

    expect(error.errors).toEqual({ title: 'Title is required' });
  });

  test('errors falls back to the "message" key (saveTags, form_error singular)', () => {
    const response: AMCResponse = {
      status: 'form_error',
      message: 'Tags could not be saved',
    };
    const error = new FormErrorsError('form error', 'form_error', response);

    expect(error.errors).toEqual({ _message: 'Tags could not be saved' });
  });

  test('errors is an empty record when response is missing', () => {
    const error = new FormErrorsError('form errors', 'form_errors');

    expect(error.errors).toEqual({});
  });

  test('formErrors takes priority over errors and message when multiple are present', () => {
    const response: AMCResponse = {
      status: 'form_errors',
      formErrors: { name: 'from formErrors' },
      errors: { name: 'from errors' },
      message: 'from message',
    };
    const error = new FormErrorsError('form errors', 'form_errors', response);

    expect(error.errors).toEqual({ name: 'from formErrors' });
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
      new FormErrorsError('', 'form_errors'),
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
      new FormErrorsError('', 'form_errors'),
      new ResponseDataError(''),
    ];

    for (const error of amcErrors) {
      expect(error).toBeInstanceOf(AMCError);
    }
  });
});
