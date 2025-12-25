import type { AbstractUser } from '../user';
import type { Page } from './page';

/**
 * Page vote data
 */
export interface PageVoteData {
  page: Page;
  user: AbstractUser;
  value: number;
}

/**
 * Page vote (rating)
 */
export class PageVote {
  /** Page this vote belongs to */
  public readonly page: Page;

  /** User who voted */
  public readonly user: AbstractUser;

  /** Vote value (+1/-1 or numeric) */
  public readonly value: number;

  constructor(data: PageVoteData) {
    this.page = data.page;
    this.user = data.user;
    this.value = data.value;
  }

  toString(): string {
    return `PageVote(user=${this.user.name}, value=${this.value})`;
  }
}

/**
 * Page vote collection
 */
export class PageVoteCollection extends Array<PageVote> {
  public readonly page: Page;

  constructor(page: Page, votes?: PageVote[]) {
    super();
    this.page = page;
    if (votes) {
      this.push(...votes);
    }
  }

  /**
   * Find by user
   * @param user - User to search for
   * @returns Vote (undefined if not found)
   */
  findByUser(user: AbstractUser): PageVote | undefined {
    return this.find((vote) => vote.user.id === user.id);
  }
}
