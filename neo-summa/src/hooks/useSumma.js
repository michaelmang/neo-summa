import { useState, useEffect } from 'react';

export function useSumma() {
  const [data, setData] = useState(null);
  const [index, setIndex] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/summa.json')
      .then(r => r.json())
      .then(d => {
        const idx = {};
        for (const article of d.articles) {
          idx[`${article.part}:${article.question}:${article.article}`] = article;
        }
        setData(d);
        setIndex(idx);
        setLoading(false);
      });
  }, []);

  const getArticle = (part, question, article) =>
    index[`${part}:${question}:${article}`] || null;

  const getQuestion = (part, question) =>
    data?.articles.filter(a => a.part === part && a.question === question) || [];

  const searchArticles = (query) => {
    if (!query || !data) return [];
    const q = query.toLowerCase();
    return data.articles.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.respondeo.english.toLowerCase().includes(q)
    ).slice(0, 20);
  };

  return { data, index, loading, getArticle, getQuestion, searchArticles };
}
