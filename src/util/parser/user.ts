import { Client } from '../../module/client'
import { AbstractUser, DeletedUser, AnonymousUser, WikidotUser, User } from '../../module/user'
import * as cheerio from 'cheerio'

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
const userParse = (client: Client, elem: cheerio.Cheerio<any>): AbstractUser => {
  if (elem.hasClass('deleted')) {
    return new DeletedUser(client, Number(elem.attr('data-id')))
  } else if (elem.hasClass('anonymous')) {
    const ip = elem.find('span.ip').text().replace('(', '').replace(')', '').trim()
    return new AnonymousUser(client, undefined, undefined, undefined, undefined, ip)
  } else if (elem.text() === 'Wikidot') {
    return new WikidotUser(client)
  } else {
    const userElem = elem.find('a').last()
    const userName = userElem.text()
    const userUnix = userElem.attr('href')?.replace('http://www.wikidot.com/user:info/', '') || ''
    const userId = Number(
      userElem.attr('onclick')?.replace('WIKIDOT.page.listeners.userInfo(', '').replace('); return false;', ''),
    )

    return new User(client, userId, userName, userUnix, `http://www.wikidot.com/avatar.php?userid=${userId}`)
  }
}

export { userParse }
