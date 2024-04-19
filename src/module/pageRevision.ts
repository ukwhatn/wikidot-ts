import { Page } from './page'
import { AbstractUser } from './user'
import { PageSource } from './pageSource'
import { StringUtil } from '../util'

import * as cheerio from 'cheerio'

class PageRevisionCollection extends Array<PageRevision> {
  constructor(
    public page: Page,
    revisions: PageRevision[],
  ) {
    super(...revisions)
  }

  static async _acquireSources(page: Page, revisions: PageRevision[]): Promise<PageRevision[]> {
    const targetRevisions = [...revisions].filter((revision) => !revision.isSourceAcquired())

    if (targetRevisions.length === 0) {
      return revisions
    }

    const responses = await page.site.amcRequest(
      targetRevisions.map((revision) => ({
        moduleName: 'history/PageSourceModule',
        revision_id: revision.id,
      })),
    )

    for (let i = 0; i < targetRevisions.length; i++) {
      const revision = targetRevisions[i]
      const response = responses[i]
      revision.source = new PageSource(page, cheerio.load(response.data.body)('div.page-source').text().trim())
    }

    return revisions
  }

  async getSources(): Promise<PageRevision[]> {
    return await PageRevisionCollection._acquireSources(this.page, this)
  }

  static async _acquireHTMLs(page: Page, revisions: PageRevision[]): Promise<PageRevision[]> {
    const targetRevisions = [...revisions].filter((revision) => !revision.isHTMLAcquired())

    if (targetRevisions.length === 0) {
      return revisions
    }

    const responses = await page.site.amcRequest(
      targetRevisions.map((revision) => ({
        moduleName: 'history/PageVersionModule',
        revision_id: revision.id,
      })),
    )

    for (let i = 0; i < targetRevisions.length; i++) {
      const revision = targetRevisions[i]
      const response = responses[i]
      const source = response.data.body
      const _source = StringUtil.split(
        source,
        "onclick=\"document.getElementById('page-version-info').style.display='none'\">",
        1,
      )[1]
      revision._html = StringUtil.split(_source, '</a>\n\t</div>\n\n\n\n', 1)[1].trim()
    }

    return revisions
  }

  async getHTMLs(): Promise<PageRevision[]> {
    return await PageRevisionCollection._acquireHTMLs(this.page, this)
  }
}

class PageRevision {
  constructor(
    public page: Page,
    public id: number,
    public revNo: number,
    public createdBy: AbstractUser,
    public createdAt: Date,
    public comment: string,
    public _source: PageSource | null = null,
    public _html: string | null = null,
  ) {}

  isSourceAcquired(): boolean {
    return this._source !== null
  }

  isHTMLAcquired(): boolean {
    return this._html !== null
  }

  get source(): Promise<PageSource> {
    if (!this.isSourceAcquired()) {
      return PageRevisionCollection._acquireSources(this.page, [this]).then(() => this._source!)
    }
    return Promise.resolve(this._source!)
  }

  set source(value: PageSource) {
    this._source = value
  }

  get html(): Promise<string> {
    if (!this.isHTMLAcquired()) {
      return PageRevisionCollection._acquireHTMLs(this.page, [this]).then(() => this._html!)
    }
    return Promise.resolve(this._html!)
  }

  set html(value: string) {
    this._html = value
  }
}

export { PageRevisionCollection, PageRevision }
