const COMPETITION_PROGRESS_KEY = 'ygo_competition_stage_index';

export const getCompetitionResumeStage = (totalStages: number): number => {
  const storedValue = localStorage.getItem(COMPETITION_PROGRESS_KEY);
  if (storedValue === null) return 0;

  const parsedStage = Number.parseInt(storedValue, 10);
  if (Number.isNaN(parsedStage)) return 0;

  return Math.min(Math.max(parsedStage, 0), Math.max(totalStages - 1, 0));
};

export const setCompetitionResumeStage = (stageIndex: number) => {
  localStorage.setItem(COMPETITION_PROGRESS_KEY, String(Math.max(stageIndex, 0)));
};

export const clearCompetitionResumeStage = () => {
  localStorage.removeItem(COMPETITION_PROGRESS_KEY);
};
