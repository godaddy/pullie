const Utils = {
  normalizeError: err => {
    if (!err) return err;

    const ret = {};
    if (err.message) {
      ret.message = err.message;
    } else {
      ret.message = err.toString();
    }

    if (err.errors && err.errors.length) {
      const innerErr = err.errors[0];
      ret.innerError = {};
      if (innerErr.message) {
        ret.innerError.message = innerErr.message;
      }
      if (innerErr.body) {
        ret.innerError.details = innerErr.body.message;
        ret.innerError.documentation = innerErr.body.documentation_url;
      }
    }

    return ret;
  }
};

module.exports = Utils;
