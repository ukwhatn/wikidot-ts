// Base errors

// AMC errors
export { AMCError, AMCHttpError, ResponseDataError, WikidotStatusError } from './amc';
export { UnexpectedError, WikidotError } from './base';
// Session errors
export { LoginRequiredError, SessionCreateError, SessionError } from './session';

// Target errors
export {
  ForbiddenError,
  NoElementError,
  NotFoundException,
  TargetError,
  TargetExistsError,
} from './target';
