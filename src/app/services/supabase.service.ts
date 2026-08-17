import { computed, inject, Injectable, signal } from '@angular/core';

import { createClient, Session, User } from '@supabase/supabase-js';

import { Database } from '../defs/database.types';
import { environment } from '../../environments/environment';

export interface SignUpRequest {
  email: string;
  password: string;
  displayName: string;
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  readonly client = createClient<Database>(environment.supabaseUrl, environment.supabaseKey);

  private userProfile = signal<Awaited<
    ReturnType<SupabaseService['getCurrentUserProfile']>
  > | null>(null);

  private readonly _session = signal<Session | null>(null);

  readonly session = this._session.asReadonly();

  readonly user = computed<User | null>(() => this._session()?.user ?? null);

  readonly isAuthenticated = computed(() => this.user() !== null);

  readonly isApprovedUser = computed(() => {
    return this.userProfile()?.is_approved;
  });
  readonly isAdminUser = computed(() => {
    return this.userProfile()?.is_approved;
  });
  constructor() {
    /*
     * Keep Angular state synchronized with Supabase.
     *
     * This also fires for:
     * - initial session
     * - sign in
     * - sign out
     * - token refresh
     */
    this.client.auth.onAuthStateChange((_event, session) => {
      this._session.set(session);
      this.getCurrentUserProfile().then((p_profile) => {
        this.userProfile.set(p_profile);
      });
    });

    /*
     * Populate immediately in case the user refreshed
     * the browser while already signed in.
     */
    void this.loadSession();
  }

  private async loadSession(): Promise<void> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      console.error('Unable to restore auth session', error);

      this._session.set(null);
      return;
    }

    this._session.set(data.session);
  }

  async getSession(): Promise<Session | null> {
    const { data, error } = await this.client.auth.getSession();

    if (error) {
      throw new Error(error.message);
    }

    this._session.set(data.session);

    return data.session;
  }

  async getProfile() {
    await this.loadSession();
    const profile = await this.getCurrentUserProfile();

    return profile;
  }

  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await this.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Login succeeded but no user was returned.');
    }

    this._session.set(data.session);

    return data.user;
  }

  async signUp(request: SignUpRequest) {
    const { data, error } = await this.client.auth.signUp({
      email: request.email,
      password: request.password,
      options: {
        data: {
          display_name: request.displayName,
        },
      },
    });

    if (error) {
      throw error;
    }

    return data;
  }
  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    this._session.set(null);
  }

  async getCurrentUserProfile() {
    const w_user = (await this.client.auth.getUser()).data.user;
    if (!w_user) {
      throw new Error('no current user');
    }
    const { data, error } = await this.client.from('user_profiles').select('*').eq('id', w_user.id);

    if (error) {
      throw new Error(error.message);
    }

    return data[0];
  }
}
