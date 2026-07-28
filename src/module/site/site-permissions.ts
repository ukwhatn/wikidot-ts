/**
 * Encoders/decoders for Wikidot's compact permission and rating strings
 *
 * Manage Site's category objects hold permissions as a single semicolon-separated
 * string (e.g. `v:armo;c:m;...`), forum permissions in a similar but distinct
 * format, and rating configuration as a fixed 4-character code (e.g. `drvM`).
 * These are typed here instead of being passed around as raw strings so callers
 * get validation and IDE support; see 30_plan.md D4 in the sibling wikidot.py
 * repo's memory directory for the design rationale (in particular: unknown
 * symbols are preserved through a decode/encode round trip rather than dropped,
 * since at least one forum permission symbol ("s") is defined in Wikidot's
 * client JS but has an unconfirmed purpose). This is a direct port of
 * wikidot.py's `module/site_permissions.py`.
 */

/** Actor that can be granted a permission */
export type Actor = 'anonymous' | 'registered' | 'member' | 'author';

/**
 * Fixed column order used when encoding an actor set back to symbols.
 * Matches the "users" column order documented in 40_admin-managesite.md
 * (a/r/m/o), which the "v:armo" example relies on.
 */
const ACTOR_ORDER: readonly Actor[] = ['anonymous', 'registered', 'member', 'author'];

const ACTOR_TO_SYMBOL: Record<Actor, string> = {
  anonymous: 'a',
  registered: 'r',
  member: 'm',
  author: 'o',
};

const SYMBOL_TO_ACTOR: Record<string, Actor> = {
  a: 'anonymous',
  r: 'registered',
  m: 'member',
  o: 'author',
};

/** Encode an actor set into its fixed-order symbol string (e.g. "armo") */
function encodeActors(actors: ReadonlySet<Actor>): string {
  return ACTOR_ORDER.filter((actor) => actors.has(actor))
    .map((actor) => ACTOR_TO_SYMBOL[actor])
    .join('');
}

/**
 * Decode a symbol string into an actor set.
 * Returns `null` (instead of a partial set) if any character is not a known
 * actor symbol, so the caller can preserve the whole segment verbatim rather
 * than silently drop the unrecognized part.
 */
function decodeActors(symbols: string): ReadonlySet<Actor> | null {
  const actors = new Set<Actor>();
  for (const symbol of symbols) {
    const actor = SYMBOL_TO_ACTOR[symbol];
    if (!actor) {
      return null;
    }
    actors.add(actor);
  }
  return actors;
}

/** Row (permission) order is fixed by 40_admin-managesite.md. */
const PAGE_PERM_ORDER = ['v', 'c', 'e', 'm', 'd', 'a', 'r', 'z', 'o'] as const;
type PagePermField =
  | 'view'
  | 'create'
  | 'edit'
  | 'move'
  | 'delete'
  | 'uploadFiles'
  | 'renameFiles'
  | 'replaceFiles'
  | 'showOptions';
const PAGE_PERM_FIELD: Record<(typeof PAGE_PERM_ORDER)[number], PagePermField> = {
  v: 'view',
  c: 'create',
  e: 'edit',
  m: 'move',
  d: 'delete',
  a: 'uploadFiles',
  r: 'renameFiles',
  z: 'replaceFiles',
  o: 'showOptions',
};

/** Constructor data for {@link PagePermissions} */
export interface PagePermissionsData {
  view?: Iterable<Actor>;
  create?: Iterable<Actor>;
  edit?: Iterable<Actor>;
  move?: Iterable<Actor>;
  delete?: Iterable<Actor>;
  uploadFiles?: Iterable<Actor>;
  renameFiles?: Iterable<Actor>;
  replaceFiles?: Iterable<Actor>;
  showOptions?: Iterable<Actor>;
  /**
   * Raw "letter:users" segments this library did not recognize, preserved
   * verbatim so a decode -> encode round trip never loses data
   */
  unknown?: readonly string[];
}

/** Decoded form of a category's `permissions` string */
export class PagePermissions {
  readonly view: ReadonlySet<Actor>;
  readonly create: ReadonlySet<Actor>;
  readonly edit: ReadonlySet<Actor>;
  readonly move: ReadonlySet<Actor>;
  readonly delete: ReadonlySet<Actor>;
  readonly uploadFiles: ReadonlySet<Actor>;
  readonly renameFiles: ReadonlySet<Actor>;
  readonly replaceFiles: ReadonlySet<Actor>;
  readonly showOptions: ReadonlySet<Actor>;
  readonly unknown: readonly string[];

