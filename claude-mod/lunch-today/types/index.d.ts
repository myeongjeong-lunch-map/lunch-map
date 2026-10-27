export type LunchView = {
  /** 마지막으로 고른 조건 (카테고리나 "10분" 같은 말). 없으면 "" */
  filter: string
  /** pick_lunch 결과 글 */
  pick: string
  /** get_ranking 결과 글 */
  ranking: string
  isLoading: boolean
  error: string
  /** 마지막으로 불러온 시각 "12:03" */
  at: string
}

declare module 'claude-code' {
  interface PluginState {
    'lunch-today': { view: LunchView }
  }
}
