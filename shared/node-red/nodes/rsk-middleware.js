/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Returns the runtime JS source that Node-RED will require() from disk.
 * The returned string is a self-contained CommonJS module.
 *
 * @returns {string} Node-RED node JS source
 */
export function getNodeJS() {
  // -----------------------------------------------------------------------
  // IMPORTANT: This string is written to <userDir>/nodes/rsk
  // and loaded by Node-RED at runtime via native require().
  // It must be plain CommonJS — no ES imports, no webpack features.
  // -----------------------------------------------------------------------
  return `
'use strict';

module.exports = function (RED) {
  function RskMiddlewareNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    // Configuration
    node.middlewareType = config.middlewareType || 'auth';
    node.authType = config.authType || 'required';
    node.role = config.role || '';
    node.permission = config.permission || '';
    node.group = config.group || '';
    node.ownerParam = config.ownerParam || 'userId';

    // ---------------------------------------------------------------
    // Retrieve the DI container via functionGlobalContext.
    // server.js configures:  functionGlobalContext: { container() { return app.get('container'); } }
    // ---------------------------------------------------------------
    var getContainer = RED.settings.functionGlobalContext.container;
    if (typeof getContainer !== 'function') {
      node.error('RSK container not found in functionGlobalContext');
      node.status({ fill: 'red', shape: 'dot', text: 'container missing' });
      return;
    }

    node.status({ fill: 'green', shape: 'dot', text: 'ready' });

    node.on('input', function (msg, send, done) {
      // Node-RED 0.x compat
      send = send || function () { node.send.apply(node, arguments); };
      done = done || function (err) { if (err) node.error(err, msg); };

      var req = msg.req;
      var res = msg.res;

      if (!req || !res) {
        node.warn('msg.req / msg.res missing — not an HTTP request');
        done();
        return;
      }

      // Build the next() callback that either forwards or stops the flow
      var nextCalled = false;
      function next(err) {
        if (nextCalled) return;        // guard against double-call
        nextCalled = true;
        if (err) {
          node.error(err.message || err, msg);
          done(err);
          return;
        }
        send(msg);
        done();
      }

      try {
        var container = getContainer();

        // Single access point for all auth middlewares
        var auth = container.resolve('auth');
        if (!auth || !auth.middlewares) {
          node.error('container.resolve("auth").middlewares is not available');
          done(new Error('auth middlewares provider missing'));
          return;
        }
        var mw = auth.middlewares;
        var middleware;

        switch (node.middlewareType) {
          case 'auth':
            middleware = node.authType === 'optional'
              ? mw.optionalAuth()
              : mw.requireAuth();
            break;

          case 'role':
            if (!node.role) {
              node.warn('Role not configured — skipping');
              send(msg);
              done();
              return;
            }
            middleware = mw.requireRole(node.role);
            break;

          case 'permission':
            if (!node.permission) {
              node.warn('Permission not configured — skipping');
              send(msg);
              done();
              return;
            }
            middleware = mw.requirePermission(node.permission);
            break;

          case 'group':
            if (!node.group) {
              node.warn('Group not configured — skipping');
              send(msg);
              done();
              return;
            }
            middleware = mw.requireGroup(node.group);
            break;

          case 'ownership':
            middleware = mw.requireOwnership({ param: node.ownerParam });
            break;

          default:
            node.warn('Unknown middleware type: ' + node.middlewareType);
            send(msg);
            done();
            return;
        }

        // Execute the Express middleware
        var result = middleware(req, res, next);
        if (result && typeof result.catch === 'function') {
          result.catch(function (err) {
            if (!nextCalled) {
              nextCalled = true;
              node.error('Middleware error: ' + (err.message || err), msg);
              done(err);
            }
          });
        }
      } catch (err) {
        node.error('Middleware setup error: ' + (err.message || err), msg);
        done(err);
      }
    });
  }

  RED.nodes.registerType('rsk-middleware', RskMiddlewareNode);
};
`;
}

/**
 * Returns the HTML source for the Node-RED editor UI.
 *
 * @returns {string} Node-RED node HTML source
 */
