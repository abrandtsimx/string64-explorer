import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { DataService } from '../../../core/services/data.service';

@Component({
  selector: 'app-explorer-node',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  styleUrl: './explorer-node.component.css',
  template: `
    <div class="node-container" [class.target-highlight]="isTarget">
      <div class="node-row" [class.expanded]="expanded" (click)="toggle($event)">
        <div class="icon-wrapper">
          <mat-icon class="arrow-icon" [class.rotated]="expanded">
            {{ isObject ? 'arrow_forward_ios' : 'circle' }}
          </mat-icon>
        </div>
        
        <span class="node-key" [class.array-item-label]="parentIsArray" [innerHTML]="getDisplayHtml()">
        </span>
        
        <ng-container *ngIf="isObject; else valueTemplate">
          <div class="node-meta">
            <span class="type-tag">
              {{ isArray ? 'Array[' + (data.__originalLength || getKeys().length) + ']' : 'Object' }}
            </span>
            <span *ngIf="data.__wasBase64" class="decoded-tag">DECODED</span>
            
            <button class="node-bookmark-btn" [class.active]="isBookmarked" (click)="onToggleBookmark($event)" title="Bookmark this group">
              <mat-icon>{{ isBookmarked ? 'bookmark' : 'bookmark_border' }}</mat-icon>
            </button>
          </div>
        </ng-container>
        
        <ng-template #valueTemplate>
          <div class="node-value-group" (dblclick)="onValueDblClick($event)">
            <span class="colon">:</span>
            
            <!-- Inline Editor -->
            <ng-container *ngIf="editMode; else viewValueTemplate">
              <!-- Boolean Toggle -->
              <div *ngIf="isBoolean" class="inline-toggle" (click)="toggleBoolean($event)">
                <div class="toggle-track" [class.active]="data">
                  <div class="toggle-thumb"></div>
                </div>
                <span [ngClass]="getValueClass()">{{ data }}</span>
              </div>
              
              <!-- Text/Number Input -->
              <textarea *ngIf="!isBoolean && isDescriptionField"
                     [value]="data"
                     (input)="onInputChange($event)"
                     (click)="$event.stopPropagation()"
                     class="inline-textarea custom-scrollbar"
                     [ngClass]="getValueClass()"></textarea>

              <input *ngIf="!isBoolean && !isDescriptionField" 
                     [type]="isNumber ? 'number' : 'text'"
                     [value]="data"
                     (input)="onInputChange($event)"
                     (click)="$event.stopPropagation()"
                     class="inline-input"
                     [ngClass]="getValueClass()">
            </ng-container>

            <ng-template #viewValueTemplate>
              <span [ngClass]="getValueClass()" class="node-value truncate">{{ getValueText() }}</span>
            </ng-template>
            
            <div class="node-actions">
              <button class="node-copy-btn" (click)="$event.stopPropagation(); copyValue($event)" title="Copy value">
                <mat-icon>content_copy</mat-icon>
              </button>
              <button class="node-instances-btn" (click)="$event.stopPropagation(); onViewInstances($event)" title="View all occurrences">
                <mat-icon>visibility</mat-icon>
              </button>
              <button class="node-bookmark-btn" [class.active]="isBookmarked" (click)="onToggleBookmark($event)" title="Bookmark this key">
                <mat-icon>{{ isBookmarked ? 'bookmark' : 'bookmark_border' }}</mat-icon>
              </button>
              <button *ngIf="editMode" class="node-edit-btn" (click)="$event.stopPropagation(); onReplaceAll($event)" title="Replace all instances">
                <mat-icon>find_replace</mat-icon>
              </button>
            </div>
          </div>
        </ng-template>
      </div>
      
      <div class="children-container" *ngIf="isObject && expanded">
        <app-explorer-node 
          *ngFor="let child of getKeys()" 
          [key]="child" 
          [data]="data[child]"
          [parentIsArray]="isArray"
          [editMode]="editMode"
          [expansionPath]="getChildPath()"
          [fullPath]="getFullPath(child)"
          [bookmarks]="bookmarks"
          (jumpTo)="onChildJump($event)"
          (replaceAll)="onChildReplaceAll($event)"
          (viewInstances)="onChildViewInstances($event)"
          (toggleBookmark)="onChildToggleBookmark($event)"
          (select)="onChildSelect($event)"
          (updateValue)="onChildUpdate($event)">
        </app-explorer-node>
      </div>
    </div>
  `,
})
export class ExplorerNodeComponent implements OnChanges {
  private el = inject(ElementRef);
  private dataService = inject(DataService);

  @Input() key: string = '';
  @Input() data: any;
  @Input() parentIsArray = false;
  @Input() editMode = false;
  @Input() expansionPath: string[] = [];
  @Input() fullPath: string[] = [];
  @Input() bookmarks: { path: string[], label: string }[] = [];
  
  @Output() jumpTo = new EventEmitter<string[]>();
  @Output() replaceAll = new EventEmitter<{ oldValue: any, newValue: any }>();
  @Output() viewInstances = new EventEmitter<any>();
  @Output() toggleBookmark = new EventEmitter<{ path: string[], data: any }>();
  @Output() select = new EventEmitter<{ path: string[], data: any }>();
  @Output() updateValue = new EventEmitter<{ path: string[], value: any }>();
  
  expanded = false;
  isTarget = false;
  private hasScrolled = false;

  get isBookmarked(): boolean {
    if (!this.bookmarks || !this.fullPath) return false;
    const myPathStr = JSON.stringify(this.fullPath);
    return this.bookmarks.some(b => JSON.stringify(b.path) === myPathStr);
  }

