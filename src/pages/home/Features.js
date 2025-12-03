/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { featuresData } from './data';
import s from './Features.css';

function Features() {
  return (
    <div className={s.container}>
      <h1 className={s.title}>Features</h1>
      <p className={s.subtitle}>
        Discover the powerful features that make this starter kit amazing.
      </p>
      <div className={s.grid}>
        {featuresData.map(feature => (
          <div key={feature.id} className={s.card}>
            <div className={s.icon}>{feature.icon}</div>
            <h3 className={s.cardTitle}>{feature.name}</h3>
            <p className={s.cardDesc}>{feature.description}</p>
            <div className={s.tags}>
              {feature.tags.map(tag => (
                <span key={tag} className={s.tag}>
                  {tag}
                </span>
              ))}
            </div>
            <a href={`/features/${feature.id}`} className={s.link}>
              Learn more →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Features;
