import { Dispatch, SetStateAction, useLayoutEffect, useState } from 'react';

interface DraftState { practiceSession: { id: string; status?: string } | null; isReviewing: boolean }
const PREFIX = 'question-bank:practice-draft:v1:';

export function usePracticeDraft<T extends DraftState>(ownerId: string | undefined, initial: T) {
  const key = ownerId ? PREFIX + ownerId : null;
  const [loaded] = useState(() => {
    if (!key) return { state: initial, restored: false, warning: '' };
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { state: initial, restored: false, warning: '' };
      const draft = JSON.parse(raw);
      const state = draft.state;
      const valid = draft.version === 1 && draft.ownerId === ownerId && state &&
        typeof state.practiceSession?.id === 'string' &&
        state.practiceSession.status !== 'completed' &&
        Object.keys(initial).every(name => {
          const expected = initial[name];
          const value = state[name];
          if (name === 'currentAnswer') return typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'));
          if (expected === null) return value === null || (typeof value === 'object' && !Array.isArray(value));
          if (Array.isArray(expected)) return Array.isArray(value);
          return typeof value === typeof expected && (typeof value !== 'object' || (value !== null && !Array.isArray(value)));
        });
      if (!valid) {
        localStorage.removeItem(key);
        return { state: initial, restored: false, warning: '旧草稿无法恢复，请重新开始练习。' };
      }
      return { state: { ...initial, ...state } as T, restored: true, warning: '' };
    } catch {
      return { state: initial, restored: false, warning: '无法读取本地草稿，请检查浏览器存储权限。' };
    }
  });
  const [state, setState] = useState<T>(loaded.state);
  const [storageWarning, setStorageWarning] = useState(loaded.warning);

  // Persist every committed edit, before paint; no debounce window on refresh or route exit.
  useLayoutEffect(() => {
    if (!key) return;
    try {
      if (!state.practiceSession || state.isReviewing || state.practiceSession.status === 'completed') {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify({ version: 1, ownerId, state }));
      }
      setStorageWarning('');
    } catch {
      setStorageWarning('草稿未能保存到本机，请勿刷新或离开页面；可继续作答并重试提交。');
    }
  }, [key, ownerId, state]);

  function field<K extends keyof T>(name: K): [T[K], Dispatch<SetStateAction<T[K]>>] {
    return [state[name], value => setState(previous => ({
      ...previous,
      [name]: typeof value === 'function'
        ? (value as (previous: T[K]) => T[K])(previous[name]) : value,
    }))];
  }
  return { field, restored: loaded.restored, storageWarning: storageWarning || loaded.warning };
}