  get isBoolean(): boolean {
    return typeof this.data === 'boolean';
  }

  get isNumber(): boolean {
    return typeof this.data === 'number';
  }

  get isDescriptionField(): boolean {
    const k = String(this.key).toLowerCase();
    return k.includes('description');
  }

  toggleBoolean(event: MouseEvent) {
    event.stopPropagation();
    this.updateValue.emit({ path: this.fullPath, value: !this.data });
  }

  onInputChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    const typedVal = this.isNumber ? Number(val) : val;
    this.updateValue.emit({ path: this.fullPath, value: typedVal });
  }

  onChildUpdate(event: { path: string[], value: any }) {
    this.updateValue.emit(event);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      if (this.data && this.data.__autoExpand) {
        this.expanded = true;
      }
      
      if (this.data && this.isArray) {
        const dataObj = this.data;
        const keys = Object.keys(dataObj);
        const hasMatchingChild = keys.some(k => 
          !k.startsWith('__') && 
          dataObj[k] && 
          typeof dataObj[k] === 'object' && 
          dataObj[k].__autoExpand
        );
        
        if (hasMatchingChild) {
          this.expanded = true;
        }
      }
    }

    if (changes['expansionPath'] && this.expansionPath) {
      if (this.expansionPath.length > 0) {
        if (this.expansionPath[0] === this.key) {
          if (this.expansionPath.length > 1) {
            this.expanded = true;
            this.isTarget = false;
            this.hasScrolled = false;
          } else {
            this.isTarget = true;
            if (!this.hasScrolled) {
              this.hasScrolled = true;
              setTimeout(() => {
                this.el.nativeElement.scrollIntoView({ behavior: 'auto', block: 'nearest' });
                setTimeout(() => this.isTarget = false, 2000);
              }, 100);
            }
          }
        } else {
          this.expanded = false;
          this.isTarget = false;
          this.hasScrolled = false;
        }
      } else {
        this.hasScrolled = false;
      }
    }
  }

  onValueDblClick(event: MouseEvent) {
    event.stopPropagation();
    this.jumpTo.emit([this.key]);
  }

  onChildJump(path: string[]) {
    this.jumpTo.emit([this.key, ...path]);
  }

  onReplaceAll(event: MouseEvent) {
    event.stopPropagation();
    this.replaceAll.emit({ oldValue: this.data, newValue: null });
  }

  onChildReplaceAll(event: { oldValue: any, newValue: any }) {
    this.replaceAll.emit(event);
  }

  onViewInstances(event: MouseEvent) {
    event.stopPropagation();
    this.viewInstances.emit(this.data);
  }

  onChildViewInstances(value: any) {
    this.viewInstances.emit(value);
  }

  onToggleBookmark(event: MouseEvent) {
    event.stopPropagation();
    this.toggleBookmark.emit({ 
      path: this.fullPath, 
      data: this.data 
    });
  }

  onChildToggleBookmark(event: { path: string[], data: any }) {
    this.toggleBookmark.emit(event);
  }

  onChildSelect(event: { path: string[], data: any }) {
    this.select.emit(event);
  }

  getFullPath(childKey: string): string[] {
    return [...this.fullPath, childKey];
  }

  checkChildBookmark(childKey: string): boolean {
    if (!this.bookmarks) return false;
    const childPath = JSON.stringify([...this.fullPath, childKey]);
    return this.bookmarks.some(b => JSON.stringify(b.path) === childPath);
  }

  copyValue(event: MouseEvent) {
    event.stopPropagation();
    if (this.data !== null && this.data !== undefined) {
      navigator.clipboard.writeText(String(this.data));
    }
  }

  getChildPath(): string[] {
    if (this.expansionPath && this.expansionPath.length > 1 && this.expansionPath[0] === this.key) {
      return this.expansionPath.slice(1);
    }
    return [];
  }

  get isObject(): boolean {
    return typeof this.data === 'object' && this.data !== null;
  }

  get isArray(): boolean {
    return Array.isArray(this.data) || (this.data && this.data.__wasArray);
  }

  toggle(event: MouseEvent) {
    if (this.isObject) {
      event.stopPropagation();
      this.expanded = !this.expanded;
    }
    // Always emit select when any node row is clicked
    this.select.emit({ path: this.fullPath, data: this.data });
  }

  getDisplayHtml(): string {
    const raw = this.dataService.getDisplayLabel(this.data, this.key, this.parentIsArray);
    
    // If it has the " | " separator, wrap the ID part in a colored span
    if (raw.includes(' | ')) {
      // Handle cases like "[0] 1234 | Name" or "1234 | Name"
      const prefixMatch = raw.match(/^(\[\d+\]\s+)?(.*)$/);
      if (prefixMatch) {
        const prefix = prefixMatch[1] || '';
        const body = prefixMatch[2];
        if (body.includes(' | ')) {
          const parts = body.split(' | ');
          return `${prefix}<span class="id-segment">${parts[0]}</span> | ${parts[1]}`;
        }
      }
    }

    return raw;
  }

  getKeys(): string[] {
    if (!this.isObject) return [];
    return Object.keys(this.data).filter(k => !k.startsWith('__'));
  }

  getValueClass(): string {
    if (typeof this.data === 'string') return 'token-string';
    if (typeof this.data === 'number') return 'token-number';
    if (typeof this.data === 'boolean') return 'token-boolean';
    if (this.data === null) return 'token-null';
    return '';
  }

  getValueText(): string {
    if (typeof this.data === 'string') return `"${this.data}"`;
    return String(this.data);
  }
}
