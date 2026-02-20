/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Custom Node-RED Editor Script
 * Replaces the user icon with a "Back to Admin" button.
 *
 * This runs as a page script injected via editorTheme.page.scripts.
 * The logout redirect is configured in settings.js to point to /admin.
 *
 * Follows the auto-discovery contract: export getScript() => string
 *
 * @returns {string} Client-side JavaScript source
 */
export function getScript() {
  const url = '/admin';
  const label = 'Admin';
  const title = 'Back to Admin';

  return `
(function () {
  var userBtnFound = false;
  var loginBtnFound = false;

  var interval = setInterval(function () {
    // 1. Replace the user menu button in the header (if authenticated)
    if (!userBtnFound) {
      var userBtn = document.getElementById('red-ui-header-button-user');
      if (userBtn && userBtn.parentNode) {
        userBtnFound = true;
        userBtn.style.display = 'none';

        var backBtn = document.createElement('a');
        backBtn.href = '${url}';
        backBtn.id = 'red-ui-header-button-back';
        backBtn.className = 'red-ui-header-button';
        backBtn.title = '${title}';
        backBtn.style.textDecoration = 'none';

        var icon = document.createElement('i');
        icon.className = 'fa fa-arrow-left';
        backBtn.appendChild(icon);

        var labelEl = document.createElement('span');
        labelEl.className = 'red-ui-header-button-label';
        labelEl.textContent = '${label}';
        labelEl.style.marginLeft = '6px';
        backBtn.appendChild(labelEl);

        userBtn.parentNode.insertBefore(backBtn, userBtn);
      }
    }

    // 2. Add Back to Admin button in the login dialog title bar (if unauthenticated)
    if (!loginBtnFound) {
      var loginDialog = document.getElementById('node-dialog-login');
      if (loginDialog) {
        // Traverse up to the jQuery UI dialog wrapper to find the title bar
        var dialogWrapper = loginDialog.closest('.ui-dialog');
        var titleBar = dialogWrapper && dialogWrapper.querySelector('.ui-dialog-titlebar');
        if (titleBar) {
          loginBtnFound = true;

          var loginBackBtn = document.createElement('a');
          loginBackBtn.href = '${url}';
          loginBackBtn.title = '${title}';
          loginBackBtn.style.cssText = 'float:right; text-decoration:none; color:inherit; font-size:14px; line-height:1; padding:2px 6px; cursor:pointer;';

          // Use Node-RED's icon style pattern (fa-arrow-left)
          var backIcon = document.createElement('i');
          backIcon.className = 'fa fa-arrow-left';
          backIcon.style.marginRight = '5px';
          loginBackBtn.appendChild(backIcon);

          loginBackBtn.appendChild(document.createTextNode('${title}'));

          titleBar.appendChild(loginBackBtn);
        }
      }
    }

    // If both are found or enough time has passed (give it 10 seconds), stop the interval
    if (userBtnFound || loginBtnFound) {
      // Typically Node-RED either shows the editor OR the login screen
      clearInterval(interval);
    }
  }, 200);

  // Fallback clear just in case
  setTimeout(function() {
    clearInterval(interval);
  }, 15000);
})();
`;
}
