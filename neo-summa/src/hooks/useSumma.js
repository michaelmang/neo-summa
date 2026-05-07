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
      const parallelPassageData = await fetch('/parallel-passages.json')
        .then(r => r.json())
        .catch(() => ({ passages: {} }));
      const leonineData = await fetch('/leonine-parallels.json')
        .then(r => r.json())
        .catch(() => ({ apparatus: {}, passages: {} }));
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
      const getParallelPassages = (article) => {
        const key = `${article.part}:${article.question}:${article.article}`;
        return mergeParallelPassages(
          parallelPassageData.passages?.[key] || [],
          leonineData.passages?.[key] || []
        );
      };
      const getLeonineApparatus = (article) =>
        leonineData.apparatus?.[`${article.part}:${article.question}:${article.article}`] || null;
      const summaArticles = d.articles.map(article => ({
        ...article,
        workId: summaWork.id,
        workTitle: summaWork.title,
        parallelPassages: getParallelPassages(article),
        leonineApparatus: getLeonineApparatus(article)
      }));
      const extraArticles = supplementalData.flatMap(workData => workData?.articles || []);

      setCorpusData({
        works: [summaWork, ...supplementalWorks],
        articles: [...summaArticles, ...extraArticles]
      });

      const idx = {};
      for (const article of summaArticles) {
        idx[`${article.part}:${article.question}:${article.article}`] = article;
      }
      setData({
        ...d,
        articles: summaArticles,
        meta: {
          ...d.meta,
          parallelPassageGroups: Object.keys(parallelPassageData.passages || {}).length,
          leonineApparatusArticles: Object.keys(leonineData.apparatus || {}).length
        }
      });
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

function mergeParallelPassages(...groups) {
  const seen = new Set();
  return groups.flat().filter((entry) => {
    const key = `${entry.part}:${entry.question}:${entry.article}:${entry.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
