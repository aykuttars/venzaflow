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
`;
