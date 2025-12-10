/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { Link } from '../../contexts/history';
import s from './NotFound.css';

function NotFound({ title = 'Page Not Found' }) {
  return (
    <div className={s.root}>
      <div className={s.container}>
        <h1 className={s.title}>{title}</h1>
        <p className={s.message}>
          Sorry, the page you were trying to view does not exist.
        </p>
        <Link className={s.link} to='/'>
          Go Home
        </Link>
      </div>
    </div>
  );
}

NotFound.propTypes = {
  title: PropTypes.string,
};

export default NotFound;