  constructor(data: PagePermissionsData = {}) {
    this.view = new Set(data.view ?? []);
    this.create = new Set(data.create ?? []);
    this.edit = new Set(data.edit ?? []);
    this.move = new Set(data.move ?? []);
    this.delete = new Set(data.delete ?? []);
    this.uploadFiles = new Set(data.uploadFiles ?? []);
    this.renameFiles = new Set(data.renameFiles ?? []);
    this.replaceFiles = new Set(data.replaceFiles ?? []);
    this.showOptions = new Set(data.showOptions ?? []);
    this.unknown = data.unknown ?? [];
  }

  /**
   * Encode back into Wikidot's `permissions` string format
   * @returns e.g. "v:armo;c:m;e:m;m:m;d:m;a:m;r:m;z:m;o:rm"
   */
  encode(): string {
    const segments = PAGE_PERM_ORDER.map(
      (symbol) => `${symbol}:${encodeActors(this[PAGE_PERM_FIELD[symbol]])}`
    );
    segments.push(...this.unknown);
    return segments.join(';');
  }

  /**
   * Decode a category's `permissions` string
   * @param s - Raw string, e.g. "v:armo;c:m;e:m;m:m;d:m;a:m;r:m;z:m;o:rm"
   */
  static decode(s: string): PagePermissions {
    const fields: Partial<Record<PagePermField, ReadonlySet<Actor>>> = {};
    const unknown: string[] = [];
    for (const segment of s.split(';')) {
      if (!segment) continue;
      const colonIndex = segment.indexOf(':');
      const symbol = colonIndex === -1 ? segment : segment.slice(0, colonIndex);
      const users = colonIndex === -1 ? '' : segment.slice(colonIndex + 1);
      const fieldName = (PAGE_PERM_FIELD as Record<string, PagePermField | undefined>)[symbol];
      const actors = fieldName ? decodeActors(users) : null;
      if (fieldName && actors) {
        fields[fieldName] = actors;
      } else {
        unknown.push(segment);
      }
    }
    return new PagePermissions({ ...fields, unknown });
  }

  /**
   * Return a copy with only the specified fields replaced, leaving the rest
   * (including `unknown`) unchanged
   */
  withUpdates(updates: Partial<Record<PagePermField, Iterable<Actor>>>): PagePermissions {
    return new PagePermissions({
      view: updates.view ?? this.view,
      create: updates.create ?? this.create,
      edit: updates.edit ?? this.edit,
      move: updates.move ?? this.move,
      delete: updates.delete ?? this.delete,
      uploadFiles: updates.uploadFiles ?? this.uploadFiles,
      renameFiles: updates.renameFiles ?? this.renameFiles,
      replaceFiles: updates.replaceFiles ?? this.replaceFiles,
      showOptions: updates.showOptions ?? this.showOptions,
      unknown: this.unknown,
    });
  }

  /**
   * Check the anonymous subset registered subset member containment convention.
   *
   * Wikidot's Manage Site UI enforces this relationship client-side (granting
   * anonymous access implies registered and member access, and so on), but it
   * is unconfirmed whether the server enforces it too. This library does not
   * auto-correct the containment (doing so could silently grant permissions
   * the caller did not ask for); call this explicitly if you want to check
   * before saving.
   * @returns Human-readable description of each violated field. Empty if
   * everything is consistent
   */
  validate(): string[] {
    const violations: string[] = [];
    for (const symbol of PAGE_PERM_ORDER) {
      const fieldName = PAGE_PERM_FIELD[symbol];
      const actors = this[fieldName];
      if (actors.has('anonymous') && !(actors.has('registered') && actors.has('member'))) {
        violations.push(`${fieldName}: anonymous access requires registered and member access too`);
      } else if (actors.has('registered') && !actors.has('member')) {
        violations.push(`${fieldName}: registered access requires member access too`);
      }
    }
    return violations;
  }
}

/**
 * Forum permission row order per 40_admin-managesite.md ("t"=Create new threads /
 * "p"=Add new posts / "e"=Edit posts). The "s" symbol is defined in Wikidot's
 * client JS (vars.permissions) but not rendered in the permission table on any
 * site checked during the survey, so its meaning is unconfirmed; it round-trips
 * through `unknown` like any other unrecognized segment instead of being
 * modeled as a known field.
 */
const FORUM_PERM_ORDER = ['t', 'p', 'e'] as const;
type ForumPermField = 'createThreads' | 'addPosts' | 'editPosts';
const FORUM_PERM_FIELD: Record<(typeof FORUM_PERM_ORDER)[number], ForumPermField> = {
  t: 'createThreads',
  p: 'addPosts',
  e: 'editPosts',
};

/** Constructor data for {@link ForumPermissions} */
export interface ForumPermissionsData {
  createThreads?: Iterable<Actor>;
  addPosts?: Iterable<Actor>;
  editPosts?: Iterable<Actor>;
  /** Raw "letter:users" segments this library did not recognize (e.g. "s") */
  unknown?: readonly string[];
}

