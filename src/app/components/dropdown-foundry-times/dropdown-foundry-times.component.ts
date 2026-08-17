import { CommonModule } from '@angular/common';
import { Component, forwardRef, Input, OnInit } from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';

export type DFoundryTime = string;

@Component({
  selector: 'app-dropdown-foundry-times',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './dropdown-foundry-times.component.html',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DropdownFoundryTimesComponent),
      multi: true,
    },
  ],
})
export class DropdownFoundryTimesComponent implements ControlValueAccessor, OnInit {
  @Input()
  selectId = 'Select a Time';

  @Input()
  invalid = false;

  readonly selectControl = new FormControl<DFoundryTime | null>(null);

  foundryTimes: DFoundryTime[] = [];
  placeholder = 'Select a Time';

  errorMessage = '';

  private disabledByParent = false;

  private onChange: (value: DFoundryTime | null) => void = () => {};

  private onTouched: () => void = () => {};

  constructor() {
    this.selectControl.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  ngOnInit(): void {
    this.loadFoundryTimes();
  }

  private async loadFoundryTimes(): Promise<void> {
    this.foundryTimes = [];
    this.errorMessage = '';

    this.updateDisabledState();

    try {
      const foundryTimes = ['02 UTC', '12 UTC', '14 UTC', '19 UTC'];

      this.foundryTimes = foundryTimes ?? [];
    } catch (error: unknown) {
      console.error('Unable to load foundryTimes', error);

      this.foundryTimes = [];
      this.errorMessage = 'The foundryTimes could not be loaded.';
    }
  }

  writeValue(value: DFoundryTime | null): void {
    this.selectControl.setValue(value ?? null, {
      emitEvent: false,
    });
  }

  registerOnChange(callback: (value: DFoundryTime | null) => void): void {
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

  trackByFoundryTime(_index: number, foundryTime: DFoundryTime): DFoundryTime {
    return foundryTime;
  }

  private updateDisabledState(): void {
    const shouldDisable = this.disabledByParent;

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
