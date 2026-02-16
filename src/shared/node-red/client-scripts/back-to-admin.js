/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Custom Node-RED Editor Script
 * Renames the "Logout" menu item to "Back to Admin"
 *
 * This runs as a page script injected via editorTheme.page.scripts.
 * The logout redirect is configured in settings.js to point to /admin.
 */
export default `
(function () {
  var interval = setInterval(function () {
    var el = document.getElementById('usermenu-item-logout');
    if (el) {
      clearInterval(interval);
      var label = el.querySelector('.red-ui-menu-label');
      if (label) {
        label.textContent = 'Back to Admin';
      }
    }
  }, 200);
})();
`;