/**
 * Decoded form of `ManageSiteForumAction/saveForumPermissions`'s per-category
 * `permissions` string (a separate encoding from PagePermissions despite the
 * similar shape)
 */
export class ForumPermissions {
  readonly createThreads: ReadonlySet<Actor>;
  readonly addPosts: ReadonlySet<Actor>;
  readonly editPosts: ReadonlySet<Actor>;
  readonly unknown: readonly string[];

  constructor(data: ForumPermissionsData = {}) {
    this.createThreads = new Set(data.createThreads ?? []);
    this.addPosts = new Set(data.addPosts ?? []);
    this.editPosts = new Set(data.editPosts ?? []);
    this.unknown = data.unknown ?? [];
  }

  /** Encode back into the forum `permissions` string format */
  encode(): string {
    const segments = FORUM_PERM_ORDER.map(
      (symbol) => `${symbol}:${encodeActors(this[FORUM_PERM_FIELD[symbol]])}`
    );
    segments.push(...this.unknown);
    return segments.join(';');
  }

  /** Decode a forum category's `permissions` string */
  static decode(s: string): ForumPermissions {
    const fields: Partial<Record<ForumPermField, ReadonlySet<Actor>>> = {};
    const unknown: string[] = [];
    for (const segment of s.split(';')) {
      if (!segment) continue;
      const colonIndex = segment.indexOf(':');
      const symbol = colonIndex === -1 ? segment : segment.slice(0, colonIndex);
      const users = colonIndex === -1 ? '' : segment.slice(colonIndex + 1);
      const fieldName = (FORUM_PERM_FIELD as Record<string, ForumPermField | undefined>)[symbol];
      const actors = fieldName ? decodeActors(users) : null;
      if (fieldName && actors) {
        fields[fieldName] = actors;
      } else {
        unknown.push(segment);
      }
    }
    return new ForumPermissions({ ...fields, unknown });
  }
}

const VOTER_TO_SYMBOL: Record<'registered' | 'member', string> = { registered: 'r', member: 'm' };
const SYMBOL_TO_VOTER: Record<string, 'registered' | 'member'> = { r: 'registered', m: 'member' };
const KIND_TO_SYMBOL: Record<'plusOnly' | 'plusMinus' | 'stars', string> = {
  plusOnly: 'P',
  plusMinus: 'M',
  stars: 'S',
};
const SYMBOL_TO_KIND: Record<string, 'plusOnly' | 'plusMinus' | 'stars'> = {
  P: 'plusOnly',
  M: 'plusMinus',
  S: 'stars',
};

/** Constructor data for {@link RatingSettings} */
export interface RatingSettingsData {
  enabled: boolean;
  voters: 'registered' | 'member';
  anonymous: boolean;
  kind: 'plusOnly' | 'plusMinus' | 'stars';
}

/** Decoded form of a category's 4-character `rating` code (e.g. "drvM") */
export class RatingSettings {
  readonly enabled: boolean;
  readonly voters: 'registered' | 'member';
  readonly anonymous: boolean;
  readonly kind: 'plusOnly' | 'plusMinus' | 'stars';

  constructor(data: RatingSettingsData) {
    this.enabled = data.enabled;
    this.voters = data.voters;
    this.anonymous = data.anonymous;
    this.kind = data.kind;
  }

  /**
   * Encode back into Wikidot's 4-character `rating` code
   * @returns e.g. "drvM"
   */
  encode(): string {
    return [
      this.enabled ? 'e' : 'd',
      VOTER_TO_SYMBOL[this.voters],
      this.anonymous ? 'a' : 'v',
      KIND_TO_SYMBOL[this.kind],
    ].join('');
  }

  /**
   * Decode a category's `rating` code
   * @param s - 4-character code, e.g. "drvM"
   * @throws {Error} If `s` is not a recognized 4-character code. Unlike
   * PagePermissions/ForumPermissions, no unrecognized-but-real variant of this
   * code was found during the survey (each of the 4 positions has exactly 2
   * documented values), so this throws instead of silently guessing at an
   * unknown format
   */
  static decode(s: string): RatingSettings {
    const voter = SYMBOL_TO_VOTER[s[1] ?? ''];
    const kind = SYMBOL_TO_KIND[s[3] ?? ''];
    if (
      s.length !== 4 ||
      (s[0] !== 'e' && s[0] !== 'd') ||
      !voter ||
      (s[2] !== 'a' && s[2] !== 'v') ||
      !kind
    ) {
      throw new Error(`Invalid rating code: ${JSON.stringify(s)}`);
    }
    return new RatingSettings({
      enabled: s[0] === 'e',
      voters: voter,
      anonymous: s[2] === 'a',
      kind,
    });
  }
}
