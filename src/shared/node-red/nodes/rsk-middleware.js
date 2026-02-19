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

    // ---------------------------------------------------------------
    // Retrieve the Express app proxy via functionGlobalContext.
    // server.js configures:  functionGlobalContext: { app() { return guardControl.proxy; } }
    // ---------------------------------------------------------------
    var getApp = RED.settings.functionGlobalContext.app;
    if (typeof getApp !== 'function') {
      node.error('RSK app instance not found in functionGlobalContext');
      node.status({ fill: 'red', shape: 'dot', text: 'app missing' });
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
        var app = getApp();
        var middleware;

        switch (node.middlewareType) {
          case 'auth': {
            var auth = app.get('auth');
            if (!auth) {
              node.error('app.get("auth") is not available');
              done(new Error('auth provider missing'));
              return;
            }
            middleware = node.authType === 'optional'
              ? auth.middlewares.optionalAuth()
              : auth.middlewares.requireAuth();
            break;
          }

          case 'role': {
            var authMw = app.get('auth');
            if (!authMw || !authMw.middlewares || typeof authMw.middlewares.requireRole !== 'function') {
              node.error('app.get("auth").middlewares.requireRole is not available');
              done(new Error('auth middlewares provider missing'));
              return;
            }
            if (!node.role) {
              node.warn('Role not configured — skipping');
              send(msg);
              done();
              return;
            }
            middleware = authMw.middlewares.requireRole(node.role);
            break;
          }

          case 'permission': {
            var authMw2 = app.get('auth');
            if (!authMw2 || !authMw2.middlewares || typeof authMw2.middlewares.requirePermission !== 'function') {
              node.error('app.get("auth").middlewares.requirePermission is not available');
              done(new Error('auth middlewares provider missing'));
              return;
            }
            if (!node.permission) {
              node.warn('Permission not configured — skipping');
              send(msg);
              done();
              return;
            }
            middleware = authMw2.middlewares.requirePermission(node.permission);
            break;
          }

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
      permission:     { value: '' }
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
</script>

<script type="text/html" data-help-name="rsk-middleware">
  <p>Applies RSK Express middlewares (auth, role, permission) to the incoming HTTP request.</p>
  <h3>Configuration</h3>
  <dl class="message-properties">
    <dt>Type</dt>
    <dd>Authentication, Role Check, or Permission Check.</dd>
    <dt>Authentication</dt>
    <dd><b>Required</b>: blocks unauthenticated requests (401). <b>Optional</b>: attaches user if token present.</dd>
    <dt>Role</dt>
    <dd>Requires user to have the specified role.</dd>
    <dt>Permission</dt>
    <dd>Requires user to have the specified permission (e.g. <code>users:read</code>).</dd>
  </dl>
  <h3>Details</h3>
  <p>Place between an <b>Http In</b> node and your handler to enforce middleware checks.</p>
</script>
`;
}
