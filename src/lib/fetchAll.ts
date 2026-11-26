const PAGE = 1000; // PostgREST silently caps a response at its max_rows (1000 by default).

/** Reads every row of a query by walking `.range()` pages until a short page arrives. */
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) return { data: rows, error: null };
  }
}
