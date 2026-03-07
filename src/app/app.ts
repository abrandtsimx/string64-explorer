import { Component, inject, ViewEncapsulation, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from './shared/components/header/header.component';
import { DataService } from './core/services/data.service';
import { ExplorerNodeComponent } from './shared/components/explorer-node/explorer-node.component';

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule, 
    FormsModule, 
    MatTabsModule,
    MatIconModule,
    HeaderComponent, 
    ExplorerNodeComponent
  ],
  styleUrl: './app.css',
  template: `
    <div class="app-container">
      <div class="main-layout">
        <app-header></app-header>

        <main class="workbench-grid" [class.input-collapsed]="!showInputPanel">
          <!-- Bookmarks Sidebar (Left) -->
          <aside class="bookmarks-sidebar">
            <div class="sidebar-header">
              <div class="header-title">
                <mat-icon>bookmarks</mat-icon>
                <span>Bookmarks</span>
              </div>
              <button *ngIf="bookmarks.length > 0" class="btn-clear-all" (click)="clearBookmarks()" title="Clear all bookmarks">
                <mat-icon>delete_sweep</mat-icon>
              </button>
            </div>
            <div class="sidebar-content custom-scrollbar">
              <div *ngIf="bookmarks.length === 0" class="empty-state mini">
                <mat-icon class="empty-icon">bookmark_border</mat-icon>
                <p class="empty-text">No bookmarks</p>
              </div>
              <div class="bookmarks-list">
                <div *ngFor="let bm of bookmarks" class="bookmark-card" (click)="handleJump(bm.path)">
                  <span class="bookmark-label" [innerHTML]="getBookmarkHtml(bm)"></span>
                  <button class="btn-remove-bm" (click)="$event.stopPropagation(); removeBookmark(bm.path)">
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </aside>

          <!-- Input Terminal Panel -->
          <section class="panel" *ngIf="showInputPanel">
            <div class="panel-header">
              <div class="header-title-group">
                <div class="icon-box">
                  <mat-icon class="icon-indigo">terminal</mat-icon>
                </div>
                <div class="title-text">
                  <h2>Input Stream</h2>
                  <p>Base64 / JSON / Escaped</p>
                </div>
              </div>
              <div class="header-actions">
                <label class="setting-toggle" title="Strip Metadata from JSON">
                  <input type="checkbox" [(ngModel)]="stripMetadata" (change)="saveSettings(); processInput()">
                  <span class="toggle-label">Strip</span>
                </label>
                <button (click)="showInputPanel = false" class="btn-icon" title="Collapse Panel">
                  <mat-icon>keyboard_double_arrow_left</mat-icon>
                </button>
                <button (click)="clearAll()" class="btn-icon" title="Clear All">
                  <mat-icon>delete_sweep</mat-icon>
                </button>
              </div>
            </div>
            
            <div class="panel-body">
              <textarea 
                [(ngModel)]="jsonInput"
                class="input-textarea custom-scrollbar"
                placeholder="Paste raw data to begin processing..."
              ></textarea>
            </div>

            <div class="panel-footer">
              <button (click)="processInput()" class="action-button">
                <span class="relative">Process</span>
                <mat-icon class="relative">bolt</mat-icon>
              </button>
            </div>
          </section>

          <!-- Output/Explorer Panel -->
          <section class="panel">
            <div class="panel-header">
              <div class="flex items-center gap-2">
                <button *ngIf="!showInputPanel" (click)="showInputPanel = true" class="btn-icon" title="Expand Input Stream">
                  <mat-icon>keyboard_double_arrow_right</mat-icon>
                </button>
                <mat-tab-group 
                  [(selectedIndex)]="selectedTabIndex" 
                  (selectedIndexChange)="onTabChange($event)"
                  class="custom-tabs flex-grow"
                  animationDuration="400ms">
                  
                  <mat-tab>
                    <ng-template mat-tab-label>
                      <mat-icon style="margin-right: 8px;">account_tree</mat-icon>
                      <span>Explore</span>
                    </ng-template>
                  </mat-tab>

                  <mat-tab>
                    <ng-template mat-tab-label>
                      <mat-icon style="margin-right: 8px;">auto_fix_high</mat-icon>
                      <span>Format</span>
                    </ng-template>
                  </mat-tab>
                  
                  <mat-tab>
                    <ng-template mat-tab-label>
                      <mat-icon style="margin-right: 8px;">gps_fixed</mat-icon>
                      <span>Extract</span>
                    </ng-template>
                  </mat-tab>
                </mat-tab-group>
              </div>

              <button (click)="copyToClipboard()" class="btn-secondary">
                <mat-icon style="font-size: 14px; width: 14px; height: 14px;">content_copy</mat-icon>
                Copy
              </button>
            </div>
            
            <div class="panel-body">
              <!-- Status Toast -->
              <div *ngIf="showStatus" 
                   [class]="'status-toast ' + (statusType === 'success' ? 'toast-success' : 'toast-error')">
                <mat-icon style="font-size: 16px; width: 16px; height: 16px;">{{ statusType === 'success' ? 'check_circle' : 'error' }}</mat-icon>
                {{ statusMessage }}
              </div>

              <div class="output-area custom-scrollbar">
                <!-- Explorer Output -->
                <div *ngIf="selectedTabIndex === 0" class="h-full flex flex-col">
                   <div class="explorer-actions-row">
                     <div class="mode-slider-container">
                       <div class="mode-slider" [class.edit-active]="editMode" (click)="editMode = !editMode; saveSettings()">
                         <div class="mode-knob"></div>
                         <span class="mode-text view">VIEW</span>
                         <span class="mode-text edit">EDIT</span>
                       </div>
                     </div>

                     <div class="search-bar-container flex-grow">
                       <mat-icon class="search-icon">search</mat-icon>
                       <input 
                         type="text" 
                         [(ngModel)]="explorerSearchQuery" 
                         placeholder="Search values..." 
                         class="search-input"
                       >
                       <button *ngIf="explorerSearchQuery" (click)="explorerSearchQuery = ''" class="clear-search">
                          <mat-icon>close</mat-icon>
                       </button>
                     </div>
                   </div>

                   <div class="pt-2">
                     <app-explorer-node 
                       *ngIf="getFilteredData()" 
                       [key]="'Root'" 
                       [data]="getFilteredData()" 
                       [parentIsArray]="false"
                       [editMode]="editMode"
                       [expansionPath]="currentExpansionPath"
                       [fullPath]="['Root']"
                       [bookmarks]="bookmarks"
                       (jumpTo)="handleJump($event)"
                       (replaceAll)="openReplaceModal($event)"
                       (viewInstances)="viewInstances($event)"
                       (toggleBookmark)="toggleBookmark($event)">
                     </app-explorer-node>
                     <div *ngIf="!explorerData" class="empty-state">
                        <mat-icon class="empty-icon">account_tree</mat-icon>
                        <p class="empty-text">Mapping required</p>
                     </div>
                     <div *ngIf="explorerData && !getFilteredData()" class="empty-state">
                        <mat-icon class="empty-icon">search_off</mat-icon>
                        <p class="empty-text">No matches found</p>
                     </div>
                   </div>
                </div>

                <!-- Instances Sidebar -->
                <aside class="instances-sidebar" *ngIf="selectedTabIndex === 0 && showInstancesSidebar">
                  <div class="sidebar-header">
                    <div class="header-title">
                      <mat-icon>visibility</mat-icon>
                      <span>Occurrences</span>
                    </div>
                    <button class="btn-close" (click)="closeInstancesSidebar()">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                  
                  <div class="sidebar-content custom-scrollbar">
                    <div class="instance-info">
                      <p class="meta-label">Value:</p>
                      <code class="instance-value">{{ instanceValue }}</code>
                      
                      <div class="instance-actions-row">
                        <p class="meta-sub">Found {{ instancesList.length }} instances</p>
                        <button *ngIf="editMode && instancesList.length > 0" 
                                class="btn-replace-selected" 
                                (click)="openReplaceModal({oldValue: instanceValue, newValue: instanceValue})">
                          Replace Selected ({{ selectedInstances.size }})
                        </button>
                      </div>

                      <label class="select-all-row" *ngIf="instancesList.length > 0">
                        <input type="checkbox" [checked]="isAllInstancesSelected()" (change)="toggleSelectAllInstances()">
                        <span>Select All</span>
                      </label>
                    </div>

                    <div class="instances-list">
                      <div *ngFor="let inst of instancesList" 
                           class="instance-card" 
                           [class.selected]="isInstanceSelected(inst.path)"
                           (click)="jumpToInstance(inst.path)">
                        <div class="instance-select" (click)="$event.stopPropagation()">
                          <input type="checkbox" 
                                 [checked]="isInstanceSelected(inst.path)" 
                                 (change)="toggleInstanceSelection(inst.path)">
                        </div>
                        <div class="instance-details">
                          <p class="instance-context">{{ inst.context }}</p>
                          <div class="instance-path">
                            <ng-container *ngFor="let segment of inst.path; let i = index; let last = last">
                              <span class="path-segment" 
                                    [class.target-segment]="last"
                                    *ngIf="segment !== 'Root'" 
                                    (click)="$event.stopPropagation(); jumpToInstance(inst.path.slice(0, i + 1))"
                                    title="Navigate to {{ segment }}">
                                {{ inst.displayPath[i] }}
                              </span>
                            </ng-container>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>

                <!-- JSON Prettifier Output -->
                <div *ngIf="selectedTabIndex === 1" [innerHTML]="jsonOutput" class="whitespace-pre"></div>

                <!-- Tool Lookup Output -->
                <div *ngIf="selectedTabIndex === 2" class="address-list">
                  <div *ngIf="toolAddresses.length === 0" class="empty-state">
                    <mat-icon class="empty-icon">search_off</mat-icon>
                    <p class="empty-text">No addresses discovered</p>
                  </div>
                  <div *ngFor="let addr of toolAddresses" class="address-card" (click)="copyValue(addr)">
                    <div class="address-icon-box">
                       <mat-icon class="icon-indigo">link</mat-icon>
                    </div>
                    <span class="token-string flex-grow truncate">{{ addr }}</span>
                    <mat-icon class="copy-hint">content_copy</mat-icon>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <!-- Replace Modal -->
      <div class="modal-backdrop" *ngIf="showReplaceModal" (click)="cancelReplace()">
        <div class="custom-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <mat-icon class="icon-vital">find_replace</mat-icon>
            <h3>Global Replace</h3>
          </div>
          <div class="modal-body">
            <div class="replace-info">
              <p class="replace-label">Current Value:</p>
              <code class="value-preview">{{ replaceOldValue }}</code>
              <p class="replace-meta" *ngIf="!showInstancesSidebar">Occurs <span class="count-tag">{{ replaceCount }}</span> times in the data.</p>
              <p class="replace-meta" *ngIf="showInstancesSidebar">Replacing <span class="count-tag">{{ selectedInstances.size }}</span> of <span class="count-tag">{{ instancesList.length }}</span> instances.</p>
            </div>
            <div class="replace-input-group">
              <p class="replace-label">Replace with:</p>
              <input type="text" [(ngModel)]="replaceNewValue" class="modal-input" placeholder="New value..." (keyup.enter)="confirmReplace()" autofocus>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" (click)="cancelReplace()">Cancel</button>
            <button class="btn-confirm" (click)="confirmReplace()">Replace All</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class App implements OnInit {
  private dataService = inject(DataService);
  private route = inject(ActivatedRoute);

  selectedTabIndex = 0;
  jsonInput = '';
  jsonOutput: any = '';
  statusMessage = '';
  statusType = 'success';
  showStatus = false;
  explorerData: any = null;
  toolAddresses: string[] = [];
  explorerSearchQuery = '';
  currentExpansionPath: string[] = [];
  stripMetadata = false;
  editMode = false;

  showReplaceModal = false;
  replaceOldValue: any = null;
  replaceNewValue: any = '';
  replaceCount = 0;

  showInstancesSidebar = false;
  instancesList: any[] = [];
  instanceValue: any = null;
  selectedInstances: Set<string> = new Set();

  bookmarks: { path: string[], label: string }[] = [];
  showInputPanel = true;

  ngOnInit() {
    // Load settings
    const saved = localStorage.getItem('explorer_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      this.stripMetadata = !!settings.stripMetadata;
      this.editMode = !!settings.editMode;
      this.bookmarks = settings.bookmarks || [];
    }

    // 1. Initial check for data parameter (?) in search string
    const searchParams = new URLSearchParams(window.location.search);
    const initialQueryData = searchParams.get('data');
    if (initialQueryData) {
      this.jsonInput = decodeURIComponent(initialQueryData);
      this.processInput();
    }

    // 2. Manual fragment check as fallback for initial load
    const hash = window.location.hash;
    if (hash && hash.includes('data=')) {
      const parts = hash.split('data=');
      if (parts.length > 1) {
        this.jsonInput = decodeURIComponent(parts[1]);
        this.processInput();
      }
    }

    // 3. Fragment check (#) for reactive changes
    this.route.fragment.subscribe(fragment => {
      if (fragment && fragment.startsWith('data=')) {
        try {
          // Use split to extract data part, then handle URL decoding if necessary
          const base64Data = fragment.split('data=')[1];
          this.jsonInput = decodeURIComponent(base64Data);
          this.processInput();
        } catch (e) {
          console.error('Failed to process fragment data', e);
        }
      }
    });
  }

  onTabChange(index: number) {
    this.selectedTabIndex = index;
    if (this.jsonInput) {
      this.processInput();
    }
  }

  processInput() {
    try {
      let input = this.jsonInput.trim();
      if (!input) return;

      // Auto-clear bookmarks when new data is processed
      this.clearBookmarks();

      input = this.dataService.decodeIfBase64(input);
      const cleanText = this.stripMetadata ? this.dataService.stripMetadata(input) : input;

      this.explorerData = null;
      this.toolAddresses = [];

      if (this.selectedTabIndex === 0) { // Explore
        let jsonStr = cleanText;
        if (jsonStr.startsWith('"') && !jsonStr.startsWith('{')) jsonStr = '{' + jsonStr + '}';
        const data = JSON.parse(jsonStr);
        this.explorerData = this.dataService.recursivelyDecodeData(data);
        this.showMessage("Data structure mapped");
      } else if (this.selectedTabIndex === 1) { // Format
        let jsonToParse = cleanText;
        if (jsonToParse.startsWith('"') && !jsonToParse.startsWith('{')) {
          jsonToParse = '{' + jsonToParse + '}';
        }
        const jsonObj = JSON.parse(jsonToParse);
        this.jsonOutput = this.dataService.syntaxHighlight(JSON.stringify(jsonObj, null, 4));
        this.showMessage("Metadata stripped & prettified");
      } else if (this.selectedTabIndex === 2) { // Extract
        this.toolAddresses = this.dataService.recursiveToolExtract(cleanText);
        if (this.toolAddresses.length > 0) {
          this.showMessage(`Located ${this.toolAddresses.length} addresses`);
        } else {
          this.showMessage("No addresses found", "error");
        }
      }
    } catch (e: any) {
      console.error("Processing error:", e);
      this.showMessage("Processing failed: " + e.message, "error");
    }
  }

  clearAll() {
    this.jsonInput = '';
    this.jsonOutput = '';
    this.showStatus = false;
    this.explorerData = null;
    this.toolAddresses = [];
  }

  copyToClipboard() {
    let text = '';
    if (this.selectedTabIndex === 2) { // Extract
      text = this.toolAddresses.join('\n');
    } else if (this.selectedTabIndex === 0) { // Explore
      text = JSON.stringify(this.explorerData, null, 2);
    } else { // Format (1)
      const temp = document.createElement('div');
      temp.innerHTML = this.jsonOutput;
      text = temp.textContent || temp.innerText || "";
    }

    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.showMessage("Copied to clipboard");
    });
  }

  copyValue(val: string) {
    navigator.clipboard.writeText(val).then(() => {
      this.showMessage(`Copied address`);
    });
  }

  private showMessage(msg: string, type: 'success' | 'error' = 'success') {
    this.statusMessage = msg;
    this.statusType = type;
    this.showStatus = true;
    setTimeout(() => this.showStatus = false, 3000);
  }

  getBtnText(): string {
    const labels: any = { 0: 'Map Explorer', 1: 'Run Prettifier', 2: 'Extract Addresses' };
    return labels[this.selectedTabIndex];
  }

  getOutputLabel(): string {
    const labels: any = { 0: 'Structure Map', 1: 'Standardized JSON', 2: 'Discovered Addresses' };
    return labels[this.selectedTabIndex];
  }

  getFilteredData() {
    if (!this.explorerData) return null;
    return this.dataService.filterData(this.explorerData, this.explorerSearchQuery);
  }

  handleJump(path: string[]) {
    // 1. Clear search first - this resets the data structure to full tree
    this.explorerSearchQuery = '';
    
    // 2. Clear existing path to ensure a fresh cycle
    this.currentExpansionPath = [];
    
    // 3. Wait for the tree to re-render with full data before applying path
    setTimeout(() => {
      this.currentExpansionPath = path;
      this.showMessage("Jumped to context");

      // 4. Clear the path after it has been propagated to the tree.
      // This stops the forced-expansion logic from locking the tree.
      setTimeout(() => {
        this.currentExpansionPath = [];
      }, 1000);
    }, 150);
  }

  globalReplace(event: { oldValue: any, newValue: any }) {
    if (!this.explorerData) return;
    this.explorerData = this.dataService.replaceAll(this.explorerData, event.oldValue, event.newValue);
    this.showMessage("Global replacement complete");
  }

  saveSettings() {
    localStorage.setItem('explorer_settings', JSON.stringify({
      stripMetadata: this.stripMetadata,
      editMode: this.editMode,
      bookmarks: this.bookmarks
    }));
  }

  toggleBookmark(event: { path: string[], data: any }) {
    const existingIndex = this.bookmarks.findIndex(b => JSON.stringify(b.path) === JSON.stringify(event.path));
    
    if (existingIndex > -1) {
      this.bookmarks.splice(existingIndex, 1);
      this.showMessage("Bookmark removed");
    } else {
      const key = event.path[event.path.length - 1];
      let descriptor = '';
      
      if (typeof event.data === 'object' && event.data !== null) {
        descriptor = this.dataService.getDescriptor(event.data, null);
      } else {
        // For primitives, just show the value (truncated if very long)
        const valStr = String(event.data);
        descriptor = valStr.length > 40 ? valStr.substring(0, 40) + '...' : valStr;
      }

      const label = descriptor ? `${key}: ${descriptor}` : key;
      
      this.bookmarks.push({
        path: event.path,
        label: label
      });
      this.showMessage("Bookmark added");
    }
    this.saveSettings();
  }

  removeBookmark(path: string[]) {
    this.bookmarks = this.bookmarks.filter(b => JSON.stringify(b.path) !== JSON.stringify(path));
    this.saveSettings();
  }

  clearBookmarks() {
    this.bookmarks = [];
    this.saveSettings();
  }

  isBookmarked(path: string[]): boolean {
    return this.bookmarks.some(b => JSON.stringify(b.path) === JSON.stringify(path));
  }

  getBookmarkHtml(bm: { path: string[], label: string }): string {
    const raw = bm.label;
    if (raw.includes(': ')) {
      const mainParts = raw.split(': ');
      const keyPart = mainParts[0];
      const descPart = mainParts[1];

      if (descPart.includes(' | ')) {
        const descSubParts = descPart.split(' | ');
        return `${keyPart}: <span class="id-segment">${descSubParts[0]}</span> | ${descSubParts[1]}`;
      }
      return raw;
    }
    return raw;
  }

  openReplaceModal(event: { oldValue: any, newValue: any }) {
    this.replaceOldValue = event.oldValue;
    this.replaceNewValue = event.oldValue; // Default to same value for easy editing
    this.replaceCount = this.dataService.countOccurrences(this.explorerData, event.oldValue);
    this.showReplaceModal = true;
  }

  confirmReplace() {
    if (!this.explorerData) return;
    
    let finalValue = this.replaceNewValue;
    if (typeof this.replaceOldValue === 'number') finalValue = Number(this.replaceNewValue);
    if (typeof this.replaceOldValue === 'boolean') finalValue = String(this.replaceNewValue).toLowerCase() === 'true';

    // If sidebar is open, check if we are doing selective replace
    if (this.showInstancesSidebar && this.selectedInstances.size < this.instancesList.length) {
      const selectedPaths = Array.from(this.selectedInstances).map(ps => JSON.parse(ps));
      this.explorerData = this.dataService.replaceAtPaths(this.explorerData, selectedPaths, finalValue);
      this.showMessage(`Replaced ${this.selectedInstances.size} selected instances`);
      // Refresh list
      this.viewInstances(this.instanceValue);
    } else {
      this.explorerData = this.dataService.replaceAll(this.explorerData, this.replaceOldValue, finalValue);
      this.showMessage(`Replaced ${this.replaceCount} instances`);
      if (this.showInstancesSidebar) this.viewInstances(this.instanceValue);
    }
    
    this.showReplaceModal = false;
  }

  cancelReplace() {
    this.showReplaceModal = false;
  }

  viewInstances(value: any) {
    this.instanceValue = value;
    this.instancesList = this.dataService.findAllInstances(this.explorerData, value, ['Root']);
    // Default to all selected
    this.selectedInstances = new Set(this.instancesList.map(inst => JSON.stringify(inst.path)));
    this.showInstancesSidebar = true;
  }

  toggleInstanceSelection(path: string[]) {
    const ps = JSON.stringify(path);
    if (this.selectedInstances.has(ps)) {
      this.selectedInstances.delete(ps);
    } else {
      this.selectedInstances.add(ps);
    }
  }

  isInstanceSelected(path: string[]): boolean {
    return this.selectedInstances.has(JSON.stringify(path));
  }

  isAllInstancesSelected(): boolean {
    return this.instancesList.length > 0 && this.selectedInstances.size === this.instancesList.length;
  }

  toggleSelectAllInstances() {
    if (this.isAllInstancesSelected()) {
      this.selectedInstances.clear();
    } else {
      this.selectedInstances = new Set(this.instancesList.map(inst => JSON.stringify(inst.path)));
    }
  }

  closeInstancesSidebar() {
    this.showInstancesSidebar = false;
  }

  jumpToInstance(path: string[]) {
    this.handleJump(path);
    // Optional: close sidebar on jump? User might want to stay. 
    // Let's keep it open for easy multi-jump.
  }
}
