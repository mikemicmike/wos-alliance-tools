import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { FoundriesService } from '../../services/foundries.service';
import { CommonModule } from '@angular/common';
import { FoundryParticipantsService } from '../../services/foundry-participants.service';

type DFoundry = Awaited<ReturnType<FoundriesService['listForDate']>>[number];
type FoundryForm = FormGroup<{
  id: FormControl<number | null>;
  legion: FormControl<number | null>;
  opponent: FormControl<string | null>;
  our_score: FormControl<number | null>;
  opponent_score: FormControl<number | null>;
  foundry_participants: FormArray<FoundryParticipantForm>;
}>;

type FoundryParticipantForm = FormGroup<{
  showed_up: FormControl<boolean | null>;
  score: FormControl<number | null>;
}>;

@Component({
  selector: 'app-foundry-manage.component',
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './foundry-manage.component.html',
  styleUrl: './foundry-manage.component.scss',
})
export class FoundryManageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly foundriesService = inject(FoundriesService);
  private readonly foundryParticipantsService = inject(FoundryParticipantsService);
  readonly date = this.route.snapshot.paramMap.get('date')?.trim() ?? '';
  updating = signal(-1);
  foundries = signal<DFoundry[]>([]);

  readonly form = new FormGroup({
    date: new FormControl(this.date, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    foundries: new FormArray<FoundryForm>([]),
  });

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  /*
   * Mirror the form state into a signal so the totals
   * at the top can be computed signals.
   */
  readonly counts = computed(() => {
    const value = this.foundries();

    return value.map((p_foundry) => {
      const regular = p_foundry.foundry_participants.filter(
        (member) => !member.is_substitute,
      ).length;

      const subs = p_foundry.foundry_participants.filter((member) => member.is_substitute).length;
      const showedUp = p_foundry.foundry_participants.filter((member) => member.showed_up).length;

      return {
        regular,
        subs,
        showedUp,
        total: regular + subs,
      };
    });
  });
  readonly wins = computed(() => {
    const value = this.foundries();

    return value.map((p_foundry) => {
      return {
        isWin: (p_foundry.our_score || 0) > (p_foundry.opponent_score || 0),
        isLoss: (p_foundry.our_score || 0) < (p_foundry.opponent_score || 0),
      };
    });
  });

  constructor() {}

  async clickManage() {
    this.router.navigate(['foundries/manage-members/', this.date]);
  }

  async clickUpdate(p_index: number) {
    this.updating.set(p_index);
  }

  async clickSave(p_index: number) {
    if (p_index === -1) {
      return;
    }
    this.updating.set(-1);
    // console.log(this.form.getRawValue());
    const w_foundry = this.form.getRawValue().foundries[p_index];

    await this.foundriesService.update(this.foundries()[p_index].id, {
      opponent: w_foundry.opponent,
      opponent_score: w_foundry.opponent_score,
      our_score: w_foundry.our_score,
    });

    for (const [x_participant, w_participant] of w_foundry.foundry_participants.entries()) {
      await this.foundryParticipantsService.update(
        this.foundries()[p_index].foundry_participants[x_participant].id,
        {
          score: w_participant.score,
          showed_up: w_participant.showed_up,
        },
      );
    }
    await this.loadData();
  }

  private createParticipantForm(
    participant: DFoundry['foundry_participants'][number],
  ): FoundryParticipantForm {
    return new FormGroup({
      showed_up: new FormControl(participant.showed_up ?? null),
      score: new FormControl(participant.score ?? null),
    });
  }

  private createFoundryForm(foundry: DFoundry): FoundryForm {
    return new FormGroup({
      id: new FormControl(foundry.id ?? null),
      legion: new FormControl(foundry.legion ?? null),
      opponent: new FormControl(foundry.opponent ?? null),
      our_score: new FormControl(foundry.our_score ?? null),
      opponent_score: new FormControl(foundry.opponent_score ?? null),

      foundry_participants: new FormArray(
        foundry.foundry_participants.map((participant) => this.createParticipantForm(participant)),
      ),
    });
  }

  async loadData() {
    this.loading.set(true);
    const a_foundries = await this.foundriesService.listForDate(this.date);

    this.foundries.set(a_foundries);

    const foundriesFormArray = this.form.controls.foundries;

    foundriesFormArray.clear();

    for (const foundry of a_foundries) {
      foundriesFormArray.push(this.createFoundryForm(foundry));
    }
    this.loading.set(false);
  }

  async ngOnInit(): Promise<void> {
    this.loadData();
  }

  async dateChanged(): Promise<void> {
    this.router.navigate(['/foundries/view/', this.form.controls.date.value]);
  }
}
