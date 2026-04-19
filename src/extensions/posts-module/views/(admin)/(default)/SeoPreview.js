/**
 * SeoPreview — Google SERP preview using react-serp-preview
 *
 * Shows how a post would appear in Google search results.
 * Opens as a right-side slide-in panel.
 */
import { Box, Text } from '@radix-ui/themes';
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
        <Box className={s.previewInfo}>
          <Text as='div' className={s.postTitle}>
            {post.title}
          </Text>
          <Text as='div' className={s.postUrl}>
            {postUrl}
          </Text>
        </Box>
        <Box className={s.previewPanel}>
          <SerpPreview
            title={post.title || ''}
            metaDescription={post.excerpt || ''}
            url={postUrl}
          />
        </Box>
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
