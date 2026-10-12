import { Routes } from '@angular/router';
import { MembersComponent } from './components/members/members.component';
import { AlliancesComponent } from './components/alliances/alliances.component';
import { MemberUpdateComponent } from './components/member-update/member-update.component';
import { MemberViewComponent } from './components/member-view/member-view.component';
import { LoginComponent } from './components/login/login.component';
import { authGuard } from './guards/auth.guard';
import { requireApprovedUserProfileGuard } from './guards/require-approved-user-profile.guard';
import { MissingProfileComponent } from './components/missing-profile/missing-profile.component';
import { requireNotApprovedUserProfileGuard } from './guards/require-not-approved-user-profile.guard';
import { EventManageComponent } from './components/event-manage/event-manage.component';
import { EventListComponent } from './components/event-list/event-list.component';
import { EventManageMembersComponent } from './components/event-manage-members/event-manage-members.component';
import { SignupComponent } from './components/signup/signup.component';
import { MembersBulkEditComponent } from './components/members-bulk-edit/members-bulk-edit.component';
import { EventKind } from './defs/event-kind';

/** List / day view / registration grid, shared by Foundry and Canyon Clash. */
function eventRoutes(p_path: string, p_kind: EventKind): Routes {
  const canActivate = [authGuard, requireApprovedUserProfileGuard];
  const data = { kind: p_kind };
  return [
    { path: p_path, component: EventListComponent, canActivate, data },
    { path: `${p_path}/manage/:date`, component: EventManageComponent, canActivate, data },
    {
      path: `${p_path}/manage-members/:date`,
      component: EventManageMembersComponent,
      canActivate,
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
    component: SignupComponent,
  },
  {
    path: 'profile/missing',
    component: MissingProfileComponent,
    canActivate: [authGuard, requireNotApprovedUserProfileGuard],
  },
  {
    path: 'members',
    component: MembersComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'members/bulk-edit',
    component: MembersBulkEditComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'member/create',
    component: MemberUpdateComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
    data: {
      mode: 'ADD',
    },
  },
  {
    path: 'member/update/:member',
    component: MemberUpdateComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
    data: {
      mode: 'UPDATE',
    },
  },
  {
    path: 'member/view/:id',
    component: MemberViewComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'alliances',
    component: AlliancesComponent,
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
