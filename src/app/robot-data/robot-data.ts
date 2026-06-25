import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  input,
  signal,
} from '@angular/core';
import type { RobotHardware, RobotState, TelemetryFrame } from '../models';

interface MaintenanceData {
  robotId: string;
  serviceHoursRemaining: number;
  lubricantPct: number;
  updatedAt: number;
}

@Component({
  selector: 'app-robot-data',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rd-header">
      <p class="rd-eyebrow">HARDWARE DIAGNOSTICS</p>
      <small>Real-time metrics via WebSocket · Maintenance data via REST API (10 s poll)</small>
    </div>

    <div class="rd-grid">
      @for (id of armIds; track id; let i = $index) {
        @if (robot(id); as arm) {
          <div class="rd-arm" [class.arm-b]="id === 'arm-b'">
            <div class="arm-header">
              <div class="arm-title-row">
                <div class="arm-badge" [class.b]="id === 'arm-b'">{{ id === 'arm-a' ? 'A' : 'B' }}</div>
                <div>
                  <strong>ARM {{ id === 'arm-a' ? 'A' : 'B' }} — {{ id === 'arm-a' ? 'ASSEMBLY' : 'TRANSFER' }}</strong>
                  <small>6-DOF manipulator</small>
                </div>
              </div>
              <span class="status-badge" [class]="arm.status">{{ arm.status.toUpperCase() }}</span>
            </div>

            <p class="section-tag">REAL-TIME <span class="source-badge ws">WebSocket · 10 Hz</span></p>

            <div class="hw-grid">
              <div class="hw-card" [class.warn]="arm.hardware.tempC > 65" [class.crit]="arm.hardware.tempC > 80">
                <span class="hw-label">TEMPERATURE</span>
                <div class="hw-value">
                  <strong>{{ arm.hardware.tempC | number:'1.1-1' }}</strong><span class="hw-unit">°C</span>
                </div>
                <div class="hw-bar">
                  <div class="hw-fill" [style.width.%]="pct(arm.hardware.tempC, 0, 100)"
                    [class.warn]="arm.hardware.tempC > 65" [class.crit]="arm.hardware.tempC > 80"></div>
                </div>
                <span class="hw-range">Normal &lt;65°C</span>
              </div>

              <div class="hw-card" [class.warn]="arm.hardware.currentA > 11" [class.crit]="arm.hardware.currentA > 13">
                <span class="hw-label">MOTOR CURRENT</span>
                <div class="hw-value">
                  <strong>{{ arm.hardware.currentA | number:'1.1-1' }}</strong><span class="hw-unit">A</span>
                </div>
                <div class="hw-bar">
                  <div class="hw-fill" [style.width.%]="pct(arm.hardware.currentA, 0, 15)"
                    [class.warn]="arm.hardware.currentA > 11" [class.crit]="arm.hardware.currentA > 13"></div>
                </div>
                <span class="hw-range">Normal &lt;11 A</span>
              </div>

              <div class="hw-card" [class.warn]="arm.hardware.voltageV < 46" [class.crit]="arm.hardware.voltageV < 44">
                <span class="hw-label">BUS VOLTAGE</span>
                <div class="hw-value">
                  <strong>{{ arm.hardware.voltageV | number:'1.1-1' }}</strong><span class="hw-unit">V</span>
                </div>
                <div class="hw-bar">
                  <div class="hw-fill" [style.width.%]="pct(arm.hardware.voltageV, 40, 52)"
                    [class.warn]="arm.hardware.voltageV < 46" [class.crit]="arm.hardware.voltageV < 44"></div>
                </div>
                <span class="hw-range">Normal 46–52 V</span>
              </div>

              <div class="hw-card" [class.warn]="arm.hardware.pressureBar > 200" [class.crit]="arm.hardware.pressureBar > 215">
                <span class="hw-label">HYDRAULIC PRESSURE</span>
                <div class="hw-value">
                  <strong>{{ arm.hardware.pressureBar | number:'1.0-0' }}</strong><span class="hw-unit">bar</span>
                </div>
                <div class="hw-bar">
                  <div class="hw-fill" [style.width.%]="pct(arm.hardware.pressureBar, 100, 230)"
                    [class.warn]="arm.hardware.pressureBar > 200" [class.crit]="arm.hardware.pressureBar > 215"></div>
                </div>
                <span class="hw-range">Normal &lt;200 bar</span>
              </div>
            </div>

            <p class="section-tag">MAINTENANCE <span class="source-badge rest">REST API · 10 s</span></p>

            @if (maintenance(id); as m) {
              <div class="maint-grid">
                <div class="maint-card" [class.warn]="m.serviceHoursRemaining < 100" [class.crit]="m.serviceHoursRemaining < 50">
                  <span class="maint-label">NEXT SERVICE IN</span>
                  <div class="maint-value">
                    <strong>{{ m.serviceHoursRemaining | number:'1.0-0' }}</strong><span class="maint-unit">hrs</span>
                  </div>
                </div>
                <div class="maint-card" [class.warn]="m.lubricantPct < 30" [class.crit]="m.lubricantPct < 15">
                  <span class="maint-label">LUBRICANT LEVEL</span>
                  <div class="maint-value">
                    <strong>{{ m.lubricantPct | number:'1.0-0' }}</strong><span class="maint-unit">%</span>
                  </div>
                </div>
              </div>
              <span class="updated-at">Updated {{ elapsed(m.updatedAt) }}s ago</span>
            } @else {
              <div class="maint-loading">Loading maintenance data…</div>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; padding: 0; }

    .rd-header {
      padding: 12px 20px 10px;
      border-bottom: 1px solid var(--line);
      display: flex;
      align-items: baseline;
      gap: 16px;
    }
    .rd-eyebrow { color: var(--green); font-size: 9px; letter-spacing: 0.2em; font-weight: 700; margin: 0; }
    .rd-header small { color: var(--muted); font-size: 10px; }

    .rd-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      min-height: calc(100vh - 180px);
    }

    .rd-arm {
      padding: 18px 20px 20px;
      border-right: 1px solid var(--line);
    }
    .rd-arm:last-child { border-right: none; }
    .rd-arm.arm-b { background: rgba(0,120,180,0.015); }

    .arm-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--line);
    }
    .arm-title-row { display: flex; align-items: center; gap: 10px; }
    .arm-badge {
      width: 28px; height: 28px; border-radius: 5px;
      background: #e1f5ee; color: #0f6e56;
      font-size: 13px; font-weight: 600;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .arm-badge.b { background: #e6f1fb; color: #185fa5; }
    .arm-title-row strong { display: block; font-size: 12px; letter-spacing: 0.04em; }
    .arm-title-row small { display: block; color: var(--muted); font-size: 9px; margin-top: 2px; }

    .status-badge {
      font-size: 9px; padding: 3px 8px; border-radius: 3px;
      background: rgba(0,140,112,0.1); color: var(--green);
      letter-spacing: 0.08em; font-weight: 600;
    }
    .status-badge.faulted { background: rgba(213,62,62,0.1); color: var(--red); }
    .status-badge.moving { background: rgba(199,124,0,0.1); color: var(--amber); }

    .section-tag {
      font-size: 8px; letter-spacing: 0.14em; color: var(--muted);
      margin: 14px 0 8px; font-weight: 700;
    }
    .source-badge {
      font-size: 8px; padding: 1px 6px; border-radius: 3px;
      margin-left: 6px; font-weight: 600;
    }
    .source-badge.ws { background: #e1f5ee; color: #0f6e56; }
    .source-badge.rest { background: #e6f1fb; color: #185fa5; }

    .hw-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    .hw-card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
    }
    .hw-card.warn { border-color: var(--amber); }
    .hw-card.crit { border-color: var(--red); }

    .hw-label {
      display: block; font-size: 8px; letter-spacing: 0.1em;
      color: var(--muted); margin-bottom: 6px;
    }
    .hw-value { display: flex; align-items: baseline; gap: 3px; margin-bottom: 8px; }
    .hw-value strong { font: 600 20px/1 "IBM Plex Mono", monospace; }
    .hw-unit { font-size: 10px; color: var(--muted); }
    .hw-card.warn .hw-value strong { color: var(--amber); }
    .hw-card.crit .hw-value strong { color: var(--red); }

    .hw-bar { height: 3px; background: var(--line); border-radius: 2px; margin-bottom: 5px; }
    .hw-fill { height: 100%; border-radius: 2px; background: var(--green); transition: width .2s linear; }
    .hw-fill.warn { background: var(--amber); }
    .hw-fill.crit { background: var(--red); }

    .hw-range { font-size: 8px; color: var(--muted); }

    .maint-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

    .maint-card {
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 10px 12px;
    }
    .maint-card.warn { border-color: var(--amber); }
    .maint-card.crit { border-color: var(--red); }

    .maint-label { display: block; font-size: 8px; letter-spacing: 0.1em; color: var(--muted); margin-bottom: 6px; }
    .maint-value { display: flex; align-items: baseline; gap: 3px; }
    .maint-value strong { font: 500 18px/1 "IBM Plex Mono", monospace; }
    .maint-unit { font-size: 10px; color: var(--muted); }
    .maint-card.warn .maint-value strong { color: var(--amber); }
    .maint-card.crit .maint-value strong { color: var(--red); }

    .updated-at { display: block; font-size: 9px; color: var(--muted); margin-top: 6px; }
    .maint-loading { font-size: 10px; color: var(--muted); padding: 8px 0; }
  `],
})
export class RobotData implements OnInit {
  readonly frame = input<TelemetryFrame | null>(null);

  private readonly destroyRef = inject(DestroyRef);
  private readonly now = signal(Date.now());
  private readonly maintenanceData = signal<Map<string, MaintenanceData>>(new Map());

  readonly armIds: Array<'arm-a' | 'arm-b'> = ['arm-a', 'arm-b'];

  ngOnInit(): void {
    this.fetchAllMaintenance();
    const timer = window.setInterval(() => {
      this.fetchAllMaintenance();
      this.now.set(Date.now());
    }, 10_000);
    const clockTimer = window.setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      window.clearInterval(clockTimer);
    });
  }

  robot(id: 'arm-a' | 'arm-b'): RobotState | undefined {
    return this.frame()?.robots.find((r) => r.id === id);
  }

  maintenance(id: string): MaintenanceData | undefined {
    return this.maintenanceData().get(id);
  }

  pct(value: number, min: number, max: number): number {
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  }

  elapsed(updatedAt: number): number {
    return Math.floor((this.now() - updatedAt) / 1000);
  }

  private fetchAllMaintenance(): void {
    for (const id of this.armIds) {
      fetch(`/api/robots/${id}/maintenance`)
        .then((r) => r.json() as Promise<MaintenanceData>)
        .then((data) => {
          this.maintenanceData.update((map) => new Map(map).set(id, data));
          this.now.set(Date.now());
        })
        .catch(() => {});
    }
  }
}
