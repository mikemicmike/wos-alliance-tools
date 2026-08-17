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

import { StatusesService } from '../../services/statuses.service';

export type DStatusId = number;

export interface DStatus {
  id: DStatusId;
  status: string;
}

@Component({
  selector: 'app-dropdown-statuses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dropdown-statuses.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownStatusesComponent),
      multi: true,
    },
  ],
})
export class DropdownStatusesComponent implements ControlValueAccessor, OnInit {
  private readonly statusesService = inject(StatusesService);

  /**
   * Prevents an older request from overwriting the
   * results of a newer request if alliance changes quickly.
   */
  private loadRequestId = 0;

  @Input()
  selectId = 'statusId';

  @Input()
  invalid = false;

  readonly selectControl = new FormControl<DStatusId | null>(null);

  statuses: DStatus[] = [];
  placeholder = 'Select a status';

  loading = false;
  errorMessage = '';

  private disabledByParent = false;

  private onChange: (value: DStatusId | null) => void = () => {};

  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  ngOnInit(): void {
    void this.loadStatuses();
  }

  private async loadStatuses(): Promise<void> {
    const requestId = ++this.loadRequestId;

    this.statuses = [];
    this.errorMessage = '';

    this.loading = true;
    this.updateDisabledState();

    try {
      const statuses = await this.statusesService.list();

      /*
       * Ignore this result if another request was started
       * while this one was running.
       */
      if (requestId !== this.loadRequestId) {
        return;
      }

      this.statuses = statuses ?? [];
    } catch (error: unknown) {
      if (requestId !== this.loadRequestId) {
        return;
      }

      console.error('Unable to load statuses', error);

      this.statuses = [];
      this.errorMessage = 'The statuses could not be loaded.';
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

  writeValue(value: DStatusId | null): void {
    this.selectControl.setValue(value ?? null, {
      emitEvent: false,
    });
  }

  registerOnChange(callback: (value: DStatusId | null) => void): void {
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

  trackByStatusId(_index: number, status: DStatus): DStatusId {
    return status.id;
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
