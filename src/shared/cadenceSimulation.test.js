import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request, BeaconApiError } from './BeaconClient/core/request.js';
import {
  simulationEnvironment,
  listExercises,
  fetchResourceLocations,
  isSimulationUnavailable,
  SimulationFeedError,
  exerciseDisplayName,
  simulationLabel,
  sameSimulation,
  selectionForHq,
} from './cadenceSimulation.js';

vi.mock('./BeaconClient/core/request.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, request: vi.fn() };
});

const FEED = 'https://api.dev.cadence-extension.com/v1';
const TRAIN = { host: 'https://apitrainbeacon.ses.nsw.gov.au', token: 'train-token' };
const TEST = { host: 'https://apitestbeacon.ses.nsw.gov.au', token: 'test-token' };
const PROD = { host: 'https://apibeacon.ses.nsw.gov.au', token: 'prod-token' };

// Shaped like the CADence backend's feed (every value invented).
const feature = (name, extra = {}) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [151.1, -33.9] },
  properties: {
    id: `cadence-ex1-individual-${name}`,
    name,
    entity: 'Demo City',
    capability: 'General Purpose',
    resourceType: 'Vehicle',
    lastSeen: '2026-10-15T01:23:45.000Z',
    direction: 90,
    talkgroup: 'CADence exercise',
    talkgroupLastUpdated: '2026-10-15T01:23:45.000Z',
    radioId: '',
    licensePlate: 'SIM',
    ...extra,
  },
});

beforeEach(() => {
  vi.mocked(request).mockReset();
});

describe('simulationEnvironment', () => {
  it('offers Train and Test Beacon, by API host or site origin', () => {
    expect(simulationEnvironment('https://apitrainbeacon.ses.nsw.gov.au')?.env).toBe('train');
    expect(simulationEnvironment('https://trainbeacon.ses.nsw.gov.au')?.env).toBe('train');
    expect(simulationEnvironment('https://apitestbeacon.ses.nsw.gov.au')?.env).toBe('test');
    expect(simulationEnvironment('https://testbeacon.ses.nsw.gov.au')?.env).toBe('test');
  });

  it('ignores a trailing slash or path', () => {
    expect(simulationEnvironment('https://apitrainbeacon.ses.nsw.gov.au/')?.env).toBe('train');
    expect(simulationEnvironment('https://trainbeacon.ses.nsw.gov.au/Jobs/Tasking')?.env).toBe('train');
  });

  it('never offers production or the other Beacon environments', () => {
    [
      'https://apibeacon.ses.nsw.gov.au',
      'https://beacon.ses.nsw.gov.au',
      'https://previewbeacon.ses.nsw.gov.au',
      'https://devbeacon.ses.nsw.gov.au',
      'https://testbeaconau.ses.nsw.gov.au',
      'http://apitrainbeacon.ses.nsw.gov.au',
      'https://apitrainbeacon.ses.nsw.gov.au.example.com',
      'https://beacon.test',
      '',
      null,
      undefined,
      'not a url',
    ].forEach((host) => expect(simulationEnvironment(host)).toBeNull());
  });
});

