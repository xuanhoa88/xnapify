/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import Icon from '../../components/Icon';
import s from './Contact.css';

/**
 * Contact information configuration
 */
const CONTACT_INFO = [
  {
    type: 'email',
    value: 'hello@xtepify.com',
    href: 'mailto:hello@xtepify.com',
    icon: 'mail',
  },
  {
    type: 'phone',
    value: '+84 966 666 666',
    href: 'tel:+84966666666',
    icon: 'phone',
  },
  {
    type: 'address',
    value: 'Xuan Hoa, Vinh Phuc, Viet Nam',
    href: null,
    icon: 'map-pin',
  },
];

/**
 * Social links configuration with icons
 */
const SOCIAL_LINKS = [
  {
    name: 'GitHub',
    href: 'https://github.com/xuanhoa88/rapid-rsk',
    icon: 'github',
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com',
    icon: 'twitter',
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: 'linkedin',
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com',
    icon: 'facebook',
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
                      <Icon name={item.icon} size={20} />
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
                    <Icon name={link.icon} size={20} />
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
