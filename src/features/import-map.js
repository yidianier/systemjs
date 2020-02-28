/*
 * Import map support for SystemJS
 * 
 * <script type="systemjs-importmap">{}</script>
 * OR
 * <script type="systemjs-importmap" src=package.json></script>
 * 
 * Only those import maps available at the time of SystemJS initialization will be loaded
 * and they will be loaded in DOM order.
 * 
 * There is no support for dynamic import maps injection currently.
 */
import { baseUrl, resolveAndComposeImportMap, resolveImportMap, resolveIfNotPlainOrUrl, hasDocument } from '../common.js';
import { systemJSPrototype } from '../system-core.js';

let importMap = { imports: {}, scopes: {}, depcache: {} }, importMapPromise;

if (hasDocument) {
  Array.prototype.forEach.call(document.querySelectorAll('script[type="systemjs-importmap"][src]'), function (script) {
    script._j = fetch(script.src).then(function (res) {
      return res.json();
    });
  });
}

systemJSPrototype.prepareImport = function () {
  if (!importMapPromise) {
    importMapPromise = Promise.resolve();
    if (hasDocument)
      Array.prototype.forEach.call(document.querySelectorAll('script[type="systemjs-importmap"]'), function (script) {
        importMapPromise = importMapPromise.then(function () {
          return (script._j || script.src && fetch(script.src).then(function (resp) { return resp.json(); }) || Promise.resolve(JSON.parse(script.innerHTML)))
          .then(function (json) {
            importMap = resolveAndComposeImportMap(json, script.src || baseUrl, importMap);
          });
        });
      });
  }
  return importMapPromise;
};

systemJSPrototype.resolve = function (id, parentUrl) {
  parentUrl = parentUrl || baseUrl;
  return resolveImportMap(importMap, resolveIfNotPlainOrUrl(id, parentUrl) || id, parentUrl) || throwUnresolved(id, parentUrl);
};

let supportsPreload = false, supportsPrefetch = false;
if (hasDocument) {
  let relList = document.createElement('link').relList;
  if (relList && relList.supports) {
    supportsPrefetch = true;
    try {
      supportsPreload = relList.supports('preload');
    }
    catch (e) {}
  }
}

const systemInstantiate = systemJSPrototype.instantiate;
systemJSPrototype.instantiate = function (url, firstParentUrl) {
  const depcache = importMap.depcache[url];
  if (depcache) {
    depcache.forEach(function (url) {
      // fallback to old fashioned image technique which still works in safari
      if (!supportsPreload && !supportsPrefetch) {
        var preloadImage = new Image();
        preloadImage.src = url;
        return;
      }
      var link = document.createElement('link');
      if (supportsPreload) {
        link.rel = 'preload';
        link.as = 'script';
      }
      else {
        // this works for all except Safari (detected by relList.supports lacking)
        link.rel = 'prefetch';
      }
      link.href = url;
      document.head.appendChild(link);
    });
  }
  return systemInstantiate.call(this, url, firstParentUrl);
};

function throwUnresolved (id, parentUrl) {
  throw Error("Unable to resolve specifier '" + id + (parentUrl ? "' from " + parentUrl : "'"));
}
