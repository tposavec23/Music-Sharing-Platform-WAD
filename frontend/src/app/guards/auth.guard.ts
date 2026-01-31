import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const user = authService.currentUser;
  const requiredRoles = route.data['roles'] as number[] | undefined;

  if (!requiredRoles || requiredRoles.length === 0) {
    return true;
  }

  if (!user) {
    router.navigate(['/']);
    return false;
  }

  if (user.role_id !== null && requiredRoles.includes(user.role_id)) {
    return true;
  }

  router.navigate(['/']);
  return false;
};
