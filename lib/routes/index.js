const { normalizeError } = require('../utils');
const resolveCwd = require('resolve-cwd');
const packageJson = require('../../package.json');

/*
 * Setup the ordering for all of our routing in
 * the application.
 */
function Routes(app, opts, callback) {
  app.perform('actions', function (done) {
    app.log.info('Adding routes');

    const config = app.config.get('github');
    app.routes.get('/', (req, res) => {
      res.render('home', {
        APP_URL: config.publicUrl,
        VERSION: packageJson.version
      });
    });

    app.routes.get('/prism-coy.css', (req, res) => {
      res.sendFile(resolveCwd('prismjs/themes/prism-coy.css'));
    });

    app.routes.get('/healthcheck(.html)?', (req, res) => {
      res.send('page ok');
    });

    app.routes.post('/api/v1/github', (req, res, next) => {
      if (req.headers['x-github-event'] === 'ping') {
        res.status(200).send('pong');
        return;
      }
      if (!req.body || !req.body.installation || !req.body.installation.id) {
        res.status(400).json({
          error: 'No GitHub App installation ID specified in request body'
        });
        return next();
      }
      app.github.login(req.body.installation.id, loginErr => {
        if (loginErr) {
          app.github.logout();
          res.status(403).json({
            error: loginErr.toString()
          });
          return next();
        }

        app.processor.processRequest(req, processErr => {
          app.github.logout();
          if (processErr) {
            const status = processErr.status || 500;
            res.status(status).json({
              error: normalizeError(processErr)
            });
            return next();
          }

          res.status(200).json({
            status: 'ok'
          });
        });
      });
    });

    done();
  }, callback);
}

module.exports = Routes;
