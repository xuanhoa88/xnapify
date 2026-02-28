import { marked } from 'marked';

let markdown = `System administrator with :comment[full access t]{id="comment-1772281157843" data="%5B%7B%22id%22%3A%22c-1772283528269%22%2C%22text%22%3A%22224%22%2C%22createdAt%22%3A%222026-02-28T12%3A58%3A48.269Z%22%7D%2C%7B%22id%22%3A%22c-1772283533970%22%2C%22text%22%3A%22353545%22%2C%22createdAt%22%3A%222026-02-28T12%3A58%3A53.970Z%22%7D%5D"}o all features.`;

let processed = markdown.replace(
  /:comment\[([\s\S]*?)\]\{([^}]+)\}/g,
  (match, content, attrString) => {
    const idMatch = attrString.match(/id="([^"]+)"/);
    const dataMatch = attrString.match(/data="([^"]+)"/);

    const id = idMatch ? idMatch[1] : '';
    let dataAttr = '';

    console.log('dataMatch:', dataMatch);

    if (dataMatch) {
      try {
        const decoded = decodeURIComponent(dataMatch[1]);
        const htmlSafeData = decoded.replace(/"/g, '&quot;');
        dataAttr = ` data-comments="${htmlSafeData}"`;
      } catch (e) {}
    }

    return `<span data-comment-id="${id}"${dataAttr}>${content}</span>`;
  },
);

console.log(processed);
