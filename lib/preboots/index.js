const path = require('path');
const winston = require('winston');
const hbs = require('hbs');
const Prism = require('prismjs');
require('prismjs/components/index.js')(['json']);

function Preboots(app, opts, callback) {
  app.preboot(require('slay-log')({
    transports: [
      new (winston.transports.Console)({
        raw: app.env !== 'local',
        timestamp: true,
        handleExceptions: true,
        humanReadableUnhandledException: true // eslint-disable-line id-length
      })
    ]
  }));

  app.preboot(require('slay-config')({
    file: { file: path.resolve(opts.configPath || '') }
  }));

  app.set('views', path.join(app.rootDir, 'lib', 'views'));
  app.set('view engine', 'hbs');
  hbs.registerHelper('code', options => new hbs.handlebars.SafeString(
    Prism.highlight(options.fn(), Prism.languages.json, 'json')));
  app.engine('hbs', hbs.__express);

  app.preboot(require('./github'));
  app.preboot(require('./commenter'));
  app.preboot(require('./processor'));
  app.preboot(require('./plugins'));

  callback();
}

module.exports = Preboots;
