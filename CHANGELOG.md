# CHANGELOG

- [feat] Org-level configuration support

## 2.0.0-rc5

- [fix] Check Collaborator rejects on unknown users, so handle that appropriately

## 2.0.0-rc4

- [fix] Handle case with no `.pullierc` file better

## 2.0.0-rc3

- [fix] Make resource paths relative in docs page

## 2.0.0-rc2

- [fix] Make `setupDocsRoutes` synchronous

## 2.0.0-rc1

- [fix] Fix static path in docs routes

## 2.0.0-rc0

- **BREAKING:** Rewrite on [Probot](https://probot.github.io)

## 1.3.1

- [dist] Update dependencies
- [fix] Do not log HTTP calls for healthcheck route
- [fix] Output port number that service is running on

## 1.3.0

- [feat] Adjust `reviewers` plugin to post a medium-priority comment instead of high-priority
- [feat] Adjust `requiredFile` plugin to prefix the comment message with a ⚠️ emoji so that attention is drawn to it better
- [dist] Update dependencies to latest

## 1.2.0

- [feat] Add `process` interceptor

## 1.1.1

- [fix] Include PR number in error logs

## 1.1.0

- [feat] Add logging for request info (e.g. HTTP status, path, remote IP)

## 1.0.1

- [fix] Set `"main"` field of `package.json` properly

## 1.0.0

- Birth of pullie

