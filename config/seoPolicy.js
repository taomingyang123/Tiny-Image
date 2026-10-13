// Page URLs only; do not apply this to assets or API endpoints.
export const canonicalPagePath = value => {
  const path = value.split(/[?#]/)[0] || "/";
  return path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
};
