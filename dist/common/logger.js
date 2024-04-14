"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
// Logger設定
function setupLogger(name = 'wikidot', level = 'debug') {
    return winston_1.default.createLogger({
        level,
        format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${name}/${level}] ${message}`;
        })),
        transports: [new winston_1.default.transports.Console()],
    });
}
exports.logger = setupLogger();
//# sourceMappingURL=logger.js.map