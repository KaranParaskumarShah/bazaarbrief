import { useEffect } from "react";

// Lightweight per-page SEO tags without pulling in react-helmet.
// Note: since this app is client-rendered (no SSR/SSG), search engines
// that don't execute JS won't see these — see README for the prerendering
// note if organic search traffic is the goal.
export function usePageMeta(title, description) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title ? `${title} · Bazaar Brief` : "Bazaar Brief";

    let tag = document.querySelector('meta[name="description"]');
    let created = false;
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
      created = true;
    }
    const prevDesc = tag.getAttribute("content");
    if (description) tag.setAttribute("content", description);

    return () => {
      document.title = prevTitle;
      if (created) tag.remove();
      else if (prevDesc != null) tag.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}
