# wikidot-ts

An async utility library for interacting with Wikidot sites in TypeScript.

## Overview

wikidot-ts is a TypeScript library for working with the Wikidot API. It supports major Wikidot features including page retrieval and editing, forum operations, private messages, and user information retrieval.

## Features

- Type-safe API (full TypeScript support)
- Result-based error handling (using neverthrow)
- Full async/await support
- Covers major features: pages, forums, private messages, and more
- High compatibility with wikidot.py

## Installation

```bash
bun add @ukwhatn/wikidot
```

or

```bash
npm install @ukwhatn/wikidot
```

## Basic Usage

This library uses the Result type from `neverthrow`. All async methods return `WikidotResultAsync<T>`. Check success with `isOk()`, then access the value with `.value`.

### Creating a Client

```typescript
import { Client } from '@ukwhatn/wikidot';

// Access without login (public information only)
const clientResult = await Client.create();
if (!clientResult.isOk()) {
  throw new Error('Failed to create client');
}
const client = clientResult.value;

// Access with login
const authClientResult = await Client.create({
  username: 'your_username',
  password: 'your_password',
});
if (!authClientResult.isOk()) {
  throw new Error('Login failed');
}
const authClient = authClientResult.value;
```

### Retrieving a Site

```typescript
// Get a site
const siteResult = await client.site.get('scp-jp');
if (!siteResult.isOk()) {
  throw new Error('Failed to retrieve site');
}
const site = siteResult.value;
console.log(`Site: ${site.title}`);
```

### Page Operations

```typescript
// Search pages
const pagesResult = await site.pages.search({ category: 'scp', tags: ['safe'] });
if (!pagesResult.isOk()) {
  throw new Error('Failed to search pages');
}
for (const page of pagesResult.value) {
  console.log(`${page.fullname}: ${page.title}`);
}

// Get a single page
const pageResult = await site.page.get('scp-001');
if (!pageResult.isOk()) {
  throw new Error('Failed to retrieve page');
}
const page = pageResult.value;
console.log(`Title: ${page.title}`);
console.log(`Rating: ${page.rating}`);
```

### Forum Operations

```typescript
// Get forum categories
const categoriesResult = await site.forum.getCategories();
if (!categoriesResult.isOk()) {
  throw new Error('Failed to retrieve forum categories');
}
for (const category of categoriesResult.value) {
  console.log(`Category: ${category.title}`);
}

// Reply to a thread (requires login)
const threadResult = await site.forum.getThread(12345);
if (!threadResult.isOk()) {
  throw new Error('Failed to retrieve thread');
}
const thread = threadResult.value;
await thread.reply('Reply content', 'Re: Title');
```

### Private Messages (requires login)

```typescript
// Get inbox
const inboxResult = await client.privateMessage.inbox();
if (!inboxResult.isOk()) {
  throw new Error('Failed to retrieve inbox');
}
for (const message of inboxResult.value) {
  console.log(`From: ${message.sender.name}, Subject: ${message.subject}`);
}

// Send a message
await client.privateMessage.send(recipientUser, 'Subject', 'Body');

// Search messages
const searchResult = await client.privateMessage.search('search query', 'all');
```

## Error Handling

wikidot-ts handles errors using the Result type from the `neverthrow` library.

```typescript
const result = await site.page.get('non-existent-page');

if (result.isOk()) {
  const page = result.value;
  // Handle success
} else {
  const error = result.error;
  if (error instanceof NotFoundException) {
    console.log('Page not found');
  } else if (error instanceof ForbiddenError) {
    console.log('Access denied');
  }
}
```

## Main Error Types

| Error | Description |
|-------|-------------|
| `LoginRequiredError` | Operation requires login |
| `NotFoundException` | Resource not found |
| `ForbiddenError` | Access denied |
| `TargetExistsError` | Resource already exists |
| `WikidotStatusError` | Wikidot API error |

## Differences from wikidot.py

wikidot-ts is a port of wikidot.py, with some differences to follow TypeScript conventions.

### Property to Method Conversion

Python properties using the `@property` decorator are implemented as getter methods in TypeScript.

| Python (wikidot.py) | TypeScript (wikidot-ts) |
|---------------------|------------------------|
| `site.base_url` | `site.getBaseUrl()` |
| `page.url` | `page.getUrl()` |
| `user.avatar_url` | `user.avatarUrl` (readonly property) |

### Naming Conventions

- snake_case to camelCase
  - `page.fullname` (unchanged)
  - `page.children_count` to `page.childrenCount`
  - `page.created_by` to `page.createdBy`

### Error Handling

- Python: Throws exceptions
- TypeScript: Returns `Result` type (using `neverthrow`)

```python
# Python
try:
    page = await site.get_page("scp-001")
except NotFoundException:
    print("Page not found")
```

```typescript
// TypeScript
const result = await site.page.get("scp-001");
if (result.isErr()) {
  if (result.error instanceof NotFoundException) {
    console.log("Page not found");
  }
}
```

### Optional Arguments

Some methods support optional arguments similar to the Python version.

```typescript
// raiseWhenNotFound option
const user = await client.user.get("username", { raiseWhenNotFound: true });

// returnExceptions option (AMCClient)
const results = await client.amcClient.requestWithOptions(bodies, { returnExceptions: true });
```

## Development

### Setup

```bash
bun install
```

### Commands

```bash
# Type check
bun run typecheck

# Lint
bun run lint

# Format
bun run format

# Test
bun test

# Build
bun run build
```

## License

MIT

## Related Projects

- [wikidot.py](https://github.com/ukwhatn/wikidot.py) - Python version of the Wikidot library
