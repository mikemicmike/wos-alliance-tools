import { CanDeactivateFn } from '@angular/router';

/** Implemented by pages that hold edits until an explicit Save. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/** Asks before navigating away from a page with unsaved edits (nav links, back button, etc.). */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = (component) =>
  !component.hasUnsavedChanges() || confirm('You have unsaved changes. Leave and discard them?');

/**
 * For `@HostListener('window:beforeunload', ['$event'])`: makes the browser ask before
 * closing / reloading the tab while there are unsaved edits.
 */
export function warnBeforeUnload(p_component: HasUnsavedChanges, event: BeforeUnloadEvent): void {
  if (p_component.hasUnsavedChanges()) {
    event.preventDefault();
  }
}
