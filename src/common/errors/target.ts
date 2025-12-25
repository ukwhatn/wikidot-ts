import { WikidotError } from './base';

/**
 * Resource not found error
 * Thrown when the requested resource does not exist
 */
export class NotFoundException extends WikidotError {}

/**
 * Resource already exists error
 * Thrown when attempting to create a resource that already exists
 */
export class TargetExistsError extends WikidotError {}

/**
 * Target state error
 * Thrown when a resource is in an inoperable state (e.g., locked)
 */
export class TargetError extends WikidotError {}

/**
 * Access denied error
 * Thrown when an operation is denied due to insufficient permissions
 */
export class ForbiddenError extends WikidotError {}

/**
 * HTML element not found error
 * Thrown when a required element is not found during parsing
 */
export class NoElementError extends WikidotError {}
