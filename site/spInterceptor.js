/**
 * SharePoint REST API Interceptor for SPARC Sandbox
 *
 * Patches jQuery.ajax to intercept SharePoint REST calls and return mock
 * responses from an in-memory store. Enables full offline development
 * without a SharePoint server.
 *
 * Load order: jquery.js -> sharepointContext.js -> spInterceptor.js -> app
 *
 * Public API (global):
 *   SPInterceptor.store     -- in-memory data (user, profile, groups, lists)
 *   SPInterceptor.register  -- add custom endpoint handlers
 *   SPInterceptor.logging   -- toggle console output (default: true)
 */
var SPInterceptor = (function ($) {
  'use strict';

  var PREFIX = '[SPInterceptor]';
  var DELAY_MS = 1000; // Simulated response delay (ms) -- set to 0 for instant responses

  // ==================================================================
  // CONFIGURATION -- edit this section to customize the sandbox identity
  // ==================================================================

  var store = {
    user: {
      Id: 1,
      LoginName: _spPageContextInfo.userLoginName,
      Title: 'John Doe',
      Email: 'john.doe@example.com',
    },

    profile: {
      DisplayName: 'John Doe',
      Email: 'john.doe@example.com',
      Title: 'Software Developer',
      PictureUrl: '',
      PersonalUrl: '',
      DirectReports: { results: [] },
      ExtendedManagers: { results: [] },
      Peers: { results: [] },
      UserProfileProperties: {
        results: [
          { Key: 'Department', Value: 'Engineering', ValueType: 'Edm.String' },
          { Key: 'Office', Value: 'Remote', ValueType: 'Edm.String' },
        ],
      },
    },

    groups: [
      { Id: 1, Title: 'Sandbox Members', Description: 'Default members group', OwnerTitle: 'Admin' },
      { Id: 2, Title: 'Sandbox Owners', Description: 'Default owners group', OwnerTitle: 'Admin' },
    ],

    /**
     * Stale principal returned by `ensureuser`, reproducing the on-prem
     * duplicate User-Information-List bug: a low/empty-email row resolves
     * instead of the valid one. `getuserbyid(STALE_USER_ID)/groups` returns []
     * (the stale principal is in no group), so the OLD siteUserId-based access
     * path grants nothing. The NEW email path (CurrentUser -> isUserInGroup)
     * resolves access via the valid email in groupMembers below.
     */
    staleUser: {
      Id: 999,
      LoginName: _spPageContextInfo.userLoginName,
      Title: 'John Doe',
      Email: '', // empty -- the ghost UIL entry
    },

    /**
     * Per-group members, keyed by group Title. Returned by
     * `sitegroups/getbyname('Title')/users` (and `getbyid(n)` via Id->Title
     * lookup), honoring `?$filter=Email eq '...'`. The valid john.doe row lives
     * in 'Sandbox Owners' so email-based resolution grants OWNER access even
     * though the stale principal (Id 999) is in no group. The empty-email ghost
     * duplicate exercises getGroupUsers' dedupe/drop logic.
     */
    groupMembers: {
      'Sandbox Members': [
        { Id: 2, LoginName: 'i:0#.w|domain\\jsmith', Title: 'Jane Smith', Email: 'jane.smith@example.com' },
      ],
      'Sandbox Owners': [
        { Id: 999, LoginName: _spPageContextInfo.userLoginName, Title: '', Email: '' }, // ghost dup
        { Id: 1, LoginName: _spPageContextInfo.userLoginName, Title: 'John Doe', Email: 'john.doe@example.com' },
      ],
    },

    /** In-memory lists. Pre-populate to seed data for your routes. */
    lists: {},
  };

  var STALE_USER_ID = 999;

  // Merge project-specific seed data from sharepointContext.js
  if (typeof _spMockData !== 'undefined') {
    if (_spMockData.user) $.extend(store.user, _spMockData.user);
    if (_spMockData.profile) $.extend(true, store.profile, _spMockData.profile);
    if (_spMockData.groups) store.groups = _spMockData.groups;
    if (_spMockData.groupMembers) store.groupMembers = _spMockData.groupMembers;
    if (_spMockData.staleUser) $.extend(store.staleUser, _spMockData.staleUser);
    if (_spMockData.lists) {
      Object.keys(_spMockData.lists).forEach(function (title) {
        store.lists[title] = _spMockData.lists[title];
      });
    }
  }

  // ==================================================================
  // INTERNALS
  // ==================================================================

  var logging = true;
  var customHandlers = [];
  var _originalAjax = $.ajax;

  // -- Helpers --

  function _ok(data) {
    var d = $.Deferred();
    setTimeout(function () { d.resolve(data); }, DELAY_MS);
    return d.promise();
  }

  function _fail(status, message) {
    var d = $.Deferred();
    setTimeout(function () { d.reject({ status: status, responseText: message }); }, DELAY_MS);
    return d.promise();
  }

  function _method(s) {
    if (s.type === 'GET') return 'GET';
    return (s.headers && s.headers['X-HTTP-Method']) || s.type || 'GET';
  }

  function _listTitle(url) {
    var m = url.match(/getbytitle\('([^']+)'\)/i);
    return m ? m[1] : null;
  }

  function _itemId(url) {
    var m = url.match(/items\((\d+)\)/);
    return m ? parseInt(m[1], 10) : null;
  }

  function _fieldName(url) {
    var m = url.match(/getbyinternalnameortitle\('([^']+)'\)/i);
    return m ? m[1] : null;
  }

  function _ensureList(title) {
    if (!store.lists[title]) store.lists[title] = { items: [], fields: [], views: [], nextId: 1 };
    return store.lists[title];
  }

  function _parseBody(settings) {
    return typeof settings.data === 'string' ? JSON.parse(settings.data) : settings.data || {};
  }

  function _log(method, url, detail) {
    if (logging) console.log(PREFIX, method, url, detail ? '-- ' + detail : '');
  }

  var _mockPeople = [
    {
      Key: 'i:0#.w|domain\\jdoe',
      DisplayText: 'John Doe',
      IsResolved: true,
      EntityType: 'User',
      EntityData: { Email: 'john.doe@example.com', Title: 'Software Developer' },
      Description: 'john.doe@example.com',
      ProviderName: 'Active Directory',
      ProviderDisplayName: 'Active Directory',
      MultipleMatches: [],
    },
    {
      Key: 'i:0#.w|domain\\jsmith',
      DisplayText: 'Jane Smith',
      IsResolved: true,
      EntityType: 'User',
      EntityData: { Email: 'jane.smith@example.com', Title: 'Project Manager' },
      Description: 'jane.smith@example.com',
      ProviderName: 'Active Directory',
      ProviderDisplayName: 'Active Directory',
      MultipleMatches: [],
    },
    {
      Key: 'i:0#.w|domain\\bjohnson',
      DisplayText: 'Bob Johnson',
      IsResolved: true,
      EntityType: 'User',
      EntityData: { Email: 'bob.johnson@example.com', Title: 'Business Analyst' },
      Description: 'bob.johnson@example.com',
      ProviderName: 'Active Directory',
      ProviderDisplayName: 'Active Directory',
      MultipleMatches: [],
    },
    {
      Key: 'i:0#.w|domain\\mgarcia',
      DisplayText: 'Maria Garcia',
      IsResolved: true,
      EntityType: 'User',
      EntityData: { Email: 'maria.garcia@example.com', Title: 'UX Designer' },
      Description: 'maria.garcia@example.com',
      ProviderName: 'Active Directory',
      ProviderDisplayName: 'Active Directory',
      MultipleMatches: [],
    },
    {
      Key: 'i:0#.w|domain\\achen',
      DisplayText: 'Alex Chen',
      IsResolved: true,
      EntityType: 'User',
      EntityData: { Email: 'alex.chen@example.com', Title: 'Data Engineer' },
      Description: 'alex.chen@example.com',
      ProviderName: 'Active Directory',
      ProviderDisplayName: 'Active Directory',
      MultipleMatches: [],
    },
    {
      Key: 'i:0#.w|domain\\swilliams',
      DisplayText: 'Sarah Williams',
      IsResolved: true,
      EntityType: 'User',
      EntityData: { Email: 'sarah.williams@example.com', Title: 'Team Lead' },
      Description: 'sarah.williams@example.com',
      ProviderName: 'Active Directory',
      ProviderDisplayName: 'Active Directory',
      MultipleMatches: [],
    },
  ];

  // -- CAML query engine --

  function _fieldAsString(item, fieldName) {
    var v = item[fieldName];
    return (v === null || v === undefined) ? '' : String(v);
  }

  function _buildPredicate(el) {
    var tag = el.tagName;

    if (tag === 'And' || tag === 'Or') {
      var children = [];
      for (var i = 0; i < el.children.length; i++) children.push(el.children[i]);
      var left = _buildPredicate(children[0]);
      var right = _buildPredicate(children[1]);
      if (tag === 'And') return function (item) { return left(item) && right(item); };
      return function (item) { return left(item) || right(item); };
    }

    // IsNull / IsNotNull -- single FieldRef child, no Value
    if (tag === 'IsNull' || tag === 'IsNotNull') {
      var ref = el.querySelector('FieldRef');
      var fn = ref ? ref.getAttribute('Name') : '';
      if (tag === 'IsNull') return function (item) { var v = item[fn]; return v === null || v === undefined || v === ''; };
      return function (item) { var v = item[fn]; return v !== null && v !== undefined && v !== ''; };
    }

    // Comparison operators: Eq, Neq, Gt, Lt, Geq, Leq, Contains, BeginsWith
    var fieldRef = el.querySelector('FieldRef');
    var valueEl = el.querySelector('Value');
    if (!fieldRef || !valueEl) return function () { return true; };
    var field = fieldRef.getAttribute('Name');
    var val = valueEl.textContent || '';

    switch (tag) {
      case 'Eq':         return function (item) { return _fieldAsString(item, field) === val; };
      case 'Neq':        return function (item) { return _fieldAsString(item, field) !== val; };
      case 'Gt':         return function (item) { return _fieldAsString(item, field) > val; };
      case 'Lt':         return function (item) { return _fieldAsString(item, field) < val; };
      case 'Geq':        return function (item) { return _fieldAsString(item, field) >= val; };
      case 'Leq':        return function (item) { return _fieldAsString(item, field) <= val; };
      case 'Contains':   return function (item) { return _fieldAsString(item, field).toLowerCase().indexOf(val.toLowerCase()) !== -1; };
      case 'BeginsWith': return function (item) { return _fieldAsString(item, field).toLowerCase().indexOf(val.toLowerCase()) === 0; };
      default:           return function () { return true; };
    }
  }

  function _parseCAMLViewXml(viewXml) {
    var result = { predicate: null, orderBy: [], viewFields: [], rowLimit: 500 };
    if (!viewXml) return result;

    var doc = new DOMParser().parseFromString(viewXml, 'application/xml');
    var view = doc.querySelector('View');
    if (!view) return result;

    // Where clause
    var where = view.querySelector('Query > Where');
    if (where && where.children.length > 0) {
      result.predicate = _buildPredicate(where.children[0]);
    }

    // OrderBy
    var orderBy = view.querySelector('Query > OrderBy');
    if (orderBy) {
      var refs = orderBy.querySelectorAll('FieldRef');
      for (var i = 0; i < refs.length; i++) {
        var asc = refs[i].getAttribute('Ascending');
        result.orderBy.push({
          field: refs[i].getAttribute('Name'),
          ascending: asc !== 'FALSE',
        });
      }
    }

    // ViewFields
    var viewFields = view.querySelector('ViewFields');
    if (viewFields) {
      var vfRefs = viewFields.querySelectorAll('FieldRef');
      for (var j = 0; j < vfRefs.length; j++) {
        result.viewFields.push(vfRefs[j].getAttribute('Name'));
      }
    }

    // RowLimit
    var rowLimit = view.querySelector('RowLimit');
    if (rowLimit) {
      var parsed = parseInt(rowLimit.textContent, 10);
      if (!isNaN(parsed) && parsed > 0) result.rowLimit = parsed;
    }

    return result;
  }

  function _sortItems(items, orderByDefs) {
    if (!orderByDefs || orderByDefs.length === 0) return items;
    return items.slice().sort(function (a, b) {
      for (var i = 0; i < orderByDefs.length; i++) {
        var def = orderByDefs[i];
        var av = _fieldAsString(a, def.field);
        var bv = _fieldAsString(b, def.field);
        if (av < bv) return def.ascending ? -1 : 1;
        if (av > bv) return def.ascending ? 1 : -1;
      }
      return 0;
    });
  }

  function _paginateItems(items, rowLimit, pagingInfoStr) {
    var startIndex = 0;
    if (pagingInfoStr) {
      var idMatch = pagingInfoStr.match(/p_ID=(\d+)/);
      if (idMatch) {
        var lastId = parseInt(idMatch[1], 10);
        for (var i = 0; i < items.length; i++) {
          if (items[i].Id === lastId) { startIndex = i + 1; break; }
        }
      }
    }
    var pageItems = items.slice(startIndex, startIndex + rowLimit);
    var hasMore = startIndex + rowLimit < items.length;
    var position = null;
    if (hasMore && pageItems.length > 0) {
      var lastItem = pageItems[pageItems.length - 1];
      position = { PagingInfo: 'Paged=TRUE&p_ID=' + lastItem.Id };
    }
    return { pageItems: pageItems, position: position };
  }

  function _filterViewFields(item, viewFields) {
    if (!viewFields || viewFields.length === 0) return $.extend({}, item);
    var out = { Id: item.Id };
    for (var i = 0; i < viewFields.length; i++) {
      var f = viewFields[i];
      if (item.hasOwnProperty(f)) out[f] = item[f];
    }
    return out;
  }

  // Extracts a raw (still URL-encoded) query-string value from a URL, or null.
  function _getQueryParam(url, name) {
    var val = (url.split(name + '=')[1] || '').split('&')[0];
    return val || null;
  }

  function _applyODataFilter(items, filterString) {
    if (!filterString) return items;
    var conditions = filterString.split(/\s+and\s+/i);
    return items.filter(function (item) {
      for (var i = 0; i < conditions.length; i++) {
        var parts = conditions[i].trim().match(/^(\w+)\s+eq\s+(.+)$/i);
        if (!parts) continue;
        var prop = parts[1];
        var raw = parts[2].trim();
        var expected;
        if (raw === 'true') expected = true;
        else if (raw === 'false') expected = false;
        else if (raw.charAt(0) === "'") expected = raw.slice(1, -1);
        else expected = raw;
        if (item[prop] !== expected) return false;
      }
      return true;
    });
  }

  // -- Custom handler check --

  function _checkCustom(settings) {
    var method = _method(settings);
    var url = settings.url || '';
    for (var i = 0; i < customHandlers.length; i++) {
      var h = customHandlers[i];
      if (h.method !== '*' && h.method !== method) continue;
      var ok =
        typeof h.test === 'string'
          ? url.includes(h.test)
          : h.test instanceof RegExp
            ? h.test.test(url)
            : typeof h.test === 'function'
              ? h.test(url, settings)
              : false;
      if (ok) return h.handler(settings);
    }
    return null;
  }

  // -- Built-in router --

  function _route(settings) {
    var url = settings.url || '';
    var m = _method(settings);

    // Digest refresh
    if (m === 'POST' && url.includes('/_api/contextinfo')) {
      _log('POST', url, 'digest refresh');

      return _ok({
        GetContextWebInformation: {
          FormDigestValue: '0xMOCK_DIGEST_' + Date.now(),
          FormDigestTimeoutSeconds: 1800,
        },
      });
    }

    // People picker search
    if (m === 'POST' && url.includes('clientPeoplePickerSearchUser')) {
      var body = _parseBody(settings);
      var params = body.queryParams;
      var query = (params.QueryString || '').toLowerCase();
      var filtered = _mockPeople.filter(function (p) {
        return p.DisplayText.toLowerCase().indexOf(query) !== -1 ||
               p.EntityData.Email.toLowerCase().indexOf(query) !== -1;
      });
      _log('POST', url, 'people search "' + query + '" -> ' + filtered.length + ' results');
      return _ok({
        d: {
          ClientPeoplePickerSearchUser: JSON.stringify(filtered),
        },
      });
    }

    // Ensure user -- returns the STALE principal (empty email, Id 999),
    // reproducing the on-prem duplicate-UIL bug.
    if (m === 'POST' && url.includes('/_api/web/ensureuser')) {
      _log('POST', url, 'ensureUser (stale principal)');
      return _ok({ d: store.staleUser });
    }

    // User groups by ID -- the stale principal belongs to no group, so the
    // OLD siteUserId-based path returns []. Other IDs still see store.groups.
    var groupsByIdMatch = url.match(/getuserbyid\((\d+)\)\/groups/);
    if (m === 'GET' && groupsByIdMatch) {
      var uid = parseInt(groupsByIdMatch[1], 10);
      var ugroups = uid === STALE_USER_ID ? [] : store.groups;
      _log('GET', url, 'user groups (id ' + uid + ') -> ' + ugroups.length);
      // Return BOTH envelopes: SiteApi.getUserGroupsByLogin reads `.value`
      // directly, while people.api unwraps `.d`. Serving both keeps every caller
      // working regardless of which shape it expects.
      return _ok({ value: ugroups, d: { results: ugroups } });
    }

    // UIL login lookup -- maps any current-user login (primary or ghost) to a
    // valid principal Id so getUserGroupsByLogin() can recover groups. The stale
    // ghost (empty email, Id 999) is in no group, so recovery routes through the
    // valid Id 1 whose getuserbyid(1)/groups returns store.groups. An empty or
    // absent login resolves to nothing -> getUserGroupsByLogin returns [].
    if (m === 'GET' && /\/_api\/web\/siteusers/.test(url)) {
      var suFilter = _getQueryParam(url, '$filter');
      var suDecoded = suFilter ? decodeURIComponent(suFilter) : '';
      var suMatch = /LoginName\s+eq\s+'([^']*)'/i.exec(suDecoded);
      var suLogin = suMatch ? suMatch[1].replace(/''/g, "'") : '';
      var suValue = suLogin ? [{ Id: 1 }] : [];
      _log('GET', url, 'siteusers login lookup "' + suLogin + '" -> ' + suValue.length);
      return _ok({ value: suValue });
    }

    // User profile (PeopleManager)
    if (m === 'GET' && url.includes('PeopleManager')) {
      _log('GET', url, 'user profile');
      return _ok({ d: store.profile });
    }

    // Group members: sitegroups/getbyid(n)|getbyname('Title')/users [?$filter=...]
    // Resolves members by group Title (numeric id mapped via store.groups),
    // then applies any server-side $filter (e.g. Email eq '...').
    if (m === 'GET' && /\/_api\/web\/sitegroups\/(getbyid\(\d+\)|getbyname\([^)]*\))\/users/.test(url)) {
      var byName = url.match(/getbyname\('([^']*)'\)\/users/);
      var byId = url.match(/getbyid\((\d+)\)\/users/);
      var groupTitle = null;
      if (byName) {
        groupTitle = decodeURIComponent(byName[1]).replace(/''/g, "'");
      } else if (byId) {
        var gid = parseInt(byId[1], 10);
        var g = store.groups.filter(function (x) { return x.Id === gid; })[0];
        groupTitle = g ? g.Title : null;
      }
      var members = (groupTitle && store.groupMembers[groupTitle]) || [];
      var filterParam = _getQueryParam(url, '$filter');
      if (filterParam) {
        members = _applyODataFilter(members, decodeURIComponent(filterParam));
      }
      _log('GET', url, 'group members "' + groupTitle + '" -> ' + members.length);
      return _ok({ value: members });
    }

    // Site groups
    if (m === 'GET' && url.includes('/_api/web/sitegroups')) {
      _log('GET', url, 'site groups');
      return _ok({ value: store.groups });
    }

    // ---- List-scoped operations ----

    var title = _listTitle(url);

    if (title) {
      var list = _ensureList(title);

      // Update list properties (Hidden, form URLs, etc.)
      if (m === 'MERGE' && !/\/items|\/fields|\/views|\/contenttypes|\/DefaultView/i.test(url)) {
        var lb = _parseBody(settings);
        delete lb.__metadata;
        $.extend(list, lb);
        _log('MERGE', url, title + ' updateList ' + JSON.stringify(lb));
        return _ok(undefined);
      }

      // CAML query (getitems)
      if (m === 'POST' && url.includes('/getitems')) {
        var qBody = _parseBody(settings);
        var viewXml = qBody && qBody.query ? qBody.query.ViewXml : null;
        var pagingInfo = qBody && qBody.query && qBody.query.ListItemCollectionPosition
          ? qBody.query.ListItemCollectionPosition.PagingInfo : null;
        var caml = _parseCAMLViewXml(viewXml);

        var filtered = caml.predicate
          ? list.items.filter(caml.predicate)
          : list.items.slice();
        var sorted = _sortItems(filtered, caml.orderBy);
        var page = _paginateItems(sorted, caml.rowLimit, pagingInfo);
        var results = page.pageItems.map(function (item) {
          var projected = _filterViewFields(item, caml.viewFields);
          projected['odata.etag'] = '"' + item.Id + '"';
          return projected;
        });

        _log('POST', url, title + ' -> ' + filtered.length + '/' + list.items.length + ' match, page ' + results.length);
        return _ok({ value: results, ListItemCollectionPosition: page.position });
      }

      // Create item
      if (m === 'POST' && /\/items\s*$|\/items$/.test(url)) {
        var body = _parseBody(settings);
        var item = $.extend({}, body);
        delete item.__metadata;
        item.Id = list.nextId++;
        item.AuthorId = store.user.Id;
        item.Created = new Date().toISOString();
        item.Modified = new Date().toISOString();
        list.items.push(item);
        _log('POST', url, title + ' createItem -> Id ' + item.Id);
        return _ok($.extend({}, item, { 'odata.etag': '"' + item.Id + '"' }));
      }

      // Update item (MERGE)
      if (m === 'MERGE' && /\/items\(\d+\)/.test(url)) {
        var uid = _itemId(url);
        var ifMatch = settings.headers && settings.headers['IF-MATCH'];
        var target = list.items.find(function (i) { return i.Id === uid; });
        // Simulate 412 when IF-MATCH is supplied and does not match the stored etag
        if (target && ifMatch && ifMatch !== '*') {
          var storedEtag = '"' + target.Id + '"';
          if (ifMatch !== storedEtag) {
            _log('MERGE', url, title + ' updateItem ' + uid + ' -- 412 ETag mismatch');
            return _fail(412, 'The request ETag value does not match the current value');
          }
        }
        var ub = _parseBody(settings);
        delete ub.__metadata;
        if (target) $.extend(target, ub, { Modified: new Date().toISOString() });
        _log('MERGE', url, title + ' updateItem ' + uid);
        return _ok(undefined);
      }

      // Delete item
      if (m === 'DELETE' && /\/items\(\d+\)/.test(url)) {
        var did = _itemId(url);
        var delIfMatch = settings.headers && settings.headers['IF-MATCH'];
        var delTarget = list.items.find(function (i) { return i.Id === did; });
        // Simulate 412 when IF-MATCH is supplied and does not match the stored etag
        if (delTarget && delIfMatch && delIfMatch !== '*') {
          var delStoredEtag = '"' + delTarget.Id + '"';
          if (delIfMatch !== delStoredEtag) {
            _log('DELETE', url, title + ' deleteItem ' + did + ' -- 412 ETag mismatch');
            return _fail(412, 'The request ETag value does not match the current value');
          }
        }
        list.items = list.items.filter(function (i) { return i.Id !== did; });
        _log('DELETE', url, title + ' deleteItem ' + did);
        return _ok(undefined);
      }

      // Create field
      if (m === 'POST' && /\/fields$/.test(url)) {
        var fb = _parseBody(settings);
        var existing = list.fields.find(function (f) { return f.InternalName === fb.Title; });
        if (existing) {
          _log('POST', url, title + ' createField DUPLICATE: ' + fb.Title);
          return _fail(409, 'A field with this internal name already exists');
        }
        var field = {
          Title: fb.Title,
          InternalName: fb.Title,
          TypeAsString: fb.FieldTypeKind === 3 ? 'Note' : 'Text',
          FieldTypeKind: fb.FieldTypeKind || 2,
          Hidden: false,
          ReadOnlyField: false,
          Indexed: !!fb.Indexed,
        };
        list.fields.push(field);
        _log('POST', url, title + ' createField: ' + field.Title);
        return _ok(field);
      }

      // Delete field
      if (m === 'DELETE' && url.includes('getbyinternalnameortitle')) {
        var dfn = _fieldName(url);
        list.fields = list.fields.filter(function (f) { return f.InternalName !== dfn; });
        _log('DELETE', url, title + ' deleteField: ' + dfn);
        return _ok(undefined);
      }

      // Set field indexed (MERGE)
      if (m === 'MERGE' && url.includes('getbyinternalnameortitle')) {
        var sfn = _fieldName(url);
        var sfb = _parseBody(settings);
        var ft = list.fields.find(function (f) { return f.InternalName === sfn; });
        if (ft && sfb.Indexed !== undefined) ft.Indexed = sfb.Indexed;
        _log('MERGE', url, title + ' setFieldIndexed: ' + sfn + ' = ' + sfb.Indexed);
        return _ok(undefined);
      }

      // Update view properties (DefaultView or by title)
      if (m === 'MERGE' && (/\/DefaultView\s*$/i.test(url) || /\/views\/getbytitle\('[^']+'\)\s*$/i.test(url))) {
        var uvBody = _parseBody(settings);
        var uvLabel = /DefaultView/i.test(url) ? 'DefaultView' : url.match(/getbytitle\('([^']+)'\)/i)[1];
        if (/DefaultView/i.test(url) && uvBody.TabularView !== undefined) {
          list.defaultView = list.defaultView || {};
          list.defaultView.TabularView = uvBody.TabularView;
        }
        _log('MERGE', url, title + ' updateView: ' + uvLabel + ' ' + JSON.stringify(uvBody));
        return _ok(undefined);
      }

      // GET DefaultView (TabularView reflects quick-edit state)
      if (m === 'GET' && /\/DefaultView(\?|\s*$)/i.test(url)) {
        var dvTab = (list.defaultView && list.defaultView.TabularView !== undefined)
          ? list.defaultView.TabularView : true;
        _log('GET', url, title + ' getDefaultView: TabularView=' + dvTab);
        return _ok({ TabularView: dvTab });
      }

      // GET view by title
      if (m === 'GET' && /\/views\/getbytitle\('/i.test(url)) {
        var viewMatch = url.match(/views\/getbytitle\('([^']+)'\)/i);
        var viewTitle = viewMatch ? viewMatch[1] : null;
        if (!list.views) list.views = [];
        var view = list.views.find(function (v) { return v.Title === viewTitle; });
        if (view) {
          _log('GET', url, title + ' getView: ' + viewTitle);
          return _ok(view);
        }
        _log('GET', url, title + ' getView: ' + viewTitle + ' -- 404');
        return _fail(404, 'View not found: ' + viewTitle);
      }

      // Create view
      if (m === 'POST' && /\/views\s*$|\/views$/.test(url) && !url.includes('addviewfield')) {
        var vb = _parseBody(settings);
        if (!list.views) list.views = [];
        var dup = list.views.find(function (v) { return v.Title === vb.Title; });
        if (dup) {
          _log('POST', url, title + ' createView DUPLICATE: ' + vb.Title);
          return _fail(409, 'A view with this title already exists');
        }
        var newView = { Title: vb.Title, PersonalView: !!vb.PersonalView, Id: 'view-' + Date.now() };
        list.views.push(newView);
        _log('POST', url, title + ' createView: ' + vb.Title);
        return _ok(newView);
      }

      // Add field to view
      if (m === 'POST' && url.includes('addviewfield')) {
        var vfMatch = url.match(/addviewfield\('([^']+)'\)/);
        var vfName = vfMatch ? vfMatch[1] : '?';
        _log('POST', url, title + ' addViewField: ' + vfName);
        return _ok(undefined);
      }

      // Get fields
      if (m === 'GET' && url.includes('/fields')) {
        var filterParam = _getQueryParam(url, '$filter');
        var filteredFields = filterParam
          ? _applyODataFilter(list.fields, decodeURIComponent(filterParam))
          : list.fields;
        _log('GET', url, title + ' getFields (' + filteredFields.length + '/' + list.fields.length + ')');
        return _ok({ value: filteredFields });
      }

      // GET list properties (getbytitle, no subpath) -- e.g. $select=DefaultNewFormUrl
      if (m === 'GET' && !/\/(items|fields|views|contenttypes|DefaultView)/i.test(url)) {
        _log('GET', url, title + ' getList');
        return _ok({
          Title: title,
          Id: 'mock-' + title.toLowerCase().replace(/\s/g, '-'),
          Hidden: !!list.Hidden,
          DefaultNewFormUrl: list.DefaultNewFormUrl || '',
          DefaultEditFormUrl: list.DefaultEditFormUrl || '',
          ServerRelativeUrl: list.ServerRelativeUrl || (_spPageContextInfo.webAbsoluteUrl + '/Lists/' + title),
        });
      }

      // Delete list (DELETE on list endpoint, no /items or /fields subpath)
      if (m === 'DELETE') {
        delete store.lists[title];
        _log('DELETE', url, 'deleteList: ' + title);
        return _ok(undefined);
      }
    }

    // Create list (POST /_api/web/lists, no getbytitle)
    if (m === 'POST' && /\/_api\/web\/lists$/.test(url)) {
      var clb = _parseBody(settings);
      if (store.lists[clb.Title]) {
        _log('POST', url, 'createList DUPLICATE: ' + clb.Title);
        return _fail(409, 'A list with this title already exists');
      }
      _ensureList(clb.Title);
      _log('POST', url, 'createList: ' + clb.Title);
      return _ok({ Title: clb.Title, Id: 'mock-' + Date.now() });
    }

    // Get all lists
    if (m === 'GET' && /\/_api\/web\/lists$/.test(url)) {
      var names = Object.keys(store.lists).map(function (t) {
        var l = store.lists[t];
        return { Title: t, Id: 'mock-' + t.toLowerCase().replace(/\s/g, '-'), Hidden: !!l.Hidden };
      });
      _log('GET', url, 'getLists (' + names.length + ')');
      return _ok({ value: names });
    }

    // Web info (must be last /_api/web handler)
    if (m === 'GET' && /\/_api\/web$/.test(url)) {
      _log('GET', url, 'getWebInfo');
      return _ok({
        Title: _spPageContextInfo.webTitle || 'SPARC Sandbox',
        Url: _spPageContextInfo.webAbsoluteUrl,
      });
    }

    return null;
  }

  // ==================================================================
  // PATCH $.ajax
  // ==================================================================

  $.ajax = function (settings) {
    var result = _checkCustom(settings) || _route(settings);
    if (result) return result;

    console.warn(PREFIX, _method(settings), settings.url, '-- NO HANDLER (falling through)');
    return _originalAjax.call($, settings);
  };

  // ==================================================================
  // PUBLIC API
  // ==================================================================

  console.log(PREFIX, 'Active');

  return {
    store: store,
    register: function (method, test, handler) {
      customHandlers.push({ method: method.toUpperCase(), test: test, handler: handler });
    },
    get logging() {
      return logging;
    },
    set logging(v) {
      logging = !!v;
    },
  };
})(jQuery);
