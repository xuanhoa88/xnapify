/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import s from './Contact.css';

/**
 * Contact information configuration
 */
const CONTACT_INFO = [
  {
    type: 'email',
    value: 'hello@xtepify.com',
    href: 'mailto:hello@xtepify.com',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    type: 'phone',
    value: '+84 966 666 666',
    href: 'tel:+84966666666',
    icon: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  },
  {
    type: 'address',
    value: 'Xuan Hoa, Vinh Phuc, Viet Nam',
    href: null,
    icon: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  },
];

/**
 * Social links configuration with icons
 */
const SOCIAL_LINKS = [
  {
    name: 'GitHub',
    href: 'https://github.com/xuanhoa88/rapid-rsk',
    icon: 'M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com',
    icon: 'M23 3a10.9 10.9 0 01-3.14 1.53 4.48 4.48 0 00-7.86 3v1A10.66 10.66 0 013 4s-4 9 5 13a11.64 11.64 0 01-7 2c9 5 20 0 20-11.5a4.5 4.5 0 00-.08-.83A7.72 7.72 0 0023 3z',
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: 'M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z',
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com',
    icon: 'M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z',
  },
];

/**
 * Office hours configuration
 */
const OFFICE_HOURS = [
  { day: 'monday_friday', hours: '9:00 AM - 6:00 PM PST' },
  { day: 'saturday', hours: '10:00 AM - 4:00 PM PST' },
  { day: 'sunday', hours: 'closed' },
];

/**
 * Initial form state
 */
const INITIAL_FORM_STATE = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

/**
 * Contact Page Component
 */
function Contact({ title }) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = useCallback(e => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSubmit = useCallback(
    async e => {
      e.preventDefault();
      setIsSubmitting(true);

      try {
        // TODO: Implement form submission logic
        // eslint-disable-next-line no-console
        console.log('Form submitted:', formData);

        // Reset form on success
        setFormData(INITIAL_FORM_STATE);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Form submission error:', error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [formData],
  );

  return (
    <div className={s.root}>
      {/* Hero Section */}
      <div className={s.hero}>
        <div className={s.heroContent}>
          <h1 className={s.heroTitle}>{title}</h1>
          <p className={s.heroSubtitle}>{t('contact.lead')}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className={s.container}>
        <div className={s.content}>
          {/* Form Section (Left) */}
          <div className={s.formSection}>
            <h2 className={s.formTitle}>{t('contact.sendMessage')}</h2>
            <p className={s.formSubtitle}>
              {t(
                'contact.formDescription',
                "Fill out the form below and we'll get back to you as soon as possible.",
              )}
            </p>

            <form className={s.form} onSubmit={handleSubmit}>
              <div className={s.formRow}>
                <div className={s.formGroup}>
                  <label htmlFor='name'>{t('contact.form.name')}</label>
                  <input
                    type='text'
                    id='name'
                    name='name'
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder={t('contact.form.namePlaceholder')}
                    required
                  />
                </div>
                <div className={s.formGroup}>
                  <label htmlFor='email'>{t('contact.form.email')}</label>
                  <input
                    type='email'
                    id='email'
                    name='email'
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder={t('contact.form.emailPlaceholder')}
                    required
                  />
                </div>
              </div>

              <div className={s.formGroup}>
                <label htmlFor='subject'>{t('contact.form.subject')}</label>
                <input
                  type='text'
                  id='subject'
                  name='subject'
                  value={formData.subject}
                  onChange={handleInputChange}
                  placeholder={t('contact.form.subjectPlaceholder')}
                  required
                />
              </div>

              <div className={s.formGroup}>
                <label htmlFor='message'>{t('contact.form.message')}</label>
                <textarea
                  id='message'
                  name='message'
                  rows='5'
                  value={formData.message}
                  onChange={handleInputChange}
                  placeholder={t('contact.form.messagePlaceholder')}
                  required
                />
              </div>

              <button
                type='submit'
                className={s.submitButton}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t('contact.form.sending')
                  : t('contact.form.submit')}
              </button>
            </form>
          </div>

          {/* Sidebar (Right) */}
          <aside className={s.sidebar}>
            {/* Contact Info Card */}
            <div className={s.sidebarCard}>
              <h3 className={s.sidebarTitle}>{t('contact.getInTouch')}</h3>
              <div className={s.contactInfo}>
                {CONTACT_INFO.map(item => (
                  <div key={item.type} className={s.contactItem}>
                    <div className={s.contactIcon}>
                      <svg
                        viewBox='0 0 24 24'
                        fill='none'
                        stroke='currentColor'
                        strokeWidth='2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      >
                        <path d={item.icon} />
                      </svg>
                    </div>
                    <div className={s.contactDetails}>
                      <span className={s.contactLabel}>
                        {t(`contact.${item.type}`)}
                      </span>
                      <span className={s.contactValue}>
                        {item.href ? (
                          <a href={item.href}>{item.value}</a>
                        ) : (
                          item.value
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Links Card */}
            <div className={s.sidebarCard}>
              <h3 className={s.sidebarTitle}>{t('contact.connectWithUs')}</h3>
              <div className={s.socialLinks}>
                {SOCIAL_LINKS.map(link => (
                  <a
                    key={link.name}
                    href={link.href}
                    className={s.socialLink}
                    target='_blank'
                    rel='noopener noreferrer'
                    title={link.name}
                  >
                    <svg viewBox='0 0 24 24' fill='currentColor'>
                      <path d={link.icon} />
                    </svg>
                  </a>
                ))}
              </div>
            </div>

            {/* Office Hours Card */}
            <div className={s.sidebarCard}>
              <h3 className={s.sidebarTitle}>{t('contact.officeHours')}</h3>
              <div className={s.hours}>
                {OFFICE_HOURS.map(item => (
                  <div key={item.day} className={s.hourItem}>
                    <span>{t(`contact.hours.${item.day}`)}</span>
                    <span>
                      {item.hours === 'closed'
                        ? t('contact.hours.closed')
                        : item.hours}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

Contact.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Contact;
