import type { AbstractUser } from '../user';
import type { Page } from './page';

/**
 * ページ投票データ
 */
export interface PageVoteData {
  page: Page;
  user: AbstractUser;
  value: number;
}

/**
 * ページへの投票（レーティング）
 */
export class PageVote {
  /** 投票が属するページ */
  public readonly page: Page;

  /** 投票したユーザー */
  public readonly user: AbstractUser;

  /** 投票値（+1/-1 または 数値） */
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
 * ページ投票コレクション
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
   * ユーザーで検索
   * @param user - 検索するユーザー
   * @returns 投票（存在しない場合はundefined）
   */
  findByUser(user: AbstractUser): PageVote | undefined {
    return this.find((vote) => vote.user.id === user.id);
  }
}
