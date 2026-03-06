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

        <main class="workbench-grid">
          <!-- Input Terminal Panel -->
          <section class="panel">
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
                <span class="relative">{{ getBtnText() }}</span>
                <mat-icon class="relative">bolt</mat-icon>
              </button>
            </div>
          </section>

          <!-- Output/Explorer Panel -->
          <section class="panel">
            <div class="panel-header">
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
                <div *ngIf="selectedTabIndex === 0" class="h-full">
                   <app-explorer-node *ngIf="explorerData" [key]="'Root'" [data]="explorerData"></app-explorer-node>
                   <div *ngIf="!explorerData" class="empty-state">
                      <mat-icon class="empty-icon">account_tree</mat-icon>
                      <p class="empty-text">Mapping required</p>
                   </div>
                </div>

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
        
        <footer class="app-footer">
          <p class="footer-brand">
            JSON EXPLORER
          </p>
        </footer>
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

  ngOnInit() {
    // 1. Initial check for data parameter (?) in search string
    const searchParams = new URLSearchParams(window.location.search);
    const initialQueryData = searchParams.get('data');
    if (initialQueryData) {
      this.jsonInput = decodeURIComponent(initialQueryData);
      this.processInput();
    }

    // 2. Fragment check (#) for longer data from Unity/OpenURL
    // We subscribe to fragmentation changes reactively
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
    let input = this.jsonInput.trim();
    if (!input) return;

    input = this.dataService.decodeIfBase64(input);
    const cleanText = this.dataService.stripMetadata(input);

    this.explorerData = null;
    this.toolAddresses = [];

    if (this.selectedTabIndex === 0) { // Explore
      try {
        let jsonStr = cleanText;
        if (jsonStr.startsWith('"') && !jsonStr.startsWith('{')) jsonStr = '{' + jsonStr + '}';
        const data = JSON.parse(jsonStr);
        this.explorerData = this.dataService.recursivelyDecodeData(data);
        this.showMessage("Data structure mapped");
      } catch (e: any) {
        this.showMessage("Mapping failed", "error");
      }
    } else if (this.selectedTabIndex === 1) { // Format
      try {
        let jsonToParse = cleanText;
        if (jsonToParse.startsWith('"') && !jsonToParse.startsWith('{')) {
          jsonToParse = '{' + jsonToParse + '}';
        }
        const jsonObj = JSON.parse(jsonToParse);
        this.jsonOutput = this.dataService.syntaxHighlight(JSON.stringify(jsonObj, null, 4));
        this.showMessage("Metadata stripped & prettified");
      } catch (err: any) {
        this.jsonOutput = `<span class="text-rose font-bold">PARSE ERROR</span>\n\n${err.message}`;
        this.showMessage("Parsing error", "error");
      }
    } else if (this.selectedTabIndex === 2) { // Extract
      this.toolAddresses = this.dataService.recursiveToolExtract(cleanText);
      if (this.toolAddresses.length > 0) {
        this.showMessage(`Located ${this.toolAddresses.length} addresses`);
      } else {
        this.showMessage("No addresses found", "error");
      }
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
}
