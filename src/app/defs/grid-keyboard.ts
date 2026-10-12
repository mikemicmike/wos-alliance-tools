/**
 * Makes Tab / Shift+Tab move down / up the current column of a grid instead of across the row.
 * Bind it to `(keydown)` on the grid's `<tbody>`; inputs opt in with `data-col="<n>"`.
 * Columns are visited in numeric order, disabled inputs are skipped, and past the last
 * column the browser's normal Tab takes over (e.g. on to the Save button).
 */
export function tabDownColumn(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (event.key !== 'Tab' || !target.dataset['col']) {
    return;
  }

  const grid = event.currentTarget as HTMLElement;
  const inputs = [...grid.querySelectorAll<HTMLInputElement>('input[data-col]')].filter(
    (p_input) => !p_input.disabled,
  );
  const colOf = (p_input: HTMLElement) => Number(p_input.dataset['col']);
  const cols = [...new Set(inputs.map(colOf))].sort((a, b) => a - b);
  const inCol = (p_col: number) => inputs.filter((p_input) => colOf(p_input) === p_col);
  const step = event.shiftKey ? -1 : 1;

  let colIndex = cols.indexOf(colOf(target));
  let column = inCol(cols[colIndex]);
  let next = column[column.indexOf(target as HTMLInputElement) + step];

  while (!next) {
    colIndex += step;
    if (colIndex < 0 || colIndex >= cols.length) {
      return;
    }
    column = inCol(cols[colIndex]);
    next = step > 0 ? column[0] : column[column.length - 1];
  }

  event.preventDefault();
  next.focus();
  // A normal Tab selects the field's text so typing replaces it; focus() alone doesn't
  if (next.type !== 'checkbox') {
    next.select();
  }
}
