const Processor = require('../processor.js');

function ProcessorPreboot(app, opts, callback) {
  app.processor = new Processor(app);
  callback();
}

module.exports = ProcessorPreboot;
