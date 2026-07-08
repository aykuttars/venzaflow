import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslateModule } from '@ngx-translate/core';

const GUIDE_TITLES: Record<string, string> = {
  'stok-hizli-baslangic': 'Stok — Hızlı Başlangıç',
  'stok-gelismis': 'Stok — Gelişmiş Kullanım',
  'barkod-rehberi': 'Barkod Rehberi',
  'satis-ve-stok-dusumu': 'Satış ve Stok Düşümü',
  sss: 'Sık Sorulan Sorular',
};

@Component({
  selector: 'app-help-page',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, TranslateModule],
  template: `
    <div class="page" style="max-width:900px;margin:0 auto;padding:24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <a mat-icon-button routerLink="/dashboard"><mat-icon>arrow_back</mat-icon></a>
        <h1 style="margin:0">{{ title() }}</h1>
      </div>
      <mat-card style="padding:24px">
        @if (loading()) {
        <p>{{ 'common.loading' | translate }}</p>
        } @else if (error()) {
        <p>{{ error() }}</p>
        } @else {
        <article class="help-md" [innerHTML]="html()"></article>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .help-md :is(h1,h2,h3) { margin-top: 1.2em; }
      .help-md p, .help-md li { line-height: 1.6; }
      .help-md table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      .help-md th, .help-md td { border: 1px solid rgba(0,0,0,0.12); padding: 8px; text-align: left; }
      .help-md code { background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px; }
    `,
  ],
})
export class HelpPageComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);

  title = signal('');
  html = signal('');
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('guide') || 'stok-hizli-baslangic';
      this.title.set(GUIDE_TITLES[slug] || slug);
      this.loading.set(true);
      this.http.get(`/assets/user-guides/${slug}.md`, { responseType: 'text' }).subscribe({
        next: (md) => {
          this.html.set(this.simpleMarkdown(md));
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Rehber bulunamadı.');
          this.loading.set(false);
        },
      });
    });
  }

  /** Lightweight markdown → HTML (headings, lists, tables, bold, code). */
  private simpleMarkdown(src: string): string {
    let html = src
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`);
    html = html.replace(/^\|(.+)\|$/gm, (line) => {
      const cells = line.split('|').filter(Boolean).map((c) => c.trim());
      if (cells.every((c) => /^[-:]+$/.test(c))) return '';
      const tag = cells.some((c) => c.includes('---')) ? null : 'td';
      if (!tag) return '';
      return `<tr>${cells.map((c) => `<${tag}>${c}</${tag}>`).join('')}</tr>`;
    });
    html = html.replace(/(<tr>.*<\/tr>\n?)+/g, (m) => `<table>${m}</table>`);
    html = html.replace(/^(?!<[hulot]|<li|<tr)(.+)$/gm, '<p>$1</p>');
    return html;
  }
}
