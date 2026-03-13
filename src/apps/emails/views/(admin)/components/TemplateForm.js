/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import s from './TemplateForm.css';

/**
 * TemplateForm — Shared form fields for email template metadata
 *
 * Used by both CreateEmailTemplate and EditEmailTemplate pages.
 */
function TemplateForm({ initialValues = {}, onChange, errors = {} }) {
  const { t } = useTranslation();

  const [name, setName] = useState(initialValues.name || '');
  const [slug, setSlug] = useState(initialValues.slug || '');
  const [description, setDescription] = useState(
    initialValues.description || '',
  );
  const [isActive, setIsActive] = useState(
    initialValues.is_active !== undefined ? initialValues.is_active : true,
  );
  const [autoSlug, setAutoSlug] = useState(!initialValues.slug);

  const generateSlug = useCallback(value => {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  const handleNameChange = useCallback(
    e => {
      const val = e.target.value;
      setName(val);
      if (autoSlug) {
        const generatedSlug = generateSlug(val);
        setSlug(generatedSlug);
        onChange && onChange({ name: val, slug: generatedSlug });
      } else {
        onChange && onChange({ name: val });
      }
    },
    [autoSlug, generateSlug, onChange],
  );

  const handleSlugChange = useCallback(
    e => {
      const val = e.target.value;
      setSlug(val);
      setAutoSlug(false);
      onChange && onChange({ slug: val });
    },
    [onChange],
  );

  const handleDescriptionChange = useCallback(
    e => {
      const val = e.target.value;
      setDescription(val);
      onChange && onChange({ description: val });
    },
    [onChange],
  );

  const handleActiveChange = useCallback(
    e => {
      const val = e.target.checked;
      setIsActive(val);
      onChange && onChange({ is_active: val });
    },
    [onChange],
  );

  return (
    <div className={s.root}>
      <div className={s.row}>
        <div className={s.field}>
          <label className={s.label} htmlFor='template-name'>
            {t('admin:emails.form.name', 'Template Name')} *
          </label>
          <input
            id='template-name'
            type='text'
            className={`${s.input} ${errors.name ? s.inputError : ''}`}
            value={name}
            onChange={handleNameChange}
            placeholder={t(
              'admin:emails.form.namePlaceholder',
              'e.g. Welcome Email',
            )}
            required
          />
          {errors.name && <span className={s.error}>{errors.name}</span>}
        </div>

        <div className={s.field}>
          <label className={s.label} htmlFor='template-slug'>
            {t('admin:emails.form.slug', 'Slug')} *
          </label>
          <input
            id='template-slug'
            type='text'
            className={`${s.input} ${errors.slug ? s.inputError : ''}`}
            value={slug}
            onChange={handleSlugChange}
            placeholder={t(
              'admin:emails.form.slugPlaceholder',
              'e.g. welcome-email',
            )}
            required
          />
          {errors.slug && <span className={s.error}>{errors.slug}</span>}
        </div>
      </div>

      <div className={s.field}>
        <label className={s.label} htmlFor='template-description'>
          {t('admin:emails.form.description', 'Description')}
        </label>
        <textarea
          id='template-description'
          className={s.textarea}
          value={description}
          onChange={handleDescriptionChange}
          placeholder={t(
            'admin:emails.form.descriptionPlaceholder',
            'Brief description of this template...',
          )}
          rows={2}
        />
      </div>

      <div className={s.checkboxField}>
        <label className={s.checkboxLabel}>
          <input
            type='checkbox'
            checked={isActive}
            onChange={handleActiveChange}
          />
          {t('admin:emails.form.isActive', 'Active')}
        </label>
      </div>
    </div>
  );
}

TemplateForm.propTypes = {
  initialValues: PropTypes.shape({
    name: PropTypes.string,
    slug: PropTypes.string,
    description: PropTypes.string,
    is_active: PropTypes.bool,
  }),
  onChange: PropTypes.func,
  errors: PropTypes.shape({}),
};

export default TemplateForm;
