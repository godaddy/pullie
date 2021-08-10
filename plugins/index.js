import Jira from './jira/index.js';
import RequiredFile from './required-file/index.js';
import Reviewers from './reviewers/index.js';
import Welcome from './welcome/index.js';

export default class PluginManager {
  constructor() {
    this.jira = new Jira();
    this.requiredFile = new RequiredFile();
    this.reviewers = new Reviewers();
    this.welcome = new Welcome();
  }
}
