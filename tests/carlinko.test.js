import { describe, it, expect } from 'vitest';
import {
  getEntities, isCarlinkoTemplate, resolveCarlinkoId, carlinkoDevices,
} from '../src/entity-config.js';

// Entity IDs follow the plate number / HA language, so they are deliberately
// unrelated to the translation keys here.
const entity = (entity_id, translation_key, device_id = 'dev1') =>
  ({ entity_id, translation_key, device_id, platform: 'carlinko' });

const hass = {
  entities: {
    'sensor.kk_1234_batteri':      entity('sensor.kk_1234_batteri', 'battery'),
    'lock.kk_1234_lak':            entity('lock.kk_1234_lak', 'lock'),
    'switch.kk_1234_steer':        entity('switch.kk_1234_steer', 'steer_heat'),
    'sensor.kk_1234_charge_state': entity('sensor.kk_1234_charge_state', 'charge_state'),
    // Same translation_key on another platform must be ignored
    'sensor.phone_battery': { entity_id: 'sensor.phone_battery', translation_key: 'battery', device_id: 'phone', platform: 'mobile_app' },
    // Second car
    'sensor.zz_9_battery':         entity('sensor.zz_9_battery', 'battery', 'dev2'),
  },
  devices: {
    dev1: { name: 'KK 1234' },
    dev2: { name: 'ZZ 9', name_by_user: 'Second J5' },
  },
};

describe('CarLinko entity map', () => {
  const E = getEntities('carlinko');

  it('uses translation-key templates', () => {
    expect(isCarlinkoTemplate(E.BATTERY_LEVEL)).toBe(true);
    expect(isCarlinkoTemplate(getEntities('fleet').BATTERY_LEVEL)).toBe(false);
    expect(isCarlinkoTemplate(null)).toBe(false);
  });

  it('keeps the domain prefix so service routing works', () => {
    expect(E.DOOR_LOCK.split('.')[0]).toBe('lock');
    expect(E.STEERING_WHEEL_HEATER.split('.')[0]).toBe('switch');
    expect(E.OPEN_TRUNK.split('.')[0]).toBe('cover');
  });
});

describe('resolveCarlinkoId', () => {
  const E = getEntities('carlinko');

  it('resolves by translation_key for the selected device', () => {
    expect(resolveCarlinkoId(E.BATTERY_LEVEL, hass, 'dev1')).toBe('sensor.kk_1234_batteri');
    expect(resolveCarlinkoId(E.BATTERY_LEVEL, hass, 'dev2')).toBe('sensor.zz_9_battery');
    expect(resolveCarlinkoId(E.DOOR_LOCK, hass, 'dev1')).toBe('lock.kk_1234_lak');
  });

  it('falls back to the first vehicle (sorted by name) when no device is set', () => {
    expect(resolveCarlinkoId(E.BATTERY_LEVEL, hass)).toBe('sensor.kk_1234_batteri');
  });

  it('returns null for missing entities, null templates and no hass', () => {
    expect(resolveCarlinkoId(E.CLIMATE, hass, 'dev1')).toBeNull();
    expect(resolveCarlinkoId(E.HORN, hass, 'dev1')).toBeNull();
    expect(resolveCarlinkoId(E.BATTERY_LEVEL, undefined)).toBeNull();
  });

  it('honours entity_overrides by canonical key', () => {
    expect(resolveCarlinkoId(E.BATTERY_LEVEL, hass, 'dev1', { BATTERY_LEVEL: 'sensor.x' })).toBe('sensor.x');
  });

  it('does not match the same key on other platforms', () => {
    const only = { entities: { 'sensor.phone_battery': hass.entities['sensor.phone_battery'] } };
    expect(resolveCarlinkoId(E.BATTERY_LEVEL, only)).toBeNull();
  });
});

describe('carlinkoDevices', () => {
  it('lists CarLinko vehicles with user names preferred', () => {
    expect(carlinkoDevices(hass)).toEqual([
      { id: 'dev1', name: 'KK 1234' },
      { id: 'dev2', name: 'Second J5' },
    ]);
  });

  it('is empty without hass', () => {
    expect(carlinkoDevices(undefined)).toEqual([]);
  });
});
