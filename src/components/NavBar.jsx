import { NavLink } from "react-router-dom";
import "./NavBar.css";

const LINKS = [
  { to: "/", label: "Home", end: true },
  { to: "/ipo", label: "IPO" },
  { to: "/tools", label: "Tools" },
];

export default function NavBar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar__mark" end>
        <span>Bazaar</span>
        <span className="navbar__mark-brief">Brief</span>
      </NavLink>
      <div className="navbar__links">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => "navbar__link" + (isActive ? " navbar__link--active" : "")}
          >
            {l.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
