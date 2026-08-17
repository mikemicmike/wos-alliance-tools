// member-details-card.component.ts

import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnInit,
  Output,
  signal,
  SimpleChanges,
} from '@angular/core';

import { MembersService } from '../../services/members.service';
import { ActivatedRoute, Router } from '@angular/router';
import { BearTimesService } from '../../services/bear-times.service';
import { StatusesService } from '../../services/statuses.service';

export interface ParticipationGroupSummary {
  total: number;
  showedUp: number;
  missed: number;
  attendancePercent: number;
}

export interface ParticipationSummary extends ParticipationGroupSummary {
  regular: ParticipationGroupSummary;
  substitute: ParticipationGroupSummary;
}

type DMember = Awaited<ReturnType<MembersService['getSingle']>>;

type DParticipation =
  DMember['foundry_participants'][number] | DMember['canyon_clash_participants'][number];
type DParticipations = DParticipation[];
type DLogEntry = DMember['member_log'][number];

@Component({
  selector: 'app-member-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './member-view.component.html',
  styleUrl: './member-view.component.scss',
})
export class MemberViewComponent implements OnInit {
  private readonly bearTimesService = inject(BearTimesService);
  private readonly statusesService = inject(StatusesService);
  private readonly membersService = inject(MembersService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly memberId = Number(this.route.snapshot.paramMap.get('id')?.trim()) ?? 0;

  private requestId = 0;

  member: Awaited<ReturnType<MembersService['getSingle']>> | null = null;

  foundrySummary = this.emptySummary();
  canyonClashSummary = this.emptySummary();

  loading = signal(false);
  errorMessage = '';
  bearTimes: Awaited<ReturnType<BearTimesService['list']>> = [];
  statuses: Awaited<ReturnType<StatusesService['list']>> = [];

  async ngOnInit() {
    await this.loadMember();
  }

  private async loadMember(): Promise<void> {
    const currentRequestId = ++this.requestId;

    this.loading.set(true);
    this.errorMessage = '';
    this.member = null;

    try {
      const member = await this.membersService.getSingle(this.memberId);
      this.bearTimes = await this.bearTimesService.list();
      this.statuses = await this.statusesService.list();

      if (currentRequestId !== this.requestId) {
        return;
      }

      this.member = member;

      this.foundrySummary = this.summarize(member.foundry_participants);

      this.canyonClashSummary = this.summarize(member.canyon_clash_participants);
    } catch (error: unknown) {
      if (currentRequestId !== this.requestId) {
        return;
      }

      console.error('Unable to load member details', error);

      this.errorMessage =
        error instanceof Error ? error.message : 'The member details could not be loaded.';
    } finally {
      if (currentRequestId === this.requestId) {
        this.loading.set(false);
      }
    }
  }

  update() {
    this.router.navigate(['member/update/', this.memberId]);
  }

  trackByParticipationId(_index: number, item: DParticipation): number {
    return item.id;
  }

  trackByLogId(_index: number, log: DLogEntry): number {
    return log.id;
  }

  previousLogValue(log: DLogEntry): string {
    return this.logValue(log.type, log.previous_value_text, log.previous_value_num);
  }

  newLogValue(log: DLogEntry): string {
    return this.logValue(log.type, log.new_value_text, log.new_value_num);
  }

  private logValue(type: string, textValue: string | null, numberValue: number | null): string {
    if (textValue !== null && textValue.trim() !== '') {
      return textValue;
    }

    if (numberValue !== null) {
      if (type === 'bear') {
        const w_bear = this.bearTimes.find((p_bearTime) => {
          return p_bearTime.id === numberValue;
        });
        return w_bear?.label || String(numberValue);
      } else if (type === 'status') {
        const w_status = this.statuses.find((p_status) => {
          return p_status.id === numberValue;
        });
        return w_status?.status || String(numberValue);
      }
      return String(numberValue);
    }

    return '—';
  }

  private summarize(participations: DParticipations): ParticipationSummary {
    const all = this.summarizeGroup(participations);

    const regular = this.summarizeGroup(participations.filter((item) => !item.is_substitute));

    const substitute = this.summarizeGroup(participations.filter((item) => item.is_substitute));

    return {
      ...all,
      regular,
      substitute,
    };
  }

  private summarizeGroup(items: DParticipations): ParticipationGroupSummary {
    const total = items.length;

    const showedUp = items.filter((item) => item.showed_up === true).length;

    const missed = total - showedUp;

    return {
      total,
      showedUp,
      missed,
      attendancePercent: total === 0 ? 0 : (showedUp / total) * 100,
    };
  }

  private emptySummary(): ParticipationSummary {
    const emptyGroup: ParticipationGroupSummary = {
      total: 0,
      showedUp: 0,
      missed: 0,
      attendancePercent: 0,
    };

    return {
      ...emptyGroup,
      regular: { ...emptyGroup },
      substitute: { ...emptyGroup },
    };
  }
}
