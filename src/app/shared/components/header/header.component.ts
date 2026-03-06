import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  styleUrl: './header.component.css',
  template: `
    <header class="header-root">
      <div class="header-card">
        <div class="brand-section">
          <div class="logo-box">
            <mat-icon>dataset</mat-icon>
          </div>

          <div class="title-group">
            <div class="title-row">
              <h1 class="main-title">
                JSON <span class="gradient-text">EXPLORER</span>
              </h1>
            </div>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {}
