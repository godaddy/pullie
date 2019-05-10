const handlebars = require('handlebars');
const fs = require('fs');
const packageJson = require('./package.json');
const path = require('path');
const Prism = require('prismjs');
require('prismjs/components/')(['json']);
const resolveCwd = require('resolve-cwd');
const { promisify } = require('util');

const readFile = promisify(fs.readFile);

module.exports = async function setupDocsRoutes(router) {
  const docsSource = await readFile(path.join(__dirname, 'views/home.hbs'), { encoding: 'utf8' });
  handlebars.registerHelper('code', options => new handlebars.SafeString(
    Prism.highlight(options.fn(), Prism.languages.json, 'json')));
  const docsTemplate = handlebars.compile(docsSource);
  const docsHtml = docsTemplate({
    APP_URL: process.env.APP_URL,
    VERSION: packageJson.version
  });

  router.use('/static', require('express').static('static'));
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
