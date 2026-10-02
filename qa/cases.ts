// The case source owns the required inventory; the runner rejects absent cases.
export const CASES = {
  daily: 'daily-load',
  generate: 'generate-new-lick',
  fallback: 'unavailable-daily-playback',
  live: 'live-daily-and-generation',
};

// Independent expectations for existing authored licks, not renderer output.
export const EXPECTED = {
  daily: { id: 'soul-02-two-five-anticipation', title: 'Pushed Resolution' },
  generated: { id: 'soul-03-sunday-walkdown', title: 'Sunday Walk-Down' },
  fallback: { id: 'soul-01-dorian-vamp', title: 'Late Night Vamp' },
};
