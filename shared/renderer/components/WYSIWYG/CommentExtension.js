/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Mark, mergeAttributes } from '@tiptap/core';

export const CommentExtension = Mark.create({
  name: 'comment',

  addOptions() {
    return {
      HTMLAttributes: {},
      onCommentActivated: () => {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: element => element.getAttribute('data-comment-id'),
        renderHTML: attributes => {
          if (!attributes.commentId) {
            return {};
          }

          return {
            'data-comment-id': attributes.commentId,
          };
        },
      },
      comments: {
        default: null,
        parseHTML: element => element.getAttribute('data-comments'),
        renderHTML: attributes => {
          if (!attributes.comments) {
            return {};
          }
          return {
            'data-comments': attributes.comments,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-comment-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'wysiwyg-comment',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId, comments = '[]') =>
        ({ commands }) => {
          if (!commentId) {
            return false;
          }
          return commands.setMark(this.name, { commentId, comments });
        },
      updateComment:
        (commentId, comments) =>
        ({ tr, dispatch }) => {
          if (!commentId) return false;

          const { doc } = tr;
          let hasModified = false;

          doc.descendants((node, pos) => {
            if (node.isText) {
              const { marks } = node;
              const commentMark = marks.find(
                mark =>
                  mark.type.name === this.name &&
                  mark.attrs.commentId === commentId,
              );

              if (commentMark) {
                if (dispatch) {
                  tr.addMark(
                    pos,
                    pos + node.nodeSize,
                    this.type.create({ ...commentMark.attrs, comments }),
                  );
                }
                hasModified = true;
              }
            }
          });

          return hasModified;
        },
      unsetComment:
        commentId =>
        ({ tr, dispatch }) => {
          if (!commentId) return false;

          const { doc } = tr;
          let hasModified = false;

          doc.descendants((node, pos) => {
            if (node.isText) {
              const { marks } = node;
              const commentMark = marks.find(
                mark =>
                  mark.type.name === this.name &&
                  mark.attrs.commentId === commentId,
              );

              if (commentMark) {
                if (dispatch) {
                  tr.removeMark(pos, pos + node.nodeSize, commentMark);
                }
                hasModified = true;
              }
            }
          });

          return hasModified;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-c': () => this.editor.commands.setComment(),
    };
  },

  onSelectionUpdate() {
    const { $from } = this.editor.state.selection;
    const marks = $from.marks();

    if (!marks.length) {
      if (this.options.onCommentActivated) {
        this.options.onCommentActivated(null);
      }
      return;
    }

    const commentMark = this.editor.schema.marks.comment;
    const activeCommentMark = marks.find(mark => mark.type === commentMark);

    if (activeCommentMark && this.options.onCommentActivated) {
      this.options.onCommentActivated(
        activeCommentMark.attrs.commentId,
        activeCommentMark.attrs.comments,
      );
    } else if (this.options.onCommentActivated) {
      this.options.onCommentActivated(null, null);
    }
  },
});
