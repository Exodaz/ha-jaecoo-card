import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { TeslaBase } from './tesla-base.js';

import { sharedStyles, chargerStyles } from './styles.js';
import { ICONS } from './icons.js';

class TeslaMenuCharger extends TeslaBase {

  static get properties() {
    return {
      ...super.properties,
      _pendingLimit: { state: true },
      _pendingAmps:  { state: true },
    };
  }

  static get styles() { return [sharedStyles, chargerStyles]; }

  constructor() {
    super();
    this._pendingLimit = null;
    this._pendingAmps  = null;
  }

  // ── Slider helpers ────────────────────────────────────────────────────────

  _pct(v, mn, mx) { return Math.round(((v - mn) / (mx - mn)) * 100); }

  _onLimitInput(e) {
    e.target.style.setProperty('--pct', `${this._pct(+e.target.value, +e.target.min, +e.target.max)}%`);
    this._pendingLimit = +e.target.value;
  }

  _onLimitChange(e) {
    this._pendingLimit = null;
    this._svc('number', 'set_value', this.E.CHARGE_LIMIT_NUMBER, { value: +e.target.value });
  }

  _onAmpsInput(e) {
    e.target.style.setProperty('--pct', `${this._pct(+e.target.value, +e.target.min, +e.target.max)}%`);
    this._pendingAmps = +e.target.value;
  }

  _onAmpsChange(e) {
    this._pendingAmps = null;
    this._svc('number', 'set_value', this.E.CHARGING_AMPS_NUMBER, { value: +e.target.value });
  }

