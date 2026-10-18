const {MiniAppElementRuntime} = require('../src/utils/miniAppElement');
const {MiniAppBackendService} = require('../src/services/MiniAppBackendService');
let elements = 0;

function installMiniAppModules() {
  const modules = new Map(), executed = new Set();
  const filesBase = jest.spyOn(MiniAppBackendService.prototype, 'filesBase').mockImplementation((appId, agency, target, version) =>
    Promise.resolve(`/api/mini-app-files/${version.split('\n')[0]}/`));
  const importModule = jest.spyOn(MiniAppElementRuntime.prototype, 'importModule').mockImplementation(async url => {
    if (executed.has(url)) return;
    if (!modules.has(url)) throw new TypeError(`Failed to fetch dynamically imported module: ${url}`);
    modules.get(url)(); executed.add(url);
  });
  function define(url, tag, connected = () => {}, disconnected = () => {}) {
    modules.set(url, () => customElements.define(tag, class extends HTMLElement {
      connectedCallback() {connected(this);}
      disconnectedCallback() {disconnected(this);}
    }));
  }
  function snapshot(id, text = id, connected, disconnected) {
    const tag = `sdk-mini-app-${++elements}`;
    const app = {id, name: id, bundle: {element: tag, entry: 'frontend/index.js', backend: null,
      files: [{path: 'frontend/index.js', sha256: `${tag}-v1`, size: 1}]}};
    define(`/api/mini-app-files/${tag}/frontend/index.js`, tag, connected || (element => {element.textContent = text;}), disconnected);
    return app;
  }
  return {snapshot, define, modules, filesBase, importModule};
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
module.exports = {installMiniAppModules, deferred};
