export default function WelcomeView({ data, partNames }) {
  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-symbol">I</div>
        <h2>Summa Theologica Navigator</h2>
        <p>A new interface for Thomas Aquinas' masterwork with bidirectional cross-references, threaded objections and replies, and authority indexing across {data.meta.totalArticles} articles.</p>
        <div className="welcome-stats">
          {Object.entries(partNames).map(([code, name]) => {
            const count = data.articles.filter(article => article.part === code).length;

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
  );
}
