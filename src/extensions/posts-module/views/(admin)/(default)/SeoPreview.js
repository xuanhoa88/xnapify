/**
 * SeoPreview — Google SERP preview using react-serp-preview
 *
 * Shows how a post would appear in Google search results.
 * Opens as a right-side slide-in panel.
 */
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import SerpPreview from 'react-serp-preview';

import Modal from '@shared/renderer/components/Modal';

import s from './SeoPreview.css';

function SeoPreview({ post, isOpen, onClose }) {
  const { t } = useTranslation();

  if (!post) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const postUrl = `${baseUrl}/posts/${post.slug || post.id}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement='right'>
      <Modal.Header onClose={onClose}>
        {t('posts:seoPreview.title', 'SEO Preview')}
      </Modal.Header>
      <Modal.Body>
        <div className={s.previewInfo}>
          <div className={s.postTitle}>{post.title}</div>
          <div className={s.postUrl}>{postUrl}</div>
        </div>
        <div className={s.previewPanel}>
          <SerpPreview
            title={post.title || ''}
            metaDescription={post.excerpt || ''}
            url={postUrl}
          />
        </div>
      </Modal.Body>
    </Modal>
  );
}

SeoPreview.propTypes = {
  post: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    title: PropTypes.string,
    excerpt: PropTypes.string,
    slug: PropTypes.string,
  }),
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default SeoPreview;
