import { useCallback, useEffect, useState } from "react";

function parse() {
  const raw = window.location.hash.replace(/^#/, "") || "/portfolio";
  const [path, query = ""] = raw.split("?");
  return { path, params: Object.fromEntries(new URLSearchParams(query)) };
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = useCallback((path, params = {}) => {
    const q = new URLSearchParams(params).toString();
    window.location.hash = q ? `${path}?${q}` : path;
  }, []);
  return { ...route, navigate };
}
