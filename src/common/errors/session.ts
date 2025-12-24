import { WikidotError } from './base';

/**
 * Base error for session related issues
 */
export class SessionError extends WikidotError {}

/**
 * Session creation failure error
 * Thrown when a login attempt fails
 */
export class SessionCreateError extends SessionError {}

/**
 * Login required error
 * Thrown when an authenticated operation is attempted without login
 */
export class LoginRequiredError extends SessionError {
  constructor(message = 'Login is required for this operation') {
    super(message);
  }
}
