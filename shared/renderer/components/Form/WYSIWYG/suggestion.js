/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Creates a Tiptap Mention suggestion configuration.
 *
 * This factory is called with the consumer-provided `onMentionQuery` callback
 * and returns the object passed to `Mention.configure({ suggestion })`.
 *
 * @param {(query: string) => Promise<string[]>} onMentionQuery
 *   Async callback that receives the current query string and must return
 *   a promise resolving to an array of mention label strings.
 *   Example: `(query) => Promise.resolve(['Alice', 'Bob'])`
 * @returns {Object} Tiptap suggestion configuration
 */

import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import MentionList from './MentionList';

export default function createSuggestion(onMentionQuery) {
  return {
    /**
     * Return matching items for the current query string.
     * Delegates entirely to the consumer-provided callback.
     * @param {{ query: string }} params
     * @returns {Promise<string[]>}
     */
    items: async ({ query }) => {
      if (typeof onMentionQuery === 'function') {
        const results = await onMentionQuery(query);
        return Array.isArray(results) ? results.slice(0, 10) : [];
      }
      return [];
    },

    /**
     * Tippy.js render lifecycle for the mention popup.
     * @returns {Object} Tiptap suggestion render handlers
     */
    render: () => {
      let component;
      let popup;

      return {
        onStart(props) {
          component = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            animation: false,
            theme: 'mention',
            maxWidth: 'none',
            zIndex: 9999,
            onCreate(instance) {
              const box = instance.popper.querySelector('.tippy-box');
              if (box) {
                Object.assign(box.style, {
                  background: '#fff',
                  borderRadius: '8px',
                  boxShadow:
                    '0 1px 3px 0 rgb(0 0 0 / 10%), 0 4px 12px rgb(0 0 0 / 15%)',
                  border: '1px solid #e4e4e7',
                  overflow: 'hidden',
                  padding: '0',
                });
              }
              const arrow = instance.popper.querySelector('.tippy-arrow');
              if (arrow) {
                arrow.style.display = 'none';
              }
            },
          });
        },

        onUpdate(props) {
          if (component) {
            component.updateProps(props);
          }

          if (!props.clientRect || !popup || !popup[0]) {
            return;
          }

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            if (popup && popup[0]) {
              popup[0].hide();
            }
            return true;
          }

          return (
            component &&
            component.ref &&
            typeof component.ref.onKeyDown === 'function' &&
            component.ref.onKeyDown(props)
          );
        },

        onExit() {
          if (popup && popup[0]) {
            popup[0].destroy();
          }
          if (component) {
            component.destroy();
          }
        },
      };
    },
  };
}
