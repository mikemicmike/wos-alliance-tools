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
import { FoundryManageComponent } from './components/foundry-manage/foundry-manage.component';
import { FoundryListComponent } from './components/foundry-list/foundry-list.component';
import { FoundryManageMembersComponent } from './components/foundry-manage-members/foundry-manage-members.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent,
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
  {
    path: 'foundries/manage/:date',
    component: FoundryManageComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'foundries',
    component: FoundryListComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: 'foundries/manage-members/:date',
    component: FoundryManageMembersComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
  {
    path: '',
    component: MembersComponent,
    canActivate: [authGuard, requireApprovedUserProfileGuard],
  },
];
