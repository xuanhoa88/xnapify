/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * This is the default settings file provided by Node-RED.
 *
 * It can contain any valid JavaScript code that will get run when Node-RED
 * is started.
 *
 * Lines that start with // are commented out.
 * Each entry should be separated from the entries above and below by a comma ','
 *
 * For more information about individual settings, refer to the documentation:
 *    https://nodered.org/docs/user-guide/runtime/configuration
 *
 * The settings are split into the following sections:
 *  - Flow File and User Directory Settings
 *  - Security
 *  - Server Settings
 *  - Runtime Settings
 *  - Editor Settings
 *  - Node Settings
 *
 **/

export default {
  /*******************************************************************************
   * Flow File and User Directory Settings
   *  - flowFile
   *  - credentialSecret
   *  - flowFilePretty
   *  - userDir
   *  - nodesDir
   ******************************************************************************/

  /** The file containing the flows. If not set, defaults to flows_<hostname>.json **/
  flowFile: 'flows.json',

  /** By default, credentials are encrypted in storage using a generated key. To
   * specify your own secret, set the following property.
   * If you want to disable encryption of credentials, set this property to false.
   * Note: once you set this property, do not change it - doing so will prevent
   * node-red from being able to decrypt your existing credentials and they will be
   * lost.
   */
  // credentialSecret: "a-secret-key",

  /** By default, the flow JSON will be formatted over multiple lines making
   * it easier to compare changes when using version control.
   * To disable pretty-printing of the JSON set the following property to false.
   */
  flowFilePretty: false,

  /** By default, all user data is stored in a directory called `.node-red` under
   * the user's home directory. To use a different location, the following
   * property can be used
   */
  // userDir: '/home/nol/.node-red/',

  /** Node-RED scans the `nodes` directory in the userDir to find local node files.
   * The following property can be used to specify an additional directory to scan.
   */
  // nodesDir: '/home/nol/.node-red/nodes',

  /*******************************************************************************
   * Security
   *  - adminAuth
   *  - https
   *  - httpsRefreshInterval
   *  - requireHttps
   *  - httpNodeAuth
   *  - httpStaticAuth
   ******************************************************************************/

  /** To password protect the Node-RED editor and admin API, the following
   * property can be used. See https://nodered.org/docs/security.html for details.
   */
  // adminAuth: {
  //     type: "credentials",
  //     users: [{
  //         username: "admin",
  //         password: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN.",
  //         permissions: "*"
  //     }]
  // },

  /** The following property can be used to enable HTTPS
   * This property can be either an object, containing both a (private) key
   * and a (public) certificate, or a function that returns such an object.
   * See http://nodejs.org/api/https.html#https_https_createserver_options_requestlistener
   * for details of its contents.
   */

  /** Option 1: static object */
  // https: {
  //   key: require("fs").readFileSync('privkey.pem'),
  //   cert: require("fs").readFileSync('cert.pem')
  // },

  /** Option 2: function that returns the HTTP configuration object */
  // https: () => {
  //     // This function should return the options object, or a Promise
  //     // that resolves to the options object
  //     return {
  //         key: require("fs").readFileSync('privkey.pem'),
  //         cert: require("fs").readFileSync('cert.pem')
  //     };
  // },

  /** If the `https` setting is a function, the following setting can be used
   * to set how often, in hours, the function will be called. That can be used
   * to refresh any certificates.
   */
  // httpsRefreshInterval: 12,

  /** The following property can be used to cause insecure HTTP connections to
   * be redirected to HTTPS.
   */
  // requireHttps: true,

  /** To password protect the node-defined HTTP endpoints (httpNodeRoot),
   * including node-red-dashboard, or the static content (httpStatic), the
   * following properties can be used.
   * The `pass` field is a bcrypt hash of the password.
   * See https://nodered.org/docs/security.html#generating-the-password-hash
   */
  // httpNodeAuth: {user: "user", pass: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN."},
  // httpStaticAuth: {user: "user", pass: "$2a$08$zZWtXTja0fB1pzD4sHCMyOCMYz2Z6dNbM6tl8sJogENOMcxWV9DN."},

  /*******************************************************************************
   * Server Settings
   *  - uiPort
   *  - uiHost
   *  - apiMaxLength
   *  - httpServerOptions
   *  - httpAdminRoot
   *  - httpAdminMiddleware
   *  - httpNodeRoot
   *  - httpNodeCors
   *  - httpNodeMiddleware
   *  - httpStatic
   *  - httpStaticRoot
   ******************************************************************************/

  /** the tcp port that the Node-RED web server is listening on */
  // uiPort: process.env.PORT || 1880,

  /** By default, the Node-RED UI accepts connections on all IPv4 interfaces.
   * To listen on all IPv6 addresses, set uiHost to "::",
   * The following property can be used to listen on a specific interface. For
   * example, the following would only allow connections from the local machine.
   */
  // uiHost: "127.0.0.1",

  /** The maximum size of HTTP request that will be accepted by the runtime api.
   * Default: 5mb
   */
  // apiMaxLength: '5mb',

  /** The following property can be used to pass custom options to the Express.js
   * server used by Node-RED. For a full list of available options, refer
   * to http://expressjs.com/en/api.html#app.settings.table
   */
  // httpServerOptions: { },

  /** By default, the Node-RED UI is available at http://localhost:1880/
   * The following property can be used to specify a different root path.
   * If set to false, this is disabled.
   */
  // httpAdminRoot: '/admin',

  /** The following property can be used to add a custom middleware function
   * in front of all admin http routes. For example, to set custom http
   * headers. It can be a single function or an array of middleware functions.
   */
  // httpAdminMiddleware: (req, res, next) => {
  //    // Set the X-Frame-Options header to limit where the editor
  //    // can be embedded
  //    // res.set('X-Frame-Options', 'sameorigin');
  //    next();
  // },

  // More sections below remain unchanged.
};
