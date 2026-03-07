import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig } from '../src/lib/config.js';

describe('getConfig', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    // Clean slate for each test
    delete process.env.VELO_DEV_REPO;
    delete process.env.VELO_PROD_REPO;
  });

  afterEach(() => {
    // Restore original env
    process.env = { ...origEnv };
  });

  it('reads VELO_DEV_REPO and VELO_PROD_REPO from env', () => {
    process.env.VELO_DEV_REPO = '/path/to/dev';
    process.env.VELO_PROD_REPO = '/path/to/prod';
    const config = getConfig();
    expect(config.devRepo).toBe('/path/to/dev');
    expect(config.prodRepo).toBe('/path/to/prod');
  });

  it('throws if VELO_DEV_REPO is missing', () => {
    process.env.VELO_PROD_REPO = '/path/to/prod';
    expect(() => getConfig()).toThrow('VELO_DEV_REPO');
  });

  it('throws if VELO_PROD_REPO is missing', () => {
    process.env.VELO_DEV_REPO = '/path/to/dev';
    expect(() => getConfig()).toThrow('VELO_PROD_REPO');
  });

  it('throws if both are missing', () => {
    expect(() => getConfig()).toThrow();
  });

  it('throws if VELO_DEV_REPO is empty string', () => {
    process.env.VELO_DEV_REPO = '';
    process.env.VELO_PROD_REPO = '/path/to/prod';
    expect(() => getConfig()).toThrow('VELO_DEV_REPO');
  });

  it('throws if VELO_PROD_REPO is empty string', () => {
    process.env.VELO_DEV_REPO = '/path/to/dev';
    process.env.VELO_PROD_REPO = '';
    expect(() => getConfig()).toThrow('VELO_PROD_REPO');
  });

  it('trims whitespace from paths', () => {
    process.env.VELO_DEV_REPO = '  /path/to/dev  ';
    process.env.VELO_PROD_REPO = '  /path/to/prod  ';
    const config = getConfig();
    expect(config.devRepo).toBe('/path/to/dev');
    expect(config.prodRepo).toBe('/path/to/prod');
  });
});