  _adjustAmps(delta) {
    const step = this._nattr(this.E.CHARGING_AMPS_NUMBER, 'step') ?? 1;
    const min  = this._nattr(this.E.CHARGING_AMPS_NUMBER, 'min')  ?? 5;
    const max  = this._nattr(this.E.CHARGING_AMPS_NUMBER, 'max')  ?? 32;
    const cur  = this._pendingAmps ?? Number(this._val(this.E.CHARGING_AMPS_NUMBER) ?? 16);
    this._pendingAmps = Math.max(min, Math.min(max, cur + delta * step));
    clearTimeout(this._ampsTimer);
    this._ampsTimer = setTimeout(() => {
      this._svc('number', 'set_value', this.E.CHARGING_AMPS_NUMBER, { value: this._pendingAmps });
      this._pendingAmps = null;
    }, 800);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  render() {
    if (!this.config || !this.hass) return html``;

    const rangeRaw  = this._val(this.E.BATTERY_RANGE);
    const rangeUnit = this._attr(this.E.BATTERY_RANGE, 'unit_of_measurement') ?? 'km';
    const range     = rangeRaw != null ? `${Math.round(Number(rangeRaw))} ${rangeUnit}` : null;

    const chargerDoorOpen = this._val(this.E.CHARGER_DOOR) === 'open'
                         || this._val(this.E.PLUGGED_IN)    === 'on';

    const limitVal  = this._pendingLimit ?? Number(this._val(this.E.CHARGE_LIMIT_NUMBER) ?? 80);
    const limitMin  = this._nattr(this.E.CHARGE_LIMIT_NUMBER, 'min')  ?? 50;
    const limitMax  = this._nattr(this.E.CHARGE_LIMIT_NUMBER, 'max')  ?? 100;
    const limitStep = this._nattr(this.E.CHARGE_LIMIT_NUMBER, 'step') ?? 1;
    const limitPct  = this._pct(limitVal, limitMin, limitMax);

    const ampsVal   = this._pendingAmps ?? Number(this._val(this.E.CHARGING_AMPS_NUMBER) ?? 16);
    const ampsMin   = this._nattr(this.E.CHARGING_AMPS_NUMBER, 'min') ?? 5;
    const ampsMax   = this._nattr(this.E.CHARGING_AMPS_NUMBER, 'max') ?? 32;

    const addedRange = this._attr(this.E.ENERGY_ADDED, 'added_range');

    const hasLimit   = !!this._state(this.E.CHARGE_LIMIT_NUMBER);
    const hasAmps    = !!this._state(this.E.CHARGING_AMPS_NUMBER);
    const hasPort    = !!(this._state(this.E.CHARGE_PORT_OPEN) || this._state(this.E.CHARGER_DOOR));
    const charging   = this._val(this.E.CHARGING) === 'on';

    // Read-only info rows — only those whose entity exists and has a value
    const withUnit = (t) => {
      const v = this._val(t);
      if (v == null || v === 'unknown' || v === 'unavailable') return null;
      const u = this._attr(t, 'unit_of_measurement');
      return u ? `${v} ${u}` : this._fmt(t);
    };
    const minsLeft = Number(this._val(this.E.CHARGE_MINUTES_LEFT));
    const infoRows = !this._isCarlinko ? [] : [
      ['Status',         this._state(this.E.CHARGING_STATE) ? this._fmt(this.E.CHARGING_STATE) : null],
      ['Power',          charging ? withUnit(this.E.CHARGE_RATE) : null],
      ['Charger',        charging ? withUnit(this.E.CHARGE_MODE) : null],
      ['Time to full',   charging && isFinite(minsLeft) && minsLeft > 0
                           ? `${Math.floor(minsLeft / 60)}h ${Math.round(minsLeft % 60)}m` : null],
      ['Energy in battery', withUnit(this.E.ENERGY_LEFT)],
    ].filter(([, v]) => v != null && v !== 'unknown' && v !== 'unavailable');

    return html`
      <div class="charger-menu${this.layout === 'landscape' ? ' landscape' : ''}">

        <!-- Header: "Charging" + range subtitle -->
        <div class="panel-header">
          <button class="panel-back" @click=${this._close}>
            <span class="icon">${unsafeHTML(ICONS['chevron-left'])}</span>
          </button>
          <div class="panel-title-block">
            <span class="panel-title">Charging</span>
            ${range ? html`<span class="panel-subtitle">${range}</span>` : ''}
          </div>
        </div>

        ${infoRows.length ? html`
          <div class="chg-card">
            ${infoRows.map(([label, value]) => html`
              <div class="chg-info-row">
                <span class="chg-info-label">${label}</span>
                <span class="chg-info-value">${value}</span>
              </div>`)}
          </div>` : ''}

        <!-- Charge limit card + amps stepper -->
        ${hasLimit || hasAmps ? html`
        <div class="chg-card">
          <div class="chg-limit-header">
            <span class="chg-limit-title">Charge limit: ${limitVal}%</span>
            ${addedRange ? html`
              <p class="chg-limit-sub">${addedRange} km added during last charging session</p>` : ''}
          </div>

          <!-- Green pill slider for charge limit -->
          <input type="range" class="chg-slider" style="--pct:${limitPct}%"
            min=${limitMin} max=${limitMax} step=${limitStep}
            .value=${String(limitVal)}
            @input=${this._onLimitInput} @change=${this._onLimitChange}/>

          <!-- Amps stepper row -->
          <div class="chg-amps-row">
            <button class="chg-amps-btn"
              ?disabled=${ampsVal <= ampsMin}
              @click=${() => this._adjustAmps(-1)}>
              <span class="icon">${unsafeHTML(ICONS['chevron-left'])}</span>
            </button>
            <span class="chg-amps-value">${ampsVal} A</span>
            <button class="chg-amps-btn"
              ?disabled=${ampsVal >= ampsMax}
              @click=${() => this._adjustAmps(+1)}>
              <span class="icon">${unsafeHTML(ICONS['chevron-right'])}</span>
            </button>
          </div>
        </div>` : ''}

        <!-- Open / Close Charge Port — plain text link -->
        ${hasPort ? html`
        <button class="chg-port-btn"
          @click=${() => this._openClose(this.E.CHARGE_PORT_OPEN, this.E.CHARGE_PORT_CLOSE, chargerDoorOpen)}>
          ${chargerDoorOpen ? 'Close Charge Port' : 'Open Charge Port'}
        </button>` : ''}

        ${charging && this._state(this.E.CHARGE_STOP) ? html`
        <button class="chg-port-btn"
          @click=${() => this._svc('button', 'press', this.E.CHARGE_STOP)}>
          Stop Charging
        </button>` : ''}

      </div>
    `;
  }
}

customElements.define('jaecoo-menu-charger', TeslaMenuCharger);
