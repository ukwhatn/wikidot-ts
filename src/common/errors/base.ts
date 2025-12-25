/**
 * Base error class for the Wikidot library
 * All custom errors inherit from this class
 */
export abstract class WikidotError extends Error {
  /** Error name */
  public override readonly name: string;

  /**
   * @param message - Error message
   */
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Unexpected error
 * Represents internal inconsistencies or bugs
 */
export class UnexpectedError extends WikidotError {}
