export const LANDING_PATH = '/';
export const APP_BASE_PATH = '/app';
export const HOME_PATH = APP_BASE_PATH;
export const AUTHORITIES_PATH = `${APP_BASE_PATH}/authorities`;
export const CATALOG_PATH = `${APP_BASE_PATH}/catalog`;
export const PARALLELS_PATH = `${APP_BASE_PATH}/parallels`;
export const SEARCH_PATH = `${APP_BASE_PATH}/search`;

export function parseRoute(pathname) {
  if (!pathname.startsWith(APP_BASE_PATH)) {
    return { type: 'landing' };
  }

  const appPath = pathname.slice(APP_BASE_PATH.length) || '/';

  const questionMatch = appPath.match(/^\/questions\/([A-Z0-9]+)\/(\d+)\/?$/);
  if (questionMatch) {
    return {
      type: 'question',
      questionRef: {
        part: questionMatch[1],
        question: Number(questionMatch[2])
      }
    };
  }

  const articleMatch = appPath.match(/^\/articles\/([A-Z0-9]+)\/(\d+)\/(\d+)\/?$/);
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

  if (/^\/authorities\/?$/.test(appPath)) {
    return { type: 'authorities' };
  }

  if (/^\/parallels\/?$/.test(appPath)) {
    return { type: 'parallels' };
  }

  if (/^\/(?:catalog|questions)\/?$/.test(appPath)) {
    return { type: 'catalog' };
  }

  if (/^\/search\/?$/.test(appPath)) {
    return { type: 'search' };
  }

  return { type: 'home' };
}

export function articlePath(part, question, article) {
  return `${APP_BASE_PATH}/articles/${part}/${question}/${article}`;
}

export function questionPath(part, question) {
  return `${APP_BASE_PATH}/questions/${part}/${question}`;
}
