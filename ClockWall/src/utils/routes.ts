export type Page = "clock" | "planets" | "earth";

const basePath = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

export const pagePaths: Record<Page, string> = {
  clock: basePath,
  planets: `${basePath}Planetary_Postions/`,
  earth: `${basePath}Earth_View/`,
};

export function getPageFromPath(pathname: string): Page {
  const path = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (path === pagePaths.planets) return "planets";
  if (path === pagePaths.earth) return "earth";
  return "clock";
}
