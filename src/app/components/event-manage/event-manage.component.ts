import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';

import { LocalTimePipe } from '../../defs/local-time';
import { injectEventKind } from '../../defs/event-kind';
import { HasUnsavedChanges, warnBeforeUnload } from '../../guards/unsaved-changes.guard';
import { SupabaseService } from '../../services/supabase.service';
import { downloadFile, rosterCsv, rosterText } from '../../defs/event-export';
import {
  assignLegionSlots,
  DEvent,
  DEventParticipant,
  eventPlacement,
  EventsService,
} from '../../services/events.service';

type ParticipantForm = FormGroup<{
  showed_up: FormControl<boolean | null>;
  score: FormControl<number | null>;
  notes: FormControl<string | null>;
}>;

type EventForm = FormGroup<{
  our_score: FormControl<number | null>;
  opponent: FormControl<string | null>;
  opponent_score: FormControl<number | null>;
  opponent_2: FormControl<string | null>;
  opponent_2_score: FormControl<number | null>;
  participants: FormArray<ParticipantForm>;
}>;

@Component({
  selector: 'app-event-manage',
  imports: [ReactiveFormsModule, DecimalPipe, LocalTimePipe],
  templateUrl: './event-manage.component.html',
  styleUrl: './event-manage.component.scss',
})
export class EventManageComponent implements HasUnsavedChanges {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventsService = inject(EventsService);
  readonly isAdmin = inject(SupabaseService).isAdminUser;

  readonly config = injectEventKind();
  readonly date = this.route.snapshot.paramMap.get('date')?.trim() ?? '';

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly compact = signal(false);
  readonly copied = signal(false);

  readonly events = signal<DEvent[]>([]);

  private readonly legionSlots = computed(() => assignLegionSlots(this.events()));
  /** L1 then L2; anything else on this date is an "extra" that probably needs deleting. */
  readonly slotted = computed(() =>
    this.legionSlots().slots.filter((p_event): p_event is DEvent => !!p_event),
  );
  readonly extras = computed(() => this.legionSlots().extras);
  readonly displayEvents = computed(() => [...this.slotted(), ...this.extras()]);

  readonly editingId = signal<number | null>(null);
  editForm: EventForm | null = null;

  /** An open "Results & attendance" edit with changes in it. */
  hasUnsavedChanges(): boolean {
    return this.editingId() !== null && !!this.editForm?.dirty;
  }

  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event: BeforeUnloadEvent): void {
    warnBeforeUnload(this, event);
  }

  counts(p_event: DEvent) {
    const participants = p_event.participants;
    const regular = participants.filter((p) => !p.is_substitute).length;
    return {
      regular,
      subs: participants.length - regular,
      registered: participants.filter((p) => p.registered).length,
      showedUp: participants.filter((p) => p.showed_up).length,
      total: participants.length,
    };
  }

  placement(p_event: DEvent): number | null {
    return eventPlacement(p_event);
  }

  regulars(p_event: DEvent): DEventParticipant[] {
    return p_event.participants.filter((p) => !p.is_substitute);
  }

  subs(p_event: DEvent): DEventParticipant[] {
    return p_event.participants.filter((p) => p.is_substitute);
  }

  clickManage(): void {
    void this.router.navigate([this.config.path, 'manage-members', this.date]);
  }

  clickBack(): void {
    void this.router.navigate([this.config.path]);
  }

  startEdit(p_event: DEvent): void {
    this.editForm = new FormGroup({
      our_score: new FormControl(p_event.our_score),
      opponent: new FormControl(p_event.opponent),
      opponent_score: new FormControl(p_event.opponent_score),
      opponent_2: new FormControl(p_event.opponent_2),
      opponent_2_score: new FormControl(p_event.opponent_2_score),
      participants: new FormArray(
        p_event.participants.map(
          (p_participant) =>
            new FormGroup({
              showed_up: new FormControl(p_participant.showed_up),
              score: new FormControl(p_participant.score),
              notes: new FormControl(p_participant.notes),
            }),
        ),
      ),
    });
    this.editingId.set(p_event.id);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editForm = null;
  }

  /** Quick "everyone showed up" before ticking off the no-shows. */
  markAllShowed(p_value: boolean): void {
    for (const w_group of this.editForm?.controls.participants.controls ?? []) {
      w_group.controls.showed_up.setValue(p_value);
    }
  }

  async saveEdit(p_event: DEvent): Promise<void> {
    if (!this.editForm) {
      return;
    }
    const value = this.editForm.getRawValue();

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.eventsService.updateEvent(this.config.kind, p_event.id, {
        our_score: value.our_score,
        opponent: value.opponent?.trim() || null,
        opponent_score: value.opponent_score,
        opponent_2: value.opponent_2?.trim() || null,
        opponent_2_score: value.opponent_2_score,
      });

      for (const [x_participant, w_participant] of p_event.participants.entries()) {
        const w_value = value.participants[x_participant];
        const notes = w_value.notes?.trim() || null;
        if (
          w_value.showed_up !== w_participant.showed_up ||
          w_value.score !== w_participant.score ||
          notes !== w_participant.notes
        ) {
          await this.eventsService.updateParticipant(this.config.kind, w_participant.id, {
            showed_up: w_value.showed_up,
            score: w_value.score,
            notes,
          });
        }
      }

      this.cancelEdit();
      await this.loadData();
    } catch (error) {
      console.error(error);
      this.error.set(error instanceof Error ? error.message : 'Unable to save.');
    } finally {
      this.saving.set(false);
    }
  }

  /** Saved immediately - this is ticked off while registering people in game. */
  async toggleRegistered(p_participant: DEventParticipant, p_value: boolean): Promise<void> {
    this.setParticipant(p_participant.id, { registered: p_value });
    try {
      await this.eventsService.updateParticipant(this.config.kind, p_participant.id, {
        registered: p_value,
      });
    } catch (error) {
      this.setParticipant(p_participant.id, { registered: !p_value });
      this.error.set(error instanceof Error ? error.message : 'Unable to save.');
    }
  }

  async deleteEvent(p_event: DEvent): Promise<void> {
    const confirmed = confirm(
      `Delete ${this.config.label} Legion ${p_event.legion} (${p_event.time || 'no time'}) on ${p_event.date}` +
        ` and its ${p_event.participants.length} registrations? This cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    try {
      await this.eventsService.removeEvent(this.config.kind, p_event.id);
      await this.loadData();
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to delete.');
    } finally {
      this.saving.set(false);
    }
  }

  async copyRoster(): Promise<void> {
    await navigator.clipboard.writeText(rosterText(this.config, this.date, this.slotted()));
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 2000);
  }

  downloadCsv(): void {
    downloadFile(
      `${this.config.kind}-${this.date}.csv`,
      rosterCsv(this.date, this.displayEvents()),
    );
  }

  private setParticipant(p_id: number, p_changes: Partial<DEventParticipant>): void {
    this.events.update((events) =>
      events.map((p_event) => ({
        ...p_event,
        participants: p_event.participants.map((p) => (p.id === p_id ? { ...p, ...p_changes } : p)),
      })),
    );
  }

  async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      this.events.set(await this.eventsService.listForDate(this.config.kind, this.date));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Unable to load.');
    } finally {
      this.loading.set(false);
    }
  }

  async ngOnInit(): Promise<void> {
    await this.loadData();
  }
}
