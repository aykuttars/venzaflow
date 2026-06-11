export const CRUD_DIALOG_STYLES = `
  table.bms-table th, table.bms-table td { padding: 10px 12px; }
  table.bms-table thead { background: rgba(0,0,0,.04); }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    backdrop-filter: blur(2px);
    z-index: 10;
  }

  .dialog {
    position: fixed;
    z-index: 11;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    background: white;
    min-width: min(640px, 96vw);
    max-width: 720px;
    width: 100%;
    max-height: 90vh;
    padding: 24px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    box-sizing: border-box;
  }

  .dialog form {
    min-width: 0;
    width: 100%;
  }

  .dialog mat-form-field {
    width: 100%;
    min-width: 0;
  }

  .dialog:has(.dialog__body) {
    padding: 0;
    overflow: hidden;
  }

  .dialog:has(.dialog__body) form {
    display: flex;
    flex-direction: column;
    max-height: 90vh;
    min-height: 0;
  }

  .dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 20px 24px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .dialog__header-main {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    min-width: 0;
    flex: 1;
  }

  .dialog__header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
    line-height: 1.3;
  }

  .dialog__header-with-avatar {
    align-items: flex-start;
  }

  .dialog__header-text {
    flex: 1;
    min-width: 0;
  }

  .dialog__header-meta {
    font-size: 13px;
    opacity: 0.75;
    margin-top: 4px;
  }

  .dialog__header-actions {
    margin-top: 12px;
  }

  .dialog__header-avatar {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  .dialog__close {
    margin-top: 4px;
  }

  .dialog__header-edit {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .dialog__header-edit h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
  }

  .overview-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
  }

  .overview-header__title {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }

  .overview-grid {
    display: grid;
    gap: 16px;
  }

  .overview-card mat-card-content {
    padding-top: 8px;
  }

  .overview-field {
    display: grid;
    grid-template-columns: 140px 1fr;
    gap: 8px 12px;
    padding: 6px 0;
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    font-size: 14px;
  }

  .overview-field:last-child {
    border-bottom: none;
  }

  .overview-field__label {
    opacity: 0.7;
    font-size: 13px;
  }

  .overview-field__value {
    margin: 0;
  }

  .records-tab__toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .records-tab__section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .records-panel-title {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
  }

  .records-panel-title__amount {
    margin-left: auto;
    font-weight: 600;
  }

  .oral-tooth-panel {
    max-height: 280px;
    overflow-y: auto;
  }

  .dialog--patient-detail .oral-tooth-panel {
    max-height: 220px;
  }

  .dialog__active-toggle {
    flex-shrink: 0;
    font-size: 14px;
  }

  .dialog__body {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 24px;
  }

  .dialog__footer {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    padding: 12px 24px 20px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    background: white;
    position: sticky;
    bottom: 0;
  }

  .dialog__section {
    margin-bottom: 24px;
  }

  .dialog__section:last-child {
    margin-bottom: 0;
  }

  .dialog__section + .dialog__section {
    margin-top: 8px;
  }

  .dialog__section-title {
    margin: 0 0 16px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: rgba(0, 0, 0, 0.65);
  }

  .dialog__section-fields {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .dialog__row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 16px;
  }

  @media (max-width: 520px) {
    .dialog__row {
      grid-template-columns: 1fr;
    }
  }

  .dialog--patient-detail {
    min-width: min(960px, 96vw);
    max-width: min(1200px, 96vw);
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 92vh;
  }

  .dialog--form {
    padding: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .dialog--form .dialog__header-edit {
    flex-shrink: 0;
    margin-bottom: 0;
    padding: 24px 24px 0;
  }

  .dialog--form .dialog__body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px 24px 24px;
  }

  .overview-layout {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .overview-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  @media (max-width: 720px) {
    .overview-stats { grid-template-columns: 1fr; }
  }

  .overview-stat {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px 16px;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    border: 1px solid rgba(0, 0, 0, 0.06);
  }

  .overview-stat mat-icon {
    color: #5c6bc0;
    flex-shrink: 0;
  }

  .overview-stat--ok mat-icon { color: #2e7d32; }
  .overview-stat--warn mat-icon { color: #ef6c00; }

  .overview-stat__label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.6;
    margin-bottom: 2px;
  }

  .overview-stat__sub {
    font-size: 12px;
    opacity: 0.65;
    margin-left: 4px;
    font-weight: 400;
  }

  .overview-grid--2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }

  @media (max-width: 800px) {
    .overview-grid--2col { grid-template-columns: 1fr; }
  }

  .overview-tile {
    border-radius: 12px !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) !important;
    overflow: hidden;
  }

  .overview-tile--wide {
    grid-column: 1 / -1;
  }

  .overview-tile__head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #fff;
  }

  .overview-tile__head mat-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;
  }

  .overview-tile__head--identity { background: linear-gradient(90deg, #3949ab, #5c6bc0); }
  .overview-tile__head--contact { background: linear-gradient(90deg, #00838f, #26a69a); }
  .overview-tile__head--address { background: linear-gradient(90deg, #6d4c41, #8d6e63); }
  .overview-tile__head--work { background: linear-gradient(90deg, #455a64, #607d8b); }

  .overview-tile mat-card-content {
    padding: 8px 0 !important;
  }

  .overview-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
  }

  .overview-row__icon {
    color: rgba(0, 0, 0, 0.45);
    flex-shrink: 0;
    margin-top: 2px;
  }

  .overview-row__label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    opacity: 0.55;
    margin-bottom: 2px;
  }

  .overview-row__value {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    word-break: break-word;
  }

  .overview-row__value--mono {
    font-family: ui-monospace, monospace;
    letter-spacing: 0.02em;
  }

  .overview-row__value a {
    color: #3949ab;
    text-decoration: none;
  }

  .overview-row__value a:hover {
    text-decoration: underline;
  }

  .overview-address-box {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin: 12px 16px 16px;
    padding: 14px 16px;
    background: #f5f7fa;
    border-radius: 10px;
    border-left: 4px solid #5c6bc0;
  }

  .overview-address-box mat-icon {
    color: #5c6bc0;
    flex-shrink: 0;
  }

  .overview-address-box p {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
    color: rgba(0, 0, 0, 0.8);
  }

  .patient-name-link {
    cursor: pointer;
    color: inherit;
    text-decoration: none;
  }

  .patient-name-link:hover {
    color: #3f51b5;
    text-decoration: underline;
  }
`;

