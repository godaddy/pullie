const processPR = require('./processor');
const setupDocsRoutes = require('./docs');

/**
 * @typedef {import('probot').Application} ProbotApp
 */

/**
 * This is the main entrypoint to your Probot app
 * @param {ProbotApp} app Application
 */
function appFn(app) {
  if (!process.env.DISABLE_DOCS_ROUTE) {
    const docsPath = process.env.DOCS_PATH || '/docs';
    app.log.info('Setting up docs route at ' + docsPath);
    const router = app.route(docsPath);
    setupDocsRoutes(router);
  }

  app.on('pull_request.opened', processPR);
  app.on('pull_request.edited', processPR);
  app.on('pull_request.ready_for_review', processPR);
}

appFn.setupDocsRoutes = setupDocsRoutes;
module.exports = appFn;
