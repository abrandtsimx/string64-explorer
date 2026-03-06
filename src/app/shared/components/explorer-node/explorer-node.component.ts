import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-explorer-node',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  styleUrl: './explorer-node.component.css',
  template: `
    <div class="node-container">
      <div class="node-row" [class.expanded]="expanded" (click)="toggle($event)">
        <div class="icon-wrapper">
          <mat-icon class="arrow-icon" [class.rotated]="expanded">
            {{ isObject ? 'arrow_forward_ios' : 'circle' }}
          </mat-icon>
        </div>
        
        <span class="node-key">{{ key }}</span>
        
        <ng-container *ngIf="isObject; else valueTemplate">
          <div class="node-meta">
            <span class="type-tag">
              {{ isArray ? 'Array[' + getKeys().length + ']' : 'Object' }}
            </span>
            <span *ngIf="data.__wasBase64" class="decoded-tag">DECODED</span>
          </div>
        </ng-container>
        
        <ng-template #valueTemplate>
          <div class="node-value-group">
            <span class="colon">:</span>
            <span [ngClass]="getValueClass()" class="node-value truncate">{{ getValueText() }}</span>
          </div>
        </ng-template>
      </div>
      
      <div class="children-container" *ngIf="isObject && expanded">
        <app-explorer-node 
          *ngFor="let child of getKeys()" 
          [key]="child" 
          [data]="data[child]">
        </app-explorer-node>
      </div>
    </div>
  `
})
export class ExplorerNodeComponent {
  @Input() key: string = '';
  @Input() data: any;
  expanded = false;

  get isObject(): boolean {
    return typeof this.data === 'object' && this.data !== null;
  }

  get isArray(): boolean {
    return Array.isArray(this.data);
  }

  toggle(event: MouseEvent) {
    if (this.isObject) {
      event.stopPropagation();
      this.expanded = !this.expanded;
    }
  }

  getKeys(): string[] {
    if (!this.isObject) return [];
    return Object.keys(this.data).filter(k => k !== '__wasBase64');
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
