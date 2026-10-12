import { Routes } from '@angular/router';
import { MembersComponent } from './components/members/members.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth.guard';
import { requireApprovedUserProfileGuard } from './guards/require-approved-user-profile.guard';
import { requireNotApprovedUserProfileGuard } from './guards/require-not-approved-user-profile.guard';
import { EventKind } from './defs/event-kind';
import { requireAdminGuard } from './guards/require-admin.guard';
import { unsavedChangesGuard } from './guards/unsaved-changes.guard';

/*
 * Login and the members list (the landing page) are in the main bundle; every other page is
 * lazy-loaded so its code is only downloaded when someone opens it.
 */

/** List / day view / registration grid, shared by Foundry and Canyon Clash. */
function eventRoutes(p_path: string, p_kind: EventKind): Routes {
  const canActivate = [authGuard, requireApprovedUserProfileGuard];
  const data = { kind: p_kind };
  return [
    {
      path: p_path,
      loadComponent: () =>
        import('./components/event-list/event-list.component').then((m) => m.EventListComponent),
      canActivate,
      data,
    },
    {
      path: `${p_path}/manage/:date`,
      loadComponent: () =>
        import('./components/event-manage/event-manage.component').then(
          (m) => m.EventManageComponent,
        ),
      canActivate,
      canDeactivate: [unsavedChangesGuard],
      data,
    },
    {
      path: `${p_path}/manage-members/:date`,
      loadComponent: () =>
        import('./components/event-manage-members/event-manage-members.component').then(
          (m) => m.EventManageMembersComponent,
        ),
      canActivate,
      canDeactivate: [unsavedChangesGuard],
      data,
    },
  ];
}

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'signup',
    loadComponent: () =>
      import('./components/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'profile/missing',
    loadComponent: () =>
      import('./components/missing-profile/missing-profile.component').then(
        (m) => m.MissingProfileComponent,
      ),
    canActivate: [authGuard, requireNotApprovedUserProfileGuard],
  },
  {
    path: 'members',
    component: MembersComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'members/bulk-edit',
    loadComponent: () =>
      import('./components/members-bulk-edit/members-bulk-edit.component').then(
        (m) => m.MembersBulkEditComponent,
      ),
    canActivate: [authGuard, requireApprovedUserProfileGuard, requireAdminGuard],
    canDeactivate: [unsavedChangesGuard],
  },
  {
    path: 'users',
    loadComponent: () => import('./components/users/users.component').then((m) => m.UsersComponent),
    canActivate: [authGuard, requireApprovedUserProfileGuard, requireAdminGuard],
  },
  {
    path: 'tasks',
    loadComponent: () => import('./components/tasks/tasks.component').then((m) => m.TasksComponent),
    canActivate: [authGuard, requireApprovedUserProfileGuard, requireAdminGuard],
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./components/calendar/calendar.component').then((m) => m.CalendarComponent),
    canActivate: [authGuard, requireApprovedUserProfileGuard, requireAdminGuard],
  },
  {
    path: 'member/create',
    loadComponent: () =>
      import('./components/member-update/member-update.component').then(
        (m) => m.MemberUpdateComponent,
      ),
    canActivate: [authGuard, requireApprovedUserProfileGuard],
    data: {
      mode: 'ADD',
    },
  },
  {
    path: 'member/update/:member',
    loadComponent: () =>
      import('./components/member-update/member-update.component').then(
        (m) => m.MemberUpdateComponent,
      ),
    canActivate: [authGuard, requireApprovedUserProfileGuard],
    data: {
      mode: 'UPDATE',
    },
  },
  {
    path: 'member/view/:id',
    loadComponent: () =>
      import('./components/member-view/member-view.component').then((m) => m.MemberViewComponent),
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'alliances',
    loadComponent: () =>
      import('./components/alliances/alliances.component').then((m) => m.AlliancesComponent),
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  ...eventRoutes('foundries', 'foundry'),
  ...eventRoutes('canyon-clashes', 'canyon-clash'),
  {
    path: '',
    component: MembersComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
