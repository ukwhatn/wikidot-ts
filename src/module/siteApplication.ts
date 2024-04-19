import { Site } from './site'
import { AbstractUser } from './user'
import {
  ForbiddenException,
  UnexpectedException,
  NotFoundException,
  WikidotStatusCodeException,
} from '../common/exceptions'
import { userParse } from '../util/parser/user'
import * as cheerio from 'cheerio'

class SiteApplication {
  constructor(
    public site: Site,
    public user: AbstractUser,
    public text: string,
  ) {}

  toString(): string {
    return `SiteApplication(user=${this.user}, site=${this.site}, text=${this.text})`
  }

  static async acquireAll(site: Site): Promise<SiteApplication[]> {
    site.client.loginCheck()

    const response = (
      await site.amcRequest([
        {
          moduleName: 'managesite/ManageSiteMembersApplicationsModule',
        },
      ])
    )[0]

    const body = response.data.body

    if (body.includes('WIKIDOT.page.listeners.loginClick(event)')) {
      throw new ForbiddenException('You are not allowed to access this page')
    }

    const html = cheerio.load(body)

    const applications: SiteApplication[] = []

    const userElements = html('h3 span.printuser')
    const textWrapperElements = html('table')

    if (userElements.length !== textWrapperElements.length) {
      throw new UnexpectedException('Length of userElements and textWrapperElements are different')
    }

    for (let i = 0; i < userElements.length; i++) {
      const userElement = userElements.eq(i)
      const textWrapperElement = textWrapperElements.eq(i)

      const user = userParse(site.client, userElement)
      const text = textWrapperElement.find('td').eq(1).text().trim()

      applications.push(new SiteApplication(site, user, text))
    }

    return applications
  }

  private async _process(action: 'accept' | 'decline'): Promise<void> {
    this.site.client.loginCheck()
    if (action !== 'accept' && action !== 'decline') {
      throw new Error(`Invalid action: ${action}`)
    }

    try {
      await this.site.amcRequest([
        {
          action: 'ManageSiteMembershipAction',
          event: 'acceptApplication',
          user_id: this.user.id,
          text: `your application has been ${action}ed`,
          type: action,
          moduleName: 'Empty',
        },
      ])
    } catch (error) {
      if (error instanceof WikidotStatusCodeException && error.statusCode === 'no_application') {
        throw new NotFoundException(`Application not found: ${this.user}`)
      } else {
        throw error
      }
    }
  }

  async accept(): Promise<void> {
    await this._process('accept')
  }

  async decline(): Promise<void> {
    await this._process('decline')
  }
}

export { SiteApplication }
