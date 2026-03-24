/**
 * PostForm — Slide-in modal for creating / editing a post
 *
 * Renders inside a right-side Modal with Form + Zod validation.
 * When `post` is null the form is in "create" mode; otherwise "edit".
 */
import { useMemo, useCallback, useEffect, useRef } from 'react';

import kebabCase from 'lodash/kebabCase';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Form, { useFormContext } from '@shared/renderer/components/Form';
import Modal from '@shared/renderer/components/Modal';

import {
  createPostFormSchema,
  updatePostFormSchema,
} from '../../../validator/post';
import {
  createPost,
  updatePost,
  isPostCreateLoading,
  isPostUpdateLoading,
  getPostCreateError,
  getPostUpdateError,
  clearPostCreateError,
  clearPostUpdateError,
} from '../redux';

import s from './PostForm.css';

/**
 * Inner form fields — rendered inside the <Form> provider
 * so they have access to useFormContext().
 */
function PostFormFields({ isEdit, saving }) {
  const { t } = useTranslation();
  const { watch, setValue } = useFormContext();
  const titleValue = watch('title');
  const slugTouched = useRef(false);

  // Auto-generate slug from title when creating (unless user manually edited slug)
  useEffect(() => {
    if (!isEdit && !slugTouched.current && titleValue) {
      setValue('slug', kebabCase(titleValue), { shouldValidate: false });
    }
  }, [titleValue, isEdit, setValue]);

  const handleSlugChange = useCallback(() => {
    slugTouched.current = true;
  }, []);

  return (
    <div className={s.form}>
      <Form.Field name='title' label={t('posts:form.title', 'Title')} required>
        <Form.Input
          placeholder={t('posts:form.titlePlaceholder', 'Enter post title')}
        />
      </Form.Field>

      <Form.Field name='slug' label={t('posts:form.slug', 'Slug')}>
        <Form.Input
          placeholder={t('posts:form.slugPlaceholder', 'url-friendly-slug')}
          onChange={handleSlugChange}
        />
        <div className={s.slugHint}>
          {t(
            'posts:form.slugHint',
            'Auto-generated from title. Edit to customize.',
          )}
        </div>
      </Form.Field>

      <Form.Field name='status' label={t('posts:form.status', 'Status')}>
        <Form.Select
          options={[
            { value: 'draft', label: t('posts:filter.draft', 'Draft') },
            {
              value: 'published',
              label: t('posts:filter.published', 'Published'),
            },
            {
              value: 'archived',
              label: t('posts:filter.archived', 'Archived'),
            },
          ]}
        />
      </Form.Field>

      <Form.Field name='excerpt' label={t('posts:form.excerpt', 'Excerpt')}>
        <Form.Textarea
          rows={3}
          placeholder={t(
            'posts:form.excerptPlaceholder',
            'Brief summary for SEO...',
          )}
        />
      </Form.Field>

      <Form.Field name='content' label={t('posts:form.content', 'Content')}>
        <Form.WYSIWYG
          className={s.contentField}
          placeholder={t(
            'posts:form.contentPlaceholder',
            'Write your post content...',
          )}
        />
      </Form.Field>

      <Modal.Footer>
        <Modal.Actions>
          <Modal.Button type='reset'>
            {t('common:cancel', 'Cancel')}
          </Modal.Button>
          <Modal.Button type='submit' variant='primary' disabled={saving}>
            {saving
              ? t('posts:form.saving', 'Saving...')
              : t('posts:form.save', 'Save')}
          </Modal.Button>
        </Modal.Actions>
      </Modal.Footer>
    </div>
  );
}

PostFormFields.propTypes = {
  isEdit: PropTypes.bool.isRequired,
  saving: PropTypes.bool.isRequired,
};

/**
 * PostForm — the full slide-in panel
 */
function PostForm({ post, isOpen, onClose, onSaved }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const isEdit = !!(post && post.id);
  const creating = useSelector(isPostCreateLoading);
  const updating = useSelector(isPostUpdateLoading);
  const createError = useSelector(getPostCreateError);
  const updateError = useSelector(getPostUpdateError);
  const saving = creating || updating;

  const schema = isEdit ? updatePostFormSchema : createPostFormSchema;
  const error = isEdit ? updateError : createError;

  const defaultValues = useMemo(
    () => ({
      title: (post && post.title) || '',
      slug: (post && post.slug) || '',
      content: (post && post.content) || '',
      excerpt: (post && post.excerpt) || '',
      status: (post && post.status) || 'draft',
    }),
    [post],
  );

  // Clear errors when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      dispatch(clearPostCreateError());
      dispatch(clearPostUpdateError());
    }
  }, [isOpen, dispatch]);

  const handleSubmit = useCallback(
    async data => {
      try {
        if (isEdit) {
          await dispatch(
            updatePost({ postId: post.id, postData: data }),
          ).unwrap();
        } else {
          await dispatch(createPost(data)).unwrap();
        }
        if (onSaved) onSaved();
        onClose();
      } catch {
        // Error is stored in Redux and displayed via Modal.Body error prop
      }
    },
    [dispatch, isEdit, post, onSaved, onClose],
  );

  const handleReset = useCallback(
    e => {
      e.preventDefault();
      onClose();
    },
    [onClose],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement='right'>
      <Modal.Header onClose={onClose}>
        {isEdit
          ? t('posts:form.editTitle', 'Edit Post')
          : t('posts:form.createTitle', 'Create Post')}
      </Modal.Header>
      <Modal.Body error={error}>
        <Form
          schema={schema}
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          onReset={handleReset}
        >
          <PostFormFields isEdit={isEdit} saving={saving} />
        </Form>
      </Modal.Body>
    </Modal>
  );
}

PostForm.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    slug: PropTypes.string,
    content: PropTypes.string,
    excerpt: PropTypes.string,
    status: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};

export default PostForm;
