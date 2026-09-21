import { markdownToText, titleFromFileName } from './markdown';

describe('markdownToText', () => {
  it('strips headings, emphasis, links and list markers', () => {
    const md =
      '# Title\n\n**Bold** and *italic* and _under_ [link](http://x.y)\n\n- item one\n> quote';
    expect(markdownToText(md)).toBe('Title\n\nBold and italic and under link\n\nitem one\nquote');
  });

  it('keeps fenced code content and drops the fences and rules', () => {
    expect(markdownToText('```\nline a\nline b\n```\n---\nend')).toBe('line a\nline b\n\nend');
  });

  it('leaves snake_case words and plain text alone', () => {
    expect(markdownToText('my_var_name stays')).toBe('my_var_name stays');
  });
});

describe('titleFromFileName', () => {
  it('cleans the extension and separators', () => {
    expect(titleFromFileName('the_raven-poe.txt')).toBe('the raven poe');
    expect(titleFromFileName('Speech.MD')).toBe('Speech');
  });
});
