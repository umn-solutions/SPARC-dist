/**
 * Local-dev mock handlers for SharePoint REST endpoints not covered by
 * spInterceptor.js. Registered via SPInterceptor.register().
 *
 * Load order: jquery.js -> sharepointContext.js -> spInterceptor.js
 *             -> spMockHandlers.js -> app
 *
 * Response format: return a jQuery Deferred promise that resolves with the
 * data object. SPInterceptor's internal _ok() helper uses a setTimeout delay;
 * these handlers resolve immediately (acceptable for local dev).
 *
 * HOW TO TEST THE ABOUT IMAGE LOCALLY:
 *   1. Place any image in site/Shared Documents/media/ (e.g. about.svg).
 *   2. After the page loads, open the browser console and run:
 *        SPInterceptor.store.lists.SiteContent.items.push({
 *          Id: 99, Title: 'home.about.image', Content: 'about.svg', Placement: ''
 *        });
 *   3. Navigate away from / and back to / to reload the route.
 *   The route will call buildFileUrl('Team Documents', 'media', 'about.svg'),
 *   which resolves the library root via the mock, then builds:
 *     /site/Shared Documents/media/about.svg
 *   Live Server serves that path as: http://localhost:<port>/site/Shared Documents/media/about.svg
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // Local helpers -- mirrors SPInterceptor's internal _ok/_fail pattern.
  // -------------------------------------------------------------------------

  function ok(data) {
    var d = $.Deferred();
    d.resolve(data);
    return d.promise();
  }

  function fail(status, message) {
    var d = $.Deferred();
    d.reject({ status: status, responseText: message });
    return d.promise();
  }

  // -------------------------------------------------------------------------
  // Shared fixture data
  // -------------------------------------------------------------------------

  var sitePath = new URL(_spPageContextInfo.webAbsoluteUrl).pathname; // e.g. '/site'

  // The library root URL is deliberately different from the display title
  // ("Team Documents" -> "/site/Shared Documents") to prove the app resolves
  // it at runtime rather than hardcoding the URL segment.
  var teamDocsRoot = sitePath + '/Shared Documents';

  var resourcesPath = teamDocsRoot + '/public/homepage/resources';
  var now = new Date().toISOString();

  var sampleResources = [
    {
      Name: 'Volunteer handbook.pdf',
      ServerRelativeUrl: resourcesPath + '/Volunteer handbook.pdf',
      Length: '2456789',
      TimeLastModified: now,
    },
    {
      Name: 'Things to know before volunteering.pdf',
      ServerRelativeUrl: resourcesPath + '/Things to know before volunteering.pdf',
      Length: '1234567',
      TimeLastModified: now,
    },
    {
      Name: 'Frequently asked questions.pdf',
      ServerRelativeUrl: resourcesPath + '/Frequently asked questions.pdf',
      Length: '987654',
      TimeLastModified: now,
    },
    {
      Name: 'Event planning checklist.xlsx',
      ServerRelativeUrl: resourcesPath + '/Event planning checklist.xlsx',
      Length: '45321',
      TimeLastModified: now,
    },
  ];

  // -------------------------------------------------------------------------
  // Handler 1: Resolve library root by display title.
  //   GET .../_api/web/lists/getbytitle('<title>')/RootFolder?$select=...
  //
  // Returns the server-relative root URL for 'Team Documents'.
  // Returns a 404-style error for any other title so the failure path is
  // testable -- e.g. fetch the URL with a misspelled title.
  // -------------------------------------------------------------------------

  SPInterceptor.register(
    'GET',
    function (url) {
      return url.includes('/RootFolder') && /lists\/getbytitle\(/i.test(url);
    },
    function (settings) {
      var url = settings.url || '';
      var m = url.match(/getbytitle\('([^']+)'\)/i);
      var title = m ? decodeURIComponent(m[1]).replace(/''/g, "'") : '';

      if (title === 'Team Documents') {
        return ok({ ServerRelativeUrl: teamDocsRoot });
      }

      // Unknown library: reject so documents.js surfaces the failure path.
      return fail(404, 'List not found: ' + title);
    },
  );

  // -------------------------------------------------------------------------
  // Handler 2: List files inside a folder (parameter alias syntax).
  //   GET .../_api/web/GetFolderByServerRelativeUrl(@p)/Files?@p='<path>'&...
  //
  // Returns sample resource files for the resources folder.
  // Returns an empty list for any other folder (e.g. media/ before an image is
  // uploaded).
  // -------------------------------------------------------------------------

  SPInterceptor.register(
    'GET',
    function (url) {
      return url.includes('GetFolderByServerRelativeUrl');
    },
    function (settings) {
      var url = settings.url || '';

      // Extract and decode the @p parameter value. documents.js URL-encodes it
      // fully (e.g. @p='%2Fsite%2FShared%20Documents%2F...'); decodeURIComponent
      // restores the decoded server-relative path for comparison.
      var pMatch = url.match(/@p='([^']+)'/);
      var folderPath = pMatch ? decodeURIComponent(pMatch[1]) : '';

      // Normalise by stripping trailing slash.
      var normalised = folderPath.replace(/\/$/, '');
      var normResources = resourcesPath.replace(/\/$/, '');

      if (normalised === normResources) {
        return ok({ value: sampleResources });
      }

      // Any other folder: empty list (e.g. media/ -- files served directly by
      // Live Server at their server-relative URL, no listing needed).
      return ok({ value: [] });
    },
  );
})();
