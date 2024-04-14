import { Cheerio } from 'cheerio';
/**
 * @method odateParse
 * @description odate要素を解析し、unix時間を返す
 * @param odateElement
 * @returns unix時間
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
export declare const odateParse: (odateElement: Cheerio<any>) => Date;
