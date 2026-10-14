import { html } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { TeslaBase } from './tesla-base.js';

import { sharedStyles, chargerStyles, securityStyles } from './styles.js';
import { ICONS } from './icons.js';

// Values that mean "no data" — such rows are hidden
const NO_VALUE = new Set([undefined, null, 'unknown', 'unavailable']);

class TeslaMenuSecurity extends TeslaBase {

  static get styles() { return [sharedStyles, chargerStyles, securityStyles]; }

  /** [label, entity template] for every opening the car reports */
  get _openings() {
    return [
      ['Driver door',     this.E.DOOR_DRIVER_FRONT],
      ['Passenger door',  this.E.DOOR_PASSENGER_FRONT],
      ['Rear left door',  this.E.DOOR_DRIVER_REAR],
      ['Rear right door', this.E.DOOR_PASSENGER_REAR],
      ['Liftgate',        this.E.OPEN_TRUNK],
      ['Windows',         this.E.WINDOWS_COVER],
      ['Sunroof',         this.E.SUNROOF_COVER],
    ].filter(([, t]) => !NO_VALUE.has(this._val(t)));
  }

  _isOpen(t) {
    const v = this._val(t);
    return v === 'on' || v === 'open' || v === 'opening';
  }

  render() {
    if (!this.config || !this.hass) return html``;

    const lockState = this._val(this.E.DOOR_LOCK);
    const isLocked  = lockState === 'locked';
    const hasLock   = !NO_VALUE.has(lockState);

    const openings = this._openings;

    const withUnit = (t) => {
      const v = this._val(t);
      if (NO_VALUE.has(v)) return null;
      const u = this._attr(t, 'unit_of_measurement');
      return u ? `${v} ${u}` : this._fmt(t);
    };
    const online      = this._val(this.E.ONLINE);
    const volt12      = withUnit(this.E.BATTERY_12V);
    const volt12State = this._val(this.E.BATTERY_12V_STATUS);
    const tyreState   = this._val(this.E.TYRE_STATUS);
    const vehicleRows = [
      ['Connection', NO_VALUE.has(online) ? null : online === 'on' ? 'Online' : 'Offline', online !== 'on'],
      ['12V battery', [volt12, NO_VALUE.has(volt12State) ? null : this._fmt(this.E.BATTERY_12V_STATUS)]
        .filter(Boolean).join(' · ') || null, volt12State && volt12State !== 'ok'],
      ['Tyres', NO_VALUE.has(tyreState) ? null : this._fmt(this.E.TYRE_STATUS), tyreState && tyreState !== 'normal'],
    ].filter(([, v]) => v);

    return html`
      <div class="security-menu${this.layout === 'landscape' ? ' landscape' : ''}">
        <div class="panel-header">
          <button class="panel-back" @click=${this._close}>
            <span class="icon">${unsafeHTML(ICONS['chevron-left'])}</span>
          </button>
          <span class="panel-title">Security</span>
        </div>

        ${hasLock ? html`
          <button class="sec-lock-btn ${isLocked ? 'locked' : 'unlocked'}"
            @click=${() => this._svc('lock', isLocked ? 'unlock' : 'lock', this.E.DOOR_LOCK)}>
            <span class="icon">${unsafeHTML(isLocked ? ICONS.lock : ICONS.unlock)}</span>
            <span>${isLocked ? 'Locked — tap to unlock' : 'Unlocked — tap to lock'}</span>
          </button>` : ''}

        ${openings.length ? html`
          <div class="sec-section-title">Doors &amp; openings</div>
          <div class="chg-card">
            ${openings.map(([label, t]) => {
              const open = this._isOpen(t);
              return html`
                <div class="chg-info-row">
                  <span class="chg-info-label">${label}</span>
                  <span class="chg-info-value ${open ? 'warn' : 'ok'}">${open ? 'Open' : 'Closed'}</span>
                </div>`;
            })}
          </div>` : ''}

        ${vehicleRows.length ? html`
          <div class="sec-section-title">Vehicle</div>
          <div class="chg-card">
            ${vehicleRows.map(([label, value, warn]) => html`
              <div class="chg-info-row">
                <span class="chg-info-label">${label}</span>
                <span class="chg-info-value ${warn ? 'warn' : 'ok'}">${value}</span>
              </div>`)}
          </div>` : ''}
      </div>
    `;
  }
}

customElements.define('jaecoo-menu-security', TeslaMenuSecurity);
