export const HOME_PATH = '/';
export const AUTHORITIES_PATH = '/authorities';
export const CATALOG_PATH = '/catalog';
export const SEARCH_PATH = '/search';

export function parseRoute(pathname) {
  const articleMatch = pathname.match(/^\/articles\/([A-Z0-9]+)\/(\d+)\/(\d+)\/?$/);
  if (articleMatch) {
    return {
      type: 'reader',
      articleRef: {
        part: articleMatch[1],
        question: Number(articleMatch[2]),
        article: Number(articleMatch[3])
      }
    };
  }

  if (/^\/authorities\/?$/.test(pathname)) {
    return { type: 'authorities' };
  }

  if (/^\/(?:catalog|questions)\/?$/.test(pathname)) {
    return { type: 'catalog' };
  }

  if (/^\/search\/?$/.test(pathname)) {
    return { type: 'search' };
  }

  return { type: 'home' };
}

export function articlePath(part, question, article) {
  return `/articles/${part}/${question}/${article}`;
}
