// Base errors
export { WikidotError, UnexpectedError } from './base';

// Session errors
export { SessionError, SessionCreateError, LoginRequiredError } from './session';

// AMC errors
export { AMCError, AMCHttpError, WikidotStatusError, ResponseDataError } from './amc';

// Target errors
export {
  NotFoundException,
  TargetExistsError,
  TargetError,
  ForbiddenError,
  NoElementError,
} from './target';
