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
            <img src="simx-logo.png" alt="SimX Logo" class="brand-logo">
          </div>

          <div class="title-group" (mousemove)="onMouseMove($event)">
            <h1 class="main-title">
              JSON EXPLORER
            </h1>
          </div>
        </div>
      </div>
    </header>
  `
})
export class HeaderComponent {
  onMouseMove(e: MouseEvent) {
    const group = e.currentTarget as HTMLElement;
    const title = group.querySelector('.main-title') as HTMLElement;
    if (!title) return;

    const rect = title.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    title.style.setProperty('--mouse-x', `${x}px`);
    title.style.setProperty('--mouse-y', `${y}px`);
  }
}
