import { Site } from './site'
import { User } from './user'
import { PageSource } from './pageSource'
import { PageRevision, PageRevisionCollection } from './pageRevision'
import { PageVote, PageVoteCollection } from './pageVote'
import { ForbiddenException, UnexpectedException, WikidotStatusCodeException } from '../common/exceptions'
import { userParse } from '../util/parser/user'
import { odateParse } from '../util/parser'
import { RequestUtil } from '../util'
import * as cheerio from 'cheerio'

const DEFAULT_MODULE_BODY = [
  'fullname',
  'category',
  'name',
  'title',
  'created_at',
  'created_by_linked',
  'updated_at',
  'updated_by_linked',
  'commented_at',
  'commented_by_linked',
  'parent_fullname',
  'comments',
  'size',
  'children',
  'rating_votes',
  'rating',
  'rating_percent',
  'revisions',
  'tags',
  '_tags',
]

// noinspection JSUnusedGlobalSymbols
class SearchPagesQuery {
  pagetype?: string = '*'
  category?: string = '*'
  tags?: string | string[] = undefined
  parent?: string = undefined
  linkTo?: string = undefined
  createdAt?: string = undefined
  updatedAt?: string = undefined
  createdBy?: User | string = undefined
  rating?: string = undefined
  votes?: string = undefined
  name?: string = undefined
  fullname?: string = undefined
  range?: string = undefined
  order: string = 'created_at desc'
  offset?: number = 0
  limit?: number = undefined
  perPage?: number = 250
  separate?: string = 'no'
  wrapper?: string = 'no'

  constructor(init?: Partial<SearchPagesQuery>) {
    Object.assign(this, init)
  }

  asDict(): Record<string, any> {
    const res: Record<string, any> = {}
    for (const [key, value] of Object.entries(this)) {
      if (value !== undefined) {
        res[key] = value
      }
    }
    if (res.tags && Array.isArray(res.tags)) {
      res.tags = res.tags.join(' ')
    }
    return res
  }
}

class PageCollection extends Array<Page> {
  constructor(
    public site: Site,
    pages: Page[] = [],
  ) {
    super(...pages)
  }

  private static _parse(site: Site, htmlBody: cheerio.CheerioAPI): PageCollection {
    const pages = []

    for (const _pageElement of htmlBody('span.page').toArray()) {
      const pageElement = cheerio.load(_pageElement)
      const pageParams: Record<string, any> = {}

      const is5starRating = pageElement('span.rating span.page-rate-list-pages-start').length > 0

      for (const setElement of pageElement('span.set').toArray()) {
        // setElementからspan.nameを取得し、innerTextをkeyとして、span.valueのinnerTextをvalueとして取得
        const setElementCheerio = cheerio.load(setElement.children)
        let key = setElementCheerio('span.name').text().trim()
        const valueElement = setElementCheerio('span.value')

        let value: any = undefined

        if (valueElement.length === 0) {
          value = undefined
        } else if (['created_at', 'updated_at', 'commented_at'].includes(key)) {
          const odateElement = valueElement.find('span.odate')
          value = odateElement.length > 0 ? odateParse(odateElement) : undefined
        } else if (['created_by_linked', 'updated_by_linked', 'commented_by_linked'].includes(key)) {
          const printuserElement = valueElement.find('span.printuser')
          value = printuserElement.length > 0 ? userParse(site.client, printuserElement) : undefined
        } else if (['tags', '_tags'].includes(key)) {
          value = valueElement.text().split(/\s+/)
        } else if (['rating_votes', 'comments', 'size', 'revisions'].includes(key)) {
          value = parseInt(valueElement.text().trim(), 10)
        } else if (key === 'rating') {
          value = is5starRating ? parseFloat(valueElement.text().trim()) : parseInt(valueElement.text().trim(), 10)
        } else if (key === 'rating_percent') {
          value = is5starRating ? parseFloat(valueElement.text().trim()) / 100 : undefined
        } else {
          value = valueElement.text().trim()
        }

        if (key.endsWith('_linked')) {
          key = key.slice(0, -7)
        } else if (['comments', 'children', 'revisions'].includes(key)) {
          key = `${key}_count`
        } else if (key === 'rating_votes') {
          key = 'votes_count'
        }

        pageParams[key] = value
      }

      for (const key of ['tags', '_tags']) {
        if (!pageParams[key]) {
          pageParams[key] = []
        }
      }

      pageParams.tags = [...pageParams.tags, ...pageParams._tags]
      delete pageParams._tags

      // @ts-expect-error assign可能な形で構築している
      pages.push(new Page(site, pageParams))
    }

    return new PageCollection(site, pages)
  }

