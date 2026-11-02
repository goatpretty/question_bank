import { RouteObject } from 'react-router-dom';
import { publicRoutes } from './publicRoutes.tsx';
import { protectedRoutes } from './protectedRoutes.tsx';

export const allRoutes: RouteObject[] = [...publicRoutes, ...protectedRoutes];
