import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSumma } from './hooks/useSumma';
import { PART_NAMES, PART_SCOPES } from './config/summa';
import { getAdjacentArticles, getOrderedArticles } from './lib/articles';
import { AUTHORITIES_PATH, HOME_PATH, articlePath, parseRoute } from './lib/routing';
import Sidebar from './components/Sidebar';
import ArticleView from './components/ArticleView';
import AuthorityIndex from './components/AuthorityIndex';
import ErrorBoundary from './components/ErrorBoundary';
import WelcomeView from './components/WelcomeView';
import './App.css';

export default function App() {
  const { data, loading, getArticle, searchArticles } = useSumma();
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));
  const [hasAppHistory, setHasAppHistory] = useState(false);

  useEffect(() => {
    const handlePopState = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const pushRoute = useCallback((path) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setHasAppHistory(true);
    }
    setRoute(parseRoute(path));
  }, []);

  const navigate = useCallback((part, question, article) => {
    const found = getArticle(part, question, article);
    if (found) {
      pushRoute(articlePath(part, question, article));
    }
  }, [getArticle, pushRoute]);

  const goBack = useCallback(() => {
    if (hasAppHistory) {
      window.history.back();
    } else {
      pushRoute(HOME_PATH);
    }
  }, [hasAppHistory, pushRoute]);

  const orderedArticles = useMemo(() => getOrderedArticles(data?.articles), [data]);

  if (loading) return (
    <div className="loading">
      <div className="loading-inner">
        <div className="loading-cross">✝</div>
        <p>Loading the Summa Theologica…</p>
      </div>
    </div>
  );

  const selected = route.type === 'reader' && route.articleRef
    ? getArticle(route.articleRef.part, route.articleRef.question, route.articleRef.article)
    : null;
  const adjacentArticles = getAdjacentArticles(orderedArticles, selected);
  const routeKey = selected ? selected.id : route.type;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="header-cross">✝</span>
          <div>
            <h1 className="header-title">Summa Theologica</h1>
          </div>
        </div>
        <div className="header-stats">
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          data={data}
          selected={selected}
          view={route.type}
          onSelect={(art) => pushRoute(articlePath(art.part, art.question, art.article))}
          onShowAuthorities={() => pushRoute(AUTHORITIES_PATH)}
          searchArticles={searchArticles}
          partNames={PART_NAMES}
          partScopes={PART_SCOPES}
        />

        <main className="main-content">
          <ErrorBoundary key={routeKey}>
            <MainView
              data={data}
              route={route}
              selected={selected}
              adjacentArticles={adjacentArticles}
              onNavigate={navigate}
              onBack={goBack}
              partNames={PART_NAMES}
            />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function MainView({ data, route, selected, adjacentArticles, onNavigate, onBack, partNames }) {
  if (route.type === 'authorities') {
    return (
      <AuthorityIndex
        data={data}
        onNavigate={onNavigate}
        onBack={onBack}
      />
    );
  }

  if (selected) {
    return (
      <ArticleView
        article={selected}
        onNavigate={onNavigate}
        previousArticle={adjacentArticles.previousArticle}
        nextArticle={adjacentArticles.nextArticle}
        partNames={partNames}
      />
    );
  }

  return <WelcomeView data={data} partNames={partNames} />;
}
