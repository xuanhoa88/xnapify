import { markdownToHtml } from './src/shared/renderer/components/Form/WYSIWYG/markdownUtils.js';

const md = `System administrator with :comment[full access t]{id="comment-1772281157843" data="%5B%7B%22id%22%3A%22c-1772283528269%22%2C%22text%22%3A%22224%22%2C%22createdAt%22%3A%222026-02-28T12%3A58%3A48.269Z%22%7D%2C%7B%22id%22%3A%22c-1772283533970%22%2C%22text%22%3A%22353545%22%2C%22createdAt%22%3A%222026-02-28T12%3A58%3A53.970Z%22%7D%5D"}o all features.`;

console.log(markdownToHtml(md));
