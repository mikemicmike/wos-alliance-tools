import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { DMemberInsert, MembersService } from '../../services/members.service';
import { DropdownBearTimesComponent } from '../dropdown-bear-times/dropdown-bear-times.component';
import { DropdownRanksComponent } from '../dropdown-ranks/dropdown-ranks.component';
import { DropdownStatusesComponent } from '../dropdown-statuses/dropdown-statuses.component';
import { Location } from '@angular/common'; // 1. Import
import { MemberLogService } from '../../services/member-log.service';

@Component({
  selector: 'appmember-add',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DropdownBearTimesComponent,
    DropdownRanksComponent,
    DropdownStatusesComponent,
  ],
  templateUrl: './member-update.component.html',
  styleUrl: './member-update.component.scss',
})
export class MemberUpdateComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly membersService = inject(MembersService);
  private readonly locationService = inject(Location);
  private readonly memberLogService = inject(MemberLogService);

  memberGet: Awaited<ReturnType<MembersService['getSingle']>> | null = null;
  readonly mode = this.route.snapshot.data['mode'];

  readonly memberForm = this.fb.group({
    id: this.fb.control<number | null>(null, {
      validators: [Validators.required, Validators.min(1)],
    }),

    name: this.fb.nonNullable.control('', {
      validators: [Validators.required],
    }),

    power: this.optionalPositiveNumber(),
    furnace_level: this.optionalPositiveNumber(),

    infantry_fc_level: this.optionalPositiveNumber(),
    lancer_fc_level: this.optionalPositiveNumber(),
    marksman_fc_level: this.optionalPositiveNumber(),

    infantry_tier: this.optionalPositiveNumber(),
    lancer_tier: this.optionalPositiveNumber(),
    marksman_tier: this.optionalPositiveNumber(),

    bear: this.fb.control<number | null>(null),
    status: this.fb.nonNullable.control(0),
    rank: this.fb.nonNullable.control(''),
    notes: this.fb.control<string | null>(''),
    joined: this.fb.nonNullable.control(''),
  });

  isSaving = false;
  submitAttempted = false;
  errorMessage = '';

  isInvalid(controlName: string): boolean {
    const control = this.memberForm.get(controlName);

    return Boolean(control && control.invalid && (control.touched || this.submitAttempted));
  }

  async cancel(): Promise<void> {
    try {
      this.locationService.back();
    } catch (error) {
      await this.router.navigate(['members/']);
    }
  }
  async submit(): Promise<void> {
    this.submitAttempted = true;
    this.errorMessage = '';

    if (this.memberForm.invalid) {
      this.memberForm.markAllAsTouched();
      return;
    }

    const formValue = this.memberForm.getRawValue();

    const member: DMemberInsert = {
      gameId: formValue.id,
      name: formValue.name.trim(),

      power: formValue.power,
      furnace_level: formValue.furnace_level,

      infantry_fc_level: formValue.infantry_fc_level,
      lancer_fc_level: formValue.lancer_fc_level,
      marksman_fc_level: formValue.marksman_fc_level,

      infantry_tier: formValue.infantry_tier,
      lancer_tier: formValue.lancer_tier,
      marksman_tier: formValue.marksman_tier,

      bear: formValue.bear,
      status: formValue.status,
      rank: formValue.rank,
      notes: formValue.notes,
      joined: formValue.joined,
    };

    this.isSaving = true;

    try {
      if (this.mode === 'UPDATE') {
        if (!this.memberGet) {
          throw new Error('No member');
        }
        await this.membersService.update(this.memberGet.id, member);
        await this.compareRecords(this.memberGet.id, this.memberGet, member);
      } else {
        await this.membersService.create(member);
      }

      try {
        this.locationService.back();
      } catch (error) {
        await this.router.navigate(['members/']);
      }
    } catch (error: unknown) {
      console.error('Unable to create member', error);

      this.errorMessage =
        error instanceof Error ? error.message : 'The member could not be created.';
    } finally {
      this.isSaving = false;
    }
  }

  private async compareRecords(p_id: number, p_previous: DMemberInsert, p_new: DMemberInsert) {
    for (const w_key of Object.keys(p_new)) {
      await this.compareField(p_id, <keyof DMemberInsert>w_key, p_previous, p_new);
    }
  }
  private async compareField(
    p_id: number,
    p_field: keyof DMemberInsert,
    p_previous: DMemberInsert,
    p_new: DMemberInsert,
  ) {
    if (p_previous[p_field] !== p_new[p_field]) {
      await this.memberLogService.create({
        member_id: p_id,
        type: p_field,
        new_value_num: typeof p_new[p_field] === 'number' ? p_new[p_field] : null,
        previous_value_num: typeof p_previous[p_field] === 'number' ? p_previous[p_field] : null,
        new_value_text: typeof p_new[p_field] === 'string' ? p_new[p_field] : null,
        previous_value_text: typeof p_previous[p_field] === 'string' ? p_previous[p_field] : null,
      });
    }
  }

  private optionalPositiveNumber() {
    return this.fb.control<number | null>(null, {
      validators: [Validators.min(0)],
    });
  }

  async ngOnInit() {
    if (this.mode === 'UPDATE') {
      console.log('hello', this.route.snapshot.paramMap.get('member'));
      this.memberGet = await this.membersService.getSingle(
        Number(this.route.snapshot.paramMap.get('member')) ?? 0,
      );
      console.log(this.memberGet);
      this.memberForm.setValue({
        bear: this.memberGet.bear,
        furnace_level: this.memberGet.furnace_level,
        id: this.memberGet.gameId,
        infantry_fc_level: this.memberGet.infantry_fc_level,
        infantry_tier: this.memberGet.infantry_tier,
        joined: this.memberGet.joined,
        lancer_fc_level: this.memberGet.lancer_fc_level,
        lancer_tier: this.memberGet.lancer_tier,
        marksman_fc_level: this.memberGet.marksman_fc_level,
        marksman_tier: this.memberGet.marksman_tier,
        name: this.memberGet.name,
        notes: this.memberGet.notes,
        power: this.memberGet.power,
        rank: this.memberGet.rank,
        status: this.memberGet.status,
      });
      this.memberForm.controls['id'].disable();
    }
  }
}
