import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../auth';

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

global.localStorage = localStorageMock as any;

describe('Auth Store', () => {
  beforeEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
    
    // Reset the store
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  });

  it('should have initial state', () => {
    const { result } = renderHook(() => useAuthStore());
    
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should login successfully', () => {
    const { result } = renderHook(() => useAuthStore());
    
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'student' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const mockToken = 'mock-jwt-token';
    
    act(() => {
      result.current.login(mockUser, mockToken);
    });
    
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('token', mockToken);
  });

  it('should logout successfully', () => {
    const { result } = renderHook(() => useAuthStore());
    
    // First login
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'student' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const mockToken = 'mock-jwt-token';
    
    act(() => {
      result.current.login(mockUser, mockToken);
    });
    
    expect(result.current.isAuthenticated).toBe(true);
    
    // Then logout
    act(() => {
      result.current.logout();
    });
    
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('token');
  });

  it('should initialize from localStorage', () => {
    const mockToken = 'existing-token';
    localStorageMock.getItem.mockReturnValue(mockToken);
    
    // Create a new store instance to test initialization
    const { result } = renderHook(() => useAuthStore());
    
    // The token should be set from localStorage
    expect(localStorageMock.getItem).toHaveBeenCalledWith('token');
    expect(result.current.token).toBe(mockToken);
  });
});