  static async searchPages(site: Site, query: SearchPagesQuery = new SearchPagesQuery()): Promise<PageCollection> {
    const queryDict = query.asDict()
    queryDict.moduleName = 'list/ListPagesModule'
    queryDict.module_body =
      '[[span class="page"]]' +
      DEFAULT_MODULE_BODY.map(
        (key) =>
          `[[span class="set ${key}"]]` +
          `[[span class="name"]] ${key} [[/span]]` +
          `[[span class="value"]] %%${key}%% [[/span]]` +
          `[[/span]]`,
      ).join('') +
      '[[/span]]'

    let response
    try {
      response = (await site.amcRequest([queryDict]))[0]
    } catch (error) {
      if (error instanceof WikidotStatusCodeException) {
        if (error.statusCode === 'not_ok') {
          throw new ForbiddenException('Failed to get pages, target site may be private')
        }
      }
      throw error
    }

    const body = response.data.body

    const firstPageHtmlBody = cheerio.load(body)

    let total = 1
    const htmlBodies = [firstPageHtmlBody]
    if (firstPageHtmlBody('div.pager').length > 0) {
      total = parseInt(firstPageHtmlBody('div.pager span.target').eq(-2).find('a').text(), 10)
    }

    if (total > 1) {
      const requestBodies = []
      for (let i = 1; i < total; i++) {
        const _queryDict = { ...queryDict }
        _queryDict.offset = i * query.perPage!
        requestBodies.push(_queryDict)
      }

      const responses = await site.amcRequest(requestBodies)
      htmlBodies.push(...responses.map((response) => cheerio.load(response.data.body)))
    }

    const pages = []
    for (const htmlBody of htmlBodies) {
      pages.push(...PageCollection._parse(site, htmlBody))
    }

    return new PageCollection(site, pages)
  }

  static async _acquirePageIds(site: Site, pages: Page[]): Promise<Page[]> {
    const targetPages = pages.filter((page) => !page.isIdAcquired())

    if (targetPages.length === 0) {
      return pages
    }

    const responses = await RequestUtil.request(
      site.client,
      'GET',
      targetPages.map((page) => `${page.getUrl()}/norender/true/noredirect/true`),
    )

    for (const [index, response] of responses.entries()) {
      // @ts-expect-error エラーでたらそこで弾く
      const idMatch = response?.data.match(/WIKIREQUEST\.info\.pageId = (\d+);/)
      if (!idMatch) {
        throw new UnexpectedException(`Cannot find page id: ${targetPages[index].fullname}`)
      }
      targetPages[index].id = parseInt(idMatch[1], 10)
    }

    return pages
  }

  // noinspection JSUnusedGlobalSymbols
  async getPageIds(): Promise<Page[]> {
    return await PageCollection._acquirePageIds(this.site, this)
  }

  static async _acquirePageSources(site: Site, pages: Page[]): Promise<Page[]> {
    const requestBodies = await Promise.all(
      pages.map(async (page) => ({
        moduleName: 'viewsource/ViewSourceModule',
        page_id: await page.id,
      })),
    )
    const responses = await site.amcRequest(requestBodies)
    for (const [index, response] of responses.entries()) {
      const page = pages[index]
      const body = response.data.body
      const source = cheerio.load(body)('div.page-source').text().trim()

      page.source = new PageSource(page, source)
    }
    return pages
  }

  async getPageSources(): Promise<Page[]> {
    return await PageCollection._acquirePageSources(this.site, this)
  }

  static async _acquirePageRevisions(site: Site, pages: Page[]): Promise<Page[]> {
    if (pages.length === 0) {
      return pages
    }

    const responses = await site.amcRequest(
      await Promise.all(
        pages.map(async (page) => ({
          moduleName: 'history/PageRevisionListModule',
          page_id: await page.id,
          options: { all: true },
          perpage: 100000000,
        })),
      ),
    )

    for (const [index, response] of responses.entries()) {
      const page = pages[index]
      const body = response.data.body
      const revs = []
      const bodyHtml = cheerio.load(body)
      for (const revElement of bodyHtml('tr[id^="revision-row-"]').toArray()) {
        const revId = parseInt(cheerio.load(revElement)('tr').attr('id')!.slice(13), 10)
        const tds = cheerio.load(revElement)('td')
        const revNo = parseInt(tds.eq(0).text().trim().slice(0, -1), 10)
        const created_by = userParse(site.client, tds.eq(4).find('span.printuser'))
        const created_at = odateParse(tds.eq(5).find('span.odate'))
        const comment = tds.eq(6).text().trim()
        revs.push(new PageRevision(page, revId, revNo, created_by, created_at, comment))
      }
      page.revisions = new PageRevisionCollection(page, revs)
    }

    return pages
  }

  async getPageRevisions(): Promise<Page[]> {
    return await PageCollection._acquirePageRevisions(this.site, this)
  }

