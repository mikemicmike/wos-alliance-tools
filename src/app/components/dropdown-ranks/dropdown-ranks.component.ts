import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnInit, SimpleChanges } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';

export type DRank = string;

@Component({
  selector: 'app-dropdown-ranks',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dropdown-ranks.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownRanksComponent),
      multi: true,
    },
  ],
})
export class DropdownRanksComponent implements ControlValueAccessor, OnInit {
  /**
   * Prevents an older request from overwriting the
   * results of a newer request if alliance changes quickly.
   */
  private loadRequestId = 0;

  @Input()
  selectId = 'R1';

  @Input()
  invalid = false;

  readonly selectControl = new FormControl<DRank | null>(null);

  ranks: DRank[] = [];
  placeholder = 'Select a Rank';

  loading = false;
  errorMessage = '';

  private disabledByParent = false;

  private onChange: (value: DRank | null) => void = () => {};

  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  ngOnInit(): void {
    void this.loadRanks();
  }

  private async loadRanks(): Promise<void> {
    const requestId = ++this.loadRequestId;

    this.ranks = [];
    this.errorMessage = '';

    this.loading = true;
    this.updateDisabledState();

    try {
      const ranks = ['R1', 'R2', 'R3', 'R4'];

      /*
       * Ignore this result if another request was started
       * while this one was running.
       */
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.ranks = ranks ?? [];
    } catch (error: unknown) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      console.error('Unable to load ranks', error);

      this.ranks = [];
      this.errorMessage = 'The ranks could not be loaded.';
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

  writeValue(value: DRank | null): void {
    this.selectControl.setValue(value ?? null, {
      emitEvent: false,
    });
  }

  registerOnChange(callback: (value: DRank | null) => void): void {
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

  trackByRank(_index: number, rank: DRank): DRank {
    return rank;
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
