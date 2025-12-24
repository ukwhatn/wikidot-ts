# Integration Tests

## Overview

This directory contains integration tests that run against an actual Wikidot server (ukwhatn-ci.wikidot.com).

## Environment Setup

### Required Environment Variables

```bash
export WIKIDOT_USERNAME=your_username
export WIKIDOT_PASSWORD=your_password
```

### Test Site

- Site name: `ukwhatn-ci.wikidot.com`
- Requirement: Test account must be a member of the site

## Running Tests

```bash
# Run integration tests only
cd /Users/yuki.c.watanabe/dev/scp/libs/wikidot-ts
bun test tests/integration/

# Run a specific test file
bun test tests/integration/page-lifecycle.test.ts

# Run all tests (unit + integration)
bun test
```

## Test Coverage

| Test File | Covered Features |
|-----------|------------------|
| site.test.ts | Site retrieval, page retrieval |
| page-lifecycle.test.ts | Page creation, retrieval, editing, deletion |
| page-tags.test.ts | Tag addition, modification, deletion |
| page-meta.test.ts | Meta setting, retrieval, update, deletion |
| page-revision.test.ts | Revision history retrieval, latest revision retrieval |
| page-votes.test.ts | Vote information retrieval |
| page-discussion.test.ts | Discussion retrieval, post creation |
| forum-category.test.ts | Forum category listing, thread retrieval |
| user.test.ts | User search, bulk retrieval |
| pm.test.ts | Inbox/outbox retrieval, message verification |

## Skipped Features

The following features are skipped in integration tests:

### 1. Site Join Application
- Reason: Site join applications require manual approval
- Related API: `site.application.*`

### 2. Private Message Sending
- Reason: To avoid sending messages to real users
- Related API: `client.privateMessage.send()`
- Note: Only retrieval is tested. Messages must be pre-populated in Inbox/Outbox

### 3. Forum Category/Thread Creation
- Reason: To avoid permanent changes to forum structure
- Related API: `site.forum.createThread()`
- Note: Only page discussion posts are tested

### 4. Member Invitation
- Reason: To avoid inviting real users
- Related API: `site.member.invite()`

## Cleanup Strategy

1. Create test pages in each test's `beforeAll`
2. Delete created pages in `afterAll`
3. Log and continue on deletion failure
4. Page naming: `{prefix}-{timestamp}-{random6chars}` format to avoid collisions

## Notes

- Integration tests are automatically skipped if environment variables are not set
- Tests are executed sequentially within each file (some tests may have dependencies)
- Be aware of API rate limits
- Pages may remain after test execution if cleanup fails
  - Identifiable by page name prefix (`test-`)
  - Delete manually if needed
