import * as cheerio from 'cheerio';

const PRIVATE_USE_START = 0xe000;
const PRIVATE_USE_END = 0xf8ff;

function findUnusedChar(text: string): string {
  for (let code = PRIVATE_USE_START; code <= PRIVATE_USE_END; code++) {
    const char = String.fromCharCode(code);
    if (!text.includes(char)) {
      return char;
    }
  }
  throw new Error('No unused private-use character available');
}

/**
 * Extract the source text from a Wikidot source module response
 *
 * Converts `&nbsp;` entities to ASCII spaces while keeping literal
 * U+00A0 characters in the source as they are.
 *
 * @param body - HTML body of viewsource/ViewSourceModule or history/PageSourceModule
 * @returns Text of the `div.page-source` element, or null if the element is not found
 */
export function parsePageSource(body: string): string | null {
  // パース後に   を一括置換すると、ソースに元からある U+00A0 まで空白になるため退避文字を使う
  const placeholder = findUnusedChar(body);
  const $ = cheerio.load(body.replaceAll('&nbsp;', placeholder));
  const element = $('div.page-source');
  if (element.length === 0) {
    return null;
  }
  return element.text().replaceAll(placeholder, ' ');
}
