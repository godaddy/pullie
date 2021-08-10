# CHANGELOG

- **MAJOR:** Convert to ES Modules

## 5.0.1

- Update dependencies

## 5.0.0

- See [5.0.0-alpha.0](#500-alpha0)

## 5.0.0-alpha.0

- **MAJOR:** Update to `probot@11`
- Update other various dependencies

## 4.1.0

- Replace various deprecated API calls into Probot in preparation for `probot@11`

## 4.0.1

- Update dependencies

## 4.0.0

- **MAJOR:** Drop support for `node@8`
- Move from Travis CI to GitHub Actions 

## 3.4.0

- Update to `probot@10`

## 3.3.0

- See 3.3.0-beta.0

## 3.3.0-beta.0

- Replace `request` with `node-fetch`

## 3.2.1

- Update deps

## 3.2.0

- [feat] Add support for limiting Pullie to a single approved GitHub Enterprise Cloud Enterprise
- [feat] Add support for limiting Pullie to only run on non-public repositories

## 3.1.0

- [feat] Add `welcome` plugin

## 3.0.0

- **BREAKING:** Suppress review requests for draft PRs unless `requestForDrafts` is set to `true` in reviewers plugin
  config.

## 3.0.0-beta2

- [fix] Listen for `ready_for_review` events

## 3.0.0-beta

- **BREAKING:** Suppress review requests for draft PRs unless `requestForDrafts` is set to `true` in reviewers plugin
  config.

## 2.0.1

- Update dependencies

## 2.0.0

- **MAJOR:** Final release of Pullie 2.0.0

## 2.0.0-rc6

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
