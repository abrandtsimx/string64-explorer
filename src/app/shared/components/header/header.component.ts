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
        <div class="card-bg-glow"></div>
        
        <div class="brand-section">
          <div class="logo-container">
            <div class="logo-glow"></div>
            <div class="logo-box">
              <mat-icon>dataset</mat-icon>
            </div>
            <div class="status-indicator"></div>
          </div>

          <div class="title-group">
            <div class="title-row">
              <h1 class="main-title">
                JSON <span class="gradient-text">EXPLORER</span>
              </h1>
              <span class="version-tag">v4.0</span>
            </div>
            <p class="subtitle">
              <span class="live-dot">
                <span class="animate-ping absolute inset-0 rounded-full bg-indigo-400" style="opacity: 0.75;"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" style="width: 8px; height: 8px;"></span>
              </span>
              SYSTEM LIVE & ENCRYPTED
            </p>
          </div>
        </div>

        <div class="info-section">
          <div class="info-group">
            <div class="info-item">
              <span class="info-label">System Status</span>
              <span class="info-value text-emerald">
                <mat-icon style="font-size: 12px; width: 12px; height: 12px;">check_circle</mat-icon>
                OPTIMAL
              </span>
            </div>
            <div class="info-divider"></div>
            <div class="info-item">
              <span class="info-label">Security Mode</span>
              <span class="info-value text-indigo">
                <mat-icon style="font-size: 12px; width: 12px; height: 12px;">shield</mat-icon>
                STRICT
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {}