  static async _acquirePageVotes(site: Site, pages: Page[]): Promise<Page[]> {
    if (pages.length === 0) {
      return pages
    }

    const responses = await site.amcRequest(
      await Promise.all(
        pages.map(async (page) => ({
          moduleName: 'pagerate/WhoRatedPageModule',
          pageId: await page.id,
        })),
      ),
    )

    for (const [index, response] of responses.entries()) {
      const page = pages[index]
      const body = response.data.body
      const bodyHtml = cheerio.load(body)
      const user_elems = bodyHtml('span.printuser')
      const value_elems = bodyHtml("span[style^='color:']")

      if (user_elems.length !== value_elems.length) {
        throw new UnexpectedException('User and value count mismatch')
      }

      const votes = user_elems.toArray().map((elem, i) => {
        const user = userParse(site.client, bodyHtml(elem))
        const value_text = bodyHtml(value_elems[i]).text().trim()
        let value: number
        if (value_text === '+') {
          value = 1
        } else if (value_text === '-') {
          value = -1
        } else {
          value = parseInt(value_text, 10)
        }

        return new PageVote(page, user, value)
      })

      page.votes = new PageVoteCollection(page, votes)
    }

    return pages
  }

  async getPageVotes(): Promise<Page[]> {
    return await PageCollection._acquirePageVotes(this.site, this)
  }
}

class Page {
  private _id?: number
  private _source?: PageSource
  private _revisions?: PageRevisionCollection
  private _votes?: PageVoteCollection

  constructor(
    public site: Site,
    {
      fullname,
      name,
      category,
      title,
      children_count,
      comments_count,
      size,
      rating,
      votes_count,
      rating_percent,
      revisions_count,
      parent_fullname,
      tags,
      created_by,
      created_at,
      updated_by,
      updated_at,
      commented_by,
      commented_at,
    }: {
      fullname: string
      name: string
      category: string
      title: string
      children_count: number
      comments_count: number
      size: number
      rating: number | null
      votes_count: number
      rating_percent: number | null
      revisions_count: number
      parent_fullname: string | null
      tags: string[]
      created_by: User
      created_at: Date
      updated_by: User | null
      updated_at: Date | null
      commented_by: User | null
      commented_at: Date | null
    },
  ) {
    this.fullname = fullname
    this.name = name
    this.category = category
    this.title = title
    this.childrenCount = children_count
    this.commentsCount = comments_count
    this.size = size
    this.rating = rating ?? undefined
    this.votes_count = votes_count
    this.ratingPercent = rating_percent ?? undefined
    this.revisions_count = revisions_count
    this.parentFullname = parent_fullname ?? undefined
    this.tags = tags
    this.createdBy = created_by
    this.createdAt = created_at
    this.updatedBy = updated_by ?? undefined
    this.updatedAt = updated_at ?? undefined
    this.commentedBy = commented_by ?? undefined
    this.commentedAt = commented_at ?? undefined
  }

  fullname: string
  name: string
  category: string
  title: string
  childrenCount: number
  commentsCount: number
  size: number
  rating?: number
  votes_count: number
  ratingPercent?: number
  revisions_count: number
  parentFullname?: string
  tags: string[]
  createdBy: User
  createdAt: Date
  updatedBy?: User
  updatedAt?: Date
  commentedBy?: User
  commentedAt?: Date

  getUrl(): string {
    return `${this.site.getUrl()}/${this.fullname}`
  }

  get id(): Promise<number> {
    if (this._id === undefined) {
      return PageCollection._acquirePageIds(this.site, [this]).then(() => this._id!)
    } else {
      return Promise.resolve(this._id!)
    }
  }

  set id(value: number) {
    this._id = value
  }

  isIdAcquired(): boolean {
    return this._id !== undefined
  }

  get source(): Promise<PageSource> {
    if (this._source === undefined) {
      return PageCollection._acquirePageSources(this.site, [this]).then(() => this._source!)
    }
    return Promise.resolve(this._source)
  }

  set source(value: PageSource) {
    this._source = value
  }

  get revisions(): Promise<PageRevisionCollection> {
    if (this._revisions === undefined) {
      return PageCollection._acquirePageRevisions(this.site, [this]).then(() => this._revisions!)
    }
    return Promise.resolve(this._revisions)
  }

  set revisions(value: PageRevisionCollection) {
    this._revisions = value
  }

  async latestRevision(): Promise<PageRevision> {
    // revision_countとrev_noが一致するものを取得
    const revisions = await this.revisions
    return revisions.find((revision) => revision.revNo === this.revisions_count)!
  }

  get votes(): Promise<PageVoteCollection> {
    if (this._votes === undefined) {
      return PageCollection._acquirePageVotes(this.site, [this]).then(() => this._votes!)
    }
    return Promise.resolve(this._votes)
  }

  set votes(value: PageVoteCollection) {
    this._votes = value
  }

  async destroy(): Promise<void> {
    this.site.client.loginCheck()
    await this.site.amcRequest([
      {
        action: 'WikiPageAction',
        event: 'deletePage',
        page_id: await this.id,
        moduleName: 'Empty',
      },
    ])
  }
}

export { SearchPagesQuery, PageCollection, Page }
