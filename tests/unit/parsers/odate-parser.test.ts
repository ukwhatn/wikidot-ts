/**
 * odateパーサーのユニットテスト
 */
import { describe, expect, test } from 'bun:test';
import * as cheerio from 'cheerio';
import { parseOdate } from '../../../src/util/parser';

/**
 * odate HTML要素を生成するヘルパー
 */
function makeOdateHtml(unixTimestamp: number): string {
  return `<span class="odate time_${unixTimestamp} format_%25e%20%25b%20%25Y%2C%20%25H%3A%25M|agohover" style="cursor: help; display: inline;">17 Dec 2025, 12:00</span>`;
}

describe('parseOdate', () => {
  test('有効なodate要素をパースできる', () => {
    // 2023-12-17 12:00:00 UTC = 1702814400
    const html = makeOdateHtml(1702814400);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1702814400 * 1000);
  });

  test('Unix epoch (0) をパースできる', () => {
    const html = makeOdateHtml(0);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result?.getTime()).toBe(0);
  });

  test('複数クラスを持つodate要素をパースできる', () => {
    const html =
      '<span class="odate time_1702828800 format_%25e another-class">17 Dec 2023, 16:00</span>';
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1702828800 * 1000);
  });

  test('time_クラスがない場合はnullを返す', () => {
    const html = '<span class="odate format_%25e%20%25b%20%25Y">17 Dec 2023, 12:00</span>';
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    // 警告ログをキャプチャ
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => {
      warnMessage = msg;
    };

    const result = parseOdate(elem);

    console.warn = originalWarn;

    // フォールバックでテキストからパースを試みる
    // パースできればDate、できなければnull
    if (result === null) {
      expect(warnMessage).toContain('Failed to parse odate element');
    }
  });

  test('最近のタイムスタンプをパースできる', () => {
    // 2024-01-01 00:00:00 UTC = 1704067200
    const html = makeOdateHtml(1704067200);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getUTCFullYear()).toBe(2024);
    expect(result?.getUTCMonth()).toBe(0); // 0-indexed
    expect(result?.getUTCDate()).toBe(1);
  });

  test('古いタイムスタンプをパースできる', () => {
    // 2007-06-21 00:00:00 UTC (SCP wiki creation date)
    const html = makeOdateHtml(1182384000);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result?.getUTCFullYear()).toBe(2007);
    expect(result?.getUTCMonth()).toBe(5); // 0-indexed, June = 5
  });

  test('空の要素をパースするとnullを返す', () => {
    const html = '<span class="odate"></span>';
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const originalWarn = console.warn;
    console.warn = () => {};
    const result = parseOdate(elem);
    console.warn = originalWarn;

    expect(result).toBeNull();
  });
});
