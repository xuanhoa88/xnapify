/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
} from 'react';

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Icon from '@shared/renderer/components/Icon';

import {
  previewRawTemplate,
  getPreviewHtml,
  getPreviewError,
  isPreviewLoading,
  clearPreview,
} from '../redux';

import s from './TemplateEditor.css';

/**
 * TemplateEditor — Split-pane code editor with live preview
 *
 * Left pane: HTML body textarea + sample data JSON textarea
 * Right pane: Rendered HTML preview in sandboxed iframe
 */
const TemplateEditor = forwardRef(function TemplateEditor(
  { htmlBody = '', textBody = '', subject = '', sampleData = {}, onChange },
  ref,
) {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [localHtml, setLocalHtml] = useState(htmlBody);
  const [localText, setLocalText] = useState(textBody);
  const [localSubject, setLocalSubject] = useState(subject);
  const [localSampleData, setLocalSampleData] = useState(
    JSON.stringify(sampleData, null, 2) || '{}',
  );
  const [sampleDataError, setSampleDataError] = useState(null);
  const [activeTab, setActiveTab] = useState('html');

  const previewHtml = useSelector(getPreviewHtml);
  const previewError = useSelector(getPreviewError);
  const previewLoading = useSelector(isPreviewLoading);
  const iframeRef = useRef(null);
  const previewTimerRef = useRef(null);

  // Sync external changes
  useEffect(() => {
    setLocalHtml(htmlBody);
  }, [htmlBody]);
  useEffect(() => {
    setLocalText(textBody);
  }, [textBody]);
  useEffect(() => {
    setLocalSubject(subject);
  }, [subject]);
  useEffect(() => {
    if (sampleData && Object.keys(sampleData).length > 0) {
      setLocalSampleData(JSON.stringify(sampleData, null, 2));
    }
  }, [sampleData]);

  // Expose getValues to parent
  useImperativeHandle(ref, () => ({
    getValues: () => {
      let parsedData = {};
      try {
        parsedData = JSON.parse(localSampleData);
      } catch {
        // ignore
      }
      return {
        html_body: localHtml,
        text_body: localText,
        subject: localSubject,
        sample_data: parsedData,
      };
    },
  }));

  // Emit change to parent
  const emitChange = useCallback(
    (field, value) => {
      if (onChange) {
        onChange(field, value);
      }
    },
    [onChange],
  );

  const handleHtmlChange = useCallback(
    e => {
      setLocalHtml(e.target.value);
      emitChange('html_body', e.target.value);
    },
    [emitChange],
  );

  const handleTextChange = useCallback(
    e => {
      setLocalText(e.target.value);
      emitChange('text_body', e.target.value);
    },
    [emitChange],
  );

  const handleSubjectChange = useCallback(
    e => {
      setLocalSubject(e.target.value);
      emitChange('subject', e.target.value);
    },
    [emitChange],
  );

  const handleSampleDataChange = useCallback(e => {
    const val = e.target.value;
    setLocalSampleData(val);
    try {
      JSON.parse(val);
      setSampleDataError(null);
    } catch (err) {
      setSampleDataError(err.message);
    }
  }, []);

  // Debounced auto-preview
  const triggerPreview = useCallback(() => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    previewTimerRef.current = setTimeout(() => {
      let parsedData = {};
      try {
        parsedData = JSON.parse(localSampleData);
      } catch {
        // Don't preview if JSON is invalid
        return;
      }
      dispatch(
        previewRawTemplate({
          subject: localSubject,
          html_body: localHtml,
          text_body: localText,
          sample_data: parsedData,
        }),
      );
    }, 800);
  }, [dispatch, localHtml, localText, localSubject, localSampleData]);

  // Auto-trigger preview when template content changes
  useEffect(() => {
    triggerPreview();
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [triggerPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      dispatch(clearPreview());
    };
  }, [dispatch]);

  // Write preview HTML into iframe
  useEffect(() => {
    if (iframeRef.current && previewHtml) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  return (
    <div className={s.root}>
      {/* Left pane — Editor */}
      <div className={s.editorPane}>
        {/* Subject */}
        <div className={s.field}>
          <label className={s.label}>
            {t('admin:emails.editor.subject', 'Subject Line')}
          </label>
          <input
            type='text'
            className={s.input}
            value={localSubject}
            onChange={handleSubjectChange}
            placeholder={t(
              'admin:emails.editor.subjectPlaceholder',
              'e.g. Welcome {{ name }}!',
            )}
          />
        </div>

        {/* Tabs: HTML | Text */}
        <div className={s.tabs}>
          <button
            type='button'
            className={`${s.tab} ${activeTab === 'html' ? s.tabActive : ''}`}
            onClick={() => setActiveTab('html')}
          >
            HTML Body
          </button>
          <button
            type='button'
            className={`${s.tab} ${activeTab === 'text' ? s.tabActive : ''}`}
            onClick={() => setActiveTab('text')}
          >
            Text Body
          </button>
        </div>

        {/* Body textarea */}
        <textarea
          className={s.codeArea}
          value={activeTab === 'html' ? localHtml : localText}
          onChange={activeTab === 'html' ? handleHtmlChange : handleTextChange}
          placeholder={
            activeTab === 'html'
              ? t(
                  'admin:emails.editor.htmlPlaceholder',
                  '<h1>Hello {{ name }}</h1>\n<p>Welcome to {{ company }}!</p>',
                )
              : t(
                  'admin:emails.editor.textPlaceholder',
                  'Hello {{ name }},\nWelcome to {{ company }}!',
                )
          }
          spellCheck='false'
        />

        {/* Sample Data */}
        <div className={s.field}>
          <label className={s.label}>
            {t('admin:emails.editor.sampleData', 'Sample Data (JSON)')}
            {sampleDataError && (
              <span className={s.error}>{sampleDataError}</span>
            )}
          </label>
          <textarea
            className={s.sampleDataArea}
            value={localSampleData}
            onChange={handleSampleDataChange}
            placeholder='{"name": "John", "company": "Acme"}'
            spellCheck='false'
          />
        </div>
      </div>

      {/* Right pane — Preview */}
      <div className={s.previewPane}>
        <div className={s.previewHeader}>
          <span className={s.previewTitle}>
            <Icon name='eye' size={16} />
            {t('admin:emails.editor.preview', 'Live Preview')}
          </span>
          {previewLoading && (
            <span className={s.previewLoading}>
              {t('admin:emails.editor.rendering', 'Rendering...')}
            </span>
          )}
        </div>

        {previewError ? (
          <div className={s.previewError}>
            <Icon name='alert-triangle' size={16} />
            <span>
              {typeof previewError === 'string'
                ? previewError
                : previewError.details || 'Rendering error'}
            </span>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            className={s.previewIframe}
            title='Email Preview'
            sandbox='allow-same-origin'
          />
        )}
      </div>
    </div>
  );
});

TemplateEditor.propTypes = {
  htmlBody: PropTypes.string,
  textBody: PropTypes.string,
  subject: PropTypes.string,
  sampleData: PropTypes.shape({}),
  onChange: PropTypes.func,
};

export default TemplateEditor;
