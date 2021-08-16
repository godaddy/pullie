import express from 'express';
import handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import Prism from 'prismjs';
import loadLanguages from 'prismjs/components/index.js';
loadLanguages(['json']);
import resolveCwd from 'resolve-cwd';
import { fileURLToPath } from 'url';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const packageJson = require('./package.json');

/**
 * @typedef {import('express').Router} expressRouter
 */
/**
 * Setup doc site routes
 *
 * @param {expressRouter} router Express router to attach routes to
 */
export default function setupDocsRoutes(router) {
  const __dirname = fileURLToPath(new URL('.', import.meta.url));
  // eslint-disable-next-line no-sync
  const docsSource = fs.readFileSync(path.join(__dirname, 'views/home.hbs'), { encoding: 'utf8' });
  handlebars.registerHelper('code', options => new handlebars.SafeString(
    Prism.highlight(options.fn(), Prism.languages.json, 'json')));
  const docsTemplate = handlebars.compile(docsSource);
  const docsHtml = docsTemplate({
    APP_URL: process.env.APP_URL,
    VERSION: packageJson.version
  });

  router.use('/static', express.static(path.join(__dirname, 'static')));
  router.get('/', (req, res) => {
    res.send(docsHtml);
  });
  router.get('/prism-coy.css', (req, res) => {
    res.sendFile(resolveCwd('prismjs/themes/prism-coy.css'));
  });
  router.get('/healthcheck(.html)?', (req, res) => {
    res.send('page ok');
  });
}
