/**
 * Page source parser unit tests
 */
import { describe, expect, test } from 'bun:test';
import { parsePageSource } from '../../../src/util/parser';

describe('parsePageSource', () => {
  test('Converts consecutive &nbsp; after a link to the same number of spaces', () => {
    const body =
      '<div class="page-source">\n' +
      '\t[[include <a href="/component:image-block">component:image-block</a>&nbsp;&nbsp;<br />\n' +
      'name=x.png|<br />\n' +
      ']]\n' +
      '</div>\n';

    expect(parsePageSource(body)).toBe('\n\t[[include component:image-block  \nname=x.png|\n]]\n');
  });

  test('Converts consecutive &nbsp; in text and at line end to spaces', () => {
    const body =
      '<div class="page-source">mid&nbsp;&nbsp;two<br />\n[[div&nbsp;&nbsp;<br />\n]]</div>';

    expect(parsePageSource(body)).toBe('mid  two\n[[div  \n]]');
  });

  test('Keeps literal U+00A0 characters in the source', () => {
    const body = '<div class="page-source">a b&nbsp;c</div>';

    expect(parsePageSource(body)).toBe('a b c');
  });

  test('Parses source containing Japanese text', () => {
    const body = '<div class="page-source">見出し&nbsp;&nbsp;<br />\n本文</div>';

    expect(parsePageSource(body)).toBe('見出し  \n本文');
  });

  test('Returns empty string for empty source', () => {
    expect(parsePageSource('<div class="page-source"></div>')).toBe('');
  });

  test('Returns null when div.page-source is missing', () => {
    expect(parsePageSource('<div>no source</div>')).toBeNull();
  });
});
