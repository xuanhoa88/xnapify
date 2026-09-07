/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * The deployment's namespace, shared by every broker adapter.
 *
 * Two deployments can end up sharing one backend, and neither backend
 * separates them on its own: Redis applies no key prefix to
 * PUBLISH/SUBSCRIBE and does not scope pub/sub per database, and the `file`
 * adapter's default data directory is host-level, so two apps on one machine
 * resolve the same path. In both cases the channel name is the only thing
 * keeping staging from closing production's sockets — which is silent when
 * it goes wrong, because cross-talk looks exactly like ordinary traffic.
 *
 * `XNAPIFY_REDIS_PREFIX` names the value for historical reasons; it is the
 * deployment namespace regardless of which adapter is carrying the messages.
 */

const DEFAULT_PREFIX = 'xnapify:';

/**
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {string} Namespace, always terminated with `:`
 */
export function getDeploymentPrefix(env = process.env) {
  const raw =
    typeof env.XNAPIFY_REDIS_PREFIX === 'string'
      ? env.XNAPIFY_REDIS_PREFIX.trim()
      : '';
  if (!raw) return DEFAULT_PREFIX;
  return raw.endsWith(':') ? raw : `${raw}:`;
}

export default getDeploymentPrefix;
