import { createStore } from 'vuex'

export default createStore({
  state: {
    // Filled by the ws replay (hunt_update) / getHunt.
    hunt: null,
    // Finished Hunt matches, newest first: getHuntHistory, then hunt_match prepends.
    huntHistory: [] as any[],
    error: null,
    // This app is entirely free; kept only so nothing can accidentally gate on it.
    pro: { status: 'active' }
  },
  mutations: {
    setHunt(state, v: any) {
      state.hunt = v
    },
    setHuntHistory(state, v: any[]) {
      state.huntHistory = v
    },
    addHuntMatch(state, entry: any) {
      state.huntHistory = [entry, ...state.huntHistory]
    },
    setError(state, v: any) {
      state.error = v
    }
  }
})
