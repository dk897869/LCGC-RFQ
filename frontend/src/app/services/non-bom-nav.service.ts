import { Injectable, computed, signal } from '@angular/core';

/** Which NON BOM module group is focused in the sidebar. `all` shows every group. */
export type NonBomNavMode =
  | 'all'
  | 'approvals'
  | 'rfq-request'
  | 'pr-process'
  | 'material-management'
  | 'reports'
  | 'wcc'
  | 'scrap-material-bidding'
  | 'item-master-list'
  | 'vendor-details'
  | 'approval-status';

@Injectable({ providedIn: 'root' })
export class NonBomNavService {
  private readonly _mode = signal<NonBomNavMode>('all');

  readonly mode = this._mode.asReadonly();
  readonly isFiltered = computed(() => this._mode() !== 'all');

  setMode(mode: NonBomNavMode): void {
    this._mode.set(mode);
  }

  showAll(): void {
    this._mode.set('all');
  }

  isGroupVisible(groupId: string): boolean {
    const mode = this._mode();
    if (mode === 'all') return true;
    return groupId === mode;
  }

  /** Map dashboard / dropdown actions to focused nav mode */
  resolveModeFromTab(tabId: string): NonBomNavMode {
    const groupIds: NonBomNavMode[] = [
      'approvals', 'rfq-request', 'pr-process', 'material-management',
      'reports', 'wcc', 'scrap-material-bidding', 'item-master-list',
      'vendor-details', 'approval-status'
    ];
    if (groupIds.includes(tabId as NonBomNavMode)) return tabId as NonBomNavMode;
    return 'all';
  }
}
