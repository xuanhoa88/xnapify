/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import { requirePermission } from '@shared/renderer/components/Rbac';
import { features } from '@shared/renderer/redux';

import EditEmailTemplate from './EditEmailTemplate';

const { addBreadcrumb } = features;

export const middleware = requirePermission('emails:templates:update');

/**
 * Page metadata
 */
export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin:emails.edit.title', 'Edit Email Template'),
  };
}

/**
 * Mount function - dispatch breadcrumb to Redux
 */
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      {
        label: i18n.t('admin:emails.form.editTemplate', 'Edit'),
        url: path,
      },
      'admin',
    ),
  );
}

/**
 * Default export - Page component
 */
export default function EditEmailTemplatePage({ context }) {
  const { id } = context.params;
  return <EditEmailTemplate params={{ id }} />;
}

EditEmailTemplatePage.propTypes = {
  context: PropTypes.shape({
    params: PropTypes.shape({
      id: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
};
