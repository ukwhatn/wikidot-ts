import { Client } from '../../module/client';
import { AbstractUser } from '../../module/user';
import * as cheerio from 'cheerio';
/**
 * @method userParse
 * @description ユーザー要素を解析し、ユーザーオブジェクトを返す
 * @param client
 * @param elem
 * @returns ユーザーオブジェクト
 * @version 1.0.0
 * @since 1.0.0
 * @public
 * @exports
 */
declare const userParse: (client: Client, elem: cheerio.Cheerio<any>) => AbstractUser;
export { userParse };