export const PATIENT_DETAIL_DIALOG_STYLES = `
  :host {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  .patient-detail-header {
    position: relative;
    flex-shrink: 0;
    padding: 20px 24px 18px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    background: #fff;
  }

  .patient-detail-header__close {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2;
  }

  .patient-detail-header__body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding-right: 36px;
  }

  .patient-detail-header__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .patient-detail-header__line {
    margin: 0;
    width: 100%;
    max-width: 100%;
    line-height: 1.3;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .patient-detail-header__line--name {
    font-size: 28px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
  }

  .patient-detail-header__line--meta {
    font-size: 16px;
    font-weight: 400;
    color: rgba(0, 0, 0, 0.72);
  }

  .patient-detail-header__rule {
    width: 100%;
    margin: 10px 0;
    border: none;
    border-top: 1px solid rgba(0, 0, 0, 0.12);
  }

  .patient-detail-header__avatar {
    flex-shrink: 0;
  }

  .dialog__body-tabs {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .patient-detail-tabs {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .patient-detail-tabs ::ng-deep .mat-mdc-tab-header {
    flex-shrink: 0;
    background: #fff;
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
  }

  .patient-detail-tabs ::ng-deep .mat-mdc-tab-body-wrapper {
    flex: 1;
    min-height: 0;
  }

  .patient-detail-tabs ::ng-deep .mat-mdc-tab-body-content {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 20px 24px 28px;
    background: #f5f7fa;
  }

  .patient-detail-tabs ::ng-deep .mat-mdc-tab-group {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .patient-detail-tabs__icon {
    margin-right: 6px;
    font-size: 18px;
    width: 18px;
    height: 18px;
    vertical-align: middle;
  }

  .patient-detail-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 48px;
    color: rgba(0, 0, 0, 0.55);
  }

  @media (max-width: 640px) {
    .patient-detail-header__line--name {
      font-size: 22px;
    }

    .patient-detail-header__line--meta {
      font-size: 14px;
    }
  }
`;
