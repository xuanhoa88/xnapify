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
  var interval = setInterval(function () {
    var userBtn = document.getElementById('red-ui-header-button-user');
    if (userBtn) {
      clearInterval(interval);
      // Hide the original user menu button
      userBtn.style.display = 'none';

      // Create back button using Node-RED's native header button markup
      var backBtn = document.createElement('a');
      backBtn.href = '${url}';
      backBtn.id = 'red-ui-header-button-back';
      backBtn.className = 'red-ui-header-button';
      backBtn.title = '${title}';
      backBtn.style.textDecoration = 'none';

      // Use Node-RED's icon markup pattern (fa-arrow-left)
      var icon = document.createElement('i');
      icon.className = 'fa fa-arrow-left';
      backBtn.appendChild(icon);

      // Add label text
      var labelEl = document.createElement('span');
      labelEl.className = 'red-ui-header-button-label';
      labelEl.textContent = '${label}';
      labelEl.style.marginLeft = '6px';
      backBtn.appendChild(labelEl);

      // Insert the back button where the user button was
      userBtn.parentNode.insertBefore(backBtn, userBtn);
    }
  }, 200);
})();
`;
}
