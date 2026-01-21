/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Contact from './Contact';

/**
 * Page metadata
 */
export const metadata = {
  title: 'Contact Us',
};

/**
 * Default export - Page component
 */
export default function ContactPage() {
  return <Contact title={metadata.title} />;
}
