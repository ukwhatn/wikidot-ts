import winston from 'winston';

// Logger設定
function setupLogger(name: string = 'wikidot', level: string = 'debug'): winston.Logger {
    return winston.createLogger({
        level,
        format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.printf(({timestamp, level, message}) => {
                return `${timestamp} [${name}/${level}] ${message}`;
            })
        ),
        transports: [new winston.transports.Console()],
    });
}

export const logger = setupLogger();