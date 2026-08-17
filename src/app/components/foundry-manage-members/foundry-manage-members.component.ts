import { DecimalPipe, Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { FoundriesService } from '../../services/foundries.service';
import { MembersService } from '../../services/members.service';
import { DropdownFoundryTimesComponent } from '../dropdown-foundry-times/dropdown-foundry-times.component';
import { form, FormField } from '@angular/forms/signals';
import { DropdownLegionsComponent } from '../dropdown-legions/dropdown-legions.component';

type DMember = {
  memberId: number;
  name: string;
  previousPower: number | null;
  previousPowerDate: string | null;
  power: number | null;
  assignments: {
    regular: boolean;
    sub: boolean;
  }[];
};

type DFormModel = {
  date: string;
  foundries: Awaited<ReturnType<FoundriesService['listForDate']>>;
  members: DMember[];
};

@Component({
  selector: 'app-foundry-manage-members',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DecimalPipe,
    DropdownFoundryTimesComponent,
    FormField,
    DropdownLegionsComponent,
  ],
  templateUrl: './foundry-manage-members.component.html',
  styleUrl: './foundry-manage-members.component.scss',
})
export class FoundryManageMembersComponent {
  private readonly locationService = inject(Location);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly foundriesService = inject(FoundriesService);
  private readonly membersService = inject(MembersService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  foundriesModel = signal<DFormModel>({
    date: this.route.snapshot.paramMap.get('date')?.trim() ?? '',
    foundries: [],
    members: [],
  });

  foundriesForm = form(this.foundriesModel);

  /*
   * Mirror the form state into a signal so the totals
   * at the top can be computed signals.
   */

  readonly counts = computed(() => {
    const value = this.foundriesModel();

    return value.foundries.map((_, foundryIndex) => {
      const regular = value.members.filter(
        (member) => member.assignments[foundryIndex]?.regular,
      ).length;

      const subs = value.members.filter((member) => member.assignments[foundryIndex]?.sub).length;

      return {
        regular,
        subs,
        total: regular + subs,
      };
    });
  });

  constructor() {}

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }

  async loadData(): Promise<void> {
    this.loading.set(true);

    const date = this.foundriesModel().date;

    const members = await this.membersService.getActiveMembers();
    const foundries = await this.foundriesService.listForDate(date);

    while (foundries.length < 2) {
      foundries.push({
        date: date,
        created_at: '',
        foundry_participants: [],
        id: 0,
        legion: 0,
        notes: '',
        opponent: '',
        opponent_score: 0,
        our_score: 0,
        status: '',
        time: '',
      });
    }
    try {
      this.foundriesModel.set({
        date: date,
        foundries: foundries,
        members: members.map((p_member) => {
          let w_participation = null;
          for (const [x_foundry, w_foundry] of foundries.entries()) {
            w_participation =
              w_participation ||
              w_foundry.foundry_participants.find(
                (p_participation) => p_participation.member_id === p_member.id,
              );
          }
          return {
            memberId: p_member.id,
            name: p_member.name,
            previousPower: p_member.foundry_participants[0]?.power,
            previousPowerDate: p_member.foundry_participants[0]?.foundries?.date,
            power: w_participation?.power || null,
            assignments: foundries.map((p_foundry) => {
              const w_participationLocal = p_foundry.foundry_participants.find(
                (p_participation) => p_participation.member_id === p_member.id,
              );
              return {
                regular: w_participationLocal ? !w_participationLocal.is_substitute : false,
                sub: w_participationLocal ? w_participationLocal.is_substitute || false : false,
              };
            }),
          };
        }),
      });
    } catch (error) {
      console.error(error);

      this.error.set('Unable to load previous power values.');
    }

    if (!date) {
      return;
    }

    this.loading.set(false);
  }
  async dateChanged(): Promise<void> {
    await this.loadData();
  }

  assignmentChanged(
    p_memberIndex: number,
    p_foundryIndex: number,
    p_type: 'reg' | 'sub',
    p_value: boolean,
  ): void {
    this.foundriesModel.update((model) => ({
      ...model,
      members: model.members.map((member, memberIndex) => {
        if (memberIndex !== p_memberIndex) {
          return member;
        }

        return {
          ...member,
          assignments: member.assignments.map((assignment, foundryIndex) => {
            // Clear every other foundry
            if (foundryIndex !== p_foundryIndex) {
              return {
                ...assignment,
                regular: false,
                sub: false,
              };
            }

            // Update selected foundry
            return p_type === 'reg'
              ? {
                  ...assignment,
                  regular: p_value,
                  sub: false,
                }
              : {
                  ...assignment,
                  regular: false,
                  sub: p_value,
                };
          }),
        };
      }),
    }));
  }

  async save(): Promise<void> {
    this.error.set(null);

    const value = this.foundriesModel();

    const times = value.foundries.map((foundry) => foundry.time.trim());

    if (new Set(times.map((x) => x.toLowerCase())).size !== times.length) {
      this.error.set('Each Foundry must have a different time label.');
      return;
    }

    this.saving.set(true);

    try {
      await this.foundriesService.updateDay({
        date: value.date,
        foundries: value.foundries.map((p_foundry, p_foundryIndex) => {
          return {
            id: p_foundry.id,
            time: p_foundry.time,
            legion: p_foundry.legion,
            participants: value.members
              .filter((p_member) => {
                return (
                  p_member.assignments[p_foundryIndex].regular ||
                  p_member.assignments[p_foundryIndex].sub
                );
              })
              .map((p_participant) => {
                return {
                  member_id: p_participant.memberId,
                  is_substitute: p_participant.assignments[p_foundryIndex].sub,
                  power: p_participant.power,
                };
              }),
          };
        }),
      });

      try {
        this.locationService.back();
      } catch (error) {
        await this.router.navigate(['/foundries/list']);
      }
    } catch (error) {
      console.error(error);

      this.error.set(error instanceof Error ? error.message : 'Unable to save Foundries.');
    } finally {
      this.saving.set(false);
    }
  }

  cancel(): void {
    void this.router.navigate(['/foundries/list']);
  }
}
