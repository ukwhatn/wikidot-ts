# wikidot-ts - A TypeScript library for making requests to the Wikidot sites.

## Installation
```bash
npm install @ukwhatn/wikidot
```

## Usage
> [!NOTE]
> You can use this library without logging in, but you can only use the features that do not require logging in.
```ts
import {Client} from "@ukwhatn/wikidot";

// Create a new Client class and logging in with the credentials of your wikidot account
// If you don't want to log in:
//   const client = await Client.init();
const client = await Client.init('input-your-name', 'input-your-password');

// ------
// user features
// ------
// Get the user object of the user
const user = await client.user.get('input-a-username');
// Bulk execution by asynchronous request
const users = await client.user.getBulk(['input-a-username', 'input-another-username']);

// ------
// site features
// ------
// Get the site object of the SCP Foundation
const site = await client.site.get('scp-wiki');

// invite a user to the site
await site.inviteUser(user)

// Get all unprocessed applications for the site
const applications = await site.getApplications()

// process an application
for (const application of applications) {
    application.accept()
    // or 
    application.reject()
}

// ------
// page features
// ------
// Search pages by some criteria
// NOTE: The search criteria are the same as in the ListPages module
pages = await site.pages.search({
    category: "_default",
    tags: ["tag1", "tag2"],  // You can also use the "tag1 -tag2" syntax
    order: "created_at desc desc",
    limit: 10,
})

// Get the page object of the SCP-001
const page = await site.page.get('scp-001')

// destroy a page
await page.destroy()

// ------
// private message features
// ------
// Get messages in your inbox
const receivedMessages = await client.privateMessage.getInbox()

// Get messages in your sent box
const sentMessages = await client.privateMessage.getSentbox()

// Get message by id
// NOTE: You can only get the message that you have received or sent
message = client.privateMessage.getMessage(123456)
// Bulk execution by asynchronous request
messages = client.privateMessage.getMessages([123456, 123457])

// Send a message to a user
await client.privateMessage.send(
    recipient = user,
    subject = 'Hello',
    body = 'Hello, world!'
)
```