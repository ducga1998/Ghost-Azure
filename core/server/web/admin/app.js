const debug = require('ghost-ignition').debug('admin');
const express = require('express');
const serveStatic = require('express').static;
const config = require('../../config');
const constants = require('../../lib/constants');
const urlService = require('../../services/url');
const shared = require('../shared');
const adminMiddleware = require('./middleware');

module.exports = function setupAdminApp() {
    debug('Admin setup start');
    const adminApp = express();

    // Admin assets
    // @TODO ensure this gets a local 404 error handler
    const configMaxAge = config.get('caching:admin:maxAge');
    adminApp.use('/assets', serveStatic(
        config.get('paths').clientAssets,
        {maxAge: (configMaxAge || configMaxAge === 0) ? configMaxAge : constants.ONE_YEAR_MS, fallthrough: false}
    ));

    // Service Worker for offline support
    adminApp.get(/^\/(sw.js|sw-registration.js)$/, require('./serviceworker'));

    // Ember CLI's live-reload script
    if (config.get('env') === 'development') {
        adminApp.get('/ember-cli-live-reload.js', function emberLiveReload(req, res) {
            res.redirect(`http://localhost:4200${urlService.utils.getSubdir()}/ghost/ember-cli-live-reload.js`);
        });
    }

    // Render error page in case of maintenance
    adminApp.use(shared.middlewares.maintenance);

    // Force SSL if required
    // must happen AFTER asset loading and BEFORE routing
    adminApp.use(shared.middlewares.urlRedirects.adminRedirect);

    // Add in all trailing slashes & remove uppercase
    // must happen AFTER asset loading and BEFORE routing
    adminApp.use(shared.middlewares.prettyUrls);

    // Cache headers go last before serving the request
    // Admin is currently set to not be cached at all
    adminApp.use(shared.middlewares.cacheControl('private'));
    // Special redirects for the admin (these should have their own cache-control headers)
    adminApp.use(adminMiddleware);

    // Finally, routing
    adminApp.get('*', require('./controller'));

    adminApp.use(shared.middlewares.errorHandler.pageNotFound);
    adminApp.use(shared.middlewares.errorHandler.handleHTMLResponse);

    debug('Admin setup end');

    return adminApp;
};
