"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userParse = void 0;
const user_1 = require("../../module/user");
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
const userParse = (client, elem) => {
    if (elem.hasClass('deleted')) {
        return new user_1.DeletedUser(client, Number(elem.attr('data-id')));
    }
    else if (elem.hasClass('anonymous')) {
        const ip = elem.find('span.ip').text().replace('(', '').replace(')', '').trim();
        return new user_1.AnonymousUser(client, undefined, undefined, undefined, undefined, ip);
    }
    else if (elem.text() === 'Wikidot') {
        return new user_1.WikidotUser(client);
    }
    else {
        const userElem = elem.find('a').last();
        const userName = userElem.text();
        const userUnix = userElem.attr('href')?.replace('http://www.wikidot.com/user:info/', '') || '';
        const userId = Number(userElem.attr('onclick')?.replace('WIKIDOT.page.listeners.userInfo(', '').replace('); return false;', ''));
        return new user_1.User(client, userId, userName, userUnix, `http://www.wikidot.com/avatar.php?userid=${userId}`);
    }
};
exports.userParse = userParse;
//# sourceMappingURL=user.js.map