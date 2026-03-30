/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

import formatDistanceToNow from 'date-fns/formatDistanceToNow';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import Icons from './ToolbarIcon';

import s from './CommentActionsPopup.css';

const CommentActionsPopup = ({
  comments = [],
  onAddComment,
  onRemoveComment,
  onClose,
}) => {
  const { t } = useTranslation();
  const [newCommentText, setNewCommentText] = useState('');
  const textareaRef = useRef(null);

  // Focus the textarea automatically when the popup opens
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = useCallback(
    e => {
      e.preventDefault();
      const text = newCommentText.trim();
      if (text) {
        onAddComment(text);
        setNewCommentText('');
      }
    },
    [newCommentText, onAddComment],
  );

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose],
  );

  return (
    <div className={s.commentPopup}>
      {comments.length > 0 && (
        <ul className={s.commentList}>
          {comments.map(comment => (
            <li key={comment.id} className={s.commentItem}>
              <div className={s.commentHeader}>
                <span className={s.commentDate}>
                  {formatDistanceToNow(new Date(comment.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                <button
                  type='button'
                  className={s.removeButton}
                  onClick={() => onRemoveComment(comment.id)}
                  title={t(
                    'shared:form.wysiwyg.delete_comment',
                    'Delete Comment',
                  )}
                  aria-label='Delete Comment'
                >
                  {Icons.trash}
                </button>
              </div>
              <p className={s.commentText}>{comment.text}</p>
            </li>
          ))}
        </ul>
      )}

      <form className={s.commentForm} onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className={s.commentTextarea}
          value={newCommentText}
          onChange={e => setNewCommentText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t(
            'shared:form.wysiwyg.type_a_comment',
            'Type a comment... (Enter to submit)',
          )}
          rows={2}
        />
        <div className={s.commentActions}>
          <button type='button' className={s.cancelButton} onClick={onClose}>
            {t('shared:form.wysiwyg.cancel', 'Cancel')}
          </button>
          <button
            type='submit'
            className={s.submitButton}
            disabled={!newCommentText.trim()}
          >
            {t('shared:form.wysiwyg.comment', 'Comment')}
          </button>
        </div>
      </form>
    </div>
  );
};

CommentActionsPopup.propTypes = {
  comments: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      text: PropTypes.string.isRequired,
      createdAt: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.number,
        PropTypes.instanceOf(Date),
      ]).isRequired,
    }),
  ),
  onAddComment: PropTypes.func.isRequired,
  onRemoveComment: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default CommentActionsPopup;