describe('listExercises', () => {
  it('lists the active exercises with the member token as the bearer', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      exercises: [
        {
          exerciseId: 'ex1',
          name: 'Demo storm night',
          mode: 'group',
          createdAt: '2026-10-15T09:00:00.000Z',
          copies: [
            { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
            { copyId: '102', participantHqId: 102, participantHqName: 'Demo Vale' },
          ],
        },
      ],
    });

    const list = await listExercises(TRAIN);

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(`${FEED}/feed/exercises`, { token: 'train-token', signal: undefined });
    expect(list).toEqual([
      {
        exerciseId: 'ex1',
        name: 'Demo storm night',
        mode: 'group',
        createdAt: '2026-10-15T09:00:00.000Z',
        copies: [
          { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
          { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
        ],
      },
    ]);
  });

  it('works on Test Beacon too', async () => {
    vi.mocked(request).mockResolvedValueOnce({ exercises: [] });
    await expect(listExercises(TEST)).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith(`${FEED}/feed/exercises`, { token: 'test-token', signal: undefined });
  });

  it('drops malformed entries, copies without an HQ, and exercises left with no copies', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      exercises: [
        null,
        { name: 'no id', copies: [{ copyId: 'individual', participantHqId: '101' }] },
        { exerciseId: 'ex2', name: 'no copies', copies: [] },
        { exerciseId: 'ex3', copies: [{ participantHqId: '101', participantHqName: 'copy without an id' }] },
        { exerciseId: 'ex4', copies: [{ copyId: 'individual', participantHqId: 101, participantHqName: 'Demo City' }] },
        { exerciseId: 'ex5', copies: [{ copyId: 'individual', participantHqName: 'copy without an HQ' }] },
        {
          exerciseId: 'ex6',
          mode: 'group',
          copies: [
            { copyId: '101', participantHqId: '', participantHqName: 'Demo City' },
            { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
          ],
        },
      ],
    });
    const list = await listExercises(TRAIN);
    expect(list.map((e) => e.exerciseId)).toEqual(['ex4', 'ex6']);
    expect(list[0]).toMatchObject({ name: '', mode: 'individual', createdAt: '' });
    expect(list[0].copies).toEqual([{ copyId: 'individual', participantHqId: '101', participantHqName: 'Demo City' }]);
    expect(list[1].copies.map((c) => c.copyId)).toEqual(['102']);
  });

  it('copes with a body that is not the expected shape', async () => {
    vi.mocked(request).mockResolvedValueOnce('oops');
    await expect(listExercises(TRAIN)).resolves.toEqual([]);
  });

  it('refuses production without calling the backend', async () => {
    const err = await listExercises(PROD).catch((e) => e);
    expect(isSimulationUnavailable(err)).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  it.each([401, 403])('treats a %i from the backend as unavailable', async (status) => {
    vi.mocked(request).mockRejectedValueOnce(new BeaconApiError(status, 'Forbidden', `${FEED}/feed/exercises`, ''));
    const err = await listExercises(TRAIN).catch((e) => e);
    expect(err).toBeInstanceOf(SimulationFeedError);
    expect(err.status).toBe(status);
    expect(isSimulationUnavailable(err)).toBe(true);
  });

  it('keeps other failures retryable', async () => {
    vi.mocked(request).mockRejectedValueOnce(new BeaconApiError(502, 'Bad Gateway', `${FEED}/feed/exercises`, ''));
    const serverError = await listExercises(TRAIN).catch((e) => e);
    expect(serverError).toBeInstanceOf(SimulationFeedError);
    expect(serverError.status).toBe(502);
    expect(isSimulationUnavailable(serverError)).toBe(false);

    vi.mocked(request).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const networkError = await listExercises(TRAIN).catch((e) => e);
    expect(networkError.status).toBeNull();
    expect(isSimulationUnavailable(networkError)).toBe(false);
  });

  it('passes an abort straight through', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    vi.mocked(request).mockRejectedValueOnce(abort);
    await expect(listExercises(TRAIN)).rejects.toBe(abort);
  });
});

describe('fetchResourceLocations', () => {
  it('reads one copy of an exercise, ids encoded into the path', async () => {
    vi.mocked(request).mockResolvedValueOnce([feature('DMC56'), feature('DMC711', { resourceType: 'Vessel' })]);
    const signal = new AbortController().signal;

    const features = await fetchResourceLocations({ exerciseId: 'ex/1', copyId: '10 1' }, { ...TRAIN, signal });

    expect(request).toHaveBeenCalledWith(`${FEED}/feed/exercises/ex%2F1/copies/10%201/resource-locations`, {
      token: 'train-token',
      signal,
    });
    expect(features.map((f) => f.properties.name)).toEqual(['DMC56', 'DMC711']);
  });

  it('returns [] for an ended or unpublished exercise', async () => {
    vi.mocked(request).mockResolvedValueOnce([]);
    await expect(fetchResourceLocations({ exerciseId: 'ex1', copyId: 'individual' }, TRAIN)).resolves.toEqual([]);
  });

  it('drops features it could not draw or match', async () => {
    const noGeometry = feature('DMC57');
    delete noGeometry.geometry;
    const noName = feature('DMC58');
    delete noName.properties.name;
    vi.mocked(request).mockResolvedValueOnce([null, noGeometry, noName, feature('DMC56')]);
    const features = await fetchResourceLocations({ exerciseId: 'ex1', copyId: 'individual' }, TRAIN);
    expect(features.map((f) => f.properties.name)).toEqual(['DMC56']);
  });

  it('needs a complete selection', async () => {
    const err = await fetchResourceLocations({ exerciseId: 'ex1' }, TRAIN).catch((e) => e);
    expect(isSimulationUnavailable(err)).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });

  // The job map and the situational awareness popups build HTML from these.
  it('strips characters that mean something in HTML from the text it passes on', async () => {
    vi.mocked(request).mockResolvedValueOnce([
      feature('DMC56<img src=x onerror=alert(1)>', {
        entity: 'Demo & "City"',
        talkgroup: "it's `live`",
        nested: { html: '<b>' },
        list: ['<b>'],
      }),
    ]);

    const [f] = await fetchResourceLocations({ exerciseId: 'ex1', copyId: 'individual' }, TRAIN);

    expect(f.properties.name).toBe('DMC56img src=x onerror=alert(1)');
    expect(f.properties.entity).toBe('Demo  City');
    expect(f.properties.talkgroup).toBe('its live');
    expect(f.properties.direction).toBe(90);
    expect(f.properties).not.toHaveProperty('nested');
    expect(f.properties).not.toHaveProperty('list');
    expect(f).toEqual({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [151.1, -33.9] },
      properties: f.properties,
    });
  });

  it('drops features without a usable position', async () => {
    const textual = feature('DMC57');
    textual.geometry.coordinates = ['151.2', '-33.8'];
    const broken = feature('DMC58');
    broken.geometry.coordinates = [151.2, 'north'];
    const blankName = feature('<>');
    vi.mocked(request).mockResolvedValueOnce([textual, broken, blankName]);

    const features = await fetchResourceLocations({ exerciseId: 'ex1', copyId: 'individual' }, TRAIN);

    expect(features.map((f) => [f.properties.name, f.geometry.coordinates])).toEqual([['DMC57', [151.2, -33.8]]]);
  });

  it('refuses production without calling the backend', async () => {
    const err = await fetchResourceLocations({ exerciseId: 'ex1', copyId: 'individual' }, PROD).catch((e) => e);
    expect(isSimulationUnavailable(err)).toBe(true);
    expect(request).not.toHaveBeenCalled();
  });
});

