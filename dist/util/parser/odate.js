"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.odateParse = void 0;
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
const odateParse = (odateElement) => {
    const odateClasses = odateElement.attr('class')?.split(' ') || [];
    for (const odateClass of odateClasses) {
        if (odateClass.startsWith('time_')) {
            const unixTime = parseInt(odateClass.replace('time_', ''), 10);
            return new Date(unixTime * 1000);
        }
    }
    throw new Error('odate element does not contain a valid unix time');
};
exports.odateParse = odateParse;
//# sourceMappingURL=odate.js.map