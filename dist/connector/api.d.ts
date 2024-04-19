export declare class APIKeys {
    readonly roKey: string;
    readonly rwKey: string;
    /**
     * APIキーのオブジェクト
     *
     * @param roKey - Read Only Key
     * @param rwKey - Read-Write Key
     */
    constructor(roKey: string, rwKey: string);
}