describe('labels', () => {
  it('names an exercise, or calls it unnamed', () => {
    expect(exerciseDisplayName('  Storm night ')).toBe('Storm night');
    expect(exerciseDisplayName('')).toBe('Unnamed exercise');
    expect(exerciseDisplayName(null)).toBe('Unnamed exercise');
  });

  it('adds the headquarters for a group exercise only', () => {
    expect(simulationLabel({ exerciseName: 'Storm night', copyName: 'Demo City', mode: 'group' })).toBe(
      'Storm night · Demo City',
    );
    expect(simulationLabel({ exerciseName: 'Storm night', copyName: 'Demo City', mode: 'individual' })).toBe(
      'Storm night',
    );
    expect(simulationLabel({ exerciseName: '', mode: 'group' })).toBe('Unnamed exercise');
    expect(simulationLabel(null)).toBe('');
  });

  it('compares selections by exercise and copy', () => {
    const a = { exerciseId: 'ex1', copyId: '101', exerciseName: 'A' };
    expect(sameSimulation(a, { exerciseId: 'ex1', copyId: '101', exerciseName: 'renamed' })).toBe(true);
    expect(sameSimulation(a, { exerciseId: 'ex1', copyId: '102' })).toBe(false);
    expect(sameSimulation(a, null)).toBe(false);
    expect(sameSimulation(null, undefined)).toBe(true);
  });
});

describe('selectionForHq', () => {
  // LAD shows Demo Vale's copy of a group exercise (every value invented).
  const showingVale = {
    exerciseId: 'ex-grp',
    copyId: '102',
    exerciseName: 'Demo flood exercise',
    copyName: 'Demo Vale',
    mode: 'group',
    participantHqId: '102',
    copies: [
      { copyId: '101', participantHqId: '101', participantHqName: 'Demo City' },
      { copyId: '102', participantHqId: '102', participantHqName: 'Demo Vale' },
    ],
  };

  it('gives the copy for another participant HQ, not the one LAD shows', () => {
    const city = selectionForHq(showingVale, 101);
    expect(city).toEqual({
      exerciseId: 'ex-grp',
      copyId: '101',
      exerciseName: 'Demo flood exercise',
      copyName: 'Demo City',
      mode: 'group',
      participantHqId: '101',
    });
    expect(simulationLabel(city)).toBe('Demo flood exercise · Demo City');
  });

  it('gives the copy LAD shows for its own HQ', () => {
    expect(selectionForHq(showingVale, '102')).toMatchObject({ copyId: '102', copyName: 'Demo Vale' });
  });

  it('is null for an HQ with no copy in the exercise, or no HQ at all', () => {
    expect(selectionForHq(showingVale, '103')).toBeNull();
    expect(selectionForHq(showingVale, null)).toBeNull();
    expect(selectionForHq(showingVale, '')).toBeNull();
    expect(selectionForHq(null, '101')).toBeNull();
  });

  it('falls back to the copy LAD shows when the copy list is missing', () => {
    const { copies, ...withoutCopies } = showingVale;
    expect(copies).toHaveLength(2);
    expect(selectionForHq(withoutCopies, 102)).toMatchObject({ copyId: '102', copyName: 'Demo Vale' });
    expect(selectionForHq(withoutCopies, 101)).toBeNull();
  });
});
