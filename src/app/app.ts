import { Component, inject, ViewEncapsulation, OnInit, ElementRef, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HeaderComponent } from './shared/components/header/header.component';
import { DataService } from './core/services/data.service';
import { StorageService } from './core/services/storage.service';
import { ExplorerNodeComponent } from './shared/components/explorer-node/explorer-node.component';

interface ExplorerFile {
  id: string;
  name: string;
  jsonInput: string;
  originalJsonInput: string;
  explorerData: any;
  originalExplorerData: any;
  bookmarks: { path: string[], label: string }[];
  hasChanges: boolean;
  stripMetadata: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [
    CommonModule, 
    FormsModule, 
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    HeaderComponent, 
    ExplorerNodeComponent
  ],
  styleUrl: './app.css',
  template: `
    <div class="app-container" (dragover)="$event.preventDefault()" (drop)="$event.preventDefault()">
      <div class="main-layout">
        <app-header></app-header>

        <main class="workbench-grid" 
              [class.input-collapsed]="!showInputPanel"
              [style.grid-template-columns]="bookmarksWidth + 'px ' + (showInputPanel ? '1fr 1.2fr' : '1fr')">
          
          <!-- Navigator Sidebar (Left) -->
          <div class="sidebar-container" [class.resizing]="isResizing" [style.width.px]="bookmarksWidth">
            
            <!-- Files Browser Panel -->
            <section class="panel sidebar-panel" 
                     [style.height.px]="filesHeight"
                     (dragover)="onDragOver($event)" 
                     (drop)="onFileDrop($event)">
              <div class="panel-header">
                <div class="header-title-group">
                  <div class="icon-box">
                    <mat-icon class="icon-indigo">folder_open</mat-icon>
                  </div>
                  <div class="title-text">
                    <h2>Files</h2>
                  </div>
                </div>
                <button class="btn-icon" (click)="createNewFile()" title="New JSON Session">
                  <mat-icon>add</mat-icon>
                </button>
              </div>
              <div class="panel-body files-list custom-scrollbar">
                <div *ngFor="let file of files" 
                     class="file-card" 
                     [class.active]="file.id === activeFileId"
                     (click)="switchFile(file.id)">
                  <mat-icon class="file-icon">{{ file.hasChanges ? 'edit_note' : 'description' }}</mat-icon>
                  <input class="file-name-input" 
                         [value]="file.name" 
                         (change)="renameFile(file.id, $any($event.target).value)"
                         (click)="$event.stopPropagation()">
                  <button class="btn-icon btn-remove" *ngIf="files.length > 1" (click)="$event.stopPropagation(); deleteFile(file.id)">
                    <mat-icon>delete_outline</mat-icon>
                  </button>
                </div>
              </div>

              <!-- Vertical Resize Handle -->
              <div class="resize-handle-v" (mousedown)="startVerticalResize($event)"></div>
            </section>

            <!-- Bookmarks Panel -->
            <section class="panel sidebar-panel flex-grow">
              <div class="panel-header">
                <div class="header-title-group">
                  <div class="icon-box">
                    <mat-icon class="icon-indigo">bookmarks</mat-icon>
                  </div>
                  <div class="title-text">
                    <h2>Bookmarks</h2>
                  </div>
                </div>
                <button *ngIf="bookmarks.length > 0" class="btn-icon" (click)="clearBookmarks()" title="Clear all bookmarks">
                  <mat-icon>delete_sweep</mat-icon>
                </button>
              </div>
              <div class="panel-body custom-scrollbar">
                <div *ngIf="bookmarks.length === 0" class="empty-state mini">
                  <mat-icon class="empty-icon">bookmark_border</mat-icon>
                  <p class="empty-text">No bookmarks</p>
                </div>
                <div class="bookmarks-list">
                  <div *ngFor="let bm of bookmarks" class="bookmark-card" (click)="handleJump(bm.path)">
                    <span class="bookmark-label" [innerHTML]="getBookmarkHtml(bm)"></span>
                    <button class="btn-icon btn-remove" (click)="$event.stopPropagation(); removeBookmark(bm.path)">
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
              </div>
            </section>
            
            <!-- Horizontal Resize Handle (Sidebar Width) -->
            <div class="resize-handle-h" (mousedown)="startResizing($event)"></div>
          </div>

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
                <label class="setting-toggle" title="Normalizes every Unity Easy Save &quot;__type&quot; wrapper (missing comma after the type name). Readable JSON values stay unwrapped; odd payloads become { __easySaveType, __easySaveValue }. Optional: empty Metadata / MetaData arrays.">
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
                [readonly]="isInputLocked"
                class="input-textarea custom-scrollbar"
                [class.locked]="isInputLocked"
                placeholder="Paste raw data to begin processing..."
              ></textarea>
            </div>

            <div class="panel-footer">
              <button *ngIf="!isInputLocked" (click)="processInput()" class="action-button">
                <span class="relative">Process</span>
                <mat-icon class="relative">bolt</mat-icon>
              </button>
              <button *ngIf="isInputLocked" (click)="isInputLocked = false" class="action-button secondary">
                <span class="relative">Unlock Input</span>
                <mat-icon class="relative">edit</mat-icon>
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

              <div class="output-area">
                <!-- Explorer Output -->
                <div *ngIf="selectedTabIndex === 0" class="h-full flex flex-col overflow-hidden">
                   <!-- Fixed Explorer Header -->
                   <div class="explorer-fixed-header">
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

                       <!-- Inline Action Buttons -->
                       <div class="header-actions-group" *ngIf="explorerData">
                         <button *ngIf="hasChanges" class="btn-action-inline revert" (click)="revertChanges()" title="Discard all edits">
                           <mat-icon>undo</mat-icon>
                         </button>
                         <button *ngIf="hasChanges" class="btn-action-inline save" (click)="saveToInput()" title="Apply edits to Input Stream">
                           <mat-icon>save</mat-icon>
                         </button>
                         <button class="btn-action-inline export" (click)="exportJson()" title="Download as JSON file">
                           <mat-icon>download</mat-icon>
                         </button>
                         <button class="btn-action-inline copy" (click)="copyJson()" title="Copy current JSON">
                           <mat-icon>content_copy</mat-icon>
                         </button>
                       </div>
                     </div>

                     <!-- Selection Breadcrumb Bar -->
                     <div class="selection-breadcrumb-bar" *ngIf="currentSelectedDisplayPath.length > 1">
                       <div class="instance-path">
                          <ng-container *ngFor="let segment of currentSelectedPath; let i = index; let last = last">
                            <span class="path-segment" 
                                  [class.target-segment]="last"
                                  *ngIf="segment !== 'Root'" 
                                  (click)="handleJump(currentSelectedPath.slice(0, i + 1))">
                              {{ currentSelectedDisplayPath[i] }}
                            </span>
                          </ng-container>
                       </div>
                     </div>
                   </div>

                   <!-- Scrollable Explorer Content -->
                   <div class="explorer-scroll-content custom-scrollbar">
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
                       (toggleBookmark)="toggleBookmark($event)"
                       (select)="onNodeSelect($event)"
                       (updateValue)="handleValueUpdate($event)">
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

                      <label class="select-all-row" *ngIf="editMode && instancesList.length > 0">
                        <input type="checkbox" [checked]="isAllInstancesSelected()" (change)="toggleSelectAllInstances()">
                        <span>Select All</span>
                      </label>
                    </div>

                    <div class="instances-list">
                      <div *ngFor="let inst of instancesList" 
                           class="instance-card" 
                           [class.selected]="editMode && isInstanceSelected(inst.path)"
                           (click)="jumpToInstance(inst.path)">
                        <div class="instance-select" *ngIf="editMode" (click)="$event.stopPropagation()">
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
                <div *ngIf="selectedTabIndex === 1" [innerHTML]="jsonOutput" class="whitespace-pre p-4 h-full overflow-auto custom-scrollbar"></div>

                <!-- Tool Lookup Output -->
                <div *ngIf="selectedTabIndex === 2" class="h-full flex flex-col overflow-hidden">
                  <div class="extraction-header">
                    <div class="search-bar-container flex-grow">
                      <mat-icon class="search-icon">filter_list</mat-icon>
                      <input 
                        type="text" 
                        [(ngModel)]="extractQuery" 
                        placeholder="Key to extract (e.g. ToolAddress)..." 
                        class="search-input"
                        (keyup.enter)="runExtraction()"
                      >
                      <button class="btn-extract-run" (click)="runExtraction()" title="Run Extraction">
                        <mat-icon>play_arrow</mat-icon>
                      </button>
                    </div>
                  </div>

                  <div class="address-list p-4 flex-grow overflow-auto custom-scrollbar">
                    <div *ngIf="toolAddresses.length === 0" class="empty-state">
                      <mat-icon class="empty-icon">search_off</mat-icon>
                      <p class="empty-text">No matches discovered</p>
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
  private storageService = inject(StorageService);
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
  extractQuery = 'ToolAddress';
  currentExpansionPath: string[] = [];
  stripMetadata = false;
  editMode = false;
  hasChanges = false;
  originalExplorerData: any = null;

  showReplaceModal = false;
  replaceOldValue: any = null;
  replaceNewValue: any = '';
  replaceCount = 0;

  showInstancesSidebar = false;
  instancesList: any[] = [];
  instanceValue: any = null;
  selectedInstances: Set<string> = new Set();

  activeFileId = '';
  files: ExplorerFile[] = [];

  bookmarks: { path: string[], label: string }[] = [];
  showInputPanel = true;
  bookmarksWidth = 330;
  filesHeight = 300;
  isResizing = false;
  isResizingVertical = false;

  currentSelectedPath: string[] = [];
  currentSelectedDisplayPath: string[] = [];
  isInputLocked = false;

  async ngOnInit() {
    // Load metadata settings
    const saved = localStorage.getItem('explorer_settings');
    if (saved) {
      const settings = JSON.parse(saved);
      this.stripMetadata = !!settings.stripMetadata;
      this.editMode = !!settings.editMode;
      this.bookmarksWidth = settings.bookmarksWidth || 330;
      this.activeFileId = settings.activeFileId || '';
    }

    // Load actual large files from IndexedDB
    try {
      this.files = await this.storageService.loadFiles();
      if (this.files.length === 0) {
        this.createNewFile();
      } else if (this.activeFileId) {
        this.loadFileData(this.activeFileId);
      }
    } catch (e) {
      console.error("Failed to load files from storage", e);
      if (this.files.length === 0) this.createNewFile();
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
    // Strictly only process if we have NO data for the requested view
    if (this.jsonInput) {
      if (index === 0 && this.explorerData === null) {
        this.processInput();
      } else if (index === 1 && !this.jsonOutput) {
        this.processInput();
      }
    }
  }

  processInput() {
    try {
      let input = this.jsonInput.trim();
      if (!input) return;

      // 1. Sync the current input to the active file object immediately
      const current = this.files.find(f => f.id === this.activeFileId);
      if (current) {
        // Prompt for name if still untitled
        if (current.name === 'Untitled Session') {
          const newName = window.prompt("Enter a name for this session:", "My JSON Data");
          if (newName) current.name = newName;
        }

        current.jsonInput = input;
        // Baseline capture: if first time, or manually entered after being empty
        if (!current.originalJsonInput) {
          current.originalJsonInput = input;
        }
      }

      // 2. Lock the input once processed
      this.isInputLocked = true;

      // 3. Clear bookmarks for this new "crunch"
      this.clearBookmarks();

      input = this.dataService.decodeIfBase64(input);
      const cleanText = this.dataService.prepareJsonForParse(input, this.stripMetadata);

      this.explorerData = null;
      this.originalExplorerData = null;
      this.hasChanges = false;
      this.toolAddresses = [];

      if (this.selectedTabIndex === 0) { // Explore
        let jsonStr = cleanText;
        if (jsonStr.startsWith('"') && !jsonStr.startsWith('{')) jsonStr = '{' + jsonStr + '}';
        const data = JSON.parse(jsonStr);
        this.explorerData = this.dataService.recursivelyDecodeData(data);
        // Store a deep copy for reversion
        this.originalExplorerData = JSON.parse(JSON.stringify(this.explorerData));
        
        // Update file object with new mapped data
        if (current) {
          current.explorerData = this.explorerData;
          current.originalExplorerData = this.originalExplorerData;
        }
        
        this.showMessage("Data structure mapped");
      } else if (this.selectedTabIndex === 1) { // Format
        let jsonToParse = cleanText;
        if (jsonToParse.startsWith('"') && !jsonToParse.startsWith('{')) {
          jsonToParse = '{' + jsonToParse + '}';
        }
        const jsonObj = JSON.parse(jsonToParse);
        this.jsonOutput = this.dataService.syntaxHighlight(JSON.stringify(jsonObj, null, 4));
        this.showMessage(this.stripMetadata ? "Metadata / MetaData cleared & JSON prettified" : "Easy Save values normalized & prettified");
      } else if (this.selectedTabIndex === 2) { // Extract
        this.runExtraction();
      }
      
      // 4. Persist the entire file collection
      this.saveSettings();

    } catch (e: any) {
      console.error("Processing error:", e);
      this.showMessage("Processing failed: " + e.message, "error");
    }
  }

  runExtraction() {
    if (!this.jsonInput) return;
    const input = this.dataService.decodeIfBase64(this.jsonInput);
    const cleanText = this.dataService.prepareJsonForParse(input, this.stripMetadata);
    
    this.toolAddresses = this.dataService.recursiveElementExtract(cleanText, this.extractQuery);
    if (this.toolAddresses.length > 0) {
      this.showMessage(`Extracted ${this.toolAddresses.length} values for "${this.extractQuery}"`);
    } else {
      this.showMessage(`No values found for "${this.extractQuery}"`, "error");
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
      bookmarksWidth: this.bookmarksWidth,
      activeFileId: this.activeFileId
    }));
    
    // Asynchronously save bulky file data to IndexedDB
    this.storageService.saveFiles(this.files).catch(err => {
       console.error("Critical: Failed to save files to IndexedDB", err);
       this.showMessage("Persistence Error: Changes might not be saved", "error");
    });
  }

  createNewFile() {
    const newFile: ExplorerFile = {
      id: 'file_' + new Date().getTime(),
      name: 'Untitled Session',
      jsonInput: '',
      originalJsonInput: '',
      explorerData: null,
      originalExplorerData: null,
      bookmarks: [],
      hasChanges: false,
      stripMetadata: false
    };
    this.files.push(newFile);
    this.switchFile(newFile.id);
  }

  switchFile(id: string) {
    if (this.activeFileId) {
      const current = this.files.find(f => f.id === this.activeFileId);
      if (current) {
        current.jsonInput = this.jsonInput;
        current.explorerData = this.explorerData;
        current.originalExplorerData = this.originalExplorerData;
        current.bookmarks = this.bookmarks;
        current.hasChanges = this.hasChanges;
        current.stripMetadata = this.stripMetadata;
      }
    }

    this.activeFileId = id;
    this.loadFileData(id);
    this.saveSettings();
  }

  private loadFileData(id: string) {
    const file = this.files.find(f => f.id === id);
    if (file) {
      this.jsonInput = file.jsonInput || '';
      // Use a fresh copy to prevent reference pollution
      this.explorerData = file.explorerData ? JSON.parse(JSON.stringify(file.explorerData)) : null;
      this.originalExplorerData = file.originalExplorerData ? JSON.parse(JSON.stringify(file.originalExplorerData)) : null;
      this.bookmarks = file.bookmarks || [];
      this.hasChanges = file.hasChanges || false;
      this.stripMetadata = file.stripMetadata || false;
      
      this.explorerSearchQuery = '';
      this.currentExpansionPath = [];
      this.currentSelectedPath = [];
      this.currentSelectedDisplayPath = [];
      this.isInputLocked = !!this.explorerData; 
    }
  }

  deleteFile(id: string) {
    const index = this.files.findIndex(f => f.id === id);
    if (index > -1) {
      this.files.splice(index, 1);
      this.storageService.deleteFile(id).catch(console.error);
      
      if (this.activeFileId === id) {
        if (this.files.length > 0) {
          this.switchFile(this.files[0].id);
        } else {
          this.createNewFile();
        }
      } else {
        this.saveSettings();
      }
    }
  }

  renameFile(id: string, newName: string) {
    const file = this.files.find(f => f.id === id);
    if (file) {
      file.name = newName;
      this.saveSettings();
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newFile: ExplorerFile = {
          id: 'file_' + new Date().getTime(),
          name: file.name,
          jsonInput: content,
          originalJsonInput: content,
          explorerData: null,
          originalExplorerData: null,
          bookmarks: [],
          hasChanges: false,
          stripMetadata: false
        };
        this.files.push(newFile);
        this.switchFile(newFile.id);
        this.processInput();
      };
      reader.readAsText(file);
    }
  }

  handleValueUpdate(event: { path: string[], value: any }) {
    if (!this.explorerData) return;
    
    // 1. Update the tree structure - start recursion at ['Root'] to match explorer paths
    this.explorerData = this.dataService.replaceAtPaths(this.explorerData, [event.path], event.value, ['Root']);
    
    // 2. Sync back to the input stream string immediately
    this.jsonInput = JSON.stringify(this.explorerData, null, 2);
    this.hasChanges = true;
    
    // 3. Keep the file collection in sync
    const current = this.files.find(f => f.id === this.activeFileId);
    if (current) {
      current.explorerData = JSON.parse(JSON.stringify(this.explorerData));
      current.jsonInput = this.jsonInput;
      current.hasChanges = true;
    }
    
    this.saveSettings();
    this.showMessage("Value updated and synced to input");
  }

  revertChanges() {
    const current = this.files.find(f => f.id === this.activeFileId);
    if (current && current.originalJsonInput) {
      this.jsonInput = current.originalJsonInput;
      
      // Force a UI clear to ensure deep re-render
      this.explorerData = null;
      
      setTimeout(() => {
        this.processInput();
        this.hasChanges = false;
        if (current) current.hasChanges = false;
        this.saveSettings();
        this.showMessage("Changes reverted to original");
      }, 10);
    }
  }

  saveToInput() {
    if (!this.explorerData) return;
    
    const current = this.files.find(f => f.id === this.activeFileId);
    if (current && current.name === 'Untitled Session') {
      const newName = window.prompt("Enter a name for this session:", "My JSON Data");
      if (newName) current.name = newName;
    }

    const json = JSON.stringify(this.explorerData, null, 2);
    this.jsonInput = json;
    
    if (current) {
      current.originalJsonInput = json; // New baseline string
      current.jsonInput = json;
      
      // Crucial: Update the original baseline data to match current edits
      current.explorerData = JSON.parse(JSON.stringify(this.explorerData));
      current.originalExplorerData = JSON.parse(JSON.stringify(this.explorerData));
      current.hasChanges = false;
    }

    this.hasChanges = false;
    this.originalExplorerData = JSON.parse(JSON.stringify(this.explorerData));
    this.saveSettings();
    this.showMessage("Changes saved to session");
  }

  exportJson() {
    if (!this.explorerData) return;
    
    const current = this.files.find(f => f.id === this.activeFileId);
    const fileName = current ? current.name.replace(/[^a-z0-9]/gi, '_').toLowerCase() : 'exported_data';
    
    const json = JSON.stringify(this.explorerData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}_${new Date().getTime()}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this.showMessage("JSON Exported");
  }

  copyJson() {
    if (!this.explorerData) return;
    const json = JSON.stringify(this.explorerData, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      this.showMessage("JSON Copied to clipboard");
    });
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
    this.replaceNewValue = event.oldValue; 
    this.replaceCount = this.dataService.countOccurrences(this.explorerData, event.oldValue);
    this.showReplaceModal = true;
  }

  confirmReplace() {
    if (!this.explorerData) return;
    
    let finalValue = this.replaceNewValue;
    if (typeof this.replaceOldValue === 'number') finalValue = Number(this.replaceNewValue);
    if (typeof this.replaceOldValue === 'boolean') finalValue = String(this.replaceNewValue).toLowerCase() === 'true';

    if (this.showInstancesSidebar && this.selectedInstances.size < this.instancesList.length) {
      const selectedPaths = Array.from(this.selectedInstances).map(ps => JSON.parse(ps));
      this.explorerData = this.dataService.replaceAtPaths(this.explorerData, selectedPaths, finalValue, ['Root']);
      this.showMessage(`Replaced ${this.selectedInstances.size} selected instances`);
      this.viewInstances(this.instanceValue);
    } else {
      this.explorerData = this.dataService.replaceAll(this.explorerData, this.replaceOldValue, finalValue);
      this.showMessage(`Replaced all ${this.replaceCount} instances`);
      if (this.showInstancesSidebar) this.viewInstances(this.instanceValue);
    }
    
    // Sync back to input stream
    this.jsonInput = JSON.stringify(this.explorerData, null, 2);
    this.hasChanges = true;

    const current = this.files.find(f => f.id === this.activeFileId);
    if (current) {
      current.explorerData = JSON.parse(JSON.stringify(this.explorerData));
      current.jsonInput = this.jsonInput;
      current.hasChanges = true;
    }
    
    this.saveSettings();
    this.showReplaceModal = false;
  }

  cancelReplace() {
    this.showReplaceModal = false;
  }

  viewInstances(value: any) {
    this.instanceValue = value;
    this.instancesList = this.dataService.findAllInstances(this.explorerData, value, ['Root']);
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
  }

  onNodeSelect(event: { path: string[], data: any }) {
    this.currentSelectedPath = event.path;
    const displayPath: string[] = [];
    const sourceData = this.getFilteredData() || this.explorerData;
    
    for (let i = 0; i < event.path.length; i++) {
      const segment = event.path[i];
      if (segment === 'Root') {
        displayPath.push('Root');
        continue;
      }

      // For the leaf node (the one actually clicked), we can use the passed event.data
      if (i === event.path.length - 1) {
        const parentPath = event.path.slice(0, i);
        const parentData = this.getValueByPath(sourceData, parentPath);
        const isParentArr = !!(parentData && (Array.isArray(parentData) || parentData.__wasArray));
        displayPath.push(this.dataService.getDisplayLabel(event.data, segment, isParentArr));
      } else {
        // For ancestors, we look up the data
        const parentPath = event.path.slice(0, i);
        const parentData = this.getValueByPath(sourceData, parentPath);
        const currentData = this.getValueByPath(sourceData, event.path.slice(0, i + 1));
        const isParentArr = !!(parentData && (Array.isArray(parentData) || parentData.__wasArray));
        displayPath.push(this.dataService.getDisplayLabel(currentData, segment, isParentArr));
      }
    }
    this.currentSelectedDisplayPath = displayPath;
  }

  private getValueByPath(obj: any, path: string[]): any {
    let current = obj;
    for (const segment of path) {
      if (segment === 'Root') continue;
      if (!current) return null;
      current = current[segment];
    }
    return current;
  }

  startResizing(event: MouseEvent) {
    this.isResizing = true;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = this.bookmarksWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isResizing) return;
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      if (newWidth >= 150 && newWidth <= 600) {
        this.bookmarksWidth = newWidth;
      }
    };
    const onMouseUp = () => {
      this.isResizing = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      this.saveSettings();
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  startVerticalResize(event: MouseEvent) {
    this.isResizingVertical = true;
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = this.filesHeight;
    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!this.isResizingVertical) return;
      const deltaY = moveEvent.clientY - startY;
      const newHeight = startHeight + deltaY;
      if (newHeight >= 100 && newHeight <= 800) {
        this.filesHeight = newHeight;
      }
    };
    const onMouseUp = () => {
      this.isResizingVertical = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }
}
