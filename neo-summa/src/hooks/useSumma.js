import { useState, useEffect } from 'react';
import { searchArticlesAdvanced } from '../lib/search';

export function useSumma() {
  const [data, setData] = useState(null);
  const [corpusData, setCorpusData] = useState(null);
  const [bibleData, setBibleData] = useState(null);
  const [index, setIndex] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLibrary() {
      const d = await fetch('/summa.json').then(r => r.json());
      const manifest = await fetch('/works/manifest.json').then(r => r.json()).catch(() => ({ works: [] }));
      const bible = await fetch('/bible/en_kjv.json')
        .then(r => r.text())
        .then(text => JSON.parse(text.replace(/^\uFEFF/, '')))
        .catch(() => null);
      const supplementalWorks = manifest.works.filter(work => !work.primary);
      const supplementalData = await Promise.all(
        supplementalWorks.map(work => fetch(work.path).then(r => r.json()).catch(() => null))
      );

      const summaWork = manifest.works.find(work => work.primary) || {
        id: 'summa-theologica',
        title: 'Summa Theologica',
        primary: true
      };
      const summaArticles = d.articles.map(article => ({
        ...article,
        workId: summaWork.id,
        workTitle: summaWork.title
      }));
      const extraArticles = supplementalData.flatMap(workData => workData?.articles || []);

      setCorpusData({
        works: [summaWork, ...supplementalWorks],
        articles: [...summaArticles, ...extraArticles]
      });

      const idx = {};
      for (const article of d.articles) {
        idx[`${article.part}:${article.question}:${article.article}`] = article;
      }
      setData(d);
      setBibleData(bible);
      setIndex(idx);
      setLoading(false);
    }

    loadLibrary();
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

  const advancedSearchArticles = (options) => searchArticlesAdvanced(corpusData, options);

  return { data, corpusData, bibleData, index, loading, getArticle, getQuestion, searchArticles, advancedSearchArticles };
}
