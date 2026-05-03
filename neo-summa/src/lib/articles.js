import { PART_ORDER } from '../config/summa';

export function getOrderedArticles(articles = []) {
  return [...articles].sort((a, b) =>
    PART_ORDER.indexOf(a.part) - PART_ORDER.indexOf(b.part) ||
    a.question - b.question ||
    a.article - b.article
  );
}

export function getAdjacentArticles(articles, selectedArticle) {
  if (!selectedArticle) {
    return {
      previousArticle: null,
      nextArticle: null
    };
  }

  const selectedIndex = articles.findIndex(article => article.id === selectedArticle.id);

  return {
    previousArticle: selectedIndex > 0 ? articles[selectedIndex - 1] : null,
    nextArticle: selectedIndex >= 0 && selectedIndex < articles.length - 1
      ? articles[selectedIndex + 1]
      : null
  };
}
