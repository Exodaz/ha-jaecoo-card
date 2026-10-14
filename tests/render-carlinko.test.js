// @vitest-environment happy-dom
import { describe, it, expect, beforeAll } from 'vitest';

// Minimal CarLinko hass mock — entity IDs deliberately unrelated to translation keys
const reg = {};
const states = {};
const add = (domain, key, state, attributes = {}) => {
  const entity_id = `${domain}.kk_1234_${key}_x`;
  reg[entity_id] = { entity_id, platform: 'carlinko', translation_key: key, device_id: 'j5' };
  states[entity_id] = { entity_id, state, attributes };
};
add('sensor', 'battery', '78', { unit_of_measurement: '%' });
add('sensor', 'range', '312', { unit_of_measurement: 'km' });
add('binary_sensor', 'online', 'on');
add('binary_sensor', 'charging', 'off');
add('binary_sensor', 'door_driver', 'on');
add('binary_sensor', 'door_passenger', 'off');
add('lock', 'lock', 'locked');
add('cover', 'liftgate', 'closed');
add('sensor', 'volt12', '12.6', { unit_of_measurement: 'V' });
add('sensor', 'volt12_status', 'ok');
add('sensor', 'tyre_status', 'normal');

const calls = [];
const hass = {
  states, entities: reg, devices: { j5: { name: 'KK 1234' } },
  formatEntityState: (st) => ({ ok: 'OK', normal: 'Normal' }[st.state] ?? st.state),
  callService: async (...args) => { calls.push(args); },
};

const settle = async (el) => { await el.updateComplete; await new Promise(r => setTimeout(r, 0)); };

describe('jaecoo-card landing + security (CarLinko)', () => {
  let card;
  beforeAll(async () => {
    customElements.define('ha-card', class extends HTMLElement {});
    await import('../src/tesla-card.js');
    card = document.createElement('jaecoo-card');
    card.setConfig({ type: 'custom:jaecoo-card' });
    card.hass = hass;
    document.body.appendChild(card);
    await settle(card);
  });

  it('shows the device name and a Security row with lock + open door', () => {
    const root = card.shadowRoot;
    expect(root.querySelector('.car-name').textContent).toBe('KK 1234');
    const labels = [...root.querySelectorAll('.nav-label')].map(e => e.textContent);
    expect(labels).toEqual(['Controls', 'Climate', 'Charging', 'Security']);
    const sec = [...root.querySelectorAll('.nav-row')].find(r => r.textContent.includes('Security'));
    expect(sec.querySelector('.nav-sublabel').textContent).toBe('Locked · Driver door open');
  });

  it('opens the Security panel with openings and vehicle status', async () => {
    const root = card.shadowRoot;
    [...root.querySelectorAll('.nav-row')].find(r => r.textContent.includes('Security')).click();
    await settle(card);
    const menu = root.querySelector('jaecoo-menu-security');
    await settle(menu);
    const rows = [...menu.shadowRoot.querySelectorAll('.chg-info-row')]
      .map(r => r.textContent.replace(/\s+/g, ' ').trim());
    expect(rows).toEqual([
      'Driver door Open', 'Passenger door Closed', 'Liftgate Closed',
      'Connection Online', '12V battery 12.6 V · OK', 'Tyres Normal',
    ]);
    menu.shadowRoot.querySelector('.sec-lock-btn').click();
    expect(calls.at(-1)).toEqual(['lock', 'unlock', { entity_id: 'lock.kk_1234_lock_x' }]);
  });
});
