# CLAUDE.md - wikidot-ts Project Guide

This document is a project guide for AI agents.

## Project Overview

**wikidot-ts** is a utility library for interacting with Wikidot sites in TypeScript. It is a TypeScript port of wikidot.py.

- **Version**: 4.0.x
- **Node.js Support**: 18 or higher
- **License**: MIT
- **Package Name**: `@ukwhatn/wikidot`

### Main Features

- Site information retrieval and management
- Page creation, editing, deletion, and search (ListPagesModule support)
- User information retrieval and search
- Forum operations (categories, threads, posts)
- Private message sending and receiving
- Authentication (public information accessible without login)

## Directory Structure

```
wikidot-ts/
├── src/
│   ├── index.ts              # Package entry point
│   ├── common/               # Common utilities
│   │   ├── decorators.ts     # @loginRequired decorator
│   │   ├── errors/           # Custom errors
│   │   ├── logger.ts         # Logging configuration
│   │   └── types/            # Common type definitions
│   ├── connector/            # HTTP communication
│   │   ├── amc-client.ts     # AjaxModuleConnectorClient
│   │   └── auth.ts           # Authentication handling
│   ├── module/               # Core modules
│   │   ├── client/           # Client (main entry point)
│   │   ├── site/             # Site (site management)
│   │   ├── page/             # Page (page operations)
│   │   ├── user/             # User hierarchy
│   │   ├── forum/            # Forum related
│   │   ├── private-message/  # Private messages
│   │   └── types.ts          # Module common types
│   └── util/                 # Utilities
│       ├── quick-module.ts   # QuickModule search
│       ├── string.ts         # String conversion
│       └── parser/           # HTML parser
├── tests/
│   ├── unit/                 # Unit tests
│   ├── integration/          # Integration tests
│   ├── fixtures/             # Test fixtures
│   └── mocks/                # Mocks
├── package.json              # Project configuration
├── tsconfig.json             # TypeScript configuration
└── biome.json                # Biome configuration
```

## Development Commands

```bash
# Install dependencies
bun install

# Format
bun run format

# Lint
bun run lint

# Fix lint issues
bun run lint:fix

# Type check
bun run typecheck

# Run tests
bun test              # All tests
bun test:cov          # With coverage

# Build
bun run build
```

## Architecture

### Design Patterns

1. **Facade Pattern**: `Client` provides a unified interface to multiple systems
2. **Accessor Pattern**: Groups functionality (`client.user`, `client.site`, `site.page`, etc.)
3. **Collection Pattern**: Bulk operations on multiple resources (`PageCollection`, `UserCollection`, etc.)
4. **Factory Pattern**: Static methods like `Page.fromName()`, `Site.fromUnixName()`

### Core Classes

All async methods return `WikidotResultAsync<T>`. Check with `isOk()`, then access the value with `.value`.

```typescript
import { Client } from '@ukwhatn/wikidot';

// Client - Main entry point
const clientResult = await Client.create({ username, password });
if (!clientResult.isOk()) throw new Error('Failed');
const client = clientResult.value;

// Site - Site operations
const siteResult = await client.site.get("scp-jp");
if (!siteResult.isOk()) throw new Error('Failed');
const site = siteResult.value;

// Page search
const pagesResult = await site.pages.search({ category: "*", tags: ["tag1"] });
if (!pagesResult.isOk()) throw new Error('Failed');
const pages = pagesResult.value;

// Page - Page operations
const pageResult = await site.page.get("page-name");
if (!pageResult.isOk()) throw new Error('Failed');
const page = pageResult.value;
await page.getSource();
await page.getVotes();
```

### User Hierarchy

```
AbstractUser (base)
├── User            # Regular user
├── DeletedUser     # Deleted user
├── AnonymousUser   # Anonymous user
├── GuestUser       # Guest user
└── WikidotUser     # Wikidot system user
```

### Error Handling

Errors are handled using Result type from the neverthrow library:

```typescript
type WikidotResult<T, E = WikidotError> = Result<T, E>;
type WikidotResultAsync<T, E = WikidotError> = ResultAsync<T, E>;
```

### Error Hierarchy

```
WikidotError (base)
├── UnexpectedError
├── SessionCreateError
├── LoginRequiredError
├── AMCError
│   ├── AMCHttpStatusError
│   ├── WikidotStatusError
│   └── ResponseDataError
├── NotFoundError
├── TargetExistsError
├── TargetError
├── ForbiddenError
└── NoElementError
```

## Code Quality Configuration

### Biome (Linter/Formatter)

- Line length: 120 characters
- Indent: Tabs (width 2)
- Semicolons: Required
- Quotes: Double

### TypeScript

- strict: true
- target: ESNext
- module: ESNext

### Bun Test

- Coverage target: 80% or higher

## Important Implementation Details

### Authentication Flow

1. Create client with `Client.create({ username, password })`
2. Internally calls `login()` -> POSTs to Wikidot login endpoint
3. Extracts `WIKIDOT_SESSION_ID` cookie
4. Validated by `@loginRequired` decorator

### HTML Parsing

- Uses cheerio library
- `odateParse()`: Converts Wikidot datetime elements to Date
- `userParse()`: Automatically determines User type from HTML elements

### SearchPagesQuery

Expresses complex ListPagesModule queries in TypeScript:

```typescript
interface SearchPagesQuery {
  pagetype?: string;
  category?: string;
  tags?: string | string[];
  parent?: string;
  createdBy?: User | string;
  rating?: string;
  order?: string;
  offset?: number;
  limit?: number;
}
```

## Environment Variables

```bash
WIKIDOT_USERNAME=your_username
WIKIDOT_PASSWORD=your_password
```

## Dependencies

### Required

- `cheerio` - HTML parsing
- `ky` - HTTP client
- `neverthrow` - Result type
- `p-limit` - Concurrency limiting
- `zod` - Schema validation

### Development

- `@biomejs/biome` - Linter/formatter
- `typescript` - Type checking
- `bunup` - Bundler

## CI/CD

### GitHub Actions

- **check_code_quality.yml**: On PR: format -> lint -> typecheck -> test
- **publish.yml**: On release: publish to npm

## Additional Information for Subagent Calls

### quality-checker / lint-runner / format-runner / typecheck-runner / test-runner

```
lint: bun run lint
format: bun run format
typecheck: bun run typecheck
test: bun test
```

### self-reviewer / pr-reviewer

```
Base branch: main
Architecture rules:
  - Facade pattern (Client)
  - Accessor pattern
  - Result-based error handling
Additional checks:
  - Proper use of neverthrow Result type
  - Avoid circular dependencies (use Ref types in types.ts)
```

## Notes

- Maintain TypeScript strict mode
- Use Ref type interfaces in `module/types.ts` to avoid circular dependencies
- Return errors using `neverthrow` Result type (avoid throwing exceptions)
- Public APIs should follow the Accessor pattern
- Maintain compatibility with Python version (wikidot.py)
