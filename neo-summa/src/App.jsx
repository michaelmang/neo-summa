import { useState, useCallback } from 'react';
import { useSumma } from './hooks/useSumma';
import Sidebar from './components/Sidebar';
import ArticleView from './components/ArticleView';
import AuthorityIndex from './components/AuthorityIndex';
import './App.css';

const PART_NAMES = {
  FP: 'Prima Pars',
  FS: 'Prima Secundae',
  SS: 'Secunda Secundae',
  TP: 'Tertia Pars',
};

const PART_SCOPES = {
  FP: 'God, creation, angels, and human nature',
  FS: 'Human acts, passions, habits, law, and grace',
  SS: 'Virtues, vices, states of life, and moral questions',
  TP: 'Christ, the sacraments, and salvation',
};

export default function App() {
  const { data, loading, getArticle, searchArticles } = useSumma();
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('reader');
  const [history, setHistory] = useState([]);

  const navigate = useCallback((part, question, article) => {
    const found = getArticle(part, question, article);
    if (found) {
      setHistory(h => selected ? [...h, selected] : h);
      setSelected(found);
      setView('reader');
    }
  }, [getArticle, selected]);

  const goBack = useCallback(() => {
    if (history.length > 0) {
      const prev = history[history.length - 1];
      setSelected(prev);
      setHistory(h => h.slice(0, -1));
    }
  }, [history]);

  if (loading) return (
    <div className="loading">
      <div className="loading-inner">
        <div className="loading-cross">✝</div>
        <p>Loading the Summa Theologica…</p>
      </div>
    </div>
  );

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
          view={view}
          onSelect={(art) => { setSelected(art); setHistory([]); setView('reader'); }}
          onShowAuthorities={() => setView('authorities')}
          searchArticles={searchArticles}
          partNames={PART_NAMES}
          partScopes={PART_SCOPES}
        />

        <main className="main-content">
          {view === 'authorities' ? (
            <AuthorityIndex
              data={data}
              onNavigate={navigate}
            />
          ) : selected ? (
            <ArticleView
              article={selected}
              onNavigate={navigate}
              onBack={history.length > 0 ? goBack : null}
              partNames={PART_NAMES}
            />
          ) : (
            <div className="welcome">
              <div className="welcome-inner">
                <div className="welcome-symbol">Ⅰ</div>
                <h2>Summa Theologica Navigator</h2>
                <p>A new interface for Thomas Aquinas' masterwork — bidirectional cross-references, threaded objections and replies, and a full citation graph across {data.meta.totalArticles} articles.</p>
                <div className="welcome-stats">
                  {Object.entries(PART_NAMES).map(([code, name]) => {
                    const count = data.articles.filter(a => a.part === code).length;
                    return count > 0 ? (
                      <div key={code} className="welcome-part">
                        <span className="welcome-part-code">{code}</span>
                        <span className="welcome-part-name">{name}</span>
                        <span className="welcome-part-count">{count} articles</span>
                      </div>
                    ) : null;
                  })}
                </div>
                <p className="welcome-hint">Select a question from the sidebar to begin.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
