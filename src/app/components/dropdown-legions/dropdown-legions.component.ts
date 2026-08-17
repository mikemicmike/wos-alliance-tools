import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input } from '@angular/core';
import { FormControl, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

export type DLegion = number;

@Component({
  selector: 'app-dropdown-legions',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dropdown-legions.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownLegionsComponent),
      multi: true,
    },
  ],
})
export class DropdownLegionsComponent {
  /**
   * Prevents an older request from overwriting the
   * results of a newer request if alliance changes quickly.
   */
  private loadRequestId = 0;

  @Input()
  selectId = 1;

  @Input()
  invalid = false;

  readonly selectControl = new FormControl<DLegion | null>(null);

  legions: DLegion[] = [];
  placeholder = 'Select a Legion';

  loading = false;
  errorMessage = '';

  private disabledByParent = false;

  private onChange: (value: DLegion | null) => void = () => {};

  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  ngOnInit(): void {
    void this.loadLegions();
  }

  private async loadLegions(): Promise<void> {
    const requestId = ++this.loadRequestId;

    this.legions = [];
    this.errorMessage = '';

    this.loading = true;
    this.updateDisabledState();

    try {
      const legions = [1, 2];

      /*
       * Ignore this result if another request was started
       * while this one was running.
       */
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.legions = legions ?? [];
    } catch (error: unknown) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      console.error('Unable to load legions', error);

      this.legions = [];
      this.errorMessage = 'The legions could not be loaded.';
    } finally {
      /*
       * Do not let an older request change the loading
       * state of a newer request.
       */
      if (requestId === this.loadRequestId) {
        this.loading = false;
        this.updateDisabledState();
      }
    }
  }

  writeValue(value: DLegion | null): void {
    this.selectControl.setValue(value ?? null, {
      emitEvent: false,
    });
  }

  registerOnChange(callback: (value: DLegion | null) => void): void {
    this.onChange = callback;
  }

  registerOnTouched(callback: () => void): void {
    this.onTouched = callback;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabledByParent = isDisabled;
    this.updateDisabledState();
  }

  markAsTouched(): void {
    this.onTouched();
  }

  trackByLegion(_index: number, legion: DLegion): DLegion {
    return legion;
  }

  private updateDisabledState(): void {
    const shouldDisable = this.disabledByParent || this.loading;

    if (shouldDisable) {
      this.selectControl.disable({
        emitEvent: false,
      });
    } else {
      this.selectControl.enable({
        emitEvent: false,
      });
    }
  }
}