export function getNodeHTML() {
  return `
<script type="text/javascript">
  RED.nodes.registerType('rsk-middleware', {
    category: 'RSK',
    color: '#E9967A',
    defaults: {
      name:           { value: '' },
      middlewareType:  { value: 'auth' },
      authType:       { value: 'required' },
      role:           { value: '' },
      permission:     { value: '' },
      group:          { value: '' },
      ownerParam:     { value: 'userId' }
    },
    inputs:  1,
    outputs: 1,
    icon:    'bridge.svg',
    label: function () {
      if (this.name) return this.name;
      switch (this.middlewareType) {
        case 'auth':
          return this.authType === 'optional' ? 'Auth (Optional)' : 'Auth (Required)';
        case 'role':
          return 'Role: ' + (this.role || 'Any');
        case 'permission':
          return 'Perm: ' + (this.permission || 'Any');
        case 'group':
          return 'Group: ' + (this.group || 'Any');
        case 'ownership':
          return 'Owner: ' + (this.ownerParam || 'userId');
        default:
          return 'RSK Middleware';
      }
    },
    oneditprepare: function () {
      var toggle = function () {
        var t = $('#node-input-middlewareType').val();
        $('.rsk-mw-row').hide();
        $('#rsk-mw-' + t).show();
      };
      $('#node-input-middlewareType').on('change', toggle);
      toggle();
    }
  });
</script>

<script type="text/html" data-template-name="rsk-middleware">
  <div class="form-row">
    <label for="node-input-name"><i class="fa fa-tag"></i> Name</label>
    <input type="text" id="node-input-name" placeholder="Name">
  </div>
  <div class="form-row">
    <label for="node-input-middlewareType"><i class="fa fa-list"></i> Type</label>
    <select id="node-input-middlewareType">
      <option value="auth">Authentication</option>
      <option value="role">Role Check</option>
      <option value="permission">Permission Check</option>
      <option value="group">Group Check</option>
      <option value="ownership">Ownership Check</option>
    </select>
  </div>
  <div class="form-row rsk-mw-row" id="rsk-mw-auth">
    <label for="node-input-authType"><i class="fa fa-lock"></i> Mode</label>
    <select id="node-input-authType">
      <option value="required">Required</option>
      <option value="optional">Optional</option>
    </select>
  </div>
  <div class="form-row rsk-mw-row" id="rsk-mw-role" style="display:none">
    <label for="node-input-role"><i class="fa fa-id-badge"></i> Role</label>
    <input type="text" id="node-input-role" placeholder="e.g. admin">
  </div>
  <div class="form-row rsk-mw-row" id="rsk-mw-permission" style="display:none">
    <label for="node-input-permission"><i class="fa fa-key"></i> Permission</label>
    <input type="text" id="node-input-permission" placeholder="e.g. users:read">
  </div>
  <div class="form-row rsk-mw-row" id="rsk-mw-group" style="display:none">
    <label for="node-input-group"><i class="fa fa-users"></i> Group</label>
    <input type="text" id="node-input-group" placeholder="e.g. engineering">
  </div>
  <div class="form-row rsk-mw-row" id="rsk-mw-ownership" style="display:none">
    <label for="node-input-ownerParam"><i class="fa fa-user-circle"></i> Param</label>
    <input type="text" id="node-input-ownerParam" placeholder="e.g. userId">
  </div>
</script>

<script type="text/html" data-help-name="rsk-middleware">
  <p>Applies RSK Express middlewares (auth, role, permission, group, ownership) to the incoming HTTP request.</p>
  <h3>Configuration</h3>
  <dl class="message-properties">
    <dt>Type</dt>
    <dd>Authentication, Role Check, Permission Check, Group Check, or Ownership Check.</dd>
    <dt>Authentication</dt>
    <dd><b>Required</b>: blocks unauthenticated requests (401). <b>Optional</b>: attaches user if token present.</dd>
    <dt>Role</dt>
    <dd>Requires user to have the specified role.</dd>
    <dt>Permission</dt>
    <dd>Requires user to have the specified permission (e.g. <code>users:read</code>).</dd>
    <dt>Group</dt>
    <dd>Requires user to belong to the specified group.</dd>
    <dt>Ownership</dt>
    <dd>Checks if the authenticated user owns the resource identified by the route param (default: <code>userId</code>).</dd>
  </dl>
  <h3>Details</h3>
  <p>Place between an <b>Http In</b> node and your handler to enforce middleware checks.</p>
</script>
`;
}
