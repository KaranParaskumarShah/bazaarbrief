import { Link } from "react-router-dom";
import { usePolling } from "../hooks/usePolling";
import { fetchLatestNews } from "../services/news";
import { formatRelativeTime } from "../utils/time";
import staticNews from "../data/newsItems.json";
import "./NewsSection.css";

export default function NewsSection() {
  const { data, loading, error, fetchedAt } = usePolling("news:et-markets", fetchLatestNews);

  const items = data && data.length > 0 ? data : staticNews.items;
  const isLive = Boolean(data && data.length > 0);

  return (
    <section className="section">
      <div className="section__head">
        <h2>Latest News</h2>
        <p>
          {isLive
            ? `Live from Economic Times Markets — ${error ? "showing last fetched items" : `updated ${formatRelativeTime(fetchedAt)}`}.`
            : loading
            ? "Fetching the latest headlines…"
            : "Couldn't fetch live headlines yet — showing recent placeholders."}
        </p>
      </div>
      <div className="news-grid">
        {items.map((n) =>
          n.url?.startsWith("http") ? (
            <a className="news-card" key={n.title} href={n.url} target="_blank" rel="noreferrer">
              <span className="news-card__date">{n.date}</span>
              <h4>{n.title}</h4>
              {n.summary && <p>{n.summary}</p>}
            </a>
          ) : (
            <Link className="news-card" key={n.title} to={n.url || "/"}>
              <span className="news-card__date">{n.date}</span>
              <h4>{n.title}</h4>
              {n.summary && <p>{n.summary}</p>}
            </Link>
          )
        )}
      </div>
    </section>
  );
}
