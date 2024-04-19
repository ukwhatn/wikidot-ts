export class APIKeys {
  /**
   * APIキーのオブジェクト
   *
   * @param roKey - Read Only Key
   * @param rwKey - Read-Write Key
   */
  constructor(
    public readonly roKey: string,
    public readonly rwKey: string,
  ) {}
}
