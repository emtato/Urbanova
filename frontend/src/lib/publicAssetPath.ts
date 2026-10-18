/** Public files must follow Vite's deployment base, including GitHub Pages subpaths. */
export function publicAssetPath(path: string): string {
  return `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}${path.replace(/^\/+/, '')}`
}
