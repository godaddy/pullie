const handlebars = require('handlebars');
const fs = require('fs');
const packageJson = require('./package.json');
const path = require('path');
const Prism = require('prismjs');
require('prismjs/components/')(['json']);
const resolveCwd = require('resolve-cwd');

/**
 * @typedef {import('express').Router} expressRouter
 */
/**
 * Setup doc site routes
 *
 * @param {expressRouter} router Express router to attach routes to
 */
module.exports = function setupDocsRoutes(router) {
  // eslint-disable-next-line no-sync
  const docsSource = fs.readFileSync(path.join(__dirname, 'views/home.hbs'), { encoding: 'utf8' });
  handlebars.registerHelper('code', options => new handlebars.SafeString(
    Prism.highlight(options.fn(), Prism.languages.json, 'json')));
  const docsTemplate = handlebars.compile(docsSource);
  const docsHtml = docsTemplate({
    APP_URL: process.env.APP_URL,
    VERSION: packageJson.version
  });

  router.use('/static', require('express').static(path.join(__dirname, 'static')));
  router.get('/', (req, res) => {
    res.send(docsHtml);
  });
  router.get('/prism-coy.css', (req, res) => {
    res.sendFile(resolveCwd('prismjs/themes/prism-coy.css'));
  });
  router.get('/healthcheck(.html)?', (req, res) => {
    res.send('page ok');
  });
};
