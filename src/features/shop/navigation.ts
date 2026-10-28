import { router } from 'expo-router';

// The Categories tab stays mounted and keeps its filter in the URL, so "browse everything" links
// pass empty params explicitly; a bare '/categories' would reopen whatever category was last selected.
export function browseAllCategories(): void {
  router.navigate({ pathname: '/categories', params: { category: '', query: '' } });
}
