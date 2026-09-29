import { Link } from "react-router-dom";
import "../styles/pages.css";

export default function NotFound() {
  return (
    <div className="page">
      <div className="page__head">
        <h1>Page not found</h1>
        <p>That page doesn't exist. Back to the <Link to="/">homepage</Link>.</p>
      </div>
    </div>
  );
}
