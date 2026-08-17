import { CommonModule } from '@angular/common';
import {
  Component,
  forwardRef,
  inject,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';

import { BearTimesService } from '../../services/bear-times.service';

export type DBearTimeId = number;
// Use string instead if bear_times.id is a UUID.

export interface DBearTime {
  id: DBearTimeId;
  label: string;
}

@Component({
  selector: 'app-dropdown-bear-times',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dropdown-bear-times.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownBearTimesComponent),
      multi: true,
    },
  ],
})
export class DropdownBearTimesComponent implements ControlValueAccessor, OnInit {
  private readonly bearTimesService = inject(BearTimesService);

  /**
   * Prevents an older request from overwriting the
   * results of a newer request if alliance changes quickly.
   */
  private loadRequestId = 0;

  @Input()
  selectId = 'bearTime';

  @Input()
  invalid = false;

  readonly selectControl = new FormControl<DBearTimeId | null>(null);

  bearTimes: DBearTime[] = [];
  placeholder = 'Select a bear time';

  loading = false;
  errorMessage = '';

  private disabledByParent = false;

  private onChange: (value: DBearTimeId | null) => void = () => {};

  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  ngOnInit(): void {
    /*
     * Angular does not need to await this lifecycle work.
     * Errors are handled inside loadBearTimes().
     */
    void this.loadBearTimes();
  }

  private async loadBearTimes(): Promise<void> {
    const requestId = ++this.loadRequestId;

    this.bearTimes = [];
    this.errorMessage = '';

    this.loading = true;
    this.updateDisabledState();

    try {
      const bearTimes = await this.bearTimesService.list();

      /*
       * Ignore this result if another request was started
       * while this one was running.
       */
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.bearTimes = bearTimes ?? [];
    } catch (error: unknown) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      console.error('Unable to load bear times', error);

      this.bearTimes = [];
      this.errorMessage = 'The bear times could not be loaded.';
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

  writeValue(value: DBearTimeId | null): void {
    this.selectControl.setValue(value ?? null, {
      emitEvent: false,
    });
  }

  registerOnChange(callback: (value: DBearTimeId | null) => void): void {
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

  trackByBearTimeId(_index: number, bearTime: DBearTime): DBearTimeId {
    return bearTime.id;
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
