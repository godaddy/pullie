module.exports = {
  /**
   * @typedef {import('@octokit/rest').GitGetBlobResponse} GitBlobResponse
   */
  /**
   * Parse a JSON file retrieved from GitHub
   * @param {GitBlobResponse} pkg package.json blob from GitHub
   * @returns {Object} Parsed package.json
   */
  parseBase64Json(pkg) {
    let contents;

    if (pkg && pkg.content) {
      contents = Buffer.from(pkg.content, 'base64');
      contents = JSON.parse(contents.toString());
    }

    return contents;
  }
};
