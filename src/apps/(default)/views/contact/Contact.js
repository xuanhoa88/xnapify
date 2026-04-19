/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import * as RadixIcons from '@radix-ui/react-icons';
import { Flex, Box, Text, Heading, Grid, Button } from '@radix-ui/themes';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Form from '@shared/renderer/components/Form';

import s from './Contact.css';

const CONTACT_INFO = [
  {
    type: 'email',
    value: 'hello@xnapify.com',
    href: 'mailto:hello@xnapify.com',
    icon: RadixIcons.EnvelopeClosedIcon,
  },
  {
    type: 'phone',
    value: '+84 966 666 666',
    href: 'tel:+84966666666',
    icon: RadixIcons.ChatBubbleIcon,
  },
  {
    type: 'address',
    value: 'Xuan Hoa, Vinh Phuc, Viet Nam',
    href: null,
    icon: RadixIcons.GlobeIcon,
  },
];

/**
 * Social links configuration with icons
 */
const SOCIAL_LINKS = [
  {
    name: 'GitHub',
    href: 'https://github.com/xuanhoa88/xnapify',
    icon: RadixIcons.GitHubLogoIcon,
  },
  {
    name: 'Twitter',
    href: 'https://twitter.com',
    icon: RadixIcons.TwitterLogoIcon,
  },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com',
    icon: RadixIcons.LinkedInLogoIcon,
  },
  {
    name: 'Facebook',
    href: 'https://facebook.com',
    icon: RadixIcons.Link1Icon, // Radix UI has no Facebook icon
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
    <Flex direction='column' gap='4'>
      <Grid columns={{ initial: '1', md: '2' }} gap='4'>
        <Form.Field
          name='email'
          label={t('contact.form.email', 'Email')}
          required
        >
          <Form.Input
            type='email'
            placeholder={t('contact.form.emailPlaceholder', 'Email')}
          />
        </Form.Field>

        <Form.Field name='phone' label={t('contact.form.phone', 'Phone')}>
          <Form.Input
            type='phone'
            placeholder={t('contact.form.phonePlaceholder', 'Phone')}
          />
        </Form.Field>
      </Grid>

      <Form.Field
        name='subject'
        label={t('contact.form.subject', 'Subject')}
        required
      >
        <Form.Input
          type='text'
          placeholder={t('contact.form.subjectPlaceholder', 'Subject')}
        />
      </Form.Field>

      <Form.Field
        name='message'
        label={t('contact.form.message', 'Message')}
        required
      >
        <Form.Textarea
          rows={5}
          placeholder={t('contact.form.messagePlaceholder', 'Message')}
        />
      </Form.Field>

      <Button
        variant='solid'
        color='indigo'
        type='submit'
        mt='4'
        className={s.fullWidthBtn}
        loading={loading}
      >
        {loading
          ? t('contact.form.sending', 'Sending...')
          : t('contact.form.submit', 'Submit')}
      </Button>
    </Flex>
  );
}

ContactFormFields.propTypes = {
  loading: PropTypes.bool,
};

/**
 * Contact Page Component mapped natively to Radix Flex layout
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
    <Box className={s.pageContainer}>
      {/* Hero Section */}
      <Flex align='center' justify='center' className={s.hero}>
        <Flex
          direction='column'
          align='center'
          gap='3'
          className={s.heroContent}
        >
          <Heading as='h1' size='8' className={s.heroTitle}>
            {title}
          </Heading>
          <Text size='4' color='gray'>
            {t('contact.lead')}
          </Text>
        </Flex>
      </Flex>

      {/* Main Content */}
      <Box className={s.mainContent}>
        <Grid columns={{ initial: '1', lg: '3' }} gap='6' className={s.grid}>
          {/* Form Section (Left) */}
          <Box className={s.formSection}>
            <Box mb='6'>
              <Heading as='h2' size='6' mb='2'>
                {t('contact.sendMessage')}
              </Heading>
              <Text size='3' color='gray'>
                {t(
                  'contact.formDescription',
                  "Fill out the form below and we'll get back to you as soon as possible.",
                )}
              </Text>
            </Box>

            <Box className={s.formBox}>
              <Form defaultValues={DEFAULT_FORM_VALUES} onSubmit={handleSubmit}>
                <ContactFormFields loading={isSubmitting} />
              </Form>
            </Box>
          </Box>

          {/* Sidebar (Right) */}
          <Flex as='aside' direction='column' gap='5'>
            {/* Contact Info Card */}
            <Flex direction='column' gap='4' className={s.infoCard}>
              <Heading as='h3' size='4'>
                {t('contact.getInTouch')}
              </Heading>
              <Flex direction='column' gap='4'>
                {CONTACT_INFO.map(item => (
                  <Flex key={item.type} align='start' gap='3'>
                    <Flex
                      align='center'
                      justify='center'
                      className={s.iconWrapper}
                    >
                      {(() => {
                        const Comp = item.icon;
                        return <Comp width={18} height={18} />;
                      })()}
                    </Flex>
                    <Flex direction='column'>
                      <Text
                        size='1'
                        weight='medium'
                        color='gray'
                        className={s.itemLabel}
                      >
                        {t(`contact.${item.type}`)}
                      </Text>
                      <Text size='3' weight='medium' mt='1'>
                        {item.href ? (
                          <a href={item.href} className={s.itemLink}>
                            {item.value}
                          </a>
                        ) : (
                          item.value
                        )}
                      </Text>
                    </Flex>
                  </Flex>
                ))}
              </Flex>
            </Flex>

            {/* Social Links Card */}
            <Flex direction='column' gap='4' className={s.infoCard}>
              <Heading as='h3' size='4'>
                {t('contact.connectWithUs')}
              </Heading>
              <Flex gap='3'>
                {SOCIAL_LINKS.map(link => (
                  <Flex
                    asChild
                    key={link.name}
                    align='center'
                    justify='center'
                    className={s.socialIconWrapper}
                  >
                    <a
                      href={link.href}
                      target='_blank'
                      rel='noopener noreferrer'
                      title={link.name}
                    >
                      {(() => {
                        const Comp = link.icon;
                        return <Comp width={20} height={20} />;
                      })()}
                    </a>
                  </Flex>
                ))}
              </Flex>
            </Flex>

            {/* Office Hours Card */}
            <Flex direction='column' gap='4' className={s.infoCard}>
              <Heading as='h3' size='4'>
                {t('contact.officeHours')}
              </Heading>
              <Flex direction='column' gap='3'>
                {OFFICE_HOURS.map(item => (
                  <Flex
                    key={item.day}
                    justify='between'
                    align='center'
                    className={s.officeHourItem}
                  >
                    <Text size='2' color='gray' className={s.officeHourDay}>
                      {t(`contact.hours.${item.day}`)}
                    </Text>
                    <Text size='2' weight='medium'>
                      {item.hours === 'closed'
                        ? t('contact.hours.closed')
                        : item.hours}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          </Flex>
        </Grid>
      </Box>
    </Box>
  );
}

Contact.propTypes = {
  title: PropTypes.string.isRequired,
};

export default Contact;
