const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');
const hljs = require('highlight.js');

marked.setOptions({
  gfm: true,
  breaks: true,
  tables: true,
  headerIds: false,
  mangle: false,
  pedantic: false,
  sanitize: false,
  smartLists: true,
  smartypants: true, 
  checkbox: true,
  highlight: function(code, lang) {
    try {
      if (lang) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch (e) {
      console.error('Highlight error:', e);
      return code;
    }
  }
});

const sanitizeOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'blockquote', 'p', 'a', 'ul', 'ol', 'nl', 'li',
    'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br',
    'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'pre',
    'span', 'input'
  ],
  allowedAttributes: {
    'a': ['href', 'target', 'rel'],
    'img': ['src', 'alt'],
    'code': ['class'],
    'pre': ['class'],
    'span': ['class', 'style'],
    'td': ['align', 'style'],
    'th': ['align', 'style'],
    'input': ['type', 'checked', 'disabled']
  },
  allowedStyles: {
    'td': {
      'text-align': [/^left$/, /^center$/, /^right$/]
    },
    'th': {
      'text-align': [/^left$/, /^center$/, /^right$/]
    },
    'span': {
      'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/],
      'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/]
    }
  },
  selfClosing: ['img', 'br', 'hr', 'input'],
  allowedSchemes: ['http', 'https', 'ftp', 'mailto'],
  allowedSchemesByTag: {},
  allowProtocolRelative: true,
  enforceHtmlBoundary: false
};

function md2html(markdown) {
  try {
    const rawHtml = marked(markdown);
    let processedHtml = sanitizeHtml(rawHtml, sanitizeOptions);
	
    processedHtml = processedHtml.replace(/<pre><code class="(.*?)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
      return `<div class="code-block-wrapper">
                <button class="copy-code-btn" onclick="copyCodeToClipboard(this)">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><path fill="none" d="M0 0h24v24H0z"/><path d="M7 6V3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3v3c0 .552-.45 1-1.007 1H4.007A1.001 1.001 0 0 1 3 21l.003-14c0-.552.45-1 1.007-1H7zM5.003 8L5 20h10V8H5.003zM9 6h8v10h2V4H9v2z"/></svg>
                </button>
                <pre><code class="${lang}">${code}</code></pre>
              </div>`;
    });
	
    processedHtml = processedHtml.replace(/<li><input type="checkbox"(.*?)><\/li>/g, (match, attributes) => {
      return `<li class="task-list-item"><input type="checkbox"${attributes} onclick="this.checked = !this.checked"></li>`;
    });
    
    return processedHtml;
  } catch (e) {
    console.error('Markdown processing error:', e);
    return sanitizeHtml(markdown, sanitizeOptions);
  }
}

module.exports = {
  md2html,
};