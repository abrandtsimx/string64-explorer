import { Component, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
    <div class="app-container selection-glow">
      <!-- Subtle Background Glow -->
      <div class="bg-glow">
        <div class="bg-glow-top"></div>
        <div class="bg-glow-bottom"></div>
      </div>

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
                <div class="shimmer-effect"></div>
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
                
                <mat-tab>
                  <ng-template mat-tab-label>
                    <mat-icon style="margin-right: 8px;">account_tree</mat-icon>
                    <span>Explore</span>
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
                <!-- JSON Prettifier Output -->
                <div *ngIf="selectedTabIndex === 0" [innerHTML]="jsonOutput" class="whitespace-pre"></div>

                <!-- Tool Lookup Output -->
                <div *ngIf="selectedTabIndex === 1" class="address-list">
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

                <!-- Explorer Output -->
                <div *ngIf="selectedTabIndex === 2" class="h-full">
                   <app-explorer-node *ngIf="explorerData" [key]="'Root'" [data]="explorerData"></app-explorer-node>
                   <div *ngIf="!explorerData" class="empty-state">
                      <mat-icon class="empty-icon">account_tree</mat-icon>
                      <p class="empty-text">Mapping required</p>
                   </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        
        <footer class="app-footer">
          <p class="footer-brand">
            JSON EXPLORER PRO <span class="footer-version">v4.0.2</span>
          </p>
          <div class="footer-stats">
            <span class="stat-item">
              <span class="status-dot"></span>
              Encrypted Stream
            </span>
            <div class="stat-divider"></div>
            <p class="stat-note">
              Enterprise Logic Core Engine
            </p>
          </div>
        </footer>
      </div>
    </div>
  `
})
export class App {
  private dataService = inject(DataService);

  selectedTabIndex = 0;
  jsonInput = '';
  jsonOutput: any = '';
  statusMessage = '';
  statusType = 'success';
  showStatus = false;
  explorerData: any = null;
  toolAddresses: string[] = [];

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

    if (this.selectedTabIndex === 1) {
      this.toolAddresses = this.dataService.recursiveToolExtract(cleanText);
      if (this.toolAddresses.length > 0) {
        this.showMessage(`Located ${this.toolAddresses.length} addresses`);
      } else {
        this.showMessage("No addresses found", "error");
      }
    } else if (this.selectedTabIndex === 0) {
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
    } else if (this.selectedTabIndex === 2) {
      try {
        let jsonStr = cleanText;
        if (jsonStr.startsWith('"') && !jsonStr.startsWith('{')) jsonStr = '{' + jsonStr + '}';
        const data = JSON.parse(jsonStr);
        this.explorerData = this.dataService.recursivelyDecodeData(data);
        this.showMessage("Data structure mapped");
      } catch (e: any) {
        this.showMessage("Mapping failed", "error");
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
    if (this.selectedTabIndex === 1) {
      text = this.toolAddresses.join('\n');
    } else if (this.selectedTabIndex === 2) {
      text = JSON.stringify(this.explorerData, null, 2);
    } else {
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
    const labels: any = { 0: 'Run Prettifier', 1: 'Extract Addresses', 2: 'Map Explorer' };
    return labels[this.selectedTabIndex];
  }

  getOutputLabel(): string {
    const labels: any = { 0: 'Standardized JSON', 1: 'Discovered Addresses', 2: 'Structure Map' };
    return labels[this.selectedTabIndex];
  }
}
