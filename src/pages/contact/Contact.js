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
import Button from '../../components/Button';
import Form from '../../components/Form';
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
  { day: 'workday', hours: '9:00 AM - 6:00 PM PST' },
  { day: 'saturday', hours: '10:00 AM - 4:00 PM PST' },
  { day: 'sunday', hours: 'closed' },
];

/**
 * Default form values
 */
const DEFAULT_FORM_VALUES = {
  phone: '',
  email: '',
  subject: '',
  message: '',
};

/**
 * Contact Form Fields Component
 */
function ContactFormFields({ loading }) {
  const { t } = useTranslation();

  return (
    <>
      <div className={s.formRow}>
        <Form.Field name='email' label={t('contact.form.email')} required>
          <Form.Input
            type='email'
            placeholder={t('contact.form.emailPlaceholder')}
          />
        </Form.Field>

        <Form.Field name='phone' label={t('contact.form.phone')}>
          <Form.Input
            type='phone'
            placeholder={t('contact.form.phonePlaceholder')}
          />
        </Form.Field>
      </div>

      <Form.Field name='subject' label={t('contact.form.subject')} required>
        <Form.Input
          type='text'
          placeholder={t('contact.form.subjectPlaceholder')}
        />
      </Form.Field>

      <Form.Field name='message' label={t('contact.form.message')} required>
        <Form.Textarea
          rows={5}
          placeholder={t('contact.form.messagePlaceholder')}
        />
      </Form.Field>

      <Button
        variant='primary'
        type='submit'
        fullWidth
        className={s.submitButton}
        loading={loading}
      >
        {loading ? t('contact.form.sending') : t('contact.form.submit')}
      </Button>
    </>
  );
}

ContactFormFields.propTypes = {
  loading: PropTypes.bool,
};

/**
 * Contact Page Component
 */
function Contact({ title }) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = useCallback(async data => {
    setIsSubmitting(true);

    try {
      // TODO: Implement form submission logic
      // eslint-disable-next-line no-console
      console.log('Form submitted:', data);

      // Reset form on success
      // Form will handle reset via defaultValues
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, []);

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

            <Form
              defaultValues={DEFAULT_FORM_VALUES}
              onSubmit={handleSubmit}
              className={s.form}
            >
              <ContactFormFields loading={isSubmitting} />
            </Form>
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
