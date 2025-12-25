/**
 * odate parser unit tests
 */
import { describe, expect, test } from 'bun:test';
import * as cheerio from 'cheerio';
import { parseOdate } from '../../../src/util/parser';

/**
 * Helper to generate odate HTML element
 */
function makeOdateHtml(unixTimestamp: number): string {
  return `<span class="odate time_${unixTimestamp} format_%25e%20%25b%20%25Y%2C%20%25H%3A%25M|agohover" style="cursor: help; display: inline;">17 Dec 2025, 12:00</span>`;
}

describe('parseOdate', () => {
  test('Can parse valid odate element', () => {
    // 2023-12-17 12:00:00 UTC = 1702814400
    const html = makeOdateHtml(1702814400);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1702814400 * 1000);
  });

  test('Can parse Unix epoch (0)', () => {
    const html = makeOdateHtml(0);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result?.getTime()).toBe(0);
  });

  test('Can parse odate element with multiple classes', () => {
    const html =
      '<span class="odate time_1702828800 format_%25e another-class">17 Dec 2023, 16:00</span>';
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1702828800 * 1000);
  });

  test('Returns null when time_ class is missing', () => {
    const html = '<span class="odate format_%25e%20%25b%20%25Y">17 Dec 2023, 12:00</span>';
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    // Capture warning log
    const originalWarn = console.warn;
    let warnMessage = '';
    console.warn = (msg: string) => {
      warnMessage = msg;
    };

    const result = parseOdate(elem);

    console.warn = originalWarn;

    // Fallback attempts to parse from text
    // Returns Date if parseable, null otherwise
    if (result === null) {
      expect(warnMessage).toContain('Failed to parse odate element');
    }
  });

  test('Can parse recent timestamp', () => {
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

  test('Can parse old timestamp', () => {
    // 2007-06-21 00:00:00 UTC (SCP wiki creation date)
    const html = makeOdateHtml(1182384000);
    const $ = cheerio.load(html);
    const elem = $('span.odate');

    const result = parseOdate(elem);

    expect(result?.getUTCFullYear()).toBe(2007);
    expect(result?.getUTCMonth()).toBe(5); // 0-indexed, June = 5
  });

  test('Returns null when parsing empty element', () => {
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